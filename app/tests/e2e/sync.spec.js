// In-app git backup / sync. Tests REAL git safely by switching the app to a
// throwaway PCC project that has its own local bare "remote" — so backup
// (commit + push) and pull run for real, fully offline, never touching the
// actual repo. The app must be pointed at the temp project first (via the
// multi-project switch), or these would act on the home repo.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

function g(cwd, args) { return execFileSync('git', args, { cwd, encoding: 'utf8' }); }

function makeGitProject() {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-git-'));
  const remote = path.join(base, 'remote.git');
  const work = path.join(base, 'work');
  fs.mkdirSync(remote); fs.mkdirSync(work);
  execFileSync('git', ['init', '--bare'], { cwd: remote });
  execFileSync('git', ['init'], { cwd: work });
  g(work, ['config', 'user.email', 'test@pcc.local']);
  g(work, ['config', 'user.name', 'PCC Test']);
  g(work, ['config', 'commit.gpgsign', 'false']);
  // Make it a valid PCC project so the app will accept + switch to it.
  fs.mkdirSync(path.join(work, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(work, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(work, 'CLAUDE.md'), '# Rules\n');
  fs.writeFileSync(path.join(work, 'PROJECT.md'), '# Brief\n');
  fs.writeFileSync(path.join(work, '.cockpit', 'state', 'project-state.json'), JSON.stringify({ project_name: 'Git-Test' }));
  fs.writeFileSync(path.join(work, 'README.md'), 'seed\n');
  g(work, ['add', '-A']); g(work, ['commit', '-m', 'seed']);
  const branch = g(work, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  g(work, ['remote', 'add', 'origin', remote]);
  g(work, ['push', '-u', 'origin', branch]);
  return { base, remote, work, branch };
}

let app, page, proj;
test.beforeAll(async () => { proj = makeGitProject(); ({ app, page } = await launchApp()); });
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(proj.base, { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

const call = (m, ...a) => page.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);

test('switch the app to the temp git project', async () => {
  expect((await call('addProject', proj.work)).ok).toBe(true);
  expect((await call('setActiveProject', proj.work)).ok).toBe(true);
});

test('syncStatus reports clean right after the seed push', async () => {
  const s = await call('syncStatus');
  expect(s.hasUpstream).toBe(true);
  expect(s.clean).toBe(true);
});

test('backup commits a new change and pushes it to the remote', async () => {
  fs.writeFileSync(path.join(proj.work, 'newfile.txt'), 'hello\n');
  expect((await call('syncStatus')).untracked).toBeGreaterThanOrEqual(1);

  const r = await call('backup', 'test backup message');
  expect(r.ok).toBe(true);
  expect(r.text).toMatch(/Pushed/);

  expect((await call('syncStatus')).clean).toBe(true);
  // The bare remote actually received the commit.
  const log = execFileSync('git', ['--git-dir', proj.remote, 'log', '--oneline'], { encoding: 'utf8' });
  expect(log).toMatch(/test backup message/);
});

test('backup with no changes still succeeds (nothing to commit, up to date)', async () => {
  const r = await call('backup', '');
  expect(r.ok).toBe(true);
  expect(r.text).toMatch(/No new changes/);
});

test('pull reports up to date', async () => {
  const r = await call('pull');
  expect(r.ok).toBe(true);
  expect(r.text).toMatch(/up to date|already/i);
});

// T3 (docs/PART7_HARDENING_AUDIT.md): the backup PUSH-FAILURE path. If a regression ever
// dropped the push.failed check, PCC would claim "backed up" while the commit never left
// the machine. Force a real, deterministic, OFFLINE push failure (origin -> a nonexistent
// path) and prove the handler is honest: ok:false, says "Push FAILED", and NEVER claims
// "backed up". Runs LAST and reuses the shared app — it just SWITCHES that app to a fresh
// broken-remote project (no second app instance, so no single-instance ambiguity), which
// is safe because every earlier test already ran against `proj`.
test('backup reports a PUSH FAILURE honestly and never claims "backed up"', async () => {
  const p2 = makeGitProject();
  // Break the remote AFTER upstream tracking is set: @{u} still resolves locally (so the
  // app decides to push), but `git push` fails because origin now points nowhere.
  execFileSync('git', ['remote', 'set-url', 'origin', path.join(p2.base, 'does-not-exist.git')], { cwd: p2.work });
  try {
    expect((await call('addProject', p2.work)).ok).toBe(true);
    expect((await call('setActiveProject', p2.work)).ok).toBe(true);
    fs.writeFileSync(path.join(p2.work, 'unpushed.txt'), 'not backed up yet\n');
    const r = await call('backup', 'push should fail');
    expect(r.ok).toBe(false);                 // honest failure, not a false success
    expect(r.text).toMatch(/Push FAILED/);    // the app's stable contract text (not git's wording)
    expect(r.text).not.toMatch(/backed up/i); // must NOT claim off-machine backup
    // The commit is real but local-only: sync still shows unpushed work, never "clean".
    const s = await call('syncStatus');
    expect(s.ahead).toBeGreaterThanOrEqual(1);
    expect(s.clean).toBe(false);
  } finally {
    try { fs.rmSync(p2.base, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
});
