// End-to-end: ADR-0020 T6 — leaving a chat names it LOCALLY and deterministically from its own
// first user message, with NO worker/LLM call. The fake worker is armed to return a DIFFERENT
// title (TITLE below) as a negative control; proving the chat is named from its first message and
// NOT from TITLE shows the naming path never went to the worker. (Pre-T6 this fired an invisible
// `claude` call on every chat leave — the exact invisible burn ADR-0020 T6 removes.)
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { launchApp, closeApp } = require('../helpers/launch');

// What the worker WOULD return if naming used it — used here as a negative control.
const TITLE = 'Ship The Widget Plan';
let app, page, fixturePath;
test.beforeAll(async () => {
  fixturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-name-')), 'fixture.json');
  fs.writeFileSync(fixturePath, JSON.stringify({ stdout: TITLE, exitCode: 0 }), 'utf8');
  ({ app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: fixturePath }));
});
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(path.dirname(fixturePath), { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

test('leaving a chat names it LOCALLY from its first message, never via the worker (ADR-0020 T6)', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  await page.locator('#input').fill('some opening question that is not the real topic');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

  // Leave it — the name is reconsidered on leave, but LOCALLY (no worker/LLM call).
  await page.locator('#new-chat').click();
  await expect(page.locator('.welcome')).toBeVisible();

  await page.locator('#chats-btn').click();
  // The name is the chat's OWN first user message (local, deterministic) …
  await expect(page.locator('.chat-name', { hasText: 'some opening question' })).toBeVisible({ timeout: 20000 });
  // … and NOT the worker/fixture title — proving auto-naming never spawned a worker.
  await expect(page.locator('.chat-name', { hasText: TITLE })).toHaveCount(0);
});
