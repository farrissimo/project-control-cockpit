// error-log.js is the last-resort recorder for otherwise-swallowed app failures
// (docs/audit/incident-response-diagnostics.md). Its whole value is that it (1) leaves
// a durable, parseable trace and (2) NEVER throws — a logger that can crash the code it
// logs for is worse than none. These tests pin both, plus append-not-clobber.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { logAppError } = require('../../error-log');

function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-errlog-')); }
function readLog(dir) {
  const p = path.join(dir, 'app-error.log');
  return fs.readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l));
}

test('writes one JSONL record with ts, context, message, and stack', () => {
  const dir = tmpDir();
  const ok = logAppError(dir, 'authority-store.write', new Error('disk full'));
  assert.strictEqual(ok, true);
  const rows = readLog(dir);
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].context, 'authority-store.write');
  assert.strictEqual(rows[0].message, 'disk full');
  assert.ok(rows[0].stack && rows[0].stack.includes('disk full'), 'stack captured');
  assert.ok(!Number.isNaN(Date.parse(rows[0].ts)), 'ts is a valid ISO timestamp');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('appends rather than clobbering — the audit trail accumulates', () => {
  const dir = tmpDir();
  logAppError(dir, 'ctx-a', new Error('first'));
  logAppError(dir, 'ctx-b', new Error('second'));
  const rows = readLog(dir);
  assert.strictEqual(rows.length, 2);
  assert.deepStrictEqual(rows.map((r) => r.context), ['ctx-a', 'ctx-b']);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('creates the logs directory if it does not exist', () => {
  const dir = path.join(tmpDir(), 'nested', 'logs');
  assert.strictEqual(fs.existsSync(dir), false);
  const ok = logAppError(dir, 'ctx', new Error('x'));
  assert.strictEqual(ok, true);
  assert.strictEqual(fs.existsSync(path.join(dir, 'app-error.log')), true);
});

test('handles a non-Error value without throwing', () => {
  const dir = tmpDir();
  const ok = logAppError(dir, 'ctx', 'a plain string failure');
  assert.strictEqual(ok, true);
  const rows = readLog(dir);
  assert.strictEqual(rows[0].message, 'a plain string failure');
  assert.strictEqual(rows[0].stack, undefined);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('NEVER throws and returns false when the target is unwritable', () => {
  // Point at a path that cannot be a directory (a file where a dir segment is expected).
  const dir = tmpDir();
  const filePath = path.join(dir, 'iamafile');
  fs.writeFileSync(filePath, 'x');
  const unwritable = path.join(filePath, 'logs'); // treats a file as a directory → mkdir fails
  let threw = false;
  let result;
  try { result = logAppError(unwritable, 'ctx', new Error('boom')); } catch (e) { threw = true; }
  assert.strictEqual(threw, false, 'logAppError must never throw');
  assert.strictEqual(result, false, 'signals failure by return value, not exception');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a null/undefined context is recorded as "unknown", not a crash', () => {
  const dir = tmpDir();
  const ok = logAppError(dir, null, new Error('y'));
  assert.strictEqual(ok, true);
  assert.strictEqual(readLog(dir)[0].context, 'unknown');
  fs.rmSync(dir, { recursive: true, force: true });
});
