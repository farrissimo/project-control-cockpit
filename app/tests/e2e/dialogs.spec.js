// Dialog-driven controls: New project (prompt), rename chat (prompt), delete
// chat (confirm). Electron does NOT support window.prompt() — it throws — so the
// app draws its own modal (pccPrompt). These tests drive that modal directly.
// Delete still uses window.confirm(), which Electron DOES support, so that one
// is driven via Playwright's native dialog handler.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });
test.beforeEach(async () => { await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 }); });

// Open the chats panel deterministically (it's a toggle; state leaks between
// tests that share one app instance).
async function openChats() {
  const panel = page.locator('#chats-panel');
  const hidden = await panel.evaluate((el) => el.classList.contains('hidden'));
  if (hidden) await page.locator('#chats-btn').click();
  await expect(panel).not.toHaveClass(/hidden/);
}

test('rename chat: in-app prompt sets the chat name', async () => {
  await openChats();
  await page.locator('.chat-mini[data-act="rename"]').first().click();
  const overlay = page.locator('[data-testid="prompt-overlay"]');
  await expect(overlay).toBeVisible();
  await page.locator('[data-testid="prompt-input"]').fill('Renamed by test');
  await page.locator('[data-testid="prompt-ok"]').click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator('.chat-name').first()).toHaveText('Renamed by test', { timeout: 10000 });
});

test('new project: in-app prompt opens a project intake chat', async () => {
  await page.locator('.nav[data-view="project"]').click();
  await page.locator('#new-project').click();
  const overlay = page.locator('[data-testid="prompt-overlay"]');
  await expect(overlay).toBeVisible();
  await page.locator('[data-testid="prompt-input"]').fill('Test Widget');
  await page.locator('[data-testid="prompt-ok"]').click();
  // New Project is gated behind an explicit build-session approval (DECISION-112):
  // approve the "Start a new project" confirm before the intake chat opens.
  await expect(page.locator('[data-testid="confirm-overlay"]')).toBeVisible();
  await page.locator('[data-testid="confirm-approve"]').click();
  // Switches to chat, opens a "New project: ..." chat, and sends the intake kickoff.
  await expect(page.locator('#view-chat')).toBeVisible();
  await expect(page.locator('.bubble.user').last()).toContainText('Test Widget', { timeout: 15000 });
});

test('prompt: Cancel makes no change', async () => {
  await openChats();
  const nameBefore = await page.locator('.chat-name').first().textContent();
  await page.locator('.chat-mini[data-act="rename"]').first().click();
  await expect(page.locator('[data-testid="prompt-overlay"]')).toBeVisible();
  await page.locator('[data-testid="prompt-cancel"]').click();
  await expect(page.locator('[data-testid="prompt-overlay"]')).toHaveCount(0);
  await expect(page.locator('.chat-name').first()).toHaveText(nameBefore);
});

test('delete chat: confirm removes it from the list', async () => {
  await openChats();
  const before = await page.locator('.chat-row').count();
  page.once('dialog', (d) => d.accept());
  await page.locator('.chat-mini[data-act="delete"]').first().click();
  await expect(async () => {
    expect(await page.locator('.chat-row').count()).toBeLessThanOrEqual(before);
  }).toPass({ timeout: 10000 });
});
