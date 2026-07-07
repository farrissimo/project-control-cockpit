// New-project auto-register: bootstrap-project.ps1 drops the new project's path
// into the active project's .cockpit/state/scaffolded-inbox.json, and the app
// imports it into the switcher on listProjects (then clears the inbox). Tested
// with isolated temp projects so nothing touches the real repo.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const fs = require('fs');
const os = require('os');
const path = require('path');

function makePcc(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-ar-'));
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Rules\n');
  fs.writeFileSync(path.join(dir, 'PROJECT.md'), '# Brief\n');
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'), JSON.stringify({ project_name: name }));
  return dir;
}
function writeInbox(dir, arr) {
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'scaffolded-inbox.json'), JSON.stringify(arr));
}

let app, page, home, fresh;
test.beforeAll(async () => { home = makePcc('Home-AR'); fresh = makePcc('Fresh-Scaffolded'); ({ app, page } = await launchApp()); });
test.afterAll(async () => {
  await closeApp(app);
  for (const d of [home, fresh]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ } }
});
const call = (m, ...a) => page.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);

test('a scaffolded project in the inbox auto-registers on listProjects', async () => {
  expect((await call('addProject', home)).ok).toBe(true);
  expect((await call('setActiveProject', home)).ok).toBe(true);
  writeInbox(home, [fresh]); // simulate bootstrap dropping the new project path
  const r = await call('listProjects');
  expect(r.projects.map((p) => p.path)).toContain(fresh);
  // inbox consumed
  const inbox = JSON.parse(fs.readFileSync(path.join(home, '.cockpit', 'state', 'scaffolded-inbox.json'), 'utf8'));
  expect(inbox).toEqual([]);
});

test('a non-PCC path in the inbox is ignored, not registered', async () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-badar-'));
  try {
    await call('setActiveProject', home);
    writeInbox(home, [bad]);
    const r = await call('listProjects');
    expect(r.projects.map((p) => p.path)).not.toContain(bad);
  } finally { fs.rmSync(bad, { recursive: true, force: true }); }
});

// W4 regression: a scaffold path that isn't valid YET (e.g. still being written, or
// a transient miss) must be KEPT in the inbox for retry — never silently consumed.
// The old code cleared the whole inbox unconditionally, which lost Tax Prep Cockpit
// from the switcher while the worker claimed it was registered.
test('a not-yet-valid scaffold path is kept for retry, not silently lost', async () => {
  await call('setActiveProject', home);
  const notYet = path.join(os.tmpdir(), 'pcc-notyet-' + Date.now()); // does not exist yet
  writeInbox(home, [notYet]);
  const r = await call('listProjects');
  expect(r.projects.map((p) => p.path)).not.toContain(notYet); // not registered (invalid)
  // ...but it MUST still be in the inbox so a later listProjects can pick it up.
  const inbox = JSON.parse(fs.readFileSync(path.join(home, '.cockpit', 'state', 'scaffolded-inbox.json'), 'utf8'));
  expect(inbox).toContain(notYet);
});
