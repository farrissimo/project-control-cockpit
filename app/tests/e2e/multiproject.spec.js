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
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

  await page.locator('#proj-switch').click();
  await expect(page.locator('#proj-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('.proj-row')).toHaveCount(2);

  // DECISION-111 slice 2: engine-kit status badge per project. The home cockpit
  // is always current; the temp project predates engine-version.json, so its
  // badge must honestly read "unknown" rather than guessing.
  const homeRow = page.locator('.proj-row').filter({ has: page.locator('.proj-home') });
  await expect(homeRow.locator('.proj-engine.current')).toHaveCount(1);
  const tempRow = page.locator('.proj-row', { hasText: 'Temp-Widget' });
  await expect(tempRow.locator('.proj-engine.unknown')).toHaveCount(1);

  await page.locator('.proj-row', { hasText: 'Temp-Widget' }).click();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#proj-name')).toHaveText('Temp-Widget', { timeout: 15000 });
});

test('chat history is isolated between projects', async () => {
  const list = await call('listProjects');
  const home = list.projects.find((p) => p.isHome).path;

  // On Temp-Widget (from the previous test): send a message, creating a temp chat.
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  await page.locator('#input').fill('temp-project message');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.user').last()).toHaveText(/temp-project message/);

  // Switch to HOME and reload: the temp message must NOT be visible.
  await call('setActiveProject', home);
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.bubble.user', { hasText: 'temp-project message' })).toHaveCount(0);

  // The two projects wrote to different namespaced localStorage keys.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('pcc.chats.v2::')));
  expect(keys.length).toBeGreaterThanOrEqual(2);
});

// I2: a corrupt/partial registry write must NOT silently drop every registered
// project. The atomic writer keeps a prior generation (.prev); readRegistry recovers
// from it instead of resetting to HOME-only. Self-contained app so it can corrupt +
// reload without disturbing the shared session above.
test('registry recovers the project list from .prev when the current file is corrupt (I2)', async () => {
  const proj = makeTempProject('RecoverMe');
  const { app: app2, page: page2 } = await launchApp();
  try {
    const call2 = (m, ...a) => page2.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);
    await call2('addProject', proj);         // write: current has proj, .prev = pre-add
    await call2('setActiveProject', proj);   // write: .prev now INCLUDES proj
    const regFile = path.join(app2._pccUserDataDir, 'projects.json');
    expect(fs.existsSync(regFile + '.prev')).toBe(true);
    // Corrupt the CURRENT registry (unparseable); leave .prev intact.
    fs.writeFileSync(regFile, '{ corrupt registry not json', 'utf8');
    await page2.reload();
    await page2.waitForLoadState('domcontentloaded');
    // Recovered from .prev — proj is still registered, NOT reset to HOME-only.
    const list = await call2('listProjects');
    const paths = list.projects.map((p) => p.path);
    expect(paths).toContain(proj);
  } finally {
    await closeApp(app2);
    try { fs.rmSync(proj, { recursive: true, force: true }); } catch (e) { /* best effort */ }
  }
});
