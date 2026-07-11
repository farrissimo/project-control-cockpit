// chat-store.js — main-process-only canonical chat store (PCC data-truth
// recovery, Phase 2A slice 2). Built ON atomic-store.js. Pure Node (fs/path/
// crypto + atomic-store): NO Electron, NO renderer. Unit-testable against a
// throwaway temp file. ADDITIVE and UNWIRED in this slice — nothing in the app
// calls it yet, and it never touches real chat data.
//
// WHY: chats today are authoritative in localStorage (renderer) and mirrored to
// backup.json by a whole-array overwrite that a partial renderer list can
// clobber. This module makes <project>/.cockpit/chats/chats.json the single
// main-owned authority, mutated ONLY by narrow, revision-checked commands — the
// renderer can never submit a replacement chat collection, so a renderer that has
// dropped chats can never shrink the store.
//
// SCHEMA (v1):
//   { schemaVersion:1, projectId, revision:<monotonic int>, createdAt, updatedAt,
//     activeChatId:<id|null>,
//     chats:[ { id, name, started, messages:[{id, cls, text, ts}],
//               createdAt, updatedAt, nameLocked?, buildChat?, buildName? } ] }
//
// CONCURRENCY: every mutation is read -> apply narrow op -> validate -> bump
// revision -> atomic write -> reread-verify. Optimistic concurrency: the caller
// passes expectedRevision; if it does not match the store's current revision the
// write is REJECTED with { conflict:true, currentRevision }. Single-writer +
// atomicity come from atomic-store; this layer adds the revision CAS.
//
// createdAt is immutable. Any accepted mutation updates both the touched chat's
// updatedAt and the store's updatedAt.

const path = require('path');
const crypto = require('crypto');
const atomic = require('./atomic-store');

const SCHEMA_VERSION = 1;

// Chat metadata that updateChatMetadata may set — deliberately NOT name (use
// renameChat), messages (use appendMessage), id, or createdAt.
const ALLOWED_META_FIELDS = ['started', 'buildChat', 'buildName'];

function _now(opts) { return (opts && typeof opts.now === 'number') ? opts.now : Date.now(); }

// ---- structural validation (the persisted-store schema authority) ----
//
// atomic-store guarantees only that a file is PARSEABLE JSON; it says nothing
// about shape. This is the SINGLE place that decides whether a parsed object is a
// structurally valid v1 store. Without it, a parseable-but-malformed store (e.g.
// chats is a string, or a chat is missing its messages array) would be served to
// the renderer as authoritative — which silently renders as an EMPTY chat list
// (false-empty) and, worse, masks a good prior generation. So a structurally
// invalid store must NEVER be served as 'current' or mutated in place.
//
// Layering: this checks SHAPE only. Project-identity binding (projectId must match
// the ACTIVE project) is a separate concern owned by chat-service, so a
// legitimately null projectId (an initStore with no id) is shape-valid here.

function _isPlainObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }

// Returns null if the chat is well-shaped, else a short reason string.
function _validateChatShape(c) {
  if (!_isPlainObject(c)) return 'chat_not_object';
  if (typeof c.id !== 'string' || !c.id) return 'chat_id';
  if (typeof c.name !== 'string') return 'chat_name';
  if (typeof c.started !== 'boolean') return 'chat_started';
  // Number.isFinite (not typeof === 'number'): NaN and Infinity ARE typeof number
  // but are not real timestamps, and JSON serialization turns them into null — so
  // a typeof check would admit an in-memory NaN/Infinity that then corrupts the
  // persisted value. Reject them here (composes with _commit's pre-write check to
  // guarantee a NaN/Infinity timestamp can never reach the file).
  if (!Number.isFinite(c.createdAt) || !Number.isFinite(c.updatedAt)) return 'chat_timestamps';
  if (!Array.isArray(c.messages)) return 'chat_messages_not_array';
  const seen = new Set();
  for (const m of c.messages) {
    if (!_isPlainObject(m)) return 'message_not_object';
    // id + ts are what appendMessage/buildStore GUARANTEE (id required; ts always
    // coerced to a number). cls/text are pass-through, so validate them only when
    // present — requiring them would reject a message this module itself writes.
    if (typeof m.id !== 'string' || !m.id) return 'message_id';
    if (seen.has(m.id)) return 'duplicate_message_id';
    seen.add(m.id);
    if (!Number.isFinite(m.ts)) return 'message_ts';
    if (m.cls !== undefined && typeof m.cls !== 'string') return 'message_cls';
    if (m.text !== undefined && typeof m.text !== 'string') return 'message_text';
  }
  // Optional metadata — typed only when present (matches this module's writers).
  if (c.nameLocked !== undefined && typeof c.nameLocked !== 'boolean') return 'chat_nameLocked';
  if (c.buildChat !== undefined && typeof c.buildChat !== 'boolean') return 'chat_buildChat';
  if (c.buildName !== undefined && typeof c.buildName !== 'string') return 'chat_buildName';
  return null;
}

