// Governance Hardening (docs/specs/governance-hardening.md) — Sub-slice A.
// Drives the REAL scripts/resolve-audit-range.ps1 (T1) and the REAL .githooks/pre-commit fail-closed
// path (T3) in throwaway git repos. Production scripts/hooks carry zero test-awareness.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }
function resolve(dir, args) {
  return spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/resolve-audit-range.ps1', ...args],
    { cwd: dir, encoding: 'utf8', timeout: 60000, windowsHide: true });
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// A minimal repo with the resolver + its baseline commit.
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-govh-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'resolve-audit-range.ps1'), path.join(dir, 'scripts', 'resolve-audit-range.ps1'));
  fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\n');
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 'test@pcc.local']);
  git(dir, ['config', 'user.name', 'pcc-test']);
  git(dir, ['branch', '-M', 'main']);
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '--no-verify', '-m', 'baseline']);
  return dir;
}

// AC-1: a push to the default branch that resolves to an EMPTY range fails closed (never audits nothing).
test('AC-1: resolver fails closed on an empty push-to-default range', () => {
  const dir = makeRepo();
  try {
    const head = git(dir, ['rev-parse', 'HEAD']);
    // before == sha == HEAD -> HEAD..HEAD is empty -> must fail closed
    const r = resolve(dir, ['-EventName', 'push', '-RefName', 'main', '-DefaultBranch', 'main',
      '-Before', head, '-Sha', head, '-BaseRef', 'origin/main']);
    expect(r.status).not.toBe(0);
    expect((r.stdout || '').trim()).toBe('');
    expect(r.stderr || '').toContain('FAIL CLOSED');
  } finally { cleanup(dir); }
});

// AC-2: a push to the default branch with real commits emits <before>..<sha> (not HEAD..HEAD).
test('AC-2: resolver emits the push range on a real push to the default branch', () => {
  const dir = makeRepo();
  try {
    const before = git(dir, ['rev-parse', 'HEAD']);
    fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\nmore\n');
    git(dir, ['commit', '-q', '--no-verify', '-am', 'second']);
    const sha = git(dir, ['rev-parse', 'HEAD']);
    const r = resolve(dir, ['-EventName', 'push', '-RefName', 'main', '-DefaultBranch', 'main',
      '-Before', before, '-Sha', sha, '-BaseRef', 'origin/main']);
    expect(r.status).toBe(0);
    expect((r.stdout || '').trim()).toBe(`${before}..${sha}`);
  } finally { cleanup(dir); }
});

// AC-3: a pull_request event emits merge-base(<BaseRef>,HEAD)..HEAD.
test('AC-3: resolver emits the merge-base range for a pull_request event', () => {
  const dir = makeRepo();
  try {
    const base = git(dir, ['rev-parse', 'HEAD']);
    git(dir, ['update-ref', 'refs/remotes/origin/main', base]); // trusted base ref
    fs.writeFileSync(path.join(dir, 'README.md'), 'baseline\npr change\n');
    git(dir, ['commit', '-q', '--no-verify', '-am', 'pr commit']);
    const r = resolve(dir, ['-EventName', 'pull_request', '-RefName', 'feature', '-DefaultBranch', 'main',
      '-BaseRef', 'origin/main']);
    expect(r.status).toBe(0);
    expect((r.stdout || '').trim()).toBe(`${base}..HEAD`);
  } finally { cleanup(dir); }
});

// AC-3b: a push to the default branch that includes a MERGE commit must PASS (emit the range), not
// fail closed. Regression guard against re-breaking the resolver to fail-close on merge pushes:
// emptiness is measured on TOTAL commit count, not non-merge count, so the audit (which skips merges)
// still runs over the range and correctly finds nothing crucial when a push carries only a merge.
test('AC-3b: resolver emits the range for a merge push to the default branch', () => {
  const dir = makeRepo();
  try {
    const before = git(dir, ['rev-parse', 'HEAD']);
    git(dir, ['checkout', '-q', '-b', 'side']);
    fs.writeFileSync(path.join(dir, 'side.txt'), 'side\n');
    git(dir, ['add', 'side.txt']);
    git(dir, ['commit', '-q', '--no-verify', '-m', 'side commit']);
    git(dir, ['checkout', '-q', 'main']);
    git(dir, ['merge', '--no-ff', '--no-verify', '-m', 'merge side', 'side']);
    const sha = git(dir, ['rev-parse', 'HEAD']);
    const r = resolve(dir, ['-EventName', 'push', '-RefName', 'main', '-DefaultBranch', 'main',
      '-Before', before, '-Sha', sha, '-BaseRef', 'origin/main']);
    expect(r.status).toBe(0);
    expect((r.stdout || '').trim()).toBe(`${before}..${sha}`);
  } finally { cleanup(dir); }
});

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
