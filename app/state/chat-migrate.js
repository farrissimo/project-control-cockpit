// chat-migrate.js — one-time, FAIL-CLOSED migration planner for the canonical
// chat store (PCC data-truth recovery, Phase 2A slice 3). Pure: takes in-memory
// snapshots and returns either a store to write or a conflict; does NO file IO
// and NO wiring (the read-localStorage / write-chats.json bootstrap seam is S4/S5).
// Unit-tested on synthetic fixtures only; never touches real chat data.
//
// INPUTS (per Codex): the untouched legacy localStorage snapshot for this project
// and backup.json. Per-chat transcripts are recovery EVIDENCE only, never an
// automatic authority, so they are not consumed here.
//
// INPUT VALIDATION (fail closed, before any reconcile/build): localChats and
// backupChats must be arrays; every non-disposable chat must be an object with a
// usable string id; every id-bearing chat must have an ARRAY messages; every
// message must be an object with legacy-typed identity fields (cls:string,
// text:string, ts:number) and, when present, a unique string id within the chat;
// projectId must be a nonempty string before a store is produced. A malformed real
// value is NEVER silently normalized to now/empty/default — it fails closed.
//
// RECONCILE RULES, per matching chat id (message identity = cls + text + ts):
//   - present in only one source            -> accept it
//   - identical histories                   -> accept; metadata is LOSSLESSLY
//                                              field-merged (conflict on difference)
//   - one history is a strict PREFIX of the -> accept the LONGER, record provenance
//     other; overlap + metadata field-merged losslessly
//   - histories diverge at a shared index,  -> CONFLICT
//     or earlier messages differ
// ANY conflict or malformation FAILS the whole migration: no canonical store is
// produced, both sources are preserved for the owner to reconcile. (Never guess.)

const crypto = require('crypto');
const { SCHEMA_VERSION } = require('./chat-store');

function _msgEq(a, b) {
  return a && b && a.cls === b.cls && a.text === b.text && a.ts === b.ts;
}

// 'identical' | 'a-longer' | 'b-longer' | 'diverge'
function _compareHistories(a, b) {
  a = a || []; b = b || [];
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (!_msgEq(a[i], b[i])) return 'diverge';
  if (a.length === b.length) return 'identical';
  return a.length > b.length ? 'a-longer' : 'b-longer';
}

function _valEq(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return false; }
}

// Merge two messages already known to be content-equal (same cls+text+ts). Unions
// every field (e.g. an id present on only one side is kept); a differing value for
// the SAME field (e.g. two different ids) is a conflict -> fail closed.
function _mergeMessage(a, b) {
  const out = {};
  const keys = new Set(Object.keys(a).concat(Object.keys(b)));
  for (const k of keys) {
    const av = a[k], bv = b[k];
    if (av !== undefined && bv !== undefined && !_valEq(av, bv)) return { ok: false, reason: 'message_field_conflict:' + k };
    out[k] = (av !== undefined) ? av : bv;
  }
  return { ok: true, msg: out };
}

// Merge two reconciling histories losslessly: field-merge the common (content-
// equal) prefix, then append the tail from the longer side. Fail closed if any
// overlapping message has a genuinely conflicting field (e.g. two different ids).
function _mergeMessages(lm, bm, rel) {
  lm = lm || []; bm = bm || [];
  const common = Math.min(lm.length, bm.length);
  const out = [];
  for (let i = 0; i < common; i++) {
    const r = _mergeMessage(lm[i], bm[i]);
    if (!r.ok) return { ok: false, reason: r.reason };
    out.push(r.msg);
  }
  const longer = (rel === 'a-longer') ? lm : (rel === 'b-longer') ? bm : lm; // identical -> no tail
  for (let i = common; i < longer.length; i++) out.push(longer[i]);
  return { ok: true, messages: out };
}

// Losslessly merge the fields of two chats that share an id and whose histories
// reconcile. Bespoke semantics for known fields (OR booleans, keep any meaningful
// name, min createdAt / max updatedAt, fail closed on conflicting names/buildName);
// EVERY other field is unioned generically (kept if one-sided, conflict if it
// genuinely differs) so no chat field is silently dropped. `id`/`messages` are
// handled by the caller. Returns { ok:true, chat } | { ok:false, reason }.
const _SPECIAL_CHAT_FIELDS = new Set(['id', 'messages', 'name', 'nameLocked', 'started', 'buildChat', 'buildName', 'createdAt', 'updatedAt']);

