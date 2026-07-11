// Unit tests for app/state/chat-store.js (Phase 2A slice 2).
// Runner: node:test — pure Node, throwaway temp files only. No Electron, no
// launch, no real chat data. Synthetic data only.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const cs = require('../../state/chat-store');
const atomic = require('../../state/atomic-store');

function tmpFile() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-chatstore-'));
  return path.join(dir, 'chats.json');
}
// Deterministic time so createdAt/updatedAt assertions are stable.
let T = 1_000;
function nextNow() { T += 1000; return { now: T }; }
// Bootstrap a store with N chats; returns { file, projectId, revision, ids }.
function seed(nChats) {
  const file = tmpFile();
  cs.initStore(file, 'proj-test', nextNow());
  let rev = 1;
  const ids = [];
  for (let i = 0; i < nChats; i++) {
    const r = cs.createChat(file, rev, { id: 'chat-' + i, name: 'Chat ' + i }, nextNow());
    assert.equal(r.ok, true);
    rev = r.revision; ids.push(r.chatId);
  }
  return { file, rev, ids };
}

// ---- init + read ----

test('initStore creates a v1 store; a second init is a no-op', () => {
  const file = tmpFile();
  const a = cs.initStore(file, 'proj-x', nextNow());
  assert.equal(a.ok, true); assert.equal(a.created, true); assert.equal(a.revision, 1);
  const rd = cs.readStore(file);
  assert.equal(rd.served, 'current');
  assert.equal(rd.store.schemaVersion, cs.SCHEMA_VERSION);
  assert.equal(rd.store.projectId, 'proj-x');
  assert.equal(rd.store.activeChatId, null);
  assert.deepEqual(rd.store.chats, []);
  const b = cs.initStore(file, 'proj-x', nextNow());
  assert.equal(b.ok, true); assert.equal(b.already, true);
});

test('readStore reports none for a missing store', () => {
  const rd = cs.readStore(tmpFile());
  assert.equal(rd.ok, true); assert.equal(rd.store, null); assert.equal(rd.served, 'none');
});

test('readStore recovers from .prev when the current file is corrupt', () => {
  const { file } = seed(2);              // current + .prev now exist
  fs.writeFileSync(file, '{ corrupt', 'utf8');
  const rd = cs.readStore(file);
  assert.equal(rd.ok, true);
  assert.equal(rd.served, 'prev', 'must serve the prior generation when current is corrupt');
  assert.equal(Array.isArray(rd.store.chats), true);
});

test('a mutation against a CORRUPT current generation FAILS CLOSED (never commits from .prev)', () => {
  const { file, rev } = seed(2);          // current rev3 valid, .prev rev2 (missing the newest chat)
  fs.writeFileSync(file, '{ corrupt current hiding newer data', 'utf8');
  // A caller holding the .prev revision must NOT be able to mutate from that stale
  // snapshot and overwrite the (corrupt) current generation.
  const r = cs.deleteChat(file, rev - 1, { chatId: 'chat-0' }, nextNow());
  assert.equal(r.ok, false);
  assert.match(r.error, /store_corrupt/);
  assert.equal(atomic.readJson(file).ok, false, 'corrupt current left untouched — not overwritten from prev');
});

// ---- structural validation (S6 recovery-exit closeout) ----
//
// The write path is strict but the read/validate path was loose: readStore served
// ANY parseable JSON as authoritative, and a non-array chats rendered as a silent
// empty chat list (false-empty). These tests pin the fix: a store is served/mutated
// ONLY if it is a structurally valid v1 store; a malformed one fails closed.

test('validateStore accepts a well-formed v1 store (incl. a null projectId)', () => {
  const { file } = seed(2);
  const good = cs.readStore(file).store;
  assert.equal(cs.validateStore(good).ok, true);
  // null projectId is shape-valid; identity binding is chat-service's concern.
  assert.equal(cs.validateStore(Object.assign({}, good, { projectId: null })).ok, true);
});

