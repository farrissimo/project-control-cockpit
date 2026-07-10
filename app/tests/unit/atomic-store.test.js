// Unit tests for app/state/atomic-store.js (Phase 2A slice 1).
// Runner: node:test (`node --test`) — pure Node, imports only the module + a
// throwaway temp dir. Does NOT launch Electron/PCC and never touches a real
// project. Honors the "synthetic/copied data only" rule.

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readJson, readPrevJson, writeJsonAtomic } = require('../../state/atomic-store');

function tmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-atomic-'));
}
function leftoverTemps(dir, base) {
  return fs.readdirSync(dir).filter((f) => f.startsWith('.' + base + '.tmp-'));
}

test('write then read round-trips the object', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  const data = { schemaVersion: 1, revision: 3, chats: [{ id: 'a', messages: [1, 2] }] };
  const w = writeJsonAtomic(file, data);
  assert.equal(w.ok, true);
  const r = readJson(file);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, data);
});

test('read of a missing file reports missing, not error', () => {
  const dir = tmpDir();
  const r = readJson(path.join(dir, 'nope.json'));
  assert.equal(r.ok, false);
  assert.equal(r.missing, true);
});

test('read of a corrupt file reports parse error, does not throw', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'bad.json');
  fs.writeFileSync(file, '{ this is not json', 'utf8');
  const r = readJson(file);
  assert.equal(r.ok, false);
  assert.match(r.error, /parse_failed/);
});

test('second write retains the immediately-prior generation as .prev', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1, chats: ['one'] });
  writeJsonAtomic(file, { revision: 2, chats: ['one', 'two'] });
  const cur = readJson(file);
  const prev = readPrevJson(file);
  assert.equal(cur.data.revision, 2);
  assert.equal(prev.ok, true);
  assert.equal(prev.data.revision, 1, 'prev must hold the last good generation');
});

test('an unserializable value is REJECTED and never clobbers the existing file', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1, chats: ['good'] });
  const circular = {}; circular.self = circular;
  const w = writeJsonAtomic(file, circular);
  assert.equal(w.ok, false);
  assert.match(w.error, /serialize_failed/);
  // the good file must be exactly as it was
  const r = readJson(file);
  assert.equal(r.ok, true);
  assert.equal(r.data.revision, 1);
  assert.deepEqual(r.data.chats, ['good']);
});

test('no temp files are left behind after a successful write', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('write creates missing parent directories', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'nested', 'deep', 'chats.json');
  const w = writeJsonAtomic(file, { ok: true });
  assert.equal(w.ok, true);
  assert.equal(readJson(file).data.ok, true);
});
