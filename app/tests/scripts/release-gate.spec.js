// Release gate (docs/HARDENING_RELEASE_GATE.md) — SLICE 1, fresh-run only.
//
// The gate is a THIN ORCHESTRATOR: it collects facts from authorities (git, detect-repo-sync,
// git ls-remote, ci-status, the npm suites, the detectors) and combines them under one policy.
// These tests drive the REAL gate in throwaway repos where each authority is a controllable fake:
//   - fake sibling scripts (ci-status.ps1, detect-*.ps1) emit chosen JSON;
//   - a local bare git remote makes `git ls-remote` deterministic and offline;
//   - a fake `npm` on PATH returns chosen exit codes.
// The production script carries ZERO test-awareness — all control is external. Every test asserts
// the honest verdict (PASS/FAIL/UNKNOWN) and exit code (0/1/2).
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const APPROVED_BLOAT = [
  'large file: app/main.js (1313 lines > 600)',
  'large file: app/renderer/renderer.js (2231 lines > 600)',
];

function psArray(items) { return '@(' + items.map((s) => "'" + String(s).replace(/'/g, "''") + "'").join(',') + ')'; }

function fakeCiStatus({ status = 'passed', sha = '$Sha', moveHead = false, moveBranch = false }) {
  let move = moveHead ? 'git commit --allow-empty -m moved-during-run *> $null\n' : '';
  if (moveBranch) move += 'git checkout -b moved-during-run *> $null\n'; // same SHA, different branch
  const shaExpr = sha === '$Sha' ? '$Sha' : "'" + sha + "'";
  return `param([string]$Sha,[switch]$Json)\n${move}@{ sha = ${shaExpr}; status = '${status}'; detail = 'fake-ci' } | ConvertTo-Json -Compress\n`;
}
function fakeDetector({ signal = 'clear', items = [], malformed = false }) {
  if (malformed) return "param([switch]$Json)\nWrite-Output 'this is not json {'\n";
  return `param([switch]$Json)\n@{ signal='${signal}'; items=${psArray(items)}; observed='x'; might_mean='x'; not_proven='x'; what_to_do='x' } | ConvertTo-Json -Compress\n`;
}
function fakeRepoSync(signal) {
  return `param([switch]$Json)\n@{ signal='${signal}'; observed='x'; might_mean='x'; not_proven='x'; what_to_do='x' } | ConvertTo-Json -Compress\n`;
}
// Fake branch-protection checker: emits the same contract as scripts/check-branch-protection.ps1
// (schema/verdict/ruleset_name/reasons/not_proven) so the gate reads a deterministic linchpin verdict
// instead of hitting the real GitHub API against the fixture's fake origin.
function fakeBranchProtection(verdict) {
  const reason = verdict === 'PASS' ? '' : `fake ${verdict}`;
  return `param([string]$Repo,[string]$FixtureRuleset,[string]$FixtureRulesetsList,[switch]$Json)\n@{ schema='branch-protection-check/v1'; repo='fake'; verdict='${verdict}'; ruleset_name='protect-main'; reasons=@('${reason}' | Where-Object { $_ }); not_proven='' } | ConvertTo-Json -Compress\n`;
}
// A fake `npm` that exits with a code chosen by args (via env vars set per test).
function fakeNpmCmd() {
  return [
    '@echo off',
    'if "%PCC_FAKE_UNIT%"=="" set PCC_FAKE_UNIT=0',
    'if "%PCC_FAKE_FULL%"=="" set PCC_FAKE_FULL=0',
    'if "%PCC_FAKE_AUDIT%"=="" set PCC_FAKE_AUDIT=0',
    'echo %* | findstr /C:"test:unit" >nul && exit /b %PCC_FAKE_UNIT%',
    'echo %* | findstr /C:"audit" >nul && exit /b %PCC_FAKE_AUDIT%',
    'exit /b %PCC_FAKE_FULL%',
  ].join('\r\n') + '\r\n';
}

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

// Build a throwaway repo with all authorities faked. opts overrides the all-green default.
function makeGateRepo(opts = {}) {
  const o = Object.assign({
    ci: { status: 'passed', sha: '$Sha', moveHead: false },
    backup: 'clear',
    detectors: { bloat: { signal: 'clear', items: [] }, drift: { signal: 'clear', items: [] }, 'stale-docs': { signal: 'clear', items: [] } },
    suites: { unit: 0, full: 0, audit: 0 },
    remote: 'match',
    bloatExceptionItems: APPROVED_BLOAT,
    branchProtection: 'PASS',
    dirty: false,
  }, opts);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-rg-'));
  const bin = path.join(dir, 'fakebin');
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'schemas'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.mkdirSync(bin, { recursive: true });

  // real gate + real schema; faked authorities
  fs.copyFileSync(path.join(REPO, 'scripts', 'run-release-gate.ps1'), path.join(dir, 'scripts', 'run-release-gate.ps1'));
  fs.copyFileSync(path.join(REPO, 'schemas', 'release-gate.schema.json'), path.join(dir, 'schemas', 'release-gate.schema.json'));
  // The canonical hang guard travels WITH the gate (both live in scripts/), so the fixture copies it by
  // default — the full suite then runs guarded (guard='active'), matching real deployment. `noGuard:true`
  // omits it to exercise the fail-closed path: a required-but-missing guard => suite 'unavailable' => UNKNOWN.
  if (!o.noGuard) fs.copyFileSync(path.join(REPO, 'scripts', 'run-guarded.ps1'), path.join(dir, 'scripts', 'run-guarded.ps1'));
  fs.writeFileSync(path.join(dir, 'scripts', 'ci-status.ps1'), fakeCiStatus(o.ci));
  fs.writeFileSync(path.join(dir, 'scripts', 'detect-repo-sync.ps1'), fakeRepoSync(o.backup));
  fs.writeFileSync(path.join(dir, 'scripts', 'check-branch-protection.ps1'), fakeBranchProtection(o.branchProtection));
  for (const d of ['bloat', 'drift', 'stale-docs']) {
    fs.writeFileSync(path.join(dir, 'scripts', 'detect-' + d + '.ps1'), fakeDetector(o.detectors[d] || { signal: 'clear', items: [] }));
  }
  fs.writeFileSync(path.join(dir, 'app', 'package.json'), JSON.stringify({ name: 'fake', scripts: {} }));
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'release-gate-exceptions.json'), JSON.stringify({ exceptions_id: 'release-gate-exceptions-v1', bloat_notice_items: o.bloatExceptionItems }));
  fs.writeFileSync(path.join(bin, 'npm.cmd'), fakeNpmCmd());
  // ignore generated receipt so it never dirties the tree (mirrors the real repo)
  fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');

  git(dir, ['init']);
  git(dir, ['config', 'user.email', 't@t.local']);
  git(dir, ['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(dir, 'readme.txt'), 'seed');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'seed']);
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (o.remote === 'match' || o.remote === 'mismatch') {
    // bare remote lives OUTSIDE the working tree so it never shows up as an untracked file
    const bare = (dir + '.remote.git').replace(/\\/g, '/');
    execFileSync('git', ['init', '--bare', bare], { encoding: 'utf8' });
    git(dir, ['remote', 'add', 'origin', bare]);
    git(dir, ['push', '-q', 'origin', branch]);
    if (o.remote === 'mismatch') git(dir, ['commit', '--allow-empty', '-m', 'local-ahead']); // HEAD advances, remote stays
  }
  if (o.dirty) fs.writeFileSync(path.join(dir, 'uncommitted.txt'), 'dirty');

  const env = Object.assign({}, process.env, {
    PATH: bin + path.delimiter + process.env.PATH,
    PCC_FAKE_UNIT: String(o.suites.unit), PCC_FAKE_FULL: String(o.suites.full), PCC_FAKE_AUDIT: String(o.suites.audit),
  });
  return { dir, env, sha: git(dir, ['rev-parse', 'HEAD']), branch };
}

function runGate(dir, env) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/run-release-gate.ps1', '-Json', '-Quiet'],
    { cwd: dir, env, encoding: 'utf8', timeout: 60000 });
  let record = null;
  try { record = JSON.parse(r.stdout.trim()); } catch (e) { /* leave null */ }
  return { record, code: r.status, stdout: r.stdout, stderr: r.stderr };
}
function reasons(rec) { return (rec && rec.verdict && rec.verdict.reasons || []).join(' '); }
function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.rmSync(dir + '.remote.git', { recursive: true, force: true });
}

