// New Project create-flow (DECISION-114): "New Project" is a new document. These drive the
// create-flow IPC directly (the surface's UI is covered in dialogs.spec.js). Own app instance,
// because Save switches the active project — isolating it keeps other specs unaffected.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const os = require('os');
const fs = require('fs');
const path = require('path');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

const call = (method, ...args) => page.evaluate(([m, a]) => window.pcc[m](...a), [method, args]);

test('start mints a workspace; cancel is clean; a second start works', async () => {
  const start = await call('createFlowStart');
  expect(start.ok).toBe(true);
  expect(typeof start.id).toBe('string');
  const cancel = await call('createFlowCancel');
  expect(cancel.ok).toBe(true);
  // Sending after cancel is refused (no active create-flow) — no silent spawn.
  const orphan = await call('createFlowSend', 'hello', undefined);
  expect(orphan.ok).toBe(false);
  const start2 = await call('createFlowStart');
  expect(start2.ok).toBe(true);
});

test('save is validated: no name and a missing location are refused (no fabricated success)', async () => {
  await call('createFlowStart');
  expect((await call('createFlowSave', '', os.tmpdir())).ok).toBe(false);
  expect((await call('createFlowSave', '   ', os.tmpdir())).ok).toBe(false);
  const missing = path.join(os.tmpdir(), 'pcc-nope-' + Date.now());
  expect((await call('createFlowSave', 'X', missing)).ok).toBe(false);
});

test('ADR-0020 T7: the create-flow send queue refuses a 6th message and hands its text back', async () => {
  // Own app instance with a SLOW fake worker so the create-flow worker stays busy while we queue.
  const { app: a, page: p } = await launchApp({ PCC_FAKE_DELAY_MS: '9000' });
  try {
    await p.locator('.nav[data-view="project"]').click();
    await p.locator('#new-project').click();
    await expect(p.locator('#create-flow')).toHaveClass(/open/, { timeout: 15000 });
    // Wait for the kickoff interview turn to be IN FLIGHT (thinking bubble) so the worker is busy and
    // subsequent sends queue deterministically — the queue starts empty behind this one busy turn.
    await expect(p.locator('#cf-log .bubble.assistant.thinking')).toBeVisible({ timeout: 15000 });
    const input = p.locator('#cf-input');
    // Fill the queue to its cap (5), then a 6th that must be refused.
    for (let i = 1; i <= 5; i++) { await input.fill('queued message ' + i); await input.press('Enter'); }
    await input.fill('SIXTH message must be refused');
    await input.press('Enter');
    // The 6th is refused with the plain usage-protection message, and its text is back in the composer.
    await expect(p.locator('#cf-log .bubble.assistant.error').last()).toContainText('already have 5 messages queued', { timeout: 6000 });
    await expect(input).toHaveValue('SIXTH message must be refused');
  } finally {
    await closeApp(a);
  }
});

test('save materializes a real, registered, active PCC project', async () => {
  await call('createFlowStart');
  // A send folds real content into the scratch (the fake worker doesn't write files, so also
  // exercise the plain happy path of createFlowSend running in the scoped surface).
  const sent = await call('createFlowSend', 'Build me a todo app', undefined);
  expect(sent.ok).toBe(true);

  const loc = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-np-'));
  try {
    const saved = await call('createFlowSave', 'E2E Todo App', loc);
    expect(saved.ok).toBe(true);
    expect(saved.project && saved.project.path).toBeTruthy();
    const proj = saved.project.path;
    // On disk: a valid PCC project (its own engine + first checkpoint).
    expect(fs.existsSync(path.join(proj, '.cockpit'))).toBe(true);
    expect(fs.existsSync(path.join(proj, 'scripts'))).toBe(true);
    expect(fs.existsSync(path.join(proj, 'CLAUDE.md'))).toBe(true);
    // Registered + made active.
    const list = await call('listProjects');
    expect(list.active).toBe(proj);
    expect(list.projects.some((p) => p.path === proj)).toBe(true);
    // Save closed the create-flow: a further save is refused.
    expect((await call('createFlowSave', 'Again', loc)).ok).toBe(false);
  } finally {
    fs.rmSync(loc, { recursive: true, force: true });
  }
});
