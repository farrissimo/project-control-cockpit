// Verification evidence bundle (roadmap #4 / IDEA-013). Runs the REAL script in throwaway repos
// so range detection ("since the last recorded verification", falling back to the last commit)
// and the offline-safe CI check are proven, not just eyeballed.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ve-'));
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'verify-evidence.ps1'), path.join(dir, 'scripts', 'verify-evidence.ps1'));
  execFileSync('git', ['init'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 't@t.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'T'], { cwd: dir });
  return dir;
}
function commit(dir, name, msg) {
  fs.writeFileSync(path.join(dir, name), String(Date.now()) + Math.random());
  execFileSync('git', ['add', '-A'], { cwd: dir });
  execFileSync('git', ['commit', '-m', msg], { cwd: dir });
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir }).toString().trim();
}
function run(dir) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/verify-evidence.ps1', '-Json'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(r.stdout.trim());
}
function recordVerifiedSha(dir, sha) {
  fs.writeFileSync(path.join(dir, 'app', 'last-verification.txt'), 'VERIFIED_SHA: ' + sha + '\nTYPE: review_only\n\nVERDICT: PASS\n');
}

test('no prior verification recorded -> falls back to the last commit', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    commit(dir, 'b.txt', 'second');
    const e = run(dir);
    expect(e.range).toBe('HEAD~1..HEAD');
    expect(e.range_kind).toMatch(/no prior verification/i);
    expect(e.commits).toContain('second');
    expect(e.commits).not.toContain('first'); // only the last commit, not the whole history
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a recorded VERIFIED_SHA scopes the range to everything since it (not the whole history)', () => {
  const dir = makeRepo();
  try {
    const shaA = commit(dir, 'a.txt', 'commitA');
    commit(dir, 'b.txt', 'commitB');
    commit(dir, 'c.txt', 'commitC');
    recordVerifiedSha(dir, shaA);
    const e = run(dir);
    expect(e.range).toBe(shaA + '..HEAD');
    expect(e.range_kind).toMatch(/since the last recorded verification/i);
    expect(e.commits).toContain('commitB');
    expect(e.commits).toContain('commitC');
    expect(e.commits).not.toContain('commitA'); // already-verified commit is excluded
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('VERIFIED_SHA equal to current HEAD -> no new commits since last verification', () => {
  const dir = makeRepo();
  try {
    const sha = commit(dir, 'a.txt', 'only');
    recordVerifiedSha(dir, sha);
    const e = run(dir);
    expect(e.commits).toBe(''); // nothing new
    expect(e.diff_stat).toMatch(/no new commits/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a garbage/nonexistent VERIFIED_SHA is ignored, falling back safely (never errors)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    commit(dir, 'b.txt', 'second');
    fs.writeFileSync(path.join(dir, 'app', 'last-verification.txt'), 'VERIFIED_SHA: 0000000deadbeef\nTYPE: review_only\n\nVERDICT: PASS\n');
    const e = run(dir);
    expect(e.range).toBe('HEAD~1..HEAD'); // safely fell back, did not crash
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('single-commit repo (no prior commit at all) degrades honestly, never errors', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'only commit');
    const e = run(dir);
    expect(e.range).toBeNull();
    expect(e.range_kind).toMatch(/no prior commit/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// No remote configured (a throwaway/local-only repo, like the boundary and lifecycle-advance
// sandboxes) -> the CI check must degrade instantly and offline-safe, never attempt a network call.
test('no remote configured -> ci_state is no_remote (offline-safe, no network attempt)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    const e = run(dir);
    expect(e.ci_state).toBe('no_remote');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Non-gating sanity: the evidence bundle carries no verdict/pass-fail field of its own — it is
// purely descriptive input for the verifier, never a decision.
test('the evidence bundle has no verdict/pass-fail field (non-gating, descriptive only)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    const e = run(dir);
    expect(Object.keys(e)).not.toContain('verdict');
    expect(Object.keys(e)).not.toContain('ok');
    expect(Object.keys(e)).not.toContain('pass');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
