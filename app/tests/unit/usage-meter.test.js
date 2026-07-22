// Owner's real Claude usage stat (desktop-parity R1). Pins the pure parser's honesty: a real
// reading only when the desktop app's own cache genuinely has one, UNAVAILABLE on anything else
// (missing/malformed/empty), and freshness (ageMs/stale) is always told straight, never hidden.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseUsageSample, readPlanUsage, applyLastGood } = require('../../usage-meter.js');

const NOW = 1784283784308; // matches a real captured sample's timestamp for round-number diffs

function withSamples(samples) { return { version: 2, samples: samples }; }

test('a real sample yields the exact session/weekly percent + age, not stale', () => {
  const r = parseUsageSample(withSamples([{ t: NOW - 60000, org: 'o1', u: { fh: 29, sd: 26 } }]), NOW);
  assert.deepStrictEqual(r, { ok: true, available: true, sessionPercent: 29, weeklyPercent: 26, asOfMs: NOW - 60000, ageMs: 60000, stale: false });
});

test('picks the LATEST sample by timestamp, not array order', () => {
  const r = parseUsageSample(withSamples([
    { t: NOW - 1000, org: 'o1', u: { fh: 50, sd: 10 } },   // newer, listed first
    { t: NOW - 500000, org: 'o1', u: { fh: 1, sd: 1 } },   // older
  ]), NOW);
  assert.strictEqual(r.sessionPercent, 50);
});

test('a reading older than the stale threshold is still shown but flagged stale (no fake-live)', () => {
  const { STALE_MS } = require('../../usage-meter.js');
  const r = parseUsageSample(withSamples([{ t: NOW - (STALE_MS + 1), org: 'o1', u: { fh: 10, sd: 10 } }]), NOW);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.stale, true);
});

test('missing/non-object input -> unavailable malformed, never a fabricated 0%', () => {
  assert.deepStrictEqual(parseUsageSample(null, NOW), { ok: true, available: false, reason: 'malformed' });
  assert.deepStrictEqual(parseUsageSample(undefined, NOW), { ok: true, available: false, reason: 'malformed' });
  assert.deepStrictEqual(parseUsageSample('not an object', NOW), { ok: true, available: false, reason: 'malformed' });
});

test('samples not an array -> unavailable malformed', () => {
  assert.deepStrictEqual(parseUsageSample({ samples: 'nope' }, NOW), { ok: true, available: false, reason: 'malformed' });
  assert.deepStrictEqual(parseUsageSample({}, NOW), { ok: true, available: false, reason: 'malformed' });
});

test('empty samples array -> unavailable empty (distinct reason from malformed)', () => {
  assert.deepStrictEqual(parseUsageSample(withSamples([]), NOW), { ok: true, available: false, reason: 'empty' });
});

test('every sample entry malformed (no valid timestamp) -> unavailable malformed', () => {
  const r = parseUsageSample(withSamples([{ u: { fh: 1, sd: 1 } }, { t: 'not-a-number', u: { fh: 1, sd: 1 } }]), NOW);
  assert.deepStrictEqual(r, { ok: true, available: false, reason: 'malformed' });
});

test('latest sample missing u / fh / sd -> unavailable malformed, does not fall back to an older good one', () => {
  const r = parseUsageSample(withSamples([
    { t: NOW - 100, org: 'o1' },                              // newest, but no u at all
    { t: NOW - 999999, org: 'o1', u: { fh: 5, sd: 5 } },       // older, well-formed
  ]), NOW);
  assert.deepStrictEqual(r, { ok: true, available: false, reason: 'malformed' });
});

test('out-of-range or non-numeric percent values are rejected, never clamped into a fake number', () => {
  for (const u of [{ fh: -1, sd: 10 }, { fh: 101, sd: 10 }, { fh: 'NaN', sd: 10 }, { fh: 10, sd: null }, { fh: NaN, sd: 10 }]) {
    const r = parseUsageSample(withSamples([{ t: NOW, org: 'o1', u }]), NOW);
    assert.strictEqual(r.available, false, JSON.stringify(u));
  }
});

test('a future-dated sample (clock skew / corrupted cache) is unavailable, never treated as fresh (Codex-caught)', () => {
  const r = parseUsageSample(withSamples([{ t: NOW + 60000, org: 'o1', u: { fh: 50, sd: 50 } }]), NOW);
  assert.deepStrictEqual(r, { ok: true, available: false, reason: 'malformed' });
});

test('a sample timestamped exactly now is available with ageMs 0 (the boundary itself is fine)', () => {
  const r = parseUsageSample(withSamples([{ t: NOW, org: 'o1', u: { fh: 1, sd: 1 } }]), NOW);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.ageMs, 0);
});