test('validateStore rejects each structural malformation class', () => {
  const { file } = seed(1);
  const base = cs.readStore(file).store;
  const bad = (mut) => { const s = JSON.parse(JSON.stringify(base)); mut(s); return cs.validateStore(s).error; };
  assert.equal(cs.validateStore(42).error, 'store_not_object');
  assert.equal(cs.validateStore(null).error, 'store_not_object');
  assert.equal(cs.validateStore([]).error, 'store_not_object');
  assert.equal(bad((s) => { s.schemaVersion = 2; }), 'schema_version');
  assert.equal(bad((s) => { s.projectId = ''; }), 'project_id');
  assert.equal(bad((s) => { s.revision = 0; }), 'revision');
  assert.equal(bad((s) => { s.revision = 1.5; }), 'revision');
  assert.equal(bad((s) => { s.createdAt = 'x'; }), 'store_timestamps');
  assert.equal(bad((s) => { s.activeChatId = 5; }), 'active_chat_id');
  assert.equal(bad((s) => { s.chats = 'nope'; }), 'chats_not_an_array');
  assert.equal(bad((s) => { s.chats = [null]; }), 'chat_not_object');
  assert.equal(bad((s) => { delete s.chats[0].messages; }), 'chat_messages_not_array');
  assert.equal(bad((s) => { s.chats[0].messages = [{ id: 'm', cls: 'user', text: 'hi' }]; }), 'message_ts'); // ts missing
  assert.equal(bad((s) => { s.chats[0].messages = [{ cls: 'user', text: 'hi', ts: 1 }]; }), 'message_id');
  assert.equal(bad((s) => { s.chats[0].messages = [{ id: 'm', text: 42, ts: 1 }]; }), 'message_text'); // wrong-typed when present
  assert.equal(bad((s) => { s.chats.push(JSON.parse(JSON.stringify(base.chats[0]))); }), 'duplicate_chat_id');
});

test('readStore treats a parseable-but-INVALID current like a corrupt one: serves valid .prev', () => {
  const { file } = seed(2);              // current (rev3) + valid .prev (rev2) exist
  // Structurally invalid but perfectly parseable JSON (chats is a string).
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, projectId: 'proj-test', revision: 9, createdAt: 1, updatedAt: 1, activeChatId: null, chats: 'corrupt' }), 'utf8');
  const rd = cs.readStore(file);
  assert.equal(rd.ok, true);
  assert.equal(rd.served, 'prev', 'a malformed current must never be served as current');
  assert.equal(Array.isArray(rd.store.chats), true);
  assert.match(rd.currentError, /invalid:chats_not_an_array/);
});

test('readStore FAILS CLOSED when current is invalid and there is no valid .prev', () => {
  const file = tmpFile();
  cs.initStore(file, 'proj-test', nextNow());   // creates current, NO .prev yet
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, projectId: 'p', revision: 1, createdAt: 1, updatedAt: 1, activeChatId: null, chats: { not: 'an array' } }), 'utf8');
  const rd = cs.readStore(file);
  assert.equal(rd.ok, false, 'no valid generation anywhere -> fail closed, never a false-empty served store');
  assert.equal(rd.error, 'store_and_prev_unreadable');
});

test('a mutation against a parseable-but-INVALID current FAILS CLOSED (store_invalid), never throws', () => {
  const { file, rev } = seed(1);
  fs.writeFileSync(file, JSON.stringify({ schemaVersion: 1, projectId: 'proj-test', revision: rev, createdAt: 1, updatedAt: 1, activeChatId: null, chats: 'corrupt' }), 'utf8');
  const r = cs.appendMessage(file, rev, { chatId: 'chat-0', message: { id: 'm', cls: 'user', text: 'hi', ts: 1 } }, nextNow());
  assert.equal(r.ok, false);
  assert.equal(r.error, 'store_invalid');
  assert.match(r.detail, /chats_not_an_array/);
});

