// Unit tests for app/state/chat-migrate.js (Phase 2A slice 3).
// Runner: node:test — pure, in-memory fixtures only. No IO, no launch, no real data.

const { test } = require('node:test');
const assert = require('node:assert');
const mig = require('../../state/chat-migrate');

const msg = (cls, text, ts) => ({ cls, text, ts });
const chat = (id, messages, extra) => Object.assign({ id, name: id, messages: messages || [] }, extra || {});

// ---- reconcile: single-source ----

test('a chat present in only one source is accepted', () => {
  const r = mig.reconcileChats([chat('a', [msg('user', 'hi', 1)])], []);
  assert.equal(r.ok, true);
  assert.equal(r.chats.length, 1);
  assert.equal(r.provenance.a, 'local-only');
  const r2 = mig.reconcileChats([], [chat('b', [msg('user', 'yo', 1)])]);
  assert.equal(r2.provenance.b, 'backup-only');
});

// ---- reconcile: identical / prefix ----

test('identical histories LOSSLESSLY merge metadata (never silently pick a winner)', () => {
  // local carries build state; backup is newer but default — neither must be lost.
  const local = chat('a', [msg('user', 'hi', 1)], { updatedAt: 10, buildChat: true, buildName: 'X', name: 'New chat' });
  const backup = chat('a', [msg('user', 'hi', 1)], { updatedAt: 20, started: true, name: 'Renamed', nameLocked: true, createdAt: 5 });
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, true);
  assert.equal(r.provenance.a, 'identical');
  const c = r.chats[0];
  assert.equal(c.buildChat, true, 'build state preserved from local');
  assert.equal(c.buildName, 'X');
  assert.equal(c.started, true, 'started preserved from backup');
  assert.equal(c.name, 'Renamed'); assert.equal(c.nameLocked, true, 'locked name preserved');
  assert.equal(c.createdAt, 5, 'min createdAt'); assert.equal(c.updatedAt, 20, 'max updatedAt');
});

test('genuinely conflicting metadata (two different LOCKED names) FAILS closed', () => {
  const local = chat('a', [msg('user', 'hi', 1)], { name: 'Alpha', nameLocked: true });
  const backup = chat('a', [msg('user', 'hi', 1)], { name: 'Beta', nameLocked: true });
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, false);
  assert.match(r.error, /metadata_conflict/);
  assert.deepEqual(r.conflicts, ['a']);
});

test('conflicting buildName across sources FAILS closed', () => {
  const local = chat('a', [], { buildChat: true, buildName: 'ProjX' });
  const backup = chat('a', [], { buildChat: true, buildName: 'ProjY' });
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, false);
  assert.match(r.error, /metadata_conflict/);
});

test('a LOCKED name never silently overrides a different meaningful name (fail closed)', () => {
  // locked default vs unlocked real rename -> conflict, not silently keep the locked default
  const r1 = mig.reconcileChats(
    [chat('a', [msg('user', 'hi', 1)], { name: 'New chat', nameLocked: true })],
    [chat('a', [msg('user', 'hi', 1)], { name: 'Renamed' })]);
  assert.equal(r1.ok, false); assert.match(r1.error, /metadata_conflict/);
  assert.equal(r1.conflictDetails.some((d) => d.id === 'a' && d.reason === 'name_conflict'), true);
  // locked 'Alpha' vs unlocked meaningful 'Beta' -> conflict
  const r2 = mig.reconcileChats(
    [chat('a', [msg('user', 'hi', 1)], { name: 'Alpha', nameLocked: true })],
    [chat('a', [msg('user', 'hi', 1)], { name: 'Beta' })]);
  assert.equal(r2.ok, false);
  assert.equal(r2.conflictDetails.some((d) => d.reason === 'name_conflict'), true);
});

test('a locked meaningful name is kept when the other side is just the default', () => {
  const r = mig.reconcileChats(
    [chat('a', [msg('user', 'hi', 1)], { name: 'Kept', nameLocked: true })],
    [chat('a', [msg('user', 'hi', 1)], { name: 'New chat' })]);
  assert.equal(r.ok, true);
  assert.equal(r.chats[0].name, 'Kept'); assert.equal(r.chats[0].nameLocked, true);
});

test('a strict-prefix history accepts the LONGER side (either direction)', () => {
  const short = chat('a', [msg('user', 'hi', 1)]);
  const long = chat('a', [msg('user', 'hi', 1), msg('assistant', 'hello', 2)]);
  const r1 = mig.reconcileChats([short], [long]);
  assert.equal(r1.ok, true);
  assert.equal(r1.provenance.a, 'backup-longer');
  assert.equal(r1.chats[0].messages.length, 2);
  const r2 = mig.reconcileChats([long], [short]);
  assert.equal(r2.provenance.a, 'local-longer');
  assert.equal(r2.chats[0].messages.length, 2);
});