test('a valid fresh run passes', () => {
  const { dir, env, sha } = makeGateRepo();
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('PASS');
    expect(code).toBe(0);
    expect(record.commit).toBe(sha);
    expect(record.suites.full.guard).toBe('active'); // the full suite ran THROUGH the hang guard
  } finally { cleanup(dir); }
});

test('a missing hang guard downgrades the gate to UNKNOWN (fail closed, never a false green)', () => {
  // The guard is the canonical MANDATORY path. On a degraded copy without scripts/run-guarded.ps1, the
  // full suite cannot be bounded, so the gate must NOT report a clean green even if the raw suite exits
  // 0 — it records guard='absent', marks the suite 'unavailable', and the overall verdict is UNKNOWN.
  const { dir, env } = makeGateRepo({ noGuard: true, suites: { unit: 0, full: 0, audit: 0 } });
  try {
    const { record } = runGate(dir, env);
    expect(record.suites.full.guard).toBe('absent');
    expect(record.suites.full.status).toBe('unavailable');
    expect(record.verdict.overall).toBe('UNKNOWN'); // never PASS when the mandatory guard is missing
  } finally { cleanup(dir); }
});

test('dirty tree fails', () => {
  const { dir, env } = makeGateRepo({ dirty: true });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/tree_clean/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('HEAD changing during the run fails', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'passed', sha: '$Sha', moveHead: true } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/head_stable/);
    expect(record.head_stable).toBe(false);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('branch changing during the run fails (same SHA, different branch)', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'passed', sha: '$Sha', moveBranch: true } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/branch_stable/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('actual remote head mismatch fails', () => {
  const { dir, env } = makeGateRepo({ remote: 'mismatch' });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/remote_head/);
    expect(record.remote_head.state).toBe('mismatch');
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('unavailable remote truth becomes UNKNOWN (never PASS)', () => {
  const { dir, env } = makeGateRepo({ remote: 'none' });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('UNKNOWN');
    expect(record.remote_head.state).toBe('unavailable');
    expect(code).toBe(2);
  } finally { cleanup(dir); }
});

test('red CI fails', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'failed', sha: '$Sha' } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/ci/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('skipped CI fails', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'skipped', sha: '$Sha' } });
  try {
    const { record } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/ci/);
  } finally { cleanup(dir); }
});