test('a command that would produce an INVALID store fails closed WITHOUT writing (current untouched)', () => {
  const { file, rev, ids } = seed(1);
  const before = fs.readFileSync(file, 'utf8');
  // appendMessage passes cls/text through verbatim (only ts is coerced), so a
  // non-string cls would make the resulting store structurally invalid. _commit
  // must reject it before any write.
  const r = cs.appendMessage(file, rev, { chatId: ids[0], message: { id: 'm-bad', cls: 42, text: 'x', ts: 1 } }, nextNow());
  assert.equal(r.ok, false);
  assert.equal(r.error, 'would_corrupt');
  assert.match(r.detail, /message_cls/);
  // The current generation on disk is byte-for-byte unchanged — nothing was persisted.
  assert.equal(fs.readFileSync(file, 'utf8'), before, 'no write occurred; current generation intact');
  assert.equal(cs.readStore(file).store.revision, rev, 'revision did not advance');
});

// ---- createChat + CAS ----

test('createChat appends and bumps revision; returns the id', () => {
  const file = tmpFile();
  cs.initStore(file, 'p', nextNow());
  const r = cs.createChat(file, 1, { id: 'c1', name: 'First' }, nextNow());
  assert.equal(r.ok, true); assert.equal(r.revision, 2); assert.equal(r.chatId, 'c1');
  assert.equal(cs.readStore(file).store.chats.length, 1);
});

test('a stale expectedRevision is REJECTED as a conflict (never applied)', () => {
  const { file, rev } = seed(1);
  const bad = cs.createChat(file, rev - 1, { id: 'zzz' }, nextNow());
  assert.equal(bad.ok, false);
  assert.equal(bad.conflict, true);
  assert.equal(bad.currentRevision, rev);
  assert.equal(cs.readStore(file).store.chats.some((c) => c.id === 'zzz'), false);
});

test('CAS is MANDATORY: a missing/non-integer expectedRevision is rejected for every mutator', () => {
  const { file } = seed(2);
  const bad = [undefined, null, '1', 1.5, NaN];
  for (const rev of bad) {
    assert.match(cs.createChat(file, rev, { id: 'x' }, nextNow()).error, /revision_required/, 'createChat rev=' + rev);
    assert.match(cs.appendMessage(file, rev, { chatId: 'chat-0', message: { id: 'm' } }, nextNow()).error, /revision_required/, 'appendMessage rev=' + rev);
    assert.match(cs.updateChatMetadata(file, rev, { chatId: 'chat-0', fields: { started: true } }, nextNow()).error, /revision_required/, 'updateChatMetadata rev=' + rev);
    assert.match(cs.renameChat(file, rev, { chatId: 'chat-0', name: 'x' }, nextNow()).error, /revision_required/, 'renameChat rev=' + rev);
    assert.match(cs.deleteChat(file, rev, { chatId: 'chat-1' }, nextNow()).error, /revision_required/, 'deleteChat rev=' + rev);
    assert.match(cs.setActiveChat(file, rev, { chatId: 'chat-0' }, nextNow()).error, /revision_required/, 'setActiveChat rev=' + rev);
  }
  // Nothing was mutated: both seeded chats survive, revision unchanged.
  const store = cs.readStore(file).store;
  assert.equal(store.chats.length, 2);
  assert.equal(store.revision, 3, 'no mutator ran without a valid revision');
});

test('duplicate chat id is rejected', () => {
  const { file, rev } = seed(1);
  const r = cs.createChat(file, rev, { id: 'chat-0' }, nextNow());
  assert.equal(r.ok, false); assert.match(r.error, /duplicate_chat_id/);
});

// ---- appendMessage (idempotent by message id) ----