function _mergeChatFields(local, backup) {
  const out = {};
  out.started = !!local.started || !!backup.started;
  if (local.buildChat || backup.buildChat) out.buildChat = true;

  const buildNames = [local.buildName, backup.buildName].filter((x) => x != null && x !== '');
  if (buildNames.length === 2 && buildNames[0] !== buildNames[1]) return { ok: false, reason: 'buildName_conflict' };
  if (buildNames.length) out.buildName = buildNames[0];

  // A name is "meaningful" if it is locked OR non-default. If BOTH sides carry a
  // meaningful name and they differ, that is a real conflict -> fail closed.
  const lLocked = !!local.nameLocked, bLocked = !!backup.nameLocked;
  const lMeaningful = lLocked || (!!local.name && local.name !== 'New chat');
  const bMeaningful = bLocked || (!!backup.name && backup.name !== 'New chat');
  if (lMeaningful && bMeaningful) {
    if (local.name !== backup.name) return { ok: false, reason: 'name_conflict' };
    out.name = local.name;
    if (lLocked || bLocked) out.nameLocked = true;
  } else if (lMeaningful) {
    out.name = local.name;
    if (lLocked) out.nameLocked = true;
  } else if (bMeaningful) {
    out.name = backup.name;
    if (bLocked) out.nameLocked = true;
  }

  const created = [local.createdAt, backup.createdAt].filter((x) => typeof x === 'number');
  if (created.length) out.createdAt = Math.min.apply(null, created);
  const updated = [local.updatedAt, backup.updatedAt].filter((x) => typeof x === 'number');
  if (updated.length) out.updatedAt = Math.max.apply(null, updated);

  // Generic union for EVERY other field on either side.
  const keys = new Set(Object.keys(local).concat(Object.keys(backup)));
  for (const k of keys) {
    if (_SPECIAL_CHAT_FIELDS.has(k)) continue;
    const av = local[k], bv = backup[k];
    if (av !== undefined && bv !== undefined && !_valEq(av, bv)) return { ok: false, reason: 'chat_field_conflict:' + k };
    out[k] = (av !== undefined) ? av : bv;
  }
  return { ok: true, chat: out };
}

// Reconcile two chat lists by id. Returns { ok:true, chats, provenance } or
// { ok:false, error:'divergence_conflict', conflicts:[ids] }.
// An id-less chat is disposable ONLY if it is literally a bare default "New chat":
// no messages, not started, at most a default name, and NO other field whatsoever
// (not even createdAt/updatedAt or a stray unknown key). Anything else is real
// persisted state, so it must FAIL CLOSED rather than be silently dropped.
const _DISPOSABLE_BLANK_KEYS = new Set(['name', 'messages', 'started']);
function _isDisposableBlank(c) {
  // messages must be absent or an EMPTY ARRAY; a non-array (or non-empty) messages
  // value carries state and must not be treated as disposable.
  if (c.messages !== undefined && (!Array.isArray(c.messages) || c.messages.length > 0)) return false;
  if (c.started) return false;
  if (c.name && c.name !== 'New chat') return false;
  for (const k of Object.keys(c)) if (!_DISPOSABLE_BLANK_KEYS.has(k)) return false;
  return true;
}

// Validate an id-bearing chat's messages: messages MUST be an array; every entry
// MUST be an object with legacy-typed identity fields (cls:string, text:string,
// ts:number); a present message id MUST be a nonempty string and unique within the
// chat. Fails closed (never normalizes a malformed value). Returns { ok } | { ok:false, reason }.
function _validateMessages(c) {
  if (!Array.isArray(c.messages)) return { ok: false, reason: 'messages_not_array' };
  const seenMsgIds = new Set();
  for (const m of c.messages) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, reason: 'message_not_object' };
    if (typeof m.cls !== 'string' || typeof m.text !== 'string' || typeof m.ts !== 'number') {
      return { ok: false, reason: 'message_field_type' };
    }
    if (m.id !== undefined) {
      if (typeof m.id !== 'string' || !m.id) return { ok: false, reason: 'message_id_type' };
      if (seenMsgIds.has(m.id)) return { ok: false, reason: 'duplicate_message_id' };
      seenMsgIds.add(m.id);
    }
  }
  return { ok: true };
}