// ---- reconcile: divergence -> FAIL CLOSED ----

test('histories that diverge at a shared index FAIL the whole migration', () => {
  const local = chat('a', [msg('user', 'hi', 1), msg('assistant', 'A', 2)]);
  const backup = chat('a', [msg('user', 'hi', 1), msg('assistant', 'B', 2)]);
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, false);
  assert.match(r.error, /divergence_conflict/);
  assert.deepEqual(r.conflicts, ['a']);
});

test('an earlier-message difference is a conflict (fail closed), and one bad chat fails ALL', () => {
  const local = [chat('a', [msg('user', 'x', 1)]), chat('b', [msg('user', 'hi', 1)])];
  const backup = [chat('a', [msg('user', 'x', 1)]), chat('b', [msg('user', 'DIFFERENT', 1)])];
  const r = mig.reconcileChats(local, backup);
  assert.equal(r.ok, false);
  assert.deepEqual(r.conflicts, ['b']);
});

test('planMigration on a conflict produces NO store', () => {
  const local = [chat('a', [msg('user', 'x', 1)])];
  const backup = [chat('a', [msg('user', 'y', 1)])];
  const r = mig.planMigration({ localChats: local, backupChats: backup, projectId: 'p', now: 100 });
  assert.equal(r.ok, false);
  assert.equal(r.store, undefined, 'no canonical store on conflict');
});

// ---- malformed input -> FAIL CLOSED (no silent drop) ----

test('duplicate chat ids within a source FAIL the migration (never silently dropped)', () => {
  const r = mig.reconcileChats([chat('a', [msg('user', 'first', 1)]), chat('a', [msg('user', 'second', 2)])], []);
  assert.equal(r.ok, false);
  assert.match(r.error, /malformed_input/);
  assert.equal(r.malformed.some((m) => m.reason === 'duplicate_id_in_source' && m.id === 'a'), true);
});

test('a content-bearing chat with no usable id FAILS the migration', () => {
  const noId = { name: 'ghost', messages: [msg('user', 'important', 1)] };
  const r = mig.reconcileChats([chat('a', [msg('user', 'hi', 1)]), noId], []);
  assert.equal(r.ok, false);
  assert.match(r.error, /malformed_input/);
  assert.equal(r.malformed.some((m) => m.reason === 'missing_id_with_state'), true);
});

test('an id-less zero-message chat that carries REAL state (locked name / build meta) FAILS', () => {
  // Users can rename or start a build on a chat before sending any message.
  const renamed = { name: 'Tax stuff', nameLocked: true, messages: [], started: false };
  const build = { name: 'New project: X', buildChat: true, buildName: 'X', messages: [], started: false };
  for (const bad of [renamed, build]) {
    const r = mig.reconcileChats([chat('a', [msg('user', 'hi', 1)]), bad], []);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.malformed.some((m) => m.reason === 'missing_id_with_state'), true);
  }
});

test('an id-less chat with ANY extra field (stray key or even a timestamp) FAILS closed', () => {
  for (const bad of [
    { name: 'New chat', messages: [], foo: 1 },
    { name: 'New chat', messages: [], createdAt: 123 },
    { name: 'New chat', messages: { draft: 'x' } },  // non-array messages carrying state
    { name: 'New chat', messages: 'oops' },
  ]) {
    const r = mig.reconcileChats([chat('a', [msg('user', 'hi', 1)]), bad], []);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.malformed.some((m) => m.reason === 'missing_id_with_state'), true);
  }
});

test('a PRISTINE default id-less blank ("New chat", empty) is disposable (ignored, not a failure)', () => {
  const blank = { name: 'New chat', messages: [], started: false };
  const r = mig.reconcileChats([chat('a', [msg('user', 'hi', 1)]), blank], []);
  assert.equal(r.ok, true);
  assert.equal(r.chats.length, 1);
  assert.equal(r.chats[0].id, 'a');
});

test('planMigration on malformed input produces NO store', () => {
  const r = mig.planMigration({ localChats: [chat('a', []), chat('a', [])], backupChats: [], projectId: 'p', now: 1 });
  assert.equal(r.ok, false);
  assert.equal(r.store, undefined);
});

// ---- message-level losslessness ----

test('content-equal messages field-merge losslessly (an id on one side is kept)', () => {
  const local = chat('a', [{ cls: 'user', text: 'hi', ts: 1, id: 'keep' }]);
  const backup = chat('a', [{ cls: 'user', text: 'hi', ts: 1 }]);
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, true);
  assert.equal(r.chats[0].messages[0].id, 'keep', 'message id preserved, not dropped');
});