// Branch protection is the linchpin the whole server-side "un-bypassable" guarantee rests on. The gate
// must FAIL closed when it is absent/weakened (bypass-evidence audit, ADR-0009): a commit is not safely
// releasable if the backstop that makes every bypass catchable is off.
test('branch protection FAIL fails the gate (linchpin off => not releasable)', () => {
  const { dir, env } = makeGateRepo({ branchProtection: 'FAIL' });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.branch_protection.verdict).toBe('FAIL');
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/branch_protection/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('branch protection UNKNOWN becomes UNKNOWN (never a green PASS over an unconfirmed backstop)', () => {
  const { dir, env } = makeGateRepo({ branchProtection: 'UNKNOWN' });
  try {
    const { record } = runGate(dir, env);
    expect(record.branch_protection.verdict).toBe('UNKNOWN');
    expect(record.verdict.overall).toBe('UNKNOWN');
    expect(reasons(record)).toMatch(/branch_protection/);
  } finally { cleanup(dir); }
});

test('missing CI becomes UNKNOWN (never PASS)', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'missing', sha: '$Sha' } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('UNKNOWN');
    expect(code).toBe(2);
  } finally { cleanup(dir); }
});

test('pending CI becomes UNKNOWN', () => {
  const { dir, env } = makeGateRepo({ ci: { status: 'pending', sha: '$Sha' } });
  try {
    const { record } = runGate(dir, env);
    expect(record.verdict.overall).toBe('UNKNOWN');
  } finally { cleanup(dir); }
});

