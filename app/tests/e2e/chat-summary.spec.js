// End-to-end: first-class chat history UI (docs/CHAT_RECALL_SPEC.md). Drives the
// REAL app; the worker is faked on PATH. A fixture makes every `claude` call return
// a valid structured-summary JSON, so we can prove the summary button -> slide-over
// -> rendered card -> close path works against the actual IPC + renderer wiring.
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { launchApp, closeApp } = require('../helpers/launch');

const SUMMARY_JSON = JSON.stringify({
  title: 'Widget shipping decision',
  gist: 'The team decided to ship the widget after tests passed.',
  decided: ['Ship the widget in v1'],
  wentRight: ['All tests passed'],
  wentWrong: ['One flaky step delayed the run'],
  openIdeas: ['Add a dark mode later'],
  importantEvents: ['Decision to ship recorded'],
});

let app, page, fixturePath;
test.beforeAll(async () => {
  // The fake `claude` replays this fixture's stdout for EVERY call (send, auto-name,
  // summarize) — here that's the summary JSON, which is what the summarize path needs.
  fixturePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-sum-')), 'fixture.json');
  fs.writeFileSync(fixturePath, JSON.stringify({ stdout: SUMMARY_JSON, exitCode: 0 }), 'utf8');
  ({ app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: fixturePath }));
});
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(path.dirname(fixturePath), { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

// Give the active chat a real exchange so it has messages to summarize.
test('setup: a sent message gives the chat content', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  await page.locator('#input').fill('should we ship the widget?');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.user').last()).toHaveText(/should we ship the widget/);
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
});

test('summary button: each chat row exposes a summary control', async () => {
  await page.locator('#chats-btn').click();
  await expect(page.locator('#chats-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('.chat-row [data-act="summary"]').first()).toBeVisible();
});

test('summary card: clicking opens the drawer and renders the structured card', async () => {
  await page.locator('.chat-row [data-act="summary"]').first().click();
  const drawer = page.locator('#summary-drawer');
  await expect(drawer).not.toHaveClass(/hidden/);
  // The structured sections render, populated from the (faked) summary JSON.
  await expect(page.locator('#summary-body')).toContainText('Decided', { timeout: 20000 });
  await expect(page.locator('#summary-body')).toContainText('Ship the widget in v1');
  await expect(page.locator('#summary-body')).toContainText('Went wrong');
  await expect(page.locator('#summary-body')).toContainText('One flaky step delayed the run');
});

test('summary card: close hides the drawer', async () => {
  await page.locator('#summary-close').click();
  await expect(page.locator('#summary-drawer')).toHaveClass(/hidden/);
});