// Returns { ok:true } | { ok:false, error, detail?, chatId? }. Never throws.
function validateStore(store) {
  if (!_isPlainObject(store)) return { ok: false, error: 'store_not_object' };
  if (store.schemaVersion !== SCHEMA_VERSION) return { ok: false, error: 'schema_version', detail: store.schemaVersion };
  if (!(store.projectId === null || (typeof store.projectId === 'string' && store.projectId))) return { ok: false, error: 'project_id' };
  if (!Number.isInteger(store.revision) || store.revision < 1) return { ok: false, error: 'revision', detail: store.revision };
  if (!Number.isFinite(store.createdAt) || !Number.isFinite(store.updatedAt)) return { ok: false, error: 'store_timestamps' };
  if (!(store.activeChatId === null || typeof store.activeChatId === 'string')) return { ok: false, error: 'active_chat_id' };
  if (!Array.isArray(store.chats)) return { ok: false, error: 'chats_not_an_array' };
  const ids = new Set();
  for (const c of store.chats) {
    const reason = _validateChatShape(c);
    if (reason) return { ok: false, error: reason, chatId: (_isPlainObject(c) ? c.id : undefined) };
    if (ids.has(c.id)) return { ok: false, error: 'duplicate_chat_id', chatId: c.id };
    ids.add(c.id);
  }
  // A NON-null activeChatId MUST reference an existing chat. A dangling selection
  // is an internally inconsistent store — fail closed rather than let a consumer
  // silently substitute a different chat (e.g. the first) for the missing id. The
  // module's own writers uphold this (setActiveChat rejects unknown ids; deleteChat
  // clears the selection when it removes the active chat).
  if (store.activeChatId !== null && !ids.has(store.activeChatId)) {
    return { ok: false, error: 'active_chat_dangling', chatId: store.activeChatId };
  }
  return { ok: true };
}

// ---- read ----

// Returns { ok, store, served } where served is 'current' | 'prev' | 'none'.
// Falls back to the prior generation when the current file is unreadable/corrupt
// OR parseable-but-structurally-invalid (a missing store is 'none', not a
// fallback). A store is served ONLY if it passes validateStore — a malformed
// current can never be presented as authoritative, and can never shadow a valid
// .prev.
function readStore(file) {
  const cur = atomic.readJson(file);
  if (cur.ok) {
    const v = validateStore(cur.data);
    if (v.ok) return { ok: true, store: cur.data, served: 'current' };
    // Parseable but structurally invalid — treat exactly like a corrupt current.
    return _servePrev(file, 'invalid:' + v.error);
  }
  if (cur.missing) return { ok: true, store: null, served: 'none' };
  return _servePrev(file, cur.error);
}

// Serve the prior generation ONLY if it too is a structurally valid store; else
// fail closed (never return a malformed .prev as though it were good data).
function _servePrev(file, currentError) {
  const prev = atomic.readPrevJson(file);
  if (prev.ok) {
    const pv = validateStore(prev.data);
    if (pv.ok) return { ok: true, store: prev.data, served: 'prev', currentError };
    return { ok: false, error: 'store_and_prev_unreadable', currentError, prevError: 'invalid:' + pv.error };
  }
  return { ok: false, error: 'store_and_prev_unreadable', currentError, prevError: prev.error };
}

// ---- project identity (Codex: stable id, not a path hash; minted file is
// authoritative ONLY when project-state.json is absent; disagreement fails closed) ----

