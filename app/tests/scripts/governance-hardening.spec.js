// Governance Hardening (docs/specs/governance-hardening.md).
// Drives the REAL .githooks/pre-commit fail-closed path (T3) and the REAL judge-from-trusted-main
// audit (B / ADR-0008) in throwaway git repos. Production scripts/hooks carry zero test-awareness.
// NOTE: the CI audit RANGE is computed inline in .github/workflows/ci.yml bash (ADR-0008) and proven
// by the live push + pull_request CI runs — there is no resolver script to unit-test here.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// --- T3: the pre-commit hook fails closed when pwsh is missing ---

// Build a PATH that has git + sh + coreutils (git-for-windows bin dirs) but NOT pwsh, so the hook's
// `command -v pwsh` fails and the fail-closed branch runs.
function gitBinPath() {
  const execPath = execFileSync('git', ['--exec-path'], { encoding: 'utf8' }).trim();
  let root = execPath;
  for (let i = 0; i < 6; i++) {
    root = path.dirname(root);
    if (fs.existsSync(path.join(root, 'bin', 'sh.exe')) || fs.existsSync(path.join(root, 'usr', 'bin', 'sh.exe'))) break;
  }
  const candidates = [
    path.join(root, 'bin'), path.join(root, 'usr', 'bin'),
    path.join(root, 'cmd'), path.join(root, 'mingw64', 'bin'),
  ].filter((d) => fs.existsSync(d));
  return candidates.join(path.delimiter);
}

function makeHookRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-govh-hook-'));
  fs.mkdirSync(path.join(dir, '.githooks'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'backlog'), { recursive: true });
  fs.copyFileSync(path.join(REPO, '.githooks', 'pre-commit'), path.join(dir, '.githooks', 'pre-commit'));
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@pcc.local']);
  git(dir, ['config', 'user.name', 'pcc-test']);
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'baseline']);
  return dir;
}

function runHookNoPwsh(dir) {
  const env = { ...process.env, PATH: gitBinPath() };
  // sanity: pwsh must be absent under this PATH, else the test proves nothing
  const probe = spawnSync('sh', ['-c', 'command -v pwsh'], { cwd: dir, env, encoding: 'utf8' });
  const pwshVisible = (probe.stdout || '').trim().length > 0 && probe.status === 0;
  return { r: spawnSync('sh', ['.githooks/pre-commit'], { cwd: dir, env, encoding: 'utf8', timeout: 60000 }), pwshVisible };
}

// AC-4: pwsh absent + a crucial (T0) path staged -> hook blocks (exit non-zero).
test('AC-4: pre-commit fails closed (blocks) without pwsh when a crucial path is staged', () => {
  const dir = makeHookRepo();
  try {
    fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// crucial change\n');
    git(dir, ['add', 'app/state/atomic-store.js']);
    const { r, pwshVisible } = runHookNoPwsh(dir);
    expect(pwshVisible).toBe(false); // the constructed PATH really hides pwsh
    expect(r.status).not.toBe(0);
    expect((r.stdout || '') + (r.stderr || '')).toContain('Failing CLOSED');
  } finally { cleanup(dir); }
});

// AC-4b: pwsh absent + a staged DELETION of a noise-tier path -> hook blocks (deletions escalate to
// >= T1; the path allowlist alone would wrongly wave it through). Regression guard for the fail-open
// an independent review flagged (archive/ + delete_or_rename).
test('AC-4b: pre-commit fails closed without pwsh on a staged deletion, even of a noise path', () => {
  const dir = makeHookRepo();
  try {
    // create + commit a backlog file, then stage its deletion
    fs.writeFileSync(path.join(dir, 'backlog', 'old.md'), '# to be removed\n');
    git(dir, ['add', 'backlog/old.md']);
    git(dir, ['commit', '-q', '--no-verify', '-m', 'add backlog file']);
    git(dir, ['rm', '-q', 'backlog/old.md']);
    const { r, pwshVisible } = runHookNoPwsh(dir);
    expect(pwshVisible).toBe(false);
    expect(r.status).not.toBe(0);
    expect((r.stdout || '') + (r.stderr || '')).toContain('Failing CLOSED');
  } finally { cleanup(dir); }
});

// AC-4c: pwsh absent AND a git query fails -> hook fails closed (blocks), never treats empty output
// as "noise only". Regression guard for the git-error fail-open an independent (GPT) review flagged.
// Simulated by running the hook where `git diff --cached` errors (a non-git directory).
test('AC-4c: pre-commit fails closed without pwsh when a git query errors', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-govh-nogit-'));
  try {
    fs.mkdirSync(path.join(dir, '.githooks'), { recursive: true });
    fs.copyFileSync(path.join(REPO, '.githooks', 'pre-commit'), path.join(dir, '.githooks', 'pre-commit'));
    // NOTE: no `git init` — `git diff --cached` here exits non-zero, so the hook must block.
    const env = { ...process.env, PATH: gitBinPath() };
    const probe = spawnSync('sh', ['-c', 'command -v pwsh'], { cwd: dir, env, encoding: 'utf8' });
    expect((probe.stdout || '').trim().length > 0 && probe.status === 0).toBe(false);
    const r = spawnSync('sh', ['.githooks/pre-commit'], { cwd: dir, env, encoding: 'utf8', timeout: 60000 });
    expect(r.status).not.toBe(0);
    expect((r.stdout || '') + (r.stderr || '')).toContain('git query failed');
  } finally { cleanup(dir); }
});

