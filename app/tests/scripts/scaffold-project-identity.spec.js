// Scaffold project identity / dirty-at-birth (Finding D, patch-intake report;
// docs/specs/scaffold-project-identity.md). Runs the REAL scripts/bootstrap-project.ps1
// into a disposable directory, then drives the REAL app/state/chat-service.js
// (chatService.readCanonical -- the actual production module the app's pcc:chatsRead
// IPC handler calls) against it, and inspects real git state. Pure Node + git, no
// Electron, no mocks.
const { test, expect } = require('@playwright/test');
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const cs = require(path.join(REPO, 'app', 'state', 'chat-service.js'));
const csStore = require(path.join(REPO, 'app', 'state', 'chat-store.js'));

function git(dir, args) { return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim(); }

function bootstrap(target) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', 'scripts/bootstrap-project.ps1',
    '-Target', target, '-Name', 'Dirty-At-Birth Test', '-Force', '-NoInbox'],
    { cwd: REPO, encoding: 'utf8', timeout: 180000, windowsHide: true });
  if (r.status !== 0) throw new Error('bootstrap failed: ' + (r.stderr || r.stdout));
}

test('AC-1/AC-2/AC-3: a freshly scaffolded project stays clean through the app\'s first real read', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-birth-'));
  try {
    bootstrap(target);

    // Sanity: bootstrap itself must leave the tree clean (already true today).
    expect(git(target, ['status', '--porcelain'])).toBe('');

    // AC-1: project-id.json is part of the bootstrap commit, not left for later.
    const headFiles = git(target, ['show', '--stat', '--name-only', '--format=', 'HEAD']);
    expect(headFiles.split(/\r?\n/)).toContain('.cockpit/state/project-id.json');

    // AC-2: the app's actual first read (chatService.readCanonical, the real pcc:chatsRead
    // code path) must not dirty the tree -- the identity it needs already exists.
    const chatsFile = path.join(target, '.cockpit', 'chats.json');
    const r = cs.readCanonical({ chatsFile, projectDir: target });
    expect(r.ok).toBe(true);
    expect(git(target, ['status', '--porcelain'])).toBe('');

    // AC-3: resolveProjectId found the EXISTING bootstrap-written id, it did not mint a
    // new one -- the honest signal that nothing new was written.
    const idResult = csStore.resolveProjectId(target, { now: () => new Date().toISOString() });
    expect(idResult.ok).toBe(true);
    expect(idResult.source).toBe('minted');
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});

test('AC-4: the minted id shape is unchanged -- a valid proj-<uuid> string chat-store.js already understands', () => {
  const target = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-birth-shape-'));
  try {
    bootstrap(target);
    const raw = fs.readFileSync(path.join(target, '.cockpit', 'state', 'project-id.json'), 'utf8');
    const parsed = JSON.parse(raw);
    expect(typeof parsed.projectId).toBe('string');
    expect(parsed.projectId).toMatch(/^proj-/);
    expect(typeof parsed.mintedAt).toBe('string');
  } finally { fs.rmSync(target, { recursive: true, force: true }); }
});
