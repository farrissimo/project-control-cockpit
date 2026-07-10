// End-to-end: chats are AI-named when you're DONE with them, not after turn one
// (docs/CHAT_RECALL_SPEC.md — the real subject usually emerges near the end). Here the
// fake worker replays a fixed title; we prove that leaving a chat (starting a new one)
// renames the chat you left from its full content.
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { launchApp, closeApp } = require('../helpers/launch');

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

test('leaving a chat gives it an AI name from its full content (not the first line)', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  // A real exchange in the current chat; its provisional name is the first message text.
  await page.locator('#input').fill('some opening question that is not the real topic');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

  // Leave it — this is when the AI name is generated (fire-and-forget).
  await page.locator('#new-chat').click();
  await expect(page.locator('.welcome')).toBeVisible();

  // The chat we left is now named by the AI, not by its first line.
  await page.locator('#chats-btn').click();
  await expect(page.locator('.chat-name', { hasText: TITLE })).toBeVisible({ timeout: 20000 });
  await expect(page.locator('.chat-name', { hasText: 'some opening question' })).toHaveCount(0);
});