test('appendMessage adds a message, marks started, is idempotent by message id', () => {
  const { file, rev } = seed(1);
  const a = cs.appendMessage(file, rev, { chatId: 'chat-0', message: { id: 'm1', cls: 'user', text: 'hi' } }, nextNow());
  assert.equal(a.ok, true); assert.equal(a.revision, rev + 1);
  const chat = cs.readStore(file).store.chats[0];
  assert.equal(chat.started, true);
  assert.equal(chat.messages.length, 1);
  // Re-append same id at the new revision -> no-op, no duplicate, no bump.
  const b = cs.appendMessage(file, rev + 1, { chatId: 'chat-0', message: { id: 'm1', cls: 'user', text: 'hi again' } }, nextNow());
  assert.equal(b.ok, true); assert.equal(b.noop, true); assert.equal(b.revision, rev + 1);
  assert.equal(cs.readStore(file).store.chats[0].messages.length, 1);
});

test('appendMessage requires a message id and an existing chat', () => {
  const { file, rev } = seed(1);
  assert.match(cs.appendMessage(file, rev, { chatId: 'chat-0', message: { cls: 'user', text: 'x' } }, nextNow()).error, /message_id_required/);
  assert.match(cs.appendMessage(file, rev, { chatId: 'nope', message: { id: 'm', text: 'x' } }, nextNow()).error, /no_such_chat/);
});

// ---- rename / metadata boundaries ----

test('renameChat sets name + nameLocked; empty name rejected', () => {
  const { file, rev } = seed(1);
  const r = cs.renameChat(file, rev, { chatId: 'chat-0', name: '  My Chat  ' }, nextNow());
  assert.equal(r.ok, true);
  const chat = cs.readStore(file).store.chats[0];
  assert.equal(chat.name, 'My Chat'); assert.equal(chat.nameLocked, true);
  assert.match(cs.renameChat(file, r.revision, { chatId: 'chat-0', name: '   ' }, nextNow()).error, /empty_name/);
});

test('renameChat with lock:false sets the name WITHOUT locking (auto-naming)', () => {
  const { file, rev } = seed(1);
  const r = cs.renameChat(file, rev, { chatId: 'chat-0', name: 'Auto Title', lock: false }, nextNow());
  assert.equal(r.ok, true);
  const chat = cs.readStore(file).store.chats[0];
  assert.equal(chat.name, 'Auto Title');
  assert.notEqual(chat.nameLocked, true, 'auto-name must not lock the title');
});

test('updateChatMetadata accepts only whitelisted fields', () => {
  const { file, rev } = seed(1);
  const ok = cs.updateChatMetadata(file, rev, { chatId: 'chat-0', fields: { started: true, buildChat: true } }, nextNow());
  assert.equal(ok.ok, true);
  const bad1 = cs.updateChatMetadata(file, ok.revision, { chatId: 'chat-0', fields: { name: 'sneaky' } }, nextNow());
  assert.match(bad1.error, /field_not_allowed/);
  const bad2 = cs.updateChatMetadata(file, ok.revision, { chatId: 'chat-0', fields: { messages: [] } }, nextNow());
  assert.match(bad2.error, /field_not_allowed/);
  const bad3 = cs.updateChatMetadata(file, ok.revision, { chatId: 'chat-0', fields: { id: 'x' } }, nextNow());
  assert.match(bad3.error, /field_not_allowed/);
});

// ---- delete + active selection ----

test('deleteChat removes only from chats.json and clears activeChatId if it was active', () => {
  const { file, rev } = seed(2);
  const sa = cs.setActiveChat(file, rev, { chatId: 'chat-1' }, nextNow());
  assert.equal(sa.ok, true);
  assert.equal(cs.readStore(file).store.activeChatId, 'chat-1');
  const del = cs.deleteChat(file, sa.revision, { chatId: 'chat-1' }, nextNow());
  assert.equal(del.ok, true);
  const store = cs.readStore(file).store;
  assert.equal(store.chats.some((c) => c.id === 'chat-1'), false);
  assert.equal(store.activeChatId, null, 'active cleared when the active chat is deleted');
});