test('a CI pass bound to the wrong SHA fails', () => {
  const wrong = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef';
  const { dir, env } = makeGateRepo({ ci: { status: 'passed', sha: wrong } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/ci/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

for (const suite of ['unit', 'full', 'audit']) {
  test(`a failing ${suite} suite command fails`, () => {
    const suites = { unit: 0, full: 0, audit: 0 };
    suites[suite] = 1;
    const { dir, env } = makeGateRepo({ suites });
    try {
      const { record, code } = runGate(dir, env);
      expect(record.verdict.overall).toBe('FAIL');
      expect(reasons(record)).toMatch(new RegExp('suite:' + suite));
      expect(code).toBe(1);
    } finally { cleanup(dir); }
  });
}

test('malformed detector output becomes UNKNOWN (documented; never silently clear)', () => {
  const { dir, env } = makeGateRepo({ detectors: { bloat: { malformed: true }, drift: { signal: 'clear', items: [] }, 'stale-docs': { signal: 'clear', items: [] } } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('UNKNOWN');
    expect(reasons(record)).toMatch(/detector:bloat/);
    expect(code).toBe(2);
  } finally { cleanup(dir); }
});

test('the exact two-item bloat notice is accepted and disclosed', () => {
  const { dir, env } = makeGateRepo({ detectors: { bloat: { signal: 'notice', items: APPROVED_BLOAT }, drift: { signal: 'clear', items: [] }, 'stale-docs': { signal: 'clear', items: [] } } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('PASS');
    expect(code).toBe(0);
    expect(record.exceptions_applied.length).toBe(1);
    expect(record.exceptions_applied[0].detector).toBe('bloat');
  } finally { cleanup(dir); }
});

test('a changed bloat item (line count) is NOT excused and fails', () => {
  const changed = ['large file: app/main.js (1400 lines > 600)', APPROVED_BLOAT[1]];
  const { dir, env } = makeGateRepo({ detectors: { bloat: { signal: 'notice', items: changed }, drift: { signal: 'clear', items: [] }, 'stale-docs': { signal: 'clear', items: [] } } });
  try {
    const { record } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/detector:bloat/);
  } finally { cleanup(dir); }
});

test('an ADDITIONAL bloat item beyond the approved two is NOT excused and fails', () => {
  const extra = APPROVED_BLOAT.concat(['large file: app/new.js (9000 lines > 600)']);
  const { dir, env } = makeGateRepo({ detectors: { bloat: { signal: 'notice', items: extra }, drift: { signal: 'clear', items: [] }, 'stale-docs': { signal: 'clear', items: [] } } });
  try {
    const { record } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/detector:bloat/);
  } finally { cleanup(dir); }
});

test('an unapproved detector notice (drift) fails', () => {
  const { dir, env } = makeGateRepo({ detectors: { bloat: { signal: 'clear', items: [] }, drift: { signal: 'notice', items: ['out of scope: foo'] }, 'stale-docs': { signal: 'clear', items: [] } } });
  try {
    const { record, code } = runGate(dir, env);
    expect(record.verdict.overall).toBe('FAIL');
    expect(reasons(record)).toMatch(/detector:drift/);
    expect(code).toBe(1);
  } finally { cleanup(dir); }
});

test('the generated receipt validates against the schema and names the exact SHA', () => {
  const { dir, env, sha } = makeGateRepo();
  try {
    const { record } = runGate(dir, env);
    expect(record.schema).toBe('release-gate/v1');
    expect(record.evidence_valid).toBe(true);
    expect(record.commit).toBe(sha);
    expect(record.commit_at_end).toBe(sha);
    // the receipt exists on disk and independently validates against the schema
    const receipt = path.join(dir, '.cockpit', 'evidence', 'release-gate.json');
    expect(fs.existsSync(receipt)).toBe(true);
    const check = spawnSync('pwsh', ['-NoProfile', '-Command',
      `Test-Json -Json (Get-Content -Raw '${receipt.replace(/\\/g, '/')}') -SchemaFile '${path.join(dir, 'schemas', 'release-gate.schema.json').replace(/\\/g, '/')}'`],
      { encoding: 'utf8' });
    expect(check.stdout.trim()).toBe('True');
  } finally { cleanup(dir); }
});