function resolveProjectId(projectDir, opts) {
  const psPath = path.join(projectDir, '.cockpit', 'state', 'project-state.json');
  const idPath = path.join(projectDir, '.cockpit', 'state', 'project-id.json');
  const ps = atomic.readJson(psPath);
  const mint = atomic.readJson(idPath);
  const psId = (ps.ok && ps.data && typeof ps.data.project_id === 'string' && ps.data.project_id) ? ps.data.project_id : null;
  const mintId = (mint.ok && mint.data && typeof mint.data.projectId === 'string' && mint.data.projectId) ? mint.data.projectId : null;

  if (psId) {
    if (mintId && mintId !== psId) {
      return { ok: false, error: 'project_id_conflict', projectStateId: psId, mintedId: mintId };
    }
    return { ok: true, projectId: psId, source: 'project-state' };
  }
  if (mintId) return { ok: true, projectId: mintId, source: 'minted' };

  // No id anywhere — mint one durably (persist once).
  const projectId = 'proj-' + crypto.randomUUID();
  const w = atomic.writeJsonAtomic(idPath, { projectId, mintedAt: _now(opts) });
  if (!w.ok) return { ok: false, error: 'mint_failed: ' + w.error };
  return { ok: true, projectId, source: 'minted-new' };
}

// ---- init ----

function initStore(file, projectId, opts) {
  const now = _now(opts);
  const existing = readStore(file);
  if (!existing.ok) return { ok: false, error: existing.error };
  if (existing.store) return { ok: true, already: true, revision: existing.store.revision };
  const store = {
    schemaVersion: SCHEMA_VERSION, projectId: projectId || null,
    revision: 1, createdAt: now, updatedAt: now, activeChatId: null, chats: [],
  };
  const w = atomic.writeJsonAtomic(file, store);
  if (!w.ok) return { ok: false, error: 'write_failed: ' + w.error };
  return { ok: true, created: true, revision: 1 };
}

// ---- shared mutation guard ----

// Load + validate schema/project/revision. Returns { ok, store } or a reject.
function _load(file, expectedRevision, opts) {
  // Mutations operate ONLY on the CURRENT generation — never the .prev fallback.
  // A corrupt current file may hide newer data; committing from the prior
  // generation would silently lose it. So read current strictly: missing -> no
  // store; unreadable/corrupt -> FAIL CLOSED (recovery from .prev is a separate,
  // deliberate operation, not a silent mutation path).
  const cur = atomic.readJson(file);
  if (cur.missing) return { ok: false, error: 'no_store' };
  if (!cur.ok) return { ok: false, error: 'store_corrupt', detail: cur.error };
  const store = cur.data;
  if (store.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: 'schema_mismatch', needsMigration: true, currentSchema: store.schemaVersion };
  }
  // Parseable + correct schemaVersion is NOT enough: a structurally malformed
  // store (e.g. chats not an array) would make the command throw mid-mutation.
  // Validate the full shape and FAIL CLOSED before touching any chat.
  const v = validateStore(store);
  if (!v.ok) return { ok: false, error: 'store_invalid', detail: v.error, chatId: v.chatId };
  if (opts && opts.expectedProjectId && store.projectId !== opts.expectedProjectId) {
    return { ok: false, error: 'project_mismatch', storeProjectId: store.projectId };
  }
  // CAS is MANDATORY: a caller must prove it read the current revision. Missing or
  // non-integer expectedRevision is rejected outright (never silently unchecked),
  // so a stale renderer can never mutate — let alone shrink — the store.
  if (!Number.isInteger(expectedRevision)) {
    return { ok: false, error: 'revision_required' };
  }
  if (store.revision !== expectedRevision) {
    return { ok: false, conflict: true, currentRevision: store.revision };
  }
  return { ok: true, store: store };
}

// Bump revision + store.updatedAt, atomic-write, then reread to confirm.
function _commit(file, store, now) {
  store.revision += 1;
  store.updatedAt = now;
  // Validate the FULLY-MUTATED store BEFORE writing. Every command mutator funnels
  // through here, and they pass caller data through (a bad-typed message field, a
  // non-string chat id/name, a wrong-typed metadata value). A command that would
  // produce a structurally invalid store must FAIL CLOSED without touching disk —
  // never write-then-discover-on-reread, which would leave an invalid CURRENT
  // generation that only .prev could recover.
  const v = validateStore(store);
  if (!v.ok) return { ok: false, error: 'would_corrupt', detail: v.error, chatId: v.chatId };
  const w = atomic.writeJsonAtomic(file, store);
  if (!w.ok) return { ok: false, error: 'write_failed: ' + w.error };
  const back = readStore(file);
  if (!back.ok || !back.store || back.store.revision !== store.revision) {
    return { ok: false, error: 'verify_failed' };
  }
  return { ok: true, revision: store.revision };
}