// AC-5: pwsh absent + only a noise-tier ADD staged -> hook allows (exit 0).
test('AC-5: pre-commit allows without pwsh when only noise-tier paths are staged', () => {
  const dir = makeHookRepo();
  try {
    fs.writeFileSync(path.join(dir, 'backlog', 'note.md'), '# a backlog note\n');
    git(dir, ['add', 'backlog/note.md']);
    const { r, pwshVisible } = runHookNoPwsh(dir);
    expect(pwshVisible).toBe(false);
    expect(r.status).toBe(0);
  } finally { cleanup(dir); }
});

// ===================== Sub-slice B (ADR-0008): judge-from-trusted-main =====================

const GOV_FILES = [
  'scripts/emit-verification-trailer.ps1', 'scripts/audit-verification-trailers.ps1',
  'scripts/write-verification-receipt.ps1', 'scripts/run-governance-gate.ps1', 'scripts/classify-stakes.ps1',
  'scripts/lib/change-identity.ps1', 'scripts/lib/receipt-check.ps1', 'scripts/lib/atomic-write.ps1',
  'schemas/verification-receipt.schema.json', '.cockpit/state/stakes-manifest.json', '.githooks/commit-msg',
];
function makeGovRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-govb-'));
  for (const sub of ['scripts/lib', 'schemas', '.cockpit/state', 'app/state', '.githooks']) {
    fs.mkdirSync(path.join(dir, sub), { recursive: true });
  }
  for (const f of GOV_FILES) fs.copyFileSync(path.join(REPO, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, '.gitignore'), '.cockpit/evidence/\n');
  fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// baseline T0 file\n');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@pcc.local']);
  git(dir, ['config', 'user.name', 'pcc-test']);
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'baseline governor']);
  return dir;
}
function auditWith(scriptDir, cwd, range) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', path.join(scriptDir, 'scripts', 'audit-verification-trailers.ps1'),
    '-Json', '-Range', range], { cwd, encoding: 'utf8', timeout: 60000, windowsHide: true });
  let json = null; try { json = JSON.parse((r.stdout || '').trim()); } catch (e) { /* leave null */ }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

// AC-B2 (the ADR-0008 success metric): a PR that WEAKENS its own classifier in the same commit as an
// unverified T0 change passes when judged by its OWN copy, but FAILS when judged from a trusted
// origin/main worktree. Proves self-modifying enforcement is closed for the governor scripts.
test('AC-B2: judge-from-main catches a PR that weakens its own classifier', () => {
  const dir = makeGovRepo();
  let trusted = null;
  try {
    const base = git(dir, ['rev-parse', 'HEAD']);
    git(dir, ['checkout', '-q', '-b', 'pr']);
    // (a) an unverified crucial T0 change, and (b) a classifier neutered to call everything T4.
    fs.writeFileSync(path.join(dir, 'app', 'state', 'atomic-store.js'), '// baseline T0 file\n// unverified crucial change\n');
    const weakened = [
      "param([switch]$Json,[string]$Files,[string]$Added,[string]$Deleted,[string]$Baseline='main')",
      "$out=[ordered]@{schema='stakes-classification/v1';tier='T4';base_tier='T4';reasons=@('weakened');files=@();escalations=@();not_proven=''}",
      "if($Json){$out|ConvertTo-Json -Depth 6}else{Write-Host 'TIER: T4'}",
      "exit 0",
    ].join("\n");
    fs.writeFileSync(path.join(dir, 'scripts', 'classify-stakes.ps1'), weakened);
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '--no-verify', '-m', 'sneaky T0 + weakened classifier']); // no trailer
    const prHead = git(dir, ['rev-parse', 'HEAD']);
    const range = `${base}..${prHead}`;

    // (1) THE HOLE: audited with the PR's OWN weakened classifier -> wrongly PASSES.
    const own = auditWith(dir, dir, range);
    expect(own.json.overall).toBe('PASS');

    // (2) THE FIX: audited from a detached `main` worktree (trusted) -> correctly FAILS.
    trusted = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-trusted-'));
    fs.rmSync(trusted, { recursive: true, force: true }); // `git worktree add` needs a non-existent path
    git(dir, ['worktree', 'add', '--detach', trusted, 'main']);
    const judged = auditWith(trusted, trusted, range);
    expect(judged.json.overall).toBe('FAIL');
    expect(judged.status).toBe(1);
  } finally {
    if (trusted) { try { git(dir, ['worktree', 'remove', '--force', trusted]); } catch (e) { /* ignore */ } }
    cleanup(dir);
  }
});
