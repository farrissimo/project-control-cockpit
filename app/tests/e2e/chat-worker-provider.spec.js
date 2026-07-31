const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
const codexArgvFile = path.join(os.tmpdir(), 'pcc-codex-worker-argv-' + Date.now() + '.json');
test.beforeAll(async () => { ({ app, page } = await launchApp({ PCC_TEST_USE_REAL_PROVIDER_CONFIG: '1', PCC_FAKE_CODEX_ARGV_FILE: codexArgvFile })); });
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(codexArgvFile, { force: true }); } catch (e) { /* best effort */ }
});

test('worker selector defaults to Codex, keeps Claude visible but disabled, and uses Codex chat', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  await expect(page.locator('#worker-select')).toHaveValue('codex');
  await expect(page.locator('#model-select')).toHaveValue('auto');
  await expect(page.locator('#worker-select option[value="claude"]')).toBeDisabled();

  await page.locator('#input').fill('hello from codex worker');
  await page.locator('#send').click();

  await expect(page.locator('.bubble.user').last()).toHaveText(/hello from codex worker/);
  await expect(page.locator('.bubble.assistant').last()).toContainText('FAKE-CODEX-REPLY', { timeout: 15000 });

  const invocation = JSON.parse(fs.readFileSync(codexArgvFile, 'utf8'));
  expect(invocation.argv).toContain('exec');
  expect(invocation.argv).toContain('--sandbox');
  expect(invocation.argv).not.toContain('--skip-git-repo-check');
  expect(invocation.argv).not.toContain('--model');
});

test('a stale saved Claude worker preference falls back to Codex when Claude is disabled', async () => {
  await page.evaluate(() => { localStorage.setItem('pcc.worker', 'claude'); });
  await page.reload();
  await page.waitForFunction(() => window.__pccBooted === true);
  await expect(page.locator('#worker-select')).toHaveValue('codex');
  await expect(page.locator('#worker-select option[value="claude"]')).toBeDisabled();
});

test('IPC refuses to route a stale disabled Claude provider and falls back to Codex', async () => {
  const res = await page.evaluate(() => window.pcc.send(
    'direct stale provider request',
    'claude',
    'auto',
    undefined,
    true,
    'stale-provider-ipc-test',
    []
  ));
  expect(res.ok).toBe(true);
  expect(res.text).toContain('FAKE-CODEX-REPLY');
  const invocation = JSON.parse(fs.readFileSync(codexArgvFile, 'utf8'));
  expect(invocation.argv).toContain('exec');
});

test('New Project create-flow uses Codex when Claude is disabled', async () => {
  const start = await page.evaluate(() => window.pcc.createFlowStart());
  expect(start.ok).toBe(true);
  const res = await page.evaluate(() => window.pcc.createFlowSend(
    'interview this new project',
    'claude',
    'auto',
    []
  ));
  expect(res.ok).toBe(true);
  expect(res.text).toContain('FAKE-CODEX-REPLY');
  const invocation = JSON.parse(fs.readFileSync(codexArgvFile, 'utf8'));
  expect(invocation.argv).toContain('exec');
  expect(invocation.argv).toContain('--skip-git-repo-check');
  await page.evaluate(() => window.pcc.createFlowCancel());
});

test('Codex New Project create-flow carries prior intake turns into the next prompt', async () => {
  const start = await page.evaluate(() => window.pcc.createFlowStart());
  expect(start.ok).toBe(true);
  const first = await page.evaluate(() => window.pcc.createFlowSend(
    'I want a live read-only advisor for Clash of Clans and Pokemon Go.',
    'claude',
    'auto',
    []
  ));
  expect(first.ok).toBe(true);
  const second = await page.evaluate(() => window.pcc.createFlowSend(
    'Did you keep track of the games I named earlier?',
    'claude',
    'auto',
    []
  ));
  expect(second.ok).toBe(true);
  const invocation = JSON.parse(fs.readFileSync(codexArgvFile, 'utf8'));
  expect(invocation.input).toContain('Prior New Project conversation');
  expect(invocation.input).toContain('Clash of Clans');
  expect(invocation.input).toContain('Pokemon Go');
  expect(invocation.input).toContain('Current owner message');
  expect(invocation.input).toContain('Did you keep track of the games I named earlier?');
  expect(invocation.input).toContain('Do not claim earlier turns are unavailable');
  expect(invocation.input).toContain('Do not create scripts, run scaffold tests, initialize git, or fix/build the project during intake');
  await page.evaluate(() => window.pcc.createFlowCancel());
});

test('Codex attachment send fails plainly instead of pretending attachments were sent', async () => {
  const res = await page.evaluate(() => window.pcc.send(
    'please inspect the attachment',
    'codex',
    'auto',
    undefined,
    true,
    'codex-attachment-test',
    [{ kind: 'text', name: 'note.txt', content: 'hello' }]
  ));
  expect(res.ok).toBe(false);
  expect(res.text).toContain('does not support attachments with Codex yet');
  expect(res.text).toContain('Switch this chat to Claude Code');
});