// ---- command-shaped mutations (no whole-array / whole-chat replace) ----

function createChat(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const id = (args && args.id) || crypto.randomUUID();
  if (L.store.chats.some((c) => c.id === id)) return { ok: false, error: 'duplicate_chat_id' };
  L.store.chats.push({
    id, name: (args && args.name) || 'New chat', started: false,
    messages: [], createdAt: now, updatedAt: now,
  });
  const c = _commit(file, L.store, now); if (!c.ok) return c;
  return { ok: true, revision: c.revision, chatId: id };
}

function appendMessage(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const chat = L.store.chats.find((c) => c.id === (args && args.chatId));
  if (!chat) return { ok: false, error: 'no_such_chat' };
  const m = (args && args.message) || {};
  if (!m.id) return { ok: false, error: 'message_id_required' };
  // Idempotent by message id: appending the same message again is a no-op, never
  // a duplicate. No write, no revision bump.
  if (chat.messages.some((x) => x.id === m.id)) return { ok: true, revision: L.store.revision, noop: true };
  chat.messages.push({ id: m.id, cls: m.cls, text: m.text, ts: (typeof m.ts === 'number' ? m.ts : now) });
  chat.started = true;
  chat.updatedAt = now;
  return _commit(file, L.store, now);
}

function updateChatMetadata(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const chat = L.store.chats.find((c) => c.id === (args && args.chatId));
  if (!chat) return { ok: false, error: 'no_such_chat' };
  const fields = (args && args.fields) || {};
  const keys = Object.keys(fields);
  if (!keys.length) return { ok: false, error: 'no_fields' };
  for (const k of keys) if (ALLOWED_META_FIELDS.indexOf(k) < 0) return { ok: false, error: 'field_not_allowed: ' + k };
  for (const k of keys) chat[k] = fields[k];
  chat.updatedAt = now;
  return _commit(file, L.store, now);
}

function renameChat(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const chat = L.store.chats.find((c) => c.id === (args && args.chatId));
  if (!chat) return { ok: false, error: 'no_such_chat' };
  const name = String((args && args.name) || '').trim();
  if (!name) return { ok: false, error: 'empty_name' };
  chat.name = name.slice(0, 200);
  // A hand-set name LOCKS the title (default). Auto-naming passes { lock:false } so
  // the title can still be refined later without being treated as owner intent.
  if (!args || args.lock !== false) chat.nameLocked = true;
  chat.updatedAt = now;
  return _commit(file, L.store, now);
}

// Removes the chat from chats.json ONLY. Per Codex: this slice does NOT touch the
// per-chat .cockpit/chats/<id>/ transcript+summary files — that reconciliation
// belongs to later migration/wiring.
function deleteChat(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const idx = L.store.chats.findIndex((c) => c.id === (args && args.chatId));
  if (idx < 0) return { ok: false, error: 'no_such_chat' };
  L.store.chats.splice(idx, 1);
  if (L.store.activeChatId === (args && args.chatId)) L.store.activeChatId = null;
  return _commit(file, L.store, now);
}

// Canonical active-chat selection. Participates in CAS and bumps revision (it is
// persisted state). null clears the selection.
function setActiveChat(file, expectedRevision, args, opts) {
  const now = _now(opts);
  const L = _load(file, expectedRevision, opts); if (!L.ok) return L;
  const id = (args && Object.prototype.hasOwnProperty.call(args, 'chatId')) ? args.chatId : undefined;
  if (id === undefined) return { ok: false, error: 'chatId_required' };
  if (id !== null && !L.store.chats.some((c) => c.id === id)) return { ok: false, error: 'no_such_chat' };
  L.store.activeChatId = id;
  return _commit(file, L.store, now);
}

module.exports = {
  SCHEMA_VERSION,
  validateStore,
  readStore, resolveProjectId, initStore,
  createChat, appendMessage, updateChatMetadata, renameChat, deleteChat, setActiveChat,
};