// Validate an id-bearing chat: valid messages AND correctly-typed KNOWN fields.
// A present-but-wrong-typed known field (e.g. started:'yes', createdAt:'bad') is
// malformed and fails closed — never silently coerced/replaced. Unknown fields are
// left to the lossless field-merge; absent known fields get legitimate defaults.
function _validateChat(c) {
  const vm = _validateMessages(c);
  if (!vm.ok) return vm;
  const wrong = (k, t) => c[k] !== undefined && typeof c[k] !== t;
  if (wrong('name', 'string')) return { ok: false, reason: 'chat_field_type:name' };
  if (wrong('started', 'boolean')) return { ok: false, reason: 'chat_field_type:started' };
  if (wrong('nameLocked', 'boolean')) return { ok: false, reason: 'chat_field_type:nameLocked' };
  if (wrong('buildChat', 'boolean')) return { ok: false, reason: 'chat_field_type:buildChat' };
  if (wrong('buildName', 'string')) return { ok: false, reason: 'chat_field_type:buildName' };
  if (wrong('createdAt', 'number')) return { ok: false, reason: 'chat_field_type:createdAt' };
  if (wrong('updatedAt', 'number')) return { ok: false, reason: 'chat_field_type:updatedAt' };
  return { ok: true };
}

function reconcileChats(localChats, backupChats) {
  const malformed = [];
  // 0. Each source MUST be an array. A non-array source is malformed, not "empty".
  if (!Array.isArray(localChats)) malformed.push({ source: 'local', reason: 'source_not_an_array' });
  if (!Array.isArray(backupChats)) malformed.push({ source: 'backup', reason: 'source_not_an_array' });
  if (malformed.length) return { ok: false, error: 'malformed_input', malformed, conflicts: [], conflictDetails: [] };

  const byId = new Map();
  // Index one source, FAIL CLOSED on anything that could silently drop data: a
  // content-bearing chat with no usable id, a duplicate id within the source, or an
  // id-bearing chat whose messages/message-entries are structurally malformed. A
  // truly-empty, id-less "New chat" is disposable, not data, so it is skipped.
  const indexSource = (list, label) => {
    const seen = new Set();
    for (const c of list) {
      if (!c || typeof c !== 'object' || Array.isArray(c)) { malformed.push({ source: label, reason: 'not_an_object' }); continue; }
      if (typeof c.id !== 'string' || !c.id) {
        if (!_isDisposableBlank(c)) malformed.push({ source: label, reason: 'missing_id_with_state' });
        continue; // pristine default blank without an id -> ignore (not data)
      }
      // id-bearing chat: messages must be a valid array of valid messages, and
      // known chat fields must be correctly typed.
      const vm = _validateChat(c);
      if (!vm.ok) { malformed.push({ source: label, id: c.id, reason: vm.reason }); continue; }
      if (seen.has(c.id)) { malformed.push({ source: label, id: c.id, reason: 'duplicate_id_in_source' }); continue; }
      seen.add(c.id);
      const e = byId.get(c.id) || {}; e[label] = c; byId.set(c.id, e);
    }
  };
  indexSource(localChats, 'local');
  indexSource(backupChats, 'backup');

  const chats = [];
  const provenance = {};
  const conflicts = [];
  const conflictDetails = [];
  let diverged = false;
  for (const [id, e] of byId) {
    if (e.local && !e.backup) { chats.push(e.local); provenance[id] = 'local-only'; continue; }
    if (e.backup && !e.local) { chats.push(e.backup); provenance[id] = 'backup-only'; continue; }
    const rel = _compareHistories(e.local.messages, e.backup.messages);
    if (rel === 'diverge') { conflicts.push(id); conflictDetails.push({ id, reason: 'history_divergence' }); diverged = true; continue; }
    // Histories reconcile — LOSSLESSLY merge both the messages (field-union of the
    // content-equal overlap + tail from the longer side) and the metadata, or fail
    // closed if either genuinely conflicts.
    const mm = _mergeMessages(e.local.messages, e.backup.messages, rel);
    if (!mm.ok) { conflicts.push(id); conflictDetails.push({ id, reason: mm.reason }); continue; }
    const m = _mergeChatFields(e.local, e.backup);
    if (!m.ok) { conflicts.push(id); conflictDetails.push({ id, reason: m.reason }); continue; }
    chats.push(Object.assign({}, m.chat, { id, messages: mm.messages }));
    provenance[id] = rel === 'identical' ? 'identical' : (rel === 'a-longer' ? 'local-longer' : 'backup-longer');
  }
  // Any malformation OR any conflict fails the whole migration (fail closed): no
  // store is produced and both sources are preserved for the owner. conflictDetails
  // names the exact reason per id (history_divergence / name_conflict / buildName_conflict).
  if (malformed.length) return { ok: false, error: 'malformed_input', malformed, conflicts, conflictDetails };
  if (conflicts.length) return { ok: false, error: diverged ? 'divergence_conflict' : 'metadata_conflict', conflicts, conflictDetails };
  return { ok: true, chats, provenance };
}