test('content-equal messages with DIFFERENT ids FAIL closed (no silent drop)', () => {
  const local = chat('a', [{ cls: 'user', text: 'hi', ts: 1, id: 'A' }]);
  const backup = chat('a', [{ cls: 'user', text: 'hi', ts: 1, id: 'B' }]);
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, false);
  assert.equal(r.conflictDetails.some((d) => /message_field_conflict:id/.test(d.reason)), true);
});

// ---- unknown/extra fields are never silently dropped ----

test('an unknown chat-level field on one side is preserved through reconcile + buildStore', () => {
  const local = chat('a', [msg('user', 'hi', 1)], { pinned: true, model: 'sonnet' });
  const backup = chat('a', [msg('user', 'hi', 1)]);
  const r = mig.planMigration({ localChats: [local], backupChats: [backup], projectId: 'p', now: 1 });
  assert.equal(r.ok, true);
  const c = r.store.chats[0];
  assert.equal(c.pinned, true, 'unknown field survives');
  assert.equal(c.model, 'sonnet');
});

test('an unknown chat field that CONFLICTS across sources fails closed', () => {
  const local = chat('a', [msg('user', 'hi', 1)], { model: 'sonnet' });
  const backup = chat('a', [msg('user', 'hi', 1)], { model: 'opus' });
  const r = mig.reconcileChats([local], [backup]);
  assert.equal(r.ok, false);
  assert.equal(r.conflictDetails.some((d) => /chat_field_conflict:model/.test(d.reason)), true);
});

test('an unknown message-level field is preserved', () => {
  const local = chat('a', [{ cls: 'user', text: 'hi', ts: 1, edited: true }]);
  const backup = chat('a', [{ cls: 'user', text: 'hi', ts: 1 }]);
  const r = mig.planMigration({ localChats: [local], backupChats: [backup], projectId: 'p', now: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.store.chats[0].messages[0].edited, true);
});

// ---- input-boundary validation (fail closed, never normalize) ----

test('an id-bearing chat with non-array messages FAILS closed (never treated as empty)', () => {
  for (const bad of [
    { id: 'a', messages: { draft: 'important' } },
    { id: 'a', messages: 'corrupt-but-preserved-state' },
    { id: 'a', messages: null },
  ]) {
    const r = mig.reconcileChats([bad], []);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.malformed.some((m) => m.reason === 'messages_not_array' && m.id === 'a'), true);
  }
});

test('a non-array localChats or backupChats source FAILS closed', () => {
  assert.match(mig.reconcileChats(null, []).error, /malformed_input/);
  assert.match(mig.reconcileChats({}, []).error, /malformed_input/);
  const r = mig.reconcileChats([], 'nope');
  assert.equal(r.ok, false);
  assert.equal(r.malformed.some((m) => m.source === 'backup' && m.reason === 'source_not_an_array'), true);
});

test('primitive / null message entries FAIL closed', () => {
  for (const badMsg of [null, 'x', 42, true]) {
    const r = mig.reconcileChats([{ id: 'a', messages: [badMsg] }], []);
    assert.equal(r.ok, false, JSON.stringify(badMsg));
    assert.equal(r.malformed.some((m) => m.reason === 'message_not_object'), true);
  }
});

test('a message with wrong-typed identity fields FAILS closed (no guessing / no now)', () => {
  const r = mig.reconcileChats([{ id: 'a', messages: [{ cls: 'user', text: 'hi', ts: 'not-a-number' }] }], []);
  assert.equal(r.ok, false);
  assert.equal(r.malformed.some((m) => m.reason === 'message_field_type'), true);
});

test('duplicate message ids within one chat FAIL closed', () => {
  const r = mig.reconcileChats([{ id: 'a', messages: [
    { cls: 'user', text: 'x', ts: 1, id: 'm1' },
    { cls: 'assistant', text: 'y', ts: 2, id: 'm1' },
  ] }], []);
  assert.equal(r.ok, false);
  assert.equal(r.malformed.some((m) => m.reason === 'duplicate_message_id'), true);
});

test('planMigration requires a nonempty string projectId and produces NO store otherwise', () => {
  const good = [chat('a', [msg('user', 'hi', 1)])];
  for (const pid of [undefined, null, '', 123, {}]) {
    const r = mig.planMigration({ localChats: good, backupChats: [], projectId: pid, now: 1 });
    assert.equal(r.ok, false, String(pid));
    assert.match(r.error, /invalid_project_id/);
    assert.equal(r.store, undefined, 'no store on invalid projectId');
  }
});

