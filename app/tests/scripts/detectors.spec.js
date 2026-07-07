// Layer 1 — the deterministic truth engine. Each detector/status script is the
// real source of PCC's honest signals; the app is just a consumer. These tests
// run the scripts exactly as main.js does (`pwsh -File <script> -Json`) and
// assert the CLI contract: valid JSON in the four-part "Observed / might mean /
// NOT proven / what to do" shape. No Electron here — pure CLI, fast, and it
// proves the extractability guarantee (scripts work without app/).
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..'); // repo root (app/ is one below)

function runJson(script, extraArgs = []) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', script, '-Json', ...extraArgs],
    { cwd: REPO, encoding: 'utf8', timeout: 30000, windowsHide: true });
  return { code: r.status, stdout: (r.stdout || '').trim(), stderr: r.stderr || '' };
}

const DETECTORS = [
  'scripts/detect-untracked.ps1',
  'scripts/detect-drift.ps1',
  'scripts/detect-stale-docs.ps1',
  'scripts/detect-repo-sync.ps1',
  'scripts/detect-bloat.ps1',
];

for (const script of DETECTORS) {
  test('detector emits valid four-part JSON: ' + script, () => {
    const { stdout } = runJson(script);
    let obj;
    expect(() => { obj = JSON.parse(stdout); }, 'output was not valid JSON:\n' + stdout).not.toThrow();
    for (const key of ['signal', 'observed', 'might_mean', 'not_proven', 'what_to_do']) {
      expect(obj, script + ' missing key: ' + key).toHaveProperty(key);
    }
    // Signal is one of the honest, bounded values — never a fabricated verdict.
    expect(['clear', 'notice', 'unknown']).toContain(obj.signal);
  });
}

test('lifecycle-status emits a stage result', () => {
  const { stdout } = runJson('scripts/lifecycle-status.ps1');
  const obj = JSON.parse(stdout);
  expect(obj).toHaveProperty('signal');
});

test('recent-decisions emits a decisions array', () => {
  const { stdout } = runJson('scripts/recent-decisions.ps1', ['-Count', '3']);
  const obj = JSON.parse(stdout);
  expect(Array.isArray(obj.decisions)).toBe(true);
});

test('babysitting-metrics emits proxy counts', () => {
  const { stdout } = runJson('scripts/babysitting-metrics.ps1');
  const obj = JSON.parse(stdout);
  expect(obj).toHaveProperty('commits_total');
});

test('doctor.ps1 runs and produces output', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/doctor.ps1'],
    { cwd: REPO, encoding: 'utf8', timeout: 120000, windowsHide: true });
  expect((r.stdout || '') + (r.stderr || '')).not.toHaveLength(0);
});
