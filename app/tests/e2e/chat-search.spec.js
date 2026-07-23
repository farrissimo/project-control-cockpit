// End-to-end: "Search all chats" UI (docs/CHAT_RECALL_SPEC.md). Drives the REAL app; the worker
// is faked. A fixture makes the (faked) judge return a matches JSON, so we prove the full path:
// type a question -> pipeline -> results render -> clicking a result opens that chat -> back clears.
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { launchApp, closeApp } = require('../helpers/launch');

// The fake replays this for EVERY claude call. As the judge output it yields one match; the
// expand call also gets it (harmless — parseTerms just folds in the question words too).
const MATCHES_JSON = JSON.stringify({ matches: [
  { chatId: '__CHAT_ID__', answer: 'You decided the tax app uses a chat interface.', quote: 'chat interface is the primary surface' },
] });

let app, page, fixturePath, dir;
test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-search-'));
  fixturePath = path.join(dir, 'fixture.json');
  ({ app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: fixturePath }));
});
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

test('setup: create a chat with content and learn its id', async () => {
  // A neutral fixture for the send turn (its content is irrelevant to this test).
  fs.writeFileSync(fixturePath, JSON.stringify({ stdout: 'ok', exitCode: 0 }), 'utf8');
  await page.locator('.nav[data-view="chat"]').click();
  await page.locator('#input').fill('should the tax app use a chat interface?');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  // Point the match fixture at the real active chat id so the result is clickable.
  // activeChat() is a renderer global resolved in the browser page context, not this file.
  // eslint-disable-next-line no-undef
  const activeId = await page.evaluate(() => activeChat().id);
  fs.writeFileSync(fixturePath, JSON.stringify({ stdout: MATCHES_JSON.replace('__CHAT_ID__', activeId), exitCode: 0 }), 'utf8');
});

test('search box appears at the top of the chats panel', async () => {
  await page.locator('#chats-btn').click();
  await expect(page.locator('#chats-panel')).not.toHaveClass(/hidden/);
  await expect(page.locator('#chats-search-input')).toBeVisible();
  await expect(page.locator('#chats-search-btn')).toBeVisible();
});

test('searching renders matches with answer + quote', async () => {
  await page.locator('#chats-search-input').fill('where did we decide the tax app UI?');
  await page.locator('#chats-search-btn').click();
  const results = page.locator('#chats-search-results');
  await expect(results).toContainText('You decided the tax app uses a chat interface', { timeout: 20000 });
  await expect(results).toContainText('chat interface is the primary surface');
  await expect(page.locator('.sr-hit')).toHaveCount(1);
});

test('clicking a result opens that chat; back returns to the list', async () => {
  await page.locator('.sr-hit').first().click();
  // Opening a chat closes the panel (switchChat -> closeChatsPanel).
  await expect(page.locator('#chats-panel')).toHaveClass(/hidden/);
  // Reopen, search again, then use back to return to the list view.
  await page.locator('#chats-btn').click();
  await page.locator('#chats-search-input').fill('anything');
  await page.locator('#chats-search-btn').click();
  await expect(page.locator('.sr-hit').first()).toBeVisible({ timeout: 20000 });
  await page.locator('.sr-back').click();
  await expect(page.locator('#chats-list')).not.toHaveClass(/hidden/);
  await expect(page.locator('#chats-search-results')).toHaveClass(/hidden/);
});

// ADR-0020 T7 truncation-visibility correction: a giant pasted question is searched only as a head+tail
// slice, and the owner is told so DETERMINISTICALLY (driven by res.questionTruncated), never silently.
test('an over-cap search question shows a "searched only part of it" notice; a normal one does not', async () => {
  const pc = require('../../payload-caps.js');
  const results = page.locator('#chats-search-results');
  // #chats-btn is a toggle — open the panel only if it isn't already (prior tests may leave it open).
  const panel = page.locator('#chats-panel');
  if (((await panel.getAttribute('class')) || '').includes('hidden')) await page.locator('#chats-btn').click();
  await expect(panel).not.toHaveClass(/hidden/);
  // A normal question: results render, no trim notice.
  await page.locator('#chats-search-input').fill('where did we decide the tax app UI?');
  await page.locator('#chats-search-btn').click();
  await expect(page.locator('.sr-hit').first()).toBeVisible({ timeout: 20000 });
  await expect(results.locator('.sr-status.cap-notice')).toHaveCount(0);
  // An over-cap question (a giant paste): the deterministic notice appears, and results still render.
  await page.locator('#chats-search-input').fill('Q'.repeat(pc.MAX_RECALL_EVIDENCE_CHARS + 500));
  await page.locator('#chats-search-btn').click();
  await expect(results.locator('.sr-status.cap-notice')).toHaveCount(1, { timeout: 20000 });
  await expect(results.locator('.sr-status.cap-notice')).toContainText('searched only the beginning and end');
});
