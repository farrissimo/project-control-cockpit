// Layer 3 (Phase 2A slice 5) — the CHAT SCREEN driven through the real UI, proving
// the renderer now reads/writes the canonical store (chats.json), not localStorage.
// Isolation: PCC_TEST_MODE + throwaway --user-data-dir (launchApp); fake worker.
// This spec runs in an Electron-capable environment / CI (test mode only), never
// the owner's real app.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

const call = (method, ...args) =>
  page.evaluate(([m, a]) => window.pcc[m](...a), [method, args]);

test('a sent message persists to the CANONICAL store and survives a reload', async () => {
  await page.fill('#input', 'hello canonical world');
  await page.click('#send');
  await page.waitForSelector('.bubble.assistant', { timeout: 20000 }); // fake worker replies

  const userText = await page.locator('.bubble.user').last().innerText();
  expect(userText).toContain('hello canonical world');

  // It's in the canonical store (chats.json via IPC), not just the DOM / localStorage.
  const read = await call('chatsRead');
  expect(read.ok).toBe(true);
  const allMsgs = read.store.chats.reduce((acc, c) => acc.concat(c.messages || []), []);
  expect(allMsgs.some((m) => m.cls === 'user' && String(m.text).includes('hello canonical world'))).toBe(true);

  // Reload the renderer: history must come back FROM CANONICAL (localStorage is only a cache).
  await page.reload();
  await page.waitForSelector('.bubble.user', { timeout: 20000 });
  const afterReload = await page.locator('.bubble.user').last().innerText();
  expect(afterReload).toContain('hello canonical world');
});

test('New chat creates a fresh canonical chat via the command IPC', async () => {
  const before = (await call('chatsRead')).store.chats.length;
  await page.click('#new-chat');
  await page.waitForTimeout(600);
  const after = await call('chatsRead');
  expect(after.store.chats.length).toBeGreaterThanOrEqual(before + 1);
});
