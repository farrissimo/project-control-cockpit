// ADR-0019 Slice C: the AUTOMATIC protection. A turn that pushes a chat over the context threshold
// (fixture reports 160K/200K = 80% >= 75%) must auto-roll the chat over into a NEW chat, carry a
// handoff forward, keep the old chat, and never delete anything — the direct fix for the 2026-07-20
// runaway that had no automatic protection at all.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage.json');

test('a turn over the context threshold auto-rolls into a NEW chat, keeps the old one, carries a handoff', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)'); // one chat to start

    await page.locator('#input').fill('a message that pushes context over the limit');
    await page.locator('#send').click();

    // After the turn settles, PCC auto-rolls over: the fresh chat shows the plain rollover notice.
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' }))
      .toBeVisible({ timeout: 25000 });
    await expect(page.locator('.bubble.assistant').last()).not.toHaveClass(/error/); // protection, not a bug

    // The OLD chat is preserved (nothing deleted) — there are now two chats.
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)');
  } finally {
    await closeApp(app);
  }
});
