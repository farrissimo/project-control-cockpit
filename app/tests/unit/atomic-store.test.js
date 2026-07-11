// Unit tests for app/state/atomic-store.js (Phase 2A slice 1 + integrity repair).
// Runner: node:test (`node --test`) — pure Node, imports only the module + a
// throwaway temp dir. Does NOT launch Electron/PCC and never touches a real
// project. Honors the "synthetic/copied data only" rule.
//
// Fault injection: atomic-store requires the same `fs` singleton this test does,
// so temporarily replacing fs.openSync / fs.renameSync forces the failure paths.
// Every patch is restored in a finally block.
//
// Ordering under test is PREV-FIRST: `.prev` is installed before the target, so
// a successful return means BOTH are in place (no silent-success-without-prev).

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { readJson, readPrevJson, writeJsonAtomic, writeTextAtomic } = require('../../state/atomic-store');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-atomic-')); }

// Any staging temp this module creates: `.<base>.new-…` or `.<base>.prev-…`.
// (The retained generation `<base>.prev` is NOT a temp and must not be counted.)
function leftoverTemps(dir, base) {
  return fs.readdirSync(dir).filter((f) =>
    f.startsWith('.' + base + '.new-') || f.startsWith('.' + base + '.prev-'));
}
function withPatch(obj, key, fn, body) {
  const orig = obj[key];
  obj[key] = fn(orig);
  try { return body(); } finally { obj[key] = orig; }
}

// ---- happy path ----

test('write then read round-trips the object', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  const data = { schemaVersion: 1, revision: 3, chats: [{ id: 'a', messages: [1, 2] }] };
  assert.equal(writeJsonAtomic(file, data).ok, true);
  const r = readJson(file);
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, data);
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('read of a missing file reports missing, not error', () => {
  const r = readJson(path.join(tmpDir(), 'nope.json'));
  assert.equal(r.ok, false);
  assert.equal(r.missing, true);
});

test('read of a corrupt file reports parse error, does not throw', () => {
  const file = path.join(tmpDir(), 'bad.json');
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
  assert.equal(readJson(file).data.revision, 2);
  const prev = readPrevJson(file);
  assert.equal(prev.ok, true);
  assert.equal(prev.data.revision, 1);
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('write creates missing parent directories', () => {
  const file = path.join(tmpDir(), 'nested', 'deep', 'chats.json');
  assert.equal(writeJsonAtomic(file, { ok: true }).ok, true);
  assert.equal(readJson(file).data.ok, true);
});

// ---- rejection before disk is touched ----

test('an unserializable value is REJECTED and never clobbers the existing file', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1, chats: ['good'] });
  const circular = {}; circular.self = circular;
  const w = writeJsonAtomic(file, circular);
  assert.equal(w.ok, false);
  assert.match(w.error, /serialize_failed/);
  assert.deepEqual(readJson(file).data, { revision: 1, chats: ['good'] });
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

// ---- integrity failure paths (prev-first ordering) ----

test('prior-generation STAGING failure REJECTS the write; current + .prev untouched', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });          // file gen1
  writeJsonAtomic(file, { revision: 2 });          // file gen2, .prev gen1
  const w = withPatch(fs, 'openSync', (orig) => (p, ...a) => {
    if (String(p).includes('.prev-')) throw new Error('inject prev-staging failure');
    return orig(p, ...a);
  }, () => writeJsonAtomic(file, { revision: 3 }));
  assert.equal(w.ok, false);
  assert.match(w.error, /prev_preserve_failed/);
  assert.equal(readJson(file).data.revision, 2, 'current target unchanged');
  assert.equal(readPrevJson(file).data.revision, 1, 'existing .prev unchanged');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('prior-generation INSTALL (.prev rename) failure REJECTS the write; current + .prev untouched', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });          // file gen2, .prev gen1
  const w = withPatch(fs, 'renameSync', (orig) => (from, to, ...a) => {
    if (String(to).endsWith('.prev')) throw new Error('inject .prev install failure');
    return orig(from, to, ...a);
  }, () => writeJsonAtomic(file, { revision: 3 }));
  assert.equal(w.ok, false);
  assert.match(w.error, /prev_install_failed/);
  assert.equal(readJson(file).data.revision, 2, 'current target unchanged — write rejected before target install');
  assert.equal(readPrevJson(file).data.revision, 1, 'existing .prev unchanged (rename is atomic)');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('target INSTALL (rename) failure leaves the current target intact and never reports success', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });          // file gen2, .prev gen1
  const w = withPatch(fs, 'renameSync', (orig) => (from, to, ...a) => {
    if (to === file) throw new Error('inject target rename failure');
    return orig(from, to, ...a);
  }, () => writeJsonAtomic(file, { revision: 3 }));
  assert.equal(w.ok, false, 'must not report success');
  assert.match(w.error, /rename_failed/);
  assert.equal(readJson(file).data.revision, 2, 'current target intact — no data loss');
  // KNOWN RESIDUAL: .prev may hold a valid copy of the current gen here; the
  // invariant that matters is that it is valid and no committed data was lost.
  assert.equal(readPrevJson(file).ok, true, '.prev remains valid JSON');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('a corrupt current file is NEVER copied over a valid .prev', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });          // file gen2, .prev gen1 (valid)
  fs.writeFileSync(file, '{ corrupt now', 'utf8'); // current target becomes garbage
  const w = writeJsonAtomic(file, { revision: 3 });
  assert.equal(w.ok, true);
  assert.equal(readJson(file).data.revision, 3, 'new valid target installed');
  assert.equal(readPrevJson(file).data.revision, 1, 'good .prev preserved, not clobbered by garbage');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

