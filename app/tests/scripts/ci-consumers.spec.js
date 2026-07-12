// CI authority convergence (Phase 2 Slice 1). Proves that PCC's exact-SHA GitHub CI truth has ONE
// implementation — scripts/ci-status.ps1 — and that the consumers (the Electron orchestrator
// app/ci-status.js#fetchCiChip and scripts/verify-evidence.ps1) invoke it rather than recreating
// GitHub API / check-run interpretation. Drives the REAL code in throwaway repos with a faked
// ci-status.ps1; no network.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fetchCiChip } = require('../../ci-status');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

// A fake ci-status.ps1: echoes the -Sha it received (or a fixed literal) with a chosen status.
function fakeCi({ status = 'passed', sha = '$Sha', malformed = false, exit = 0 } = {}) {
  if (malformed) return "param([string]$Sha,[switch]$Json,[switch]$UrlOnly)\nWrite-Output 'not json {'\n";
  const shaExpr = sha === '$Sha' ? '$Sha' : "'" + sha + "'";
  const tail = exit !== 0 ? `\nexit ${exit}\n` : '\n';
  return `param([string]$Sha,[switch]$Json,[switch]$UrlOnly)\n@{ sha = ${shaExpr}; status = '${status}'; detail = 'fake' } | ConvertTo-Json -Compress${tail}`;
}

// A project repo whose scripts/ci-status.ps1 is the given fake (or absent when fake===null).
function makeProject(fake) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cic-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  if (fake !== null) fs.writeFileSync(path.join(dir, 'scripts', 'ci-status.ps1'), fake);
  git(dir, ['init']);
  git(dir, ['config', 'user.email', 't@t.local']);
  git(dir, ['config', 'user.name', 'T']);
  fs.writeFileSync(path.join(dir, 'a.txt'), 'x');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', 'seed']);
  return { dir, sha: git(dir, ['rev-parse', 'HEAD']) };
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// ---- A. ci-status.ps1 offline parse (-UrlOnly: no network) ----
function makePsRepo(remoteUrl) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-cis-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'ci-status.ps1'), path.join(dir, 'scripts', 'ci-status.ps1'));
  git(dir, ['init']);
  if (remoteUrl) git(dir, ['remote', 'add', 'origin', remoteUrl]);
  return dir;
}
function urlOnly(dir) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/ci-status.ps1', '-Sha', 'c'.repeat(40), '-UrlOnly'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(r.stdout.trim());
}

test('ci-status.ps1: no remote → target no_remote (offline)', () => {
  const dir = makePsRepo(null);
  try { expect(urlOnly(dir).target).toBe('no_remote'); } finally { cleanup(dir); }
});

test('ci-status.ps1: non-GitHub remote → target not_github (offline)', () => {
  const dir = makePsRepo('https://gitlab.com/owner/repo.git');
  try { expect(urlOnly(dir).target).toBe('not_github'); } finally { cleanup(dir); }
});

test('ci-status.ps1: a dotted GitHub repo name is preserved in the query URL (offline)', () => {
  const dir = makePsRepo('https://github.com/acme/widget.ui.git');
  try {
    const t = urlOnly(dir).target;
    expect(t).toContain('/repos/acme/widget.ui/commits/');
    expect(t).not.toContain('widget.ui.git');
  } finally { cleanup(dir); }
});

// ---- B. fetchCiChip orchestration (invokes the ACTIVE project's ci-status.ps1 with exact HEAD) ----
test('fetchCiChip invokes the project ci-status.ps1 with the exact HEAD sha; passed → green', async () => {
  const { dir, sha } = makeProject(fakeCi({ status: 'passed' }));
  try {
    const chip = await fetchCiChip(dir);
    expect(chip).toEqual({ ok: true, available: true, state: 'passed', sha });
  } finally { cleanup(dir); }
});

test('fetchCiChip maps failed → red, pending → pending, missing → none', async () => {
  for (const [status, expected] of [['failed', { available: true, state: 'failed' }], ['pending', { available: true, state: 'pending' }], ['missing', { available: true, state: 'none' }]]) {
    const { dir } = makeProject(fakeCi({ status }));
    try { expect(await fetchCiChip(dir)).toMatchObject(expected); } finally { cleanup(dir); }
  }
});

test('fetchCiChip: a result bound to a different sha is NEVER green', async () => {
  const { dir } = makeProject(fakeCi({ status: 'passed', sha: 'd'.repeat(40) })); // ignores -Sha, returns wrong sha
  try {
    const chip = await fetchCiChip(dir);
    expect(chip.available).toBe(false);
    expect(chip.reason).toBe('sha_mismatch');
  } finally { cleanup(dir); }
});

test('fetchCiChip: a MISSING ci-status.ps1 degrades to unavailable (honest unknown)', async () => {
  const { dir } = makeProject(null);
  try {
    const chip = await fetchCiChip(dir);
    expect(chip.available).toBe(false);
  } finally { cleanup(dir); }
});

test('fetchCiChip: malformed helper output degrades to unavailable', async () => {
  const { dir } = makeProject(fakeCi({ malformed: true }));
  try { expect((await fetchCiChip(dir)).available).toBe(false); } finally { cleanup(dir); }
});

// A helper that prints a valid 'passed' but EXITS NONZERO (failed/interrupted run) must not be trusted.
test('fetchCiChip: valid JSON but a nonzero helper exit degrades to unavailable (never green)', async () => {
  const { dir } = makeProject(fakeCi({ status: 'passed', exit: 1 }));
  try {
    const chip = await fetchCiChip(dir);
    expect(chip.available).toBe(false);
  } finally { cleanup(dir); }
});

test('project switching: fetchCiChip runs the ACTIVE project helper, not another project', async () => {
  const green = makeProject(fakeCi({ status: 'passed' }));
  const red = makeProject(fakeCi({ status: 'failed' }));
  try {
    expect((await fetchCiChip(green.dir)).state).toBe('passed');
    expect((await fetchCiChip(red.dir)).state).toBe('failed'); // switched project → its own helper result
  } finally { cleanup(green.dir); cleanup(red.dir); }
});

// ---- C. structural: the consumers no longer interpret the GitHub check-runs API themselves ----
test('no consumer re-implements GitHub CI interpretation (only ci-status.ps1 may)', () => {
  const forbidden = [/api\.github\.com/, /check_runs/, /decideCiStatus/, /parseGitHubRepo/];
  for (const rel of ['app/main.js', 'app/ci-status.js', 'scripts/verify-evidence.ps1']) {
    const text = fs.readFileSync(path.join(REPO, rel), 'utf8');
    for (const re of forbidden) {
      expect(re.test(text), `${rel} must not contain ${re}`).toBe(false);
    }
  }
  // and the authority DOES own it
  const auth = fs.readFileSync(path.join(REPO, 'scripts/ci-status.ps1'), 'utf8');
  expect(/api\.github\.com/.test(auth)).toBe(true);
});
