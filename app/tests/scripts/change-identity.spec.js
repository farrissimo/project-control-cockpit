// Governor trusted-baseline resolution (Finding B, patch-intake report;
// docs/specs/governor-trusted-baseline.md). Drives the REAL Get-ChangeIdentity
// (scripts/lib/change-identity.ps1), shared by the commit gate, receipt writer, and
// trailer emitter, in throwaway repos with a REAL local `origin` remote -- so the
// production helper carries zero test-awareness.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

// A bare "origin" repo + a working clone with origin fetched. Mirrors a real
// remote-backed PCC project (this repo itself), not a local-only one.
function makeRepoWithOrigin() {
  const originDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ci-origin-'));
  execFileSync('git', ['init', '-q', '--bare'], { cwd: originDir });

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ci-work-'));
  fs.mkdirSync(path.join(workDir, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(workDir, 'scripts', 'lib', 'change-identity.ps1'));
  git(workDir, ['init', '-q']);
  git(workDir, ['config', 'user.email', 't@t.local']);
  git(workDir, ['config', 'user.name', 'T']);
  git(workDir, ['branch', '-M', 'main']);
  git(workDir, ['remote', 'add', 'origin', originDir]);
  fs.writeFileSync(path.join(workDir, 'trusted.txt'), 'v1');
  git(workDir, ['add', '-A']);
  git(workDir, ['commit', '-q', '-m', 'trusted content (the real origin state)']);
  git(workDir, ['push', '-q', 'origin', 'main']);
  git(workDir, ['fetch', '-q', 'origin']); // origin/main now resolves, pointing at this commit
  const trustedSha = git(workDir, ['rev-parse', 'HEAD']);
  return { workDir, originDir, trustedSha };
}

// Calls the REAL Get-ChangeIdentity via a tiny inline harness (dot-source + call + JSON out).
function getIdentity(dir, baseline) {
  const script = ". '" + path.join(dir, 'scripts', 'lib', 'change-identity.ps1').replace(/\\/g, '/') + "'\n"
    + '$id = Get-ChangeIdentity -Baseline \'' + baseline + '\'\n'
    + '$id | ConvertTo-Json -Depth 5';
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', script], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(r.stdout.trim());
}

function cleanup(dirs) { dirs.forEach((d) => fs.rmSync(d, { recursive: true, force: true })); }

// --- AC-1 / the actual incident: local main silently drifts ahead of origin/main via
// UNPUSHED local commits (mirrors "local main temporarily pointed at the restored
// result" -- any local-only operation has this shape). The governor's default
// -Baseline main must not silently trust the drifted local ref over the network-
// anchored origin copy. ---
test('AC-1: local main drifted ahead of origin/main (unpushed) -- -Baseline main still resolves against origin, not the drifted local ref', () => {
  const { workDir, originDir, trustedSha } = makeRepoWithOrigin();
  try {
    // Local-only, UNPUSHED commit that changes something real -- origin/main does NOT see this.
    fs.writeFileSync(path.join(workDir, 'unreviewed-drift.txt'), 'content nobody on the remote has seen');
    git(workDir, ['add', '-A']);
    git(workDir, ['commit', '-q', '-m', 'local-only drift (never pushed)']);
    // Now stage one more small change on top, as if about to commit.
    fs.writeFileSync(path.join(workDir, 'final.txt'), 'the staged change under review');
    git(workDir, ['add', '-A']);

    const id = getIdentity(workDir, 'main');
    // The honest, full scope of change since the last network-verified point MUST include
    // the unpushed drift file -- not just the last staged sliver on top of it.
    expect(id.files).toContain('unreviewed-drift.txt');
    expect(id.files).toContain('final.txt');
    expect(id.base).toBe(trustedSha); // base = origin/main's real commit, not the drifted local main
  } finally { cleanup([workDir, originDir]); }
});

// --- AC-2: no origin remote at all (local-only project) -- unchanged fallback to local ref. ---
test('AC-2: no origin remote -- falls back to the local ref exactly as today', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ci-local-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(dir, 'scripts', 'lib', 'change-identity.ps1'));
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 't@t.local']);
    git(dir, ['config', 'user.name', 'T']);
    git(dir, ['branch', '-M', 'main']);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    git(dir, ['add', '-A']);
    const shaA = (() => { git(dir, ['commit', '-q', '-m', 'a']); return git(dir, ['rev-parse', 'HEAD']); })();
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    git(dir, ['add', '-A']);
    const id = getIdentity(dir, 'main');
    expect(id.base).toBe(shaA);
    expect(id.files).toEqual(['b.txt']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- AC-3: no origin, no local `main` at all, but a pcc-baseline tag exists (a freshly
// scaffolded project whose default branch isn't named 'main' on this machine). ---
test('AC-3: neither origin nor local main resolve -- falls back to the pcc-baseline tag', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ci-tag-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(dir, 'scripts', 'lib', 'change-identity.ps1'));
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 't@t.local']);
    git(dir, ['config', 'user.name', 'T']);
    git(dir, ['checkout', '-q', '-b', 'trunk']); // deliberately NOT named 'main'
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'bootstrap']);
    const shaBaseline = git(dir, ['rev-parse', 'HEAD']);
    git(dir, ['tag', 'pcc-baseline']);
    // A LATER commit after the tag, so "fall back to plain HEAD" (today's wrong answer) is
    // distinguishable from "correctly resolved the pcc-baseline tag" (the fix) -- otherwise
    // HEAD and the tagged commit would coincide and the test couldn't tell them apart.
    fs.writeFileSync(path.join(dir, 'later.txt'), 'committed after the baseline tag');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'later local work']);
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b');
    git(dir, ['add', '-A']);
    const id = getIdentity(dir, 'main'); // caller still asks for 'main' -- doesn't exist here
    expect(id.base).toBe(shaBaseline);
    expect(id.files.sort()).toEqual(['b.txt', 'later.txt']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- AC-4: nothing resolves at all -- unchanged honest fallback to HEAD, base_note set. ---
test('AC-4: nothing resolves -- falls back to HEAD with an honest base_note (unchanged)', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ci-none-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
    fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(dir, 'scripts', 'lib', 'change-identity.ps1'));
    git(dir, ['init', '-q']);
    git(dir, ['config', 'user.email', 't@t.local']);
    git(dir, ['config', 'user.name', 'T']);
    git(dir, ['checkout', '-q', '-b', 'trunk']);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a');
    git(dir, ['add', '-A']);
    git(dir, ['commit', '-q', '-m', 'only commit, no pcc-baseline tag, no origin, no main']);
    const id = getIdentity(dir, 'main');
    expect(id.base_note).toMatch(/not found/i);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// --- AC-5: local and origin/main already agree (the normal, synced case -- true for every
// commit this project has made so far) -- IDENTICAL result to today, no behavior change. ---
test('AC-5: local main == origin/main (synced, the normal case) -- identical result to today', () => {
  const { workDir, originDir, trustedSha } = makeRepoWithOrigin();
  try {
    fs.writeFileSync(path.join(workDir, 'final.txt'), 'staged on top of a fully-synced main');
    git(workDir, ['add', '-A']);
    const idOrigin = getIdentity(workDir, 'origin/main');
    const idMain = getIdentity(workDir, 'main');
    expect(idMain.base).toBe(trustedSha);
    expect(idMain.base).toBe(idOrigin.base);
    expect(idMain.diff_id).toBe(idOrigin.diff_id);
  } finally { cleanup([workDir, originDir]); }
});
