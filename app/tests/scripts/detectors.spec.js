// Layer 1 — the deterministic truth engine. Each detector/status script is the
// real source of PCC's honest signals; the app is just a consumer. These tests
// run the scripts exactly as main.js does (`pwsh -File <script> -Json`) and
// assert the CLI contract: valid JSON in the four-part "Observed / might mean /
// NOT proven / what to do" shape. No Electron here — pure CLI, fast, and it
// proves the extractability guarantee (scripts work without app/).
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
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
  'scripts/detect-high-stakes.ps1',
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

// Soak fix F9: when the configured baseline ref does not exist, drift must degrade to
// 'unknown' — NOT silently fall back to a working-tree-only diff and report a false
// 'clear'. Reproduced in a throwaway repo whose scope points at a ref that cannot exist.
test('drift degrades to UNKNOWN when the baseline ref is missing (F9)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-drift-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'seed'],
      { cwd: tmp, encoding: 'utf8' });
    // The detector pins to its own repo via $PSScriptRoot, so run a copy from tmp/scripts.
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-drift.ps1'), path.join(tmp, 'scripts', 'detect-drift.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'app-build-scope.json'),
      JSON.stringify({ compare_baseline: 'no-such-baseline-ref-xyz', allowed_globs: ['product/**'] }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-drift.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'missing baseline must be unknown, not a false clear:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Soak fix F10: exclude_globs must keep the copied PCC engine out of a project's
// bloat scan. A large file matching an exclude glob is skipped; a large product file
// is still flagged.
test('bloat excludes engine files via exclude_globs, still flags product (F10)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-bloat-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-bloat.ps1'), path.join(tmp, 'scripts', 'detect-bloat.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'bloat-thresholds.json'), JSON.stringify({
      max_source_file_lines: 100, max_dependencies: 20,
      source_globs: ['app/**.js', 'product/**.js'], exclude_globs: ['app/**'],
    }));
    const big = Array.from({ length: 200 }, (_, i) => '// ' + i).join('\n');
    fs.mkdirSync(path.join(tmp, 'app', 'renderer'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'app', 'renderer', 'engine.js'), big); // engine — must be excluded
    fs.mkdirSync(path.join(tmp, 'product'));
    fs.writeFileSync(path.join(tmp, 'product', 'big.js'), big); // product — must be flagged
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['add', '-A'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'x'], { cwd: tmp, encoding: 'utf8' });
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-bloat.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    const flagged = (obj.items || []).join('\n');
    expect(flagged, 'engine file must be excluded').not.toContain('engine.js');
    expect(flagged, 'product file must be flagged').toContain('product/big.js');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Metric-honesty parity (2026-07-16 audit): bloat was the ONE config-driven detector
// missing the guard its siblings (drift/stale-docs/high-stakes) already have. A PRESENT
// but MALFORMED bloat-thresholds.json must degrade to 'unknown' — it used to swallow the
// parse error and report a false 'clear' ("within the limits you set") over zero files.
test('bloat degrades to UNKNOWN on a malformed config (green-over-unchecked)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-bloatbad-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-bloat.ps1'), path.join(tmp, 'scripts', 'detect-bloat.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'bloat-thresholds.json'), '{ this is not valid json ');
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'x'], { cwd: tmp, encoding: 'utf8' });
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-bloat.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'a malformed config checks nothing -> unknown, not a false clear:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Same class: a well-formed config that declares NO source_globs and NO dependency_manifests
// scans zero files. Reporting 'clear' would paint green over an unchecked project (and note the
// PowerShell @($null).Count === 1 trap that made the naive guard miss this). Must be 'unknown'.
test('bloat degrades to UNKNOWN when nothing is declared to scan', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-bloatempty-'));
  try {
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-bloat.ps1'), path.join(tmp, 'scripts', 'detect-bloat.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'bloat-thresholds.json'),
      JSON.stringify({ max_source_file_lines: 600, max_dependencies: 20 })); // no source_globs / manifests
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'x'], { cwd: tmp, encoding: 'utf8' });
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-bloat.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'nothing declared to scan -> unknown, not a false clear:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Soak fix F9 (stale-docs half): like drift, stale-docs must degrade to 'unknown' when
// the configured baseline ref is missing, not report a false 'clear'.
test('stale-docs degrades to UNKNOWN when the baseline ref is missing (F9)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-stale-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'seed'], { cwd: tmp, encoding: 'utf8' });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-stale-docs.ps1'), path.join(tmp, 'scripts', 'detect-stale-docs.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'doc-freshness-map.json'), JSON.stringify({
      compare_baseline: 'no-such-baseline-ref-xyz',
      rules: [{ id: 'r1', when_changed: ['app/*.js'], expect_updated: ['README.md'], satisfied_by: 'any' }],
    }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-stale-docs.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'missing baseline must be unknown, not clear:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Metric-honesty fix (2026-07-14): a detector that did not actually check anything must
// read 'unknown', never 'clear'. A green badge over an empty rule set is a false all-clear
// (same bug class as F9). stale-docs with ZERO declared rules must degrade to 'unknown'.
test('stale-docs degrades to UNKNOWN when no rules are defined (green-over-unchecked)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-stale0-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'seed'], { cwd: tmp, encoding: 'utf8' });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-stale-docs.ps1'), path.join(tmp, 'scripts', 'detect-stale-docs.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'doc-freshness-map.json'), JSON.stringify({ rules: [] }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-stale-docs.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'zero rules means nothing was checked -> unknown, not a false clear:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// Metric-honesty fix (2026-07-14): high-stakes must degrade to 'unknown' when the baseline
// ref is missing (parity with the drift/stale-docs F9 fix), instead of reporting clear/notice
// off a degraded HEAD-only comparison.
test('high-stakes degrades to UNKNOWN when the baseline ref is missing', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-hs-'));
  try {
    spawnSync('git', ['init'], { cwd: tmp, encoding: 'utf8' });
    spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '--allow-empty', '-q', '-m', 'seed'], { cwd: tmp, encoding: 'utf8' });
    fs.mkdirSync(path.join(tmp, 'scripts'));
    fs.copyFileSync(path.join(REPO, 'scripts', 'detect-high-stakes.ps1'), path.join(tmp, 'scripts', 'detect-high-stakes.ps1'));
    fs.mkdirSync(path.join(tmp, '.cockpit', 'state'), { recursive: true });
    fs.writeFileSync(path.join(tmp, '.cockpit', 'state', 'high-stakes-rules.json'), JSON.stringify({
      compare_baseline: 'no-such-baseline-ref-xyz',
      high_stakes_globs: ['docs/**'],
    }));
    const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/detect-high-stakes.ps1', '-Json'],
      { cwd: tmp, encoding: 'utf8', timeout: 30000, windowsHide: true });
    const obj = JSON.parse((r.stdout || '').trim());
    expect(obj.signal, 'missing baseline must be unknown, not a degraded clear/notice:\n' + r.stdout).toBe('unknown');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('doctor.ps1 runs and produces output', () => {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/doctor.ps1'],
    { cwd: REPO, encoding: 'utf8', timeout: 120000, windowsHide: true });
  expect((r.stdout || '') + (r.stderr || '')).not.toHaveLength(0);
});
