// Focused harness tests for scripts/run-failure-injection.ps1 (Phase 5 Slice 1).
//
// These do NOT run the real 6 injections (that is captured as a committed evidence
// receipt). They prove the ORCHESTRATOR's classification is HONEST across all four
// outcomes using tiny synthetic scenarios that emit controlled JSON — so a harness
// problem can never be laundered into a "safe" result:
//   RECOVERED / CONTAINED  — baseline ok + injection fired + all checks ok
//   EXPOSED                — baseline ok + injection fired + a safety check FAILED
//   INVALID                — crash / no-JSON / baseline-not-established /
//                            injection-not-triggered / no-assertions  (never success)
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'run-failure-injection.ps1');

// Emit a scenario that prints a controlled JSON result (or crashes / stays silent).
function scenarioSource({ baselineOk = true, injectionTriggered = true, expected = 'CONTAINED', checks = [{ name: 'x', ok: true, detail: 'd' }], crash = false, silent = false }) {
  if (crash) return "process.exit(3);\n";
  if (silent) return "console.log('no json here');\n";
  const obj = { id: 'SYN', expected, baselineOk, injectionTriggered, observed: 'synthetic', checks };
  return 'console.log(JSON.stringify(' + JSON.stringify(obj) + '));\n';
}

let dir, manifestPath, receiptPath, result;

test.beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-fih-'));
  const cases = [
    { id: 'c-recovered', variant: { expected: 'RECOVERED', checks: [{ name: 'a', ok: true, detail: '' }] } },
    { id: 'c-contained', variant: { expected: 'CONTAINED', checks: [{ name: 'a', ok: true, detail: '' }] } },
    { id: 'c-exposed', variant: { expected: 'CONTAINED', checks: [{ name: 'a', ok: true, detail: '' }, { name: 'b', ok: false, detail: 'safety check failed' }] } },
    { id: 'c-invalid-baseline', variant: { baselineOk: false } },
    { id: 'c-invalid-noinjection', variant: { injectionTriggered: false } },
    { id: 'c-invalid-nochecks', variant: { checks: [] } },
    { id: 'c-invalid-crash', variant: { crash: true } },
    { id: 'c-invalid-silent', variant: { silent: true } },
  ];
  const manifestCases = cases.map((c) => {
    const p = path.join(dir, c.id + '.js');
    fs.writeFileSync(p, scenarioSource(c.variant));
    return { id: c.id, priority: 'p', boundary: 'synthetic', injectedFault: 'synthetic', runner: 'node', scenario: p, expected: c.variant.expected || 'CONTAINED' };
  });
  manifestPath = path.join(dir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify({ schemaVersion: 1, note: 'synthetic', cases: manifestCases }, null, 2));
  receiptPath = path.join(dir, 'receipt.json');

  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-ManifestPath', manifestPath, '-ReceiptPath', receiptPath, '-Json'],
    { cwd: REPO, encoding: 'utf8', timeout: 120000, windowsHide: true });
  const text = (r.stdout || '').trim();
  result = { exit: r.status, receipt: JSON.parse(text.slice(text.indexOf('{'))) };
});

test.afterAll(() => { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ } });

function classOf(id) { const row = result.receipt.results.find((x) => x.id === id); return row ? row.classification : '(missing)'; }

test('a met RECOVERED expectation classifies RECOVERED', () => { expect(classOf('c-recovered')).toBe('RECOVERED'); });
test('a met CONTAINED expectation classifies CONTAINED', () => { expect(classOf('c-contained')).toBe('CONTAINED'); });
test('a failed safety check classifies EXPOSED (a real defect is never hidden)', () => { expect(classOf('c-exposed')).toBe('EXPOSED'); });
test('baseline-not-established is INVALID, never a pass', () => { expect(classOf('c-invalid-baseline')).toBe('INVALID'); });
test('injection-not-triggered is INVALID, never a pass', () => { expect(classOf('c-invalid-noinjection')).toBe('INVALID'); });
test('no safety assertions is INVALID, never a pass', () => { expect(classOf('c-invalid-nochecks')).toBe('INVALID'); });
test('a crashed scenario is INVALID — a harness failure is never counted as containment', () => { expect(classOf('c-invalid-crash')).toBe('INVALID'); });
test('a scenario that emits no JSON is INVALID', () => { expect(classOf('c-invalid-silent')).toBe('INVALID'); });

test('the aggregate is honest and exit is nonzero when anything is EXPOSED/INVALID', () => {
  const s = result.receipt.summary;
  expect(s.recovered).toBe(1);
  expect(s.contained).toBe(1);
  expect(s.exposed).toBe(1);
  expect(s.invalid).toBe(5);
  expect(s.allSafe).toBe(false);
  expect(result.exit).not.toBe(0);
});

test('the receipt states what it proves and does not (honest scope, incl. the durability caveat)', () => {
  expect(result.receipt.doesNotProve).toMatch(/not a chaos framework|not exhaustive/i);
  expect(result.receipt.doesNotProve).toMatch(/power-loss/i);
  expect(result.receipt.proves).toMatch(/fails closed|recover/i);
});