test('an existing valid .prev survives an early (temp-write) failed write', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });          // file gen2, .prev gen1
  const w = withPatch(fs, 'openSync', (orig) => (p, ...a) => {
    if (String(p).includes('.new-')) throw new Error('inject target temp-write failure');
    return orig(p, ...a);
  }, () => writeJsonAtomic(file, { revision: 3 }));
  assert.equal(w.ok, false);
  assert.match(w.error, /temp_write_failed/);
  assert.equal(readJson(file).data.revision, 2, 'target unchanged');
  assert.equal(readPrevJson(file).data.revision, 1, 'existing .prev survives');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

// ---- fail-closed on an unreadable-but-existing current target ----

test('a valid-but-UNREADABLE current target FAILS CLOSED (never silently overwritten)', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  writeJsonAtomic(file, { revision: 1 });
  writeJsonAtomic(file, { revision: 2 });          // file gen2 (valid), .prev gen1
  const w = withPatch(fs, 'readFileSync', (orig) => (p, ...a) => {
    if (p === file) throw Object.assign(new Error('inject EPERM'), { code: 'EPERM' });
    return orig(p, ...a);
  }, () => writeJsonAtomic(file, { revision: 3 }));
  assert.equal(w.ok, false);
  assert.match(w.error, /unreadable/);
  assert.equal(readJson(file).data.revision, 2, 'unreadable current must not be overwritten');
  assert.equal(readPrevJson(file).data.revision, 1, 'existing .prev unchanged');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

// ---- short / partial writes ----

test('a short (partial) fs.writeSync still writes the COMPLETE file (loops to completion)', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'chats.json');
  const data = { revision: 1, chats: Array.from({ length: 40 }, (_, i) => ({ id: 'c' + i, messages: [i, i + 1] })) };
  // Force every writeSync to write at most 8 bytes, simulating short writes.
  const w = withPatch(fs, 'writeSync', (orig) => (fd, buffer, offset, length, ...rest) => {
    const capped = Math.min(typeof length === 'number' ? length : buffer.length, 8);
    return orig(fd, buffer, offset, capped, ...rest);
  }, () => writeJsonAtomic(file, data));
  assert.equal(w.ok, true);
  assert.deepEqual(readJson(file).data, data, 'complete content despite 8-byte short writes');
  assert.equal(leftoverTemps(dir, 'chats.json').length, 0);
});

// ---- writeTextAtomic (durable raw-text write, e.g. PROJECT.md) ----

test('writeTextAtomic writes text and retains the prior generation in .prev', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'PROJECT.md');
  assert.equal(writeTextAtomic(file, 'v1').ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'v1');
  assert.equal(fs.existsSync(file + '.prev'), false, 'no .prev on first write');
  assert.equal(writeTextAtomic(file, 'v2').ok, true);
  assert.equal(fs.readFileSync(file, 'utf8'), 'v2');
  assert.equal(fs.readFileSync(file + '.prev', 'utf8'), 'v1', 'prior generation retained');
  assert.equal(leftoverTemps(dir, 'PROJECT.md').length, 0);
});

test('writeTextAtomic rejects a non-string and never touches the file', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'PROJECT.md');
  writeTextAtomic(file, 'keep');
  assert.equal(writeTextAtomic(file, null).ok, false);
  assert.equal(writeTextAtomic(file, 42).ok, false);
  assert.equal(fs.readFileSync(file, 'utf8'), 'keep', 'file unchanged by a rejected write');
});

test('writeTextAtomic FAILS CLOSED when the current file is unreadable (never overwrites it)', () => {
  const dir = tmpDir();
  const file = path.join(dir, 'PROJECT.md');
  writeTextAtomic(file, 'current');
  const r = withPatch(fs, 'readFileSync', (orig) => (p, ...rest) => {
    if (p === file) throw new Error('EBUSY');
    return orig(p, ...rest);
  }, () => writeTextAtomic(file, 'new'));
  assert.equal(r.ok, false);
  assert.match(r.error, /prev_preserve_failed|unreadable/);
  assert.equal(leftoverTemps(dir, 'PROJECT.md').length, 0, 'temp cleaned up on failure');
});
