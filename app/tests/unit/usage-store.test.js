// PCC's own durable mirror of the last real usage reading (usage-store.js). Pins that it round-trips
// a valid reading, NEVER persists or returns a bogus/partial/fake-fresh one, and fails safe (null,
// never a throw) on missing/corrupt files. Temp fixtures only — never touches real data.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { sanitizeReading, loadUsageCache, saveUsageCache } = require('../../usage-store.js');

const GOOD = { sessionPercent: 12, weeklyPercent: 30, asOfMs: 1784646056682 };
function tmpDir() { return fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-usagestore-')); }

test('sanitizeReading accepts a fully-valid reading and strips extra fields', () => {
  assert.deepStrictEqual(sanitizeReading({ ...GOOD, junk: 1 }), GOOD);
  assert.deepStrictEqual(sanitizeReading({ sessionPercent: 0, weeklyPercent: 100, asOfMs: 1 }),
    { sessionPercent: 0, weeklyPercent: 100, asOfMs: 1 });
});

test('sanitizeReading rejects anything invalid -> null (never a partial/fabricated reading)', () => {
  for (const bad of [
    null, undefined, 'x', 42,
    { sessionPercent: 12, weeklyPercent: 30 },                 // no timestamp
    { sessionPercent: 12, asOfMs: 1 },                          // no weekly
    { sessionPercent: -1, weeklyPercent: 30, asOfMs: 1 },       // out of range
    { sessionPercent: 101, weeklyPercent: 30, asOfMs: 1 },      // out of range
    { sessionPercent: 12, weeklyPercent: 30, asOfMs: 0 },       // non-positive epoch
    { sessionPercent: 12, weeklyPercent: 30, asOfMs: 'now' },   // non-numeric epoch
    { sessionPercent: NaN, weeklyPercent: 30, asOfMs: 1 },
  ]) {
    assert.strictEqual(sanitizeReading(bad), null, JSON.stringify(bad));
  }
});

test('save then load round-trips a valid reading', () => {
  const dir = tmpDir();
  try {
    assert.strictEqual(saveUsageCache(dir, GOOD), true);
    assert.deepStrictEqual(loadUsageCache(dir), GOOD);
    assert.ok(!fs.existsSync(path.join(dir, 'usage-cache.json.tmp')), 'no torn temp file left behind');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('load returns null (never throws) on a missing or corrupt file', () => {
  const dir = tmpDir();
  try {
    assert.strictEqual(loadUsageCache(dir), null);                 // missing
    fs.writeFileSync(path.join(dir, 'usage-cache.json'), '{not json', 'utf8');
    assert.strictEqual(loadUsageCache(dir), null);                 // corrupt
    fs.writeFileSync(path.join(dir, 'usage-cache.json'), JSON.stringify({ sessionPercent: 999, weeklyPercent: 1, asOfMs: 1 }), 'utf8');
    assert.strictEqual(loadUsageCache(dir), null);                 // out-of-range -> rejected, not surfaced
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('save refuses to persist a bogus reading (returns false, writes nothing)', () => {
  const dir = tmpDir();
  try {
    assert.strictEqual(saveUsageCache(dir, { sessionPercent: 12, weeklyPercent: 30 }), false); // no timestamp
    assert.ok(!fs.existsSync(path.join(dir, 'usage-cache.json')), 'nothing written for a bogus reading');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