test('setActiveChat participates in CAS, bumps revision, rejects unknown, allows null', () => {
  const { file, rev } = seed(1);
  const a = cs.setActiveChat(file, rev, { chatId: 'chat-0' }, nextNow());
  assert.equal(a.ok, true); assert.equal(a.revision, rev + 1);
  assert.equal(cs.readStore(file).store.activeChatId, 'chat-0');
  assert.match(cs.setActiveChat(file, a.revision, { chatId: 'ghost' }, nextNow()).error, /no_such_chat/);
  const clear = cs.setActiveChat(file, a.revision, { chatId: null }, nextNow());
  assert.equal(clear.ok, true);
  assert.equal(cs.readStore(file).store.activeChatId, null);
});

// ---- immutability + schema/project guards ----

test('createdAt is immutable and store.updatedAt advances on mutation', () => {
  const file = tmpFile();
  cs.initStore(file, 'p', { now: 5000 });
  const c = cs.createChat(file, 1, { id: 'c1' }, { now: 6000 });
  const created = cs.readStore(file).store.chats[0].createdAt;
  assert.equal(created, 6000);
  cs.appendMessage(file, c.revision, { chatId: 'c1', message: { id: 'm1', text: 'x' } }, { now: 9000 });
  const chat = cs.readStore(file).store.chats[0];
  assert.equal(chat.createdAt, 6000, 'createdAt immutable');
  assert.equal(chat.updatedAt, 9000, 'chat updatedAt advanced');
  assert.equal(cs.readStore(file).store.updatedAt, 9000, 'store updatedAt advanced');
});

test('a schemaVersion mismatch is rejected as needs-migration', () => {
  const file = tmpFile();
  atomic.writeJsonAtomic(file, { schemaVersion: 99, projectId: 'p', revision: 1, chats: [] });
  const r = cs.createChat(file, 1, { id: 'c1' }, nextNow());
  assert.equal(r.ok, false); assert.match(r.error, /schema_mismatch/); assert.equal(r.needsMigration, true);
});

test('expectedProjectId mismatch is rejected', () => {
  const { file, rev } = seed(1);
  const r = cs.createChat(file, rev, { id: 'c9' }, { now: T, expectedProjectId: 'proj-OTHER' });
  assert.equal(r.ok, false); assert.match(r.error, /project_mismatch/);
});

// ---- project identity ----

test('resolveProjectId uses project-state.json project_id when present', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-pid-'));
  const stateDir = path.join(dir, '.cockpit', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'project-state.json'), JSON.stringify({ project_id: 'project-control-cockpit' }), 'utf8');
  const r = cs.resolveProjectId(dir, nextNow());
  assert.equal(r.ok, true); assert.equal(r.projectId, 'project-control-cockpit'); assert.equal(r.source, 'project-state');
});

test('resolveProjectId mints a durable id when none exists, and reuses it', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-pid-'));
  const a = cs.resolveProjectId(dir, nextNow());
  assert.equal(a.ok, true); assert.equal(a.source, 'minted-new'); assert.match(a.projectId, /^proj-/);
  const b = cs.resolveProjectId(dir, nextNow());
  assert.equal(b.ok, true); assert.equal(b.source, 'minted'); assert.equal(b.projectId, a.projectId, 'minted id is durable');
});

test('resolveProjectId FAILS CLOSED when project-state and minted id disagree', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-pid-'));
  const stateDir = path.join(dir, '.cockpit', 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'project-state.json'), JSON.stringify({ project_id: 'real-id' }), 'utf8');
  fs.writeFileSync(path.join(stateDir, 'project-id.json'), JSON.stringify({ projectId: 'stale-minted-id' }), 'utf8');
  const r = cs.resolveProjectId(dir, nextNow());
  assert.equal(r.ok, false); assert.match(r.error, /project_id_conflict/);
});