test('every validation failure produces NO store', () => {
  const cases = [
    { localChats: 'x', backupChats: [], projectId: 'p' },
    { localChats: [{ id: 'a', messages: null }], backupChats: [], projectId: 'p' },
    { localChats: [{ id: 'a', messages: [7] }], backupChats: [], projectId: 'p' },
  ];
  for (const c of cases) {
    const r = mig.planMigration(Object.assign({ now: 1 }, c));
    assert.equal(r.ok, false, JSON.stringify(c));
    assert.equal(r.store, undefined);
  }
});

// ---- buildStore ----

test('buildStore produces a schema-v1 store, assigns deterministic message ids', () => {
  const b1 = mig.buildStore({ chats: [chat('a', [msg('user', 'hi', 1)])], projectId: 'p', now: 500 });
  assert.equal(b1.ok, true);
  const s1 = b1.store;
  assert.equal(s1.schemaVersion, 1);
  assert.equal(s1.projectId, 'p');
  assert.equal(s1.revision, 1);
  assert.equal(s1.activeChatId, null);
  const mid = s1.chats[0].messages[0].id;
  assert.match(mid, /^m-/);
  assert.equal(s1.chats[0].started, true, 'a chat with messages is started');
  // Deterministic: same input -> same message id.
  const s2 = mig.buildStore({ chats: [chat('a', [msg('user', 'hi', 1)])], projectId: 'p', now: 999 }).store;
  assert.equal(s2.chats[0].messages[0].id, mid);
});

test('buildStore preserves existing message ids and defaults empty chats', () => {
  const withId = { id: 'a', name: 'A', messages: [{ id: 'keep-me', cls: 'user', text: 'x', ts: 1 }] };
  const empty = { id: 'b', name: 'New chat', messages: [] };
  const s = mig.buildStore({ chats: [withId, empty], projectId: 'p', now: 7 }).store;
  assert.equal(s.chats[0].messages[0].id, 'keep-me');
  assert.equal(s.chats[1].started, false, 'empty chat is not started');
  assert.equal(s.chats[1].createdAt, 7);
});

test('buildStore is a structured API: non-array chats or bad projectId return a failure, never throw', () => {
  for (const badChats of [{}, 'x', 123, null, undefined]) {
    const b = mig.buildStore({ chats: badChats, projectId: 'p', now: 1 });
    assert.equal(b.ok, false, JSON.stringify(badChats));
    assert.match(b.error, /chats_not_an_array/);
    assert.equal(b.store, undefined);
  }
  const b2 = mig.buildStore({ chats: [], projectId: '', now: 1 });
  assert.equal(b2.ok, false); assert.match(b2.error, /invalid_project_id/);
  // A malformed chat passed DIRECTLY to buildStore fails closed, never throws.
  for (const badChat of [{ id: 'a', messages: {} }, { id: 'a', messages: [7] }, { id: 'a', messages: [], started: 'yes' }, { messages: [] }]) {
    const b = mig.buildStore({ chats: [badChat], projectId: 'p', now: 1 });
    assert.equal(b.ok, false, JSON.stringify(badChat));
    assert.match(b.error, /malformed_chats/);
    assert.equal(b.store, undefined);
  }
});

test('a chat with a wrong-typed KNOWN field (started/createdAt) FAILS closed, never coerced', () => {
  for (const bad of [
    { id: 'a', messages: [], started: 'yes' },
    { id: 'a', messages: [], createdAt: 'bad' },
    { id: 'a', messages: [], updatedAt: 'bad' },
    { id: 'a', messages: [], name: 42 },
    { id: 'a', messages: [], nameLocked: 'true' },
  ]) {
    const r = mig.reconcileChats([bad], []);
    assert.equal(r.ok, false, JSON.stringify(bad));
    assert.equal(r.malformed.some((m) => /chat_field_type:/.test(m.reason)), true);
  }
});

test('planMigration end-to-end merges prefix histories into one store', () => {
  const local = [chat('a', [msg('user', 'hi', 1)]), chat('c', [msg('user', 'only-local', 1)])];
  const backup = [chat('a', [msg('user', 'hi', 1), msg('assistant', 'more', 2)])];
  const r = mig.planMigration({ localChats: local, backupChats: backup, projectId: 'proj', now: 42 });
  assert.equal(r.ok, true);
  assert.equal(r.store.chats.length, 2);
  const a = r.store.chats.find((c) => c.id === 'a');
  assert.equal(a.messages.length, 2, 'longer history kept');
  assert.equal(r.provenance.a, 'backup-longer');
  assert.equal(r.provenance.c, 'local-only');
});
