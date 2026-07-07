// Multi-project switching: the home cockpit points at one active project at a
// time. Uses a throwaway second PCC project on disk (minimal but valid: its own
// .cockpit/scripts/CLAUDE.md/PROJECT.md) to prove that registering + switching
// re-points every read at the new project, that invalid folders are refused,
// and that chat history is isolated per project.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const fs = require('fs');
const os = require('os');
const path = require('path');

function makeTempProject(name) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-proj-'));
  fs.mkdirSync(path.join(dir, '.cockpit', 'state'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Rules\nDISTINCT-RULES-' + name + '\n');
  fs.writeFileSync(path.join(dir, 'PROJECT.md'), '# Brief\nDISTINCT-BRIEF-' + name + '\n');
  fs.writeFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'),
    JSON.stringify({ project_name: name }));
  return dir;
}

let app, page, tempDir;
test.beforeAll(async () => {
  tempDir = makeTempProject('Temp-Widget');
  ({ app, page } = await launchApp());
});
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

const call = (m, ...a) => page.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);

test('listProjects includes HOME as the default active project', async () => {
  const r = await call('listProjects');
  const home = r.projects.find((p) => p.isHome);
  expect(home).toBeTruthy();
  expect(r.active).toBe(home.path);
});

test('addProject refuses a folder that is not a PCC project', async () => {
  const bad = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-bad-'));
  try {
    const r = await call('addProject', bad);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not a pcc project/i);
  } finally {
    fs.rmSync(bad, { recursive: true, force: true });
  }
});

test('setActiveProject refuses an unregistered path', async () => {
  const r = await call('setActiveProject', path.join(os.tmpdir(), 'nope-not-registered'));
  expect(r.ok).toBe(false);
});

test('add + switch re-points every read at the new project', async () => {
  expect((await call('addProject', tempDir)).ok).toBe(true);
  const sw = await call('setActiveProject', tempDir);
  expect(sw.ok).toBe(true);
  expect(sw.active.name).toBe('Temp-Widget');
  expect((await call('getRules')).text).toContain('DISTINCT-RULES-Temp-Widget');
  expect((await call('getMemory')).text).toContain('DISTINCT-BRIEF-Temp-Widget');
  expect((await call('getState')).project.project_name).toBe('Temp-Widget');
});

test('UI: the switcher lists both projects and switching updates the active name', async () => {
  const list = await call('listProjects');
  const home = list.projects.find((p) => p.isHome).path;
  await call('setActiveProject', home);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 });

  await page.locator('#proj-switch').click();
  await expect(page.locator('#proj-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('.proj-row')).toHaveCount(2);

  await page.locator('.proj-row', { hasText: 'Temp-Widget' }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#proj-name')).toHaveText('Temp-Widget', { timeout: 15000 });
});

test('chat history is isolated between projects', async () => {
  const list = await call('listProjects');
  const home = list.projects.find((p) => p.isHome).path;

  // On Temp-Widget (from the previous test): send a message, creating a temp chat.
  await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 });
  await page.locator('#input').fill('temp-project message');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.user').last()).toHaveText(/temp-project message/);

  // Switch to HOME and reload: the temp message must NOT be visible.
  await call('setActiveProject', home);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 });
  await expect(page.locator('.bubble.user', { hasText: 'temp-project message' })).toHaveCount(0);

  // The two projects wrote to different namespaced localStorage keys.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pcc.chats.v2::')));
  expect(keys.length).toBeGreaterThanOrEqual(2);
});
