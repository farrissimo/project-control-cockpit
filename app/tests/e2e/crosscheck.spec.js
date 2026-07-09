// Claude<->Codex cross-check: the "Second opinion" button sends the last answer
// to the (faked) Codex and renders its independent take in a distinct bubble.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });
test.beforeEach(async () => { await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 }); });

test('Second opinion with no answer yet shows a friendly error', async () => {
  await page.locator('.corr', { hasText: 'Second opinion' }).first().click();
  await expect(page.locator('.bubble.error').last()).toContainText(/No answer to review/);
});

test('Second opinion sends the last answer to Codex and renders a codex bubble', async () => {
  // First get a (faked) Claude answer.
  await page.locator('#input').fill('should I ship this?');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant').last()).toContainText('FAKE-CLAUDE-REPLY', { timeout: 15000 });
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 15000 });

  // Now ask Codex for a second opinion.
  await page.locator('.corr', { hasText: 'Second opinion' }).first().click();
  const codexBubble = page.locator('.bubble.codex').last();
  await expect(codexBubble).toBeVisible({ timeout: 20000 });
  await expect(codexBubble).toContainText('FAKE-CODEX-REPLY');
});