test('0 and 100 are valid boundary percentages', () => {
  const r = parseUsageSample(withSamples([{ t: NOW, org: 'o1', u: { fh: 0, sd: 100 } }]), NOW);
  assert.deepStrictEqual(r, { ok: true, available: true, sessionPercent: 0, weeklyPercent: 100, asOfMs: NOW, ageMs: 0, stale: false });
});

// --- readPlanUsage: the appData-directory resolution (the 2026-07-21 no_file fix) ---
// The app process can lack process.env.APPDATA entirely (reproduced live on the owner's machine:
// the meter read "no_file" over healthy data). The Electron caller now passes a resolved appData
// directory (app.getPath('appData')); these pin that the passed directory is honored and that a
// missing env var no longer breaks a real reading. Temp fixtures only — never touches real data.
function makeAppData(samplesJson) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-usage-'));
  fs.mkdirSync(path.join(dir, 'Claude'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'Claude', 'plan-usage-history.json'), samplesJson, 'utf8');
  return dir;
}

test('reads via the passed appData dir EVEN WHEN process.env.APPDATA is missing (the real fix)', () => {
  const dir = makeAppData(JSON.stringify(withSamples([{ t: NOW - 60000, org: 'o1', u: { fh: 42, sd: 7 } }])));
  const savedAppData = process.env.APPDATA;
  try {
    delete process.env.APPDATA;                 // reproduce the owner's broken app process exactly
    const r = readPlanUsage(NOW, dir);
    assert.strictEqual(r.available, true, 'should read a real number with no APPDATA env when the dir is passed');
    assert.strictEqual(r.sessionPercent, 42);
    assert.strictEqual(r.weeklyPercent, 7);
  } finally {
    if (savedAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = savedAppData;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('with NO appData dir passed AND no APPDATA env -> honest no_file, never a fabricated number', () => {
  const savedAppData = process.env.APPDATA;
  try {
    delete process.env.APPDATA;
    assert.deepStrictEqual(readPlanUsage(NOW), { ok: true, available: false, reason: 'no_file' });
  } finally {
    if (savedAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = savedAppData;
  }
});

test('the passed appData dir takes precedence over process.env.APPDATA', () => {
  const good = makeAppData(JSON.stringify(withSamples([{ t: NOW - 1000, org: 'o1', u: { fh: 55, sd: 5 } }])));
  const savedAppData = process.env.APPDATA;
  try {
    process.env.APPDATA = path.join(os.tmpdir(), 'pcc-usage-does-not-exist-' + NOW); // env points nowhere
    const r = readPlanUsage(NOW, good);         // passed dir must win
    assert.strictEqual(r.available, true);
    assert.strictEqual(r.sessionPercent, 55);
  } finally {
    if (savedAppData === undefined) delete process.env.APPDATA; else process.env.APPDATA = savedAppData;
    fs.rmSync(good, { recursive: true, force: true });
  }
});

// --- readPlanUsage retry: rides the desktop app's atomic-replace window (the 2026-07-21 fragility) ---
// A transient ENOENT/EBUSY/EPERM/EACCES during the file swap must NOT blank the meter; a genuinely
// missing file (or a non-transient error) still resolves honestly to no_file. `deps` injects a fake
// reader + no-op sleep so this is deterministic and instant.
function transientThenOk(failCount, code, json) {
  let calls = 0;
  return {
    fs: { readFileSync: () => { calls++; if (calls <= failCount) { const e = new Error('transient'); e.code = code; throw e; } return json; } },
    sleep: () => {},
    calls: () => calls,
  };
}

test('a momentary file LOCK is retried and then succeeds', () => {
  const json = JSON.stringify(withSamples([{ t: NOW - 1000, org: 'o1', u: { fh: 12, sd: 3 } }]));
  for (const code of ['EBUSY', 'EPERM', 'EACCES']) {
    const dep = transientThenOk(2, code, json);   // locked twice, readable on the 3rd try
    const r = readPlanUsage(NOW, 'C:\\any', dep);
    assert.strictEqual(r.available, true, code);
    assert.strictEqual(r.sessionPercent, 12, code);
    assert.strictEqual(dep.calls(), 3, code);
  }
});

test('a non-lock read error is NOT retried; falls through to honest no_file', () => {
  let calls = 0;
  const dep = { fs: { readFileSync: () => { calls++; const e = new Error('is a directory'); e.code = 'EISDIR'; throw e; } }, sleep: () => {} };
  const r = readPlanUsage(NOW, 'C:\\any', dep);
  assert.deepStrictEqual(r, { ok: true, available: false, reason: 'no_file' });
  assert.strictEqual(calls, 1); // NOT retried
});

test('a persistent LOCK exhausts the bounded retries then honest no_file (never hangs)', () => {
  let calls = 0;
  const dep = { fs: { readFileSync: () => { calls++; const e = new Error('locked'); e.code = 'EBUSY'; throw e; } }, sleep: () => {} };
  const r = readPlanUsage(NOW, 'C:\\any', dep);
  assert.strictEqual(r.available, false);
  assert.strictEqual(r.reason, 'no_file');
  assert.strictEqual(calls, 4); // initial + 3 bounded retries on the single candidate
});

test('MSIX/Store install: reads the DIRECT package path, not the un-traversable Roaming junction', () => {
  // Reproduces the owner's machine: %APPDATA%\Claude is a dead junction (ENOENT), but the real file
  // lives under %LOCALAPPDATA%\Packages\Claude_*\LocalCache\Roaming\Claude. Must read the package path.
  const json = JSON.stringify(withSamples([{ t: NOW - 1000, org: 'o1', u: { fh: 20, sd: 5 } }]));
  const pkgFile = path.join('C:\\ud', 'Local', 'Packages', 'Claude_abc', 'LocalCache', 'Roaming', 'Claude', 'plan-usage-history.json');
  let pkgReads = 0;
  const dep = {
    fs: {
      readdirSync: (d) => { if (/Packages$/i.test(d)) return ['Claude_abc', 'SomethingElse']; throw Object.assign(new Error('x'), { code: 'ENOENT' }); },
      readFileSync: (f) => {
        if (f === pkgFile) { pkgReads++; return json; }               // the MSIX package path works
        const e = new Error('gone'); e.code = 'ENOENT'; throw e;       // the Roaming junction is dead
      },
    }, sleep: () => {},
  };
  const r = readPlanUsage(NOW, 'C:\\ud\\Roaming', dep);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.sessionPercent, 20);   // read from the package path
  assert.strictEqual(pkgReads, 1);            // exactly once — ENOENT on junction was not retried
});

// --- applyLastGood: never blank the meter over a transient failure, but never fake a live number ---
test('applyLastGood: a fresh available reading always wins and is returned as-is', () => {
  const fresh = { ok: true, available: true, sessionPercent: 5, weeklyPercent: 9, asOfMs: NOW, ageMs: 0, stale: false };
  assert.strictEqual(applyLastGood(fresh, { sessionPercent: 99, weeklyPercent: 99, asOfMs: NOW - 1000 }, NOW), fresh);
});

test('applyLastGood: fresh unavailable but recent last-good -> serves last-good, honestly aged', () => {
  const r = applyLastGood({ ok: true, available: false, reason: 'no_file' }, { sessionPercent: 33, weeklyPercent: 12, asOfMs: NOW - 90000 }, NOW);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.sessionPercent, 33);
  assert.strictEqual(r.weeklyPercent, 12);
  assert.strictEqual(r.ageMs, 90000);       // TRUE age, recomputed — not a fake "just now"
  assert.strictEqual(r.stale, false);        // 90s < STALE_MS
  assert.strictEqual(r.servedFromLastGood, true);
});

test('applyLastGood: served last-good past the stale threshold is flagged stale (no fake-live)', () => {
  const { STALE_MS } = require('../../usage-meter.js');
  const r = applyLastGood({ available: false, reason: 'no_file' }, { sessionPercent: 1, weeklyPercent: 1, asOfMs: NOW - (STALE_MS + 1000) }, NOW);
  assert.strictEqual(r.available, true);
  assert.strictEqual(r.stale, true);
});

test('applyLastGood: last-good older than the 60-min hard expiry is dropped -> honest unavailable', () => {
  const { LAST_GOOD_MAX_AGE_MS } = require('../../usage-meter.js');
  const fresh = { ok: true, available: false, reason: 'no_file' };
  assert.strictEqual(applyLastGood(fresh, { sessionPercent: 33, weeklyPercent: 12, asOfMs: NOW - (LAST_GOOD_MAX_AGE_MS + 1000) }, NOW), fresh);
});

test('applyLastGood: no last-good and a future-dated last-good both fall through to the honest result', () => {
  const fresh = { ok: true, available: false, reason: 'empty' };
  assert.strictEqual(applyLastGood(fresh, null, NOW), fresh);
  assert.strictEqual(applyLastGood(fresh, { sessionPercent: 5, weeklyPercent: 5, asOfMs: NOW + 60000 }, NOW), fresh);
});
