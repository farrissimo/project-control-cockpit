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
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'app'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'verify-evidence.ps1'), path.join(dir, 'scripts', 'verify-evidence.ps1'));
  // verify-evidence now delegates its CI note to the single authority ci-status.ps1 — it must be present.
  fs.copyFileSync(path.join(REPO, 'scripts', 'ci-status.ps1'), path.join(dir, 'scripts', 'ci-status.ps1'));
  // Finding A fix: verify-evidence now dot-sources change-identity.ps1 to re-derive a tip
  // commit's Verified-Receipt trailer (same shared helper the gate/writer/audit already use).
  fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(dir, 'scripts', 'lib', 'change-identity.ps1'));
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
// Re-derive a commit's diff_id exactly the way scripts/lib/change-identity.ps1 (Get-CommitDiffId)
// and the CI trailer audit do, so a test-written trailer is REAL (re-derivable), not asserted text.
function realDiffId(dir, base, commitSha) {
  const script = ". '" + path.join(dir, 'scripts', 'lib', 'change-identity.ps1').replace(/\\/g, '/') + "'\nGet-CommitDiffId '" + base + "' '" + commitSha + "'";
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', script], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return r.stdout.trim();
}
// Commit, then AMEND the message to carry a Verified-Receipt trailer. Amending only changes the
// message, not the tree/content, so a diff_id computed against the PRE-amend sha still re-derives
// correctly against the POST-amend sha (Get-CommitDiffId diffs content, never the message).
function commitWithTrailer(dir, name, subject, trailerBase, opts) {
  opts = opts || {};
  const sha = commit(dir, name, subject);
  const diffId = opts.forgedDiffId || realDiffId(dir, trailerBase, sha);
  const verdict = opts.verdict || 'PASS';
  const verifier = opts.verifier || 'codex exec';
  const trailer = 'Verified-Receipt: base=' + trailerBase + ' diff_id=' + diffId + ' verdict=' + verdict + ' verifier=' + verifier;
  const msg = opts.malformed ? (subject + '\n\nVerified-Receipt: not a real trailer line') : (subject + '\n\n' + trailer);
  execFileSync('git', ['commit', '--amend', '-m', msg], { cwd: dir });
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

// Codex-caught gap: git cat-file -e only proves a commit OBJECT exists somewhere in the repo's
// database, not that it's an ancestor of HEAD. A real sha from an unrelated/orphan branch must
// still be rejected, or the range would produce a nonsensical diff.
test('a VERIFIED_SHA that exists but is NOT an ancestor of HEAD is rejected (ancestry check)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'main-first');
    commit(dir, 'b.txt', 'main-second');
    // an orphan branch with its own real, valid commit that shares no history with the current branch
    execFileSync('git', ['checkout', '--orphan', 'unrelated'], { cwd: dir });
    execFileSync('git', ['rm', '-rf', '--cached', '.'], { cwd: dir, stdio: 'ignore' });
    const orphanSha = commit(dir, 'x.txt', 'orphan-commit');
    execFileSync('git', ['checkout', 'master'], { cwd: dir });
    recordVerifiedSha(dir, orphanSha); // a real, existing commit object -- but not our ancestor
    const e = run(dir);
    expect(e.range).toBe('HEAD~1..HEAD'); // rejected; fell back safely, not a nonsensical cross-branch diff
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
test('no remote configured -> ci_state is no_remote (via ci-status.ps1, offline-safe)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    const e = run(dir);
    expect(e.ci_state).toBe('no_remote'); // the authority's own no-remote result, consumed by verify-evidence
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Delegation must degrade honestly: if the single authority is missing, verify-evidence still
// completes and reports an honest 'unavailable' note (never a fabricated CI state, never a crash).
test('a missing ci-status.ps1 -> ci_state unavailable (verify-evidence still completes honestly)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    fs.rmSync(path.join(dir, 'scripts', 'ci-status.ps1'), { force: true });
    const e = run(dir);
    expect(e.ci_state).toBe('unavailable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// Exact-SHA binding on the delegated result: a helper reporting a pass for a DIFFERENT sha must
// never surface as 'passed' — it is treated as unavailable.
test('a ci-status result bound to a different sha -> ci_state unavailable (never passed)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    // fake helper that ignores -Sha and always claims a pass for some OTHER commit
    fs.writeFileSync(path.join(dir, 'scripts', 'ci-status.ps1'),
      "param([string]$Sha,[switch]$Json,[switch]$UrlOnly)\n@{ sha='deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'; status='passed'; detail='x' } | ConvertTo-Json -Compress\n");
    const e = run(dir);
    expect(e.ci_state).toBe('unavailable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// A helper that prints a valid 'passed' but EXITS NONZERO must not be trusted (fail closed).
test('a ci-status helper that exits nonzero -> ci_state unavailable (never the reported pass)', () => {
  const dir = makeRepo();
  try {
    const sha = commit(dir, 'a.txt', 'first');
    fs.writeFileSync(path.join(dir, 'scripts', 'ci-status.ps1'),
      "param([string]$Sha,[switch]$Json,[switch]$UrlOnly)\n@{ sha=$Sha; status='passed'; detail='x' } | ConvertTo-Json -Compress\nexit 1\n");
    const e = run(dir);
    expect(e.ci_state).toBe('unavailable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// An unrecognised status string is not echoed through — only the known vocabulary is trusted.
test('a ci-status helper returning a bogus status -> ci_state unavailable (whitelist)', () => {
  const dir = makeRepo();
  try {
    commit(dir, 'a.txt', 'first');
    fs.writeFileSync(path.join(dir, 'scripts', 'ci-status.ps1'),
      "param([string]$Sha,[switch]$Json,[switch]$UrlOnly)\n@{ sha=$Sha; status='bogus'; detail='x' } | ConvertTo-Json -Compress\n");
    const e = run(dir);
    expect(e.ci_state).toBe('unavailable');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- Finding A: prefer HEAD's own attested Verified-Receipt trailer over a stale VERIFIED_SHA ---
// Reproduces the real 2026-07-17 incident: a recorded VERIFIED_SHA that is a real, valid ancestor
// of HEAD (so today's ancestry check passes it through) but far older than the work actually
// under review, producing a huge, wrong-scope range that LOOKS authoritative to the verifier.

test('AC-1/AC-5: a valid Verified-Receipt trailer on the tip commit is preferred over a stale-but-valid VERIFIED_SHA', () => {
  const dir = makeRepo();
  try {
    const shaAncient = commit(dir, 'a.txt', 'ancient verified point');
    for (let i = 0; i < 3; i++) commit(dir, 'filler' + i + '.txt', 'unrelated filler ' + i);
    recordVerifiedSha(dir, shaAncient); // stale but a real, valid ancestor -- today's code trusts this
    const shaParent = commit(dir, 'before.txt', 'right before the real change');
    commitWithTrailer(dir, 'restore.txt', 'the real restore work', shaParent);
    const e = run(dir);
    expect(e.range).toBe(shaParent + '..HEAD'); // narrow, precise -- not shaAncient..HEAD
    expect(e.commits).toContain('the real restore work');
    expect(e.commits).not.toContain('ancient verified point');
    expect(e.commits).not.toContain('unrelated filler');
    expect(e.range_kind).toMatch(/trailer/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-2: a trailer whose diff_id does not re-derive (forged/corrupted) is ignored -- falls back to VERIFIED_SHA', () => {
  const dir = makeRepo();
  try {
    const shaA = commit(dir, 'a.txt', 'commitA');
    recordVerifiedSha(dir, shaA);
    const shaB = commit(dir, 'b.txt', 'commitB');
    commitWithTrailer(dir, 'c.txt', 'commitC', shaB, { forgedDiffId: 'deadbeef'.repeat(8) });
    const e = run(dir);
    expect(e.range).toBe(shaA + '..HEAD'); // never trusts an unverifiable trailer
    expect(e.range_kind).not.toMatch(/trailer/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a malformed trailer line on the tip commit is ignored -- falls back to VERIFIED_SHA', () => {
  const dir = makeRepo();
  try {
    const shaA = commit(dir, 'a.txt', 'commitA');
    recordVerifiedSha(dir, shaA);
    commitWithTrailer(dir, 'b.txt', 'commitB', shaA, { malformed: true });
    const e = run(dir);
    expect(e.range).toBe(shaA + '..HEAD');
    expect(e.range_kind).not.toMatch(/trailer/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('a trailer whose base is NOT an ancestor of HEAD is ignored -- falls back to VERIFIED_SHA', () => {
  const dir = makeRepo();
  try {
    const shaA = commit(dir, 'a.txt', 'commitA');
    recordVerifiedSha(dir, shaA);
    commit(dir, 'b.txt', 'commitB');
    // a real-looking but unrelated sha as the trailer's claimed base (never an ancestor here)
    const fakeBase = '0123456789abcdef0123456789abcdef01234567';
    commitWithTrailer(dir, 'c.txt', 'commitC', fakeBase, { forgedDiffId: realDiffId(dir, fakeBase, fakeBase) || 'x'.repeat(64) });
    const e = run(dir);
    expect(e.range).toBe(shaA + '..HEAD');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('AC-3: no trailer on the tip commit -- existing VERIFIED_SHA behavior is unchanged', () => {
  const dir = makeRepo();
  try {
    const shaA = commit(dir, 'a.txt', 'commitA');
    commit(dir, 'b.txt', 'commitB');
    commit(dir, 'c.txt', 'commitC');
    recordVerifiedSha(dir, shaA);
    const e = run(dir);
    expect(e.range).toBe(shaA + '..HEAD');
    expect(e.range_kind).toMatch(/since the last recorded verification/i);
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