// Deterministic message id for legacy messages that never had one — stable across
// re-runs (position + content), so migration is reproducible.
function _deriveMsgId(chatId, i, m) {
  const h = crypto.createHash('sha1').update(chatId + '|' + i + '|' + (m.cls || '') + '|' + (m.ts || '') + '|' + (m.text || '')).digest('hex');
  return 'm-' + h.slice(0, 16);
}

// Build a schema-v1 canonical store from reconciled chats. Structured API — never
// throws and never produces a store from malformed input: a non-array `chats` or a
// missing/invalid projectId returns { ok:false, error }. Assigns message ids where
// absent and defaults ABSENT (not malformed) required fields. Returns
// { ok:true, store } | { ok:false, error }.
function buildStore(opts) {
  const now = (opts && typeof opts.now === 'number') ? opts.now : Date.now();
  const projectId = opts && opts.projectId;
  if (typeof projectId !== 'string' || !projectId) return { ok: false, error: 'invalid_project_id' };
  if (!Array.isArray(opts && opts.chats)) return { ok: false, error: 'chats_not_an_array' };
  // buildStore is a structured, self-contained API: validate EVERY chat before
  // mapping, so a direct call with malformed input fails closed rather than
  // throwing a raw .map error or silently normalizing an inner malformed value.
  const invalid = [];
  for (const c of opts.chats) {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { invalid.push({ reason: 'not_an_object' }); continue; }
    if (typeof c.id !== 'string' || !c.id) { invalid.push({ reason: 'missing_id' }); continue; }
    const vc = _validateChat(c);
    if (!vc.ok) invalid.push({ id: c.id, reason: vc.reason });
  }
  if (invalid.length) return { ok: false, error: 'malformed_chats', invalid };
  const chats = opts.chats.map((c) => {
    // Preserve every field on the reconciled chat (known + unknown); only default
    // the required ones. Spread first so nothing is dropped, then overlay.
    const messages = (c.messages || []).map((m, i) => Object.assign({}, m, {
      id: m.id || _deriveMsgId(c.id, i, m),
      cls: m.cls, text: m.text, ts: (typeof m.ts === 'number' ? m.ts : now),
    }));
    return Object.assign({}, c, {
      id: c.id,
      name: c.name || 'New chat',
      started: !!c.started || messages.length > 0,
      messages,
      createdAt: (typeof c.createdAt === 'number' ? c.createdAt : now),
      updatedAt: (typeof c.updatedAt === 'number' ? c.updatedAt : now),
    });
  });
  return {
    ok: true,
    store: {
      schemaVersion: SCHEMA_VERSION, projectId,
      revision: 1, createdAt: now, updatedAt: now, activeChatId: null, chats,
    },
  };
}

// Full plan: validate projectId, reconcile, then build. On ANY validation failure
// or conflict, returns the failure unchanged (NO store) so the caller writes
// nothing and preserves both sources.
function planMigration(opts) {
  const projectId = opts && opts.projectId;
  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, error: 'invalid_project_id' };
  }
  const r = reconcileChats(opts && opts.localChats, opts && opts.backupChats);
  if (!r.ok) return r;
  const b = buildStore({ chats: r.chats, projectId, now: opts && opts.now });
  if (!b.ok) return b;
  return { ok: true, store: b.store, provenance: r.provenance };
}

module.exports = { reconcileChats, buildStore, planMigration };
