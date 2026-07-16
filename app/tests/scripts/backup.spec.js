// Backup / restore-point contract (state & data integrity audit, ADR-0009 category "state-data-integrity").
// backup-protected-files.ps1 is a T0 (trust-root) file that had NO automated test — the audit's job is to
// verify, not trust. These run the real script against a SYNTHETIC repo in a temp dir (never real data:
// a fresh cwd + a temp -BackupRoot) and assert the contract, especially the data-safety path: a restore
// must ABORT before making ANY change if the snapshot is incomplete, so a corrupt snapshot can't
// half-overwrite good live files. Pure CLI, no Electron.
const { test, expect } = require('@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'backup-protected-files.ps1');

// Build a throwaway "repo" with just the .cockpit state files the backup set protects.
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-backup-'));
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, '.cockpit', 'result'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'), JSON.stringify({ project: 'orig-project' }));
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'task-state.json'), JSON.stringify({ task_id: 'orig-task' }));
  fs.writeFileSync(path.join(dir, '.cockpit', 'result', 'verification-result.json'), JSON.stringify({ verdict: 'orig' }));
  return dir;
}

function run(cwd, args) {
  return spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args],
    { cwd, encoding: 'utf8', timeout: 30000, windowsHide: true });
}

// find the single timestamped restore-point dir under backups/
function onlyRestorePoint(dir) {
  const root = path.join(dir, 'backups');
  const pts = fs.readdirSync(root).filter((n) => fs.statSync(path.join(root, n)).isDirectory());
  expect(pts.length).toBe(1);
  return pts[0];
}

test('Backup creates a restore point with a manifest listing the protected files', () => {
  const dir = makeRepo();
  const r = run(dir, ['-Action', 'Backup', '-BackupRoot', 'backups']);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  const ts = onlyRestorePoint(dir);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'backups', ts, 'manifest.json'), 'utf8'));
  expect(manifest.restore_point).toBe(ts);
  expect(manifest.task_id).toBe('orig-task'); // pulled from task-state.json
  expect(manifest.backed_up_files).toEqual(expect.arrayContaining([
    '.cockpit/state/project-state.json',
    '.cockpit/state/task-state.json',
    '.cockpit/result/verification-result.json',
  ]));
  // the snapshot actually contains the copied bytes
  const snap = fs.readFileSync(path.join(dir, 'backups', ts, '.cockpit', 'state', 'project-state.json'), 'utf8');
  expect(JSON.parse(snap).project).toBe('orig-project');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('List reports the restore point', () => {
  const dir = makeRepo();
  run(dir, ['-Action', 'Backup', '-BackupRoot', 'backups']);
  const ts = onlyRestorePoint(dir);
  const r = run(dir, ['-Action', 'List', '-BackupRoot', 'backups']);
  expect(r.status).toBe(0);
  expect(r.stdout).toContain(ts);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Restore brings back the snapshotted content over changed live files', () => {
  const dir = makeRepo();
  run(dir, ['-Action', 'Backup', '-BackupRoot', 'backups']);
  const ts = onlyRestorePoint(dir);
  // mutate the live file, then restore
  const live = path.join(dir, '.cockpit', 'state', 'project-state.json');
  fs.writeFileSync(live, JSON.stringify({ project: 'CHANGED' }));
  const r = run(dir, ['-Action', 'Restore', '-RestorePoint', ts, '-BackupRoot', 'backups']);
  expect(r.status, r.stdout + r.stderr).toBe(0);
  expect(JSON.parse(fs.readFileSync(live, 'utf8')).project).toBe('orig-project'); // restored
  fs.rmSync(dir, { recursive: true, force: true });
});

// THE data-safety path: an incomplete snapshot must abort the restore BEFORE any file is written,
// so a corrupt restore point can never half-overwrite good live state.
test('Restore ABORTS before any change if a snapshotted file is missing from the snapshot', () => {
  const dir = makeRepo();
  run(dir, ['-Action', 'Backup', '-BackupRoot', 'backups']);
  const ts = onlyRestorePoint(dir);
  // corrupt the snapshot: delete one snapshotted file
  fs.rmSync(path.join(dir, 'backups', ts, '.cockpit', 'state', 'task-state.json'));
  // change ALL live files to a sentinel so we can prove none were overwritten
  const p = path.join(dir, '.cockpit', 'state', 'project-state.json');
  const t = path.join(dir, '.cockpit', 'state', 'task-state.json');
  fs.writeFileSync(p, JSON.stringify({ project: 'SENTINEL' }));
  fs.writeFileSync(t, JSON.stringify({ task_id: 'SENTINEL' }));
  const r = run(dir, ['-Action', 'Restore', '-RestorePoint', ts, '-BackupRoot', 'backups']);
  expect(r.status).toBe(1);
  expect((r.stderr + r.stdout)).toMatch(/missing from the snapshot|Restore aborted/i);
  // NO live file was touched — the abort happened before any copy
  expect(JSON.parse(fs.readFileSync(p, 'utf8')).project).toBe('SENTINEL');
  expect(JSON.parse(fs.readFileSync(t, 'utf8')).task_id).toBe('SENTINEL');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Restore fails closed when the manifest is missing (untrusted snapshot)', () => {
  const dir = makeRepo();
  run(dir, ['-Action', 'Backup', '-BackupRoot', 'backups']);
  const ts = onlyRestorePoint(dir);
  fs.rmSync(path.join(dir, 'backups', ts, 'manifest.json'));
  const r = run(dir, ['-Action', 'Restore', '-RestorePoint', ts, '-BackupRoot', 'backups']);
  expect(r.status).toBe(1);
  expect(r.stderr + r.stdout).toMatch(/missing its manifest|cannot be trusted/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Restore requires a -RestorePoint', () => {
  const dir = makeRepo();
  const r = run(dir, ['-Action', 'Restore', '-BackupRoot', 'backups']);
  expect(r.status).toBe(1);
  expect(r.stderr + r.stdout).toMatch(/requires -RestorePoint/i);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('Restore fails closed for a non-existent restore point', () => {
  const dir = makeRepo();
  const r = run(dir, ['-Action', 'Restore', '-RestorePoint', 'nope-9999', '-BackupRoot', 'backups']);
  expect(r.status).toBe(1);
  expect(r.stderr + r.stdout).toMatch(/does not exist/i);
  fs.rmSync(dir, { recursive: true, force: true });
});
