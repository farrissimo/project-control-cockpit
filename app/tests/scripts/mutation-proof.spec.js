// Focused harness tests for scripts/run-mutation-proof.ps1 (Phase 4 Slice 1).
//
// These do NOT run the real 5-mutation proof (that is slow and is captured as a
// committed evidence receipt). They prove the ORCHESTRATOR's classification logic is
// honest, using a tiny synthetic node:test fixture so they are fast and need no
// node_modules/junction:
//   - a mutation the test catches           -> KILLED
//   - a no-op mutation the test cannot catch -> SURVIVED (a real test-confidence finding)
//   - a `find` string that is absent         -> INVALID (never a silent pass)
//   - a mutation that breaks syntax          -> INVALID (a crash is NEVER a false KILL)
// and that the run leaves the fixture SOURCE untouched (isolation).
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'run-mutation-proof.ps1');

// A self-contained fixture: one trivial module + its node:test, plus a manifest whose
// four mutations exercise each classification branch.
const MYMOD = 'module.exports = { isPos: (n) => n > 0 };\n';
const MYTEST = [
  "const { test } = require('node:test');",
  "const assert = require('node:assert');",
  "const { isPos } = require('../../mymod.js');",
  "test('positive is positive', () => { assert.equal(isPos(5), true); });",
  "test('negative is not positive', () => { assert.equal(isPos(-1), false); });",
  '',
].join('\n');

// A second fixture exercising the PLAYWRIGHT runner branch (4/5 real mutations use it).
// It resolves @playwright/test by upward module resolution to the real app/node_modules,
// because the orchestrator nests its scratch copy under app/.pcc-mut-tmp/.
const PMOD = 'module.exports = { isNeg: (n) => n < 0 };\n';
const PTEST = [
  "const { test, expect } = require('@playwright/test');",
  "const { isNeg } = require('../../pmod.js');",
  "test('negative is negative', () => { expect(isNeg(-1)).toBe(true); expect(isNeg(1)).toBe(false); });",
  '',
].join('\n');
const PCONFIG = "module.exports = { testDir: './tests' };\n";

function fixtureManifest() {
  return {
    schemaVersion: 1,
    note: 'synthetic fixture manifest for harness tests',
    mutations: [
      { id: 'should-kill', priority: 'p', productBehavior: 'isPos rejects negatives',
        file: 'app/mymod.js', runner: 'node-test', testFile: 'tests/unit/mymod.test.js',
        detector: 'negative is not positive', find: 'n > 0', replace: 'true' },
      { id: 'should-survive', priority: 'p', productBehavior: 'isPos rejects negatives',
        file: 'app/mymod.js', runner: 'node-test', testFile: 'tests/unit/mymod.test.js',
        detector: 'negative is not positive', find: 'n > 0', replace: 'n > 0 || false' },
      { id: 'should-invalid-absent', priority: 'p', productBehavior: 'x',
        file: 'app/mymod.js', runner: 'node-test', testFile: 'tests/unit/mymod.test.js',
        detector: 'd', find: 'n > 999999', replace: 'true' },
      { id: 'should-invalid-syntax', priority: 'p', productBehavior: 'x',
        file: 'app/mymod.js', runner: 'node-test', testFile: 'tests/unit/mymod.test.js',
        detector: 'd', find: 'n > 0', replace: 'n > 0 &&' },
      { id: 'pw-should-kill', priority: 'p', productBehavior: 'isNeg rejects positives',
        file: 'app/pmod.js', runner: 'playwright', testFile: 'tests/unit/pmod.spec.js',
        detector: 'negative is negative', find: 'n < 0', replace: 'true' },
    ],
  };
}

let dir, appDir, mymodPath, manifestPath, receiptPath, result;

test.beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-mutharness-'));
  appDir = path.join(dir, 'app');
  fs.mkdirSync(path.join(appDir, 'tests', 'unit'), { recursive: true });
  mymodPath = path.join(appDir, 'mymod.js');
  fs.writeFileSync(mymodPath, MYMOD);
  fs.writeFileSync(path.join(appDir, 'tests', 'unit', 'mymod.test.js'), MYTEST);
  fs.writeFileSync(path.join(appDir, 'pmod.js'), PMOD);
  fs.writeFileSync(path.join(appDir, 'tests', 'unit', 'pmod.spec.js'), PTEST);
  fs.writeFileSync(path.join(appDir, 'playwright.config.js'), PCONFIG);
  manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(fixtureManifest(), null, 2));
  receiptPath = path.join(dir, 'receipt.json');

  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT,
    '-AppDir', appDir, '-ManifestPath', manifestPath, '-ReceiptPath', receiptPath, '-Json'],
    { cwd: REPO, encoding: 'utf8', timeout: 180000, windowsHide: true });
  // stdout is the JSON receipt; parse the object out of it.
  const text = (r.stdout || '').trim();
  const start = text.indexOf('{');
  result = { exit: r.status, receipt: JSON.parse(text.slice(start)) };
});

test.afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ } });

function classOf(id) {
  const row = result.receipt.results.find((x) => x.id === id);
  return row ? row.classification : '(missing)';
}

test('a mutation the test catches is classified KILLED (node:test runner)', () => {
  expect(classOf('should-kill')).toBe('KILLED');
});

test('the PLAYWRIGHT runner branch also classifies a caught mutation KILLED', () => {
  expect(classOf('pw-should-kill')).toBe('KILLED');
});

test('a no-op mutation the test cannot catch is classified SURVIVED', () => {
  expect(classOf('should-survive')).toBe('SURVIVED');
});

test('an absent find string is INVALID, never a silent pass', () => {
  expect(classOf('should-invalid-absent')).toBe('INVALID');
});

test('a syntax-breaking mutation is INVALID — a crash is never a false KILL', () => {
  expect(classOf('should-invalid-syntax')).toBe('INVALID');
});

test('the aggregate is honest (not allKilled) and exit is nonzero when a mutation survives', () => {
  expect(result.receipt.summary.allKilled).toBe(false);
  expect(result.receipt.summary.killed).toBe(2);   // should-kill (node) + pw-should-kill (playwright)
  expect(result.receipt.summary.survived).toBe(1);
  expect(result.receipt.summary.invalid).toBe(2);
  expect(result.exit).not.toBe(0);
});

test('the fixture SOURCE is left byte-identical (isolation: the real file is only read)', () => {
  expect(fs.readFileSync(mymodPath, 'utf8')).toBe(MYMOD);
});

test('the receipt records what the proof does and does not establish (honest scope)', () => {
  expect(result.receipt.doesNotProve).toMatch(/not a mutation score/i);
  expect(result.receipt.proves).toMatch(/KILLED/);
});
