// Rename classification convergence (Finding G, patch-intake report;
// docs/specs/rename-classification-convergence.md). Drives the REAL
// scripts/lib/change-identity.ps1 and scripts/classify-stakes.ps1 in a throwaway repo
// with a REAL tracked rename, proving the local classification paths (git diff --
// which detects renames as R by DEFAULT on this git version, hiding them from
// --diff-filter=A/D) now agree with the CI audit path (git diff-tree -- which does
// NOT detect renames by default, already seeing D+A). Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-rename-'));
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts', 'lib', 'change-identity.ps1'), path.join(dir, 'scripts', 'lib', 'change-identity.ps1'));
  fs.copyFileSync(path.join(REPO, 'scripts', 'classify-stakes.ps1'), path.join(dir, 'scripts', 'classify-stakes.ps1'));
  fs.copyFileSync(path.join(REPO, '.cockpit', 'state', 'stakes-manifest.json'), path.join(dir, '.cockpit', 'state', 'stakes-manifest.json'));
  git(dir, ['init', '-q']);
  git(dir, ['config', 'user.email', 't@t.local']);
  git(dir, ['config', 'user.name', 'T']);
  git(dir, ['branch', '-M', 'main']);
  fs.writeFileSync(path.join(dir, 'original.txt'), 'line1\nline2\nline3\nline4\nline5\n');
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-q', '-m', 'baseline']);
  return dir;
}
function getIdentity(dir) {
  const script = ". '" + path.join(dir, 'scripts', 'lib', 'change-identity.ps1').replace(/\\/g, '/') + "'\n"
    + '(Get-ChangeIdentity -Baseline \'main\') | ConvertTo-Json -Depth 5';
  const r = spawnSync('pwsh', ['-NoProfile', '-Command', script], { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse(r.stdout.trim());
}
function classifyStandalone(dir) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/classify-stakes.ps1', '-Json', '-Baseline', 'main'],
    { cwd: dir, encoding: 'utf8', timeout: 20000 });
  return JSON.parse((r.stdout || '').trim());
}
function cleanup(dir) { fs.rmSync(dir, { recursive: true, force: true }); }

// --- AC-1: Get-ChangeIdentity (StagedNames) must see a staged rename under BOTH
// added and deleted -- the exact list the commit gate + receipt writer classify from. ---
test('AC-1: Get-ChangeIdentity sees a staged rename as delete+add, not an invisible R', () => {
  const dir = makeRepo();
  try {
    git(dir, ['mv', 'original.txt', 'renamed.txt']);
    git(dir, ['add', '-A']);
    const id = getIdentity(dir);
    expect(id.deleted).toContain('original.txt');
    expect(id.added).toContain('renamed.txt');
  } finally { cleanup(dir); }
});

// --- AC-2: classify-stakes.ps1's own standalone git-mode (no -Files -- what the live
// Signals-tab card and the pre-commit gate's classifier invocation use) must escalate
// a staged rename to delete_or_rename, exactly like an explicit -Deleted does. ---
test('AC-2: classify-stakes.ps1 standalone git-mode escalates a staged rename to delete_or_rename', () => {
  const dir = makeRepo();
  try {
    git(dir, ['mv', 'original.txt', 'renamed.txt']);
    git(dir, ['add', '-A']);
    const o = classifyStandalone(dir);
    expect(o.escalations.some((e) => e.id === 'delete_or_rename')).toBe(true);
    expect(o.tier).toBe('T1');
  } finally { cleanup(dir); }
});

// --- AC-3: the CI audit path (git diff-tree) already sees a COMMITTED rename as
// delete+add by default on this git version -- confirms the divergence is real (the
// local `git diff`-based paths were the ones hiding it, not diff-tree), and that
// explicitly pinning --no-renames there too changes nothing (defense-in-depth only). ---
test('AC-3: git diff-tree (the CI audit command) already sees a committed rename as delete+add, with or without --no-renames', () => {
  const dir = makeRepo();
  try {
    git(dir, ['mv', 'original.txt', 'renamed.txt']);
    git(dir, ['commit', '-q', '-am', 'rename']);
    const withoutFlag = git(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '--diff-filter=D', 'HEAD']);
    const withFlag = git(dir, ['diff-tree', '--no-commit-id', '--name-only', '-r', '--root', '--no-renames', '--diff-filter=D', 'HEAD']);
    expect(withoutFlag).toBe('original.txt');
    expect(withFlag).toBe('original.txt');
  } finally { cleanup(dir); }
});

// --- AC-4: a plain content edit (no rename) is unaffected -- no false escalation. ---
test('AC-4: a plain content edit (no rename) does not trigger delete_or_rename', () => {
  const dir = makeRepo();
  try {
    fs.writeFileSync(path.join(dir, 'original.txt'), 'line1\nCHANGED\nline3\nline4\nline5\n');
    git(dir, ['add', '-A']);
    const o = classifyStandalone(dir);
    expect(o.escalations.some((e) => e.id === 'delete_or_rename')).toBe(false);
    const id = getIdentity(dir);
    expect(id.deleted).toEqual([]);
  } finally { cleanup(dir); }
});
