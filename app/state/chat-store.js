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

// ---- read ----

// Returns { ok, store, served } where served is 'current' | 'prev' | 'none'.
// Falls back to the prior generation ONLY when the current file is
// unreadable/corrupt (a missing store is 'none', not a fallback).
function readStore(file) {
  const cur = atomic.readJson(file);
  if (cur.ok) return { ok: true, store: cur.data, served: 'current' };
  if (cur.missing) return { ok: true, store: null, served: 'none' };
  const prev = atomic.readPrevJson(file);
  if (prev.ok) return { ok: true, store: prev.data, served: 'prev', currentError: cur.error };
  return { ok: false, error: 'store_and_prev_unreadable', currentError: cur.error, prevError: prev.error };
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
  readStore, resolveProjectId, initStore,
  createChat, appendMessage, updateChatMetadata, renameChat, deleteChat, setActiveChat,
};
