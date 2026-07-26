// ADR-0025: the chat-length / chat-health meter is REMOVED (neither usable signal was both honest and
// built). This pins that it stays gone — no gauge element, no "Chat length" tile, no chat-health signal
// card — while the manual "Continue in fresh chat" button (the owner-controlled replacement) is still
// present. AC-1/AC-6 of docs/specs/remove-chat-length-meter.md.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the chat-length meter is gone (no gauge, no chat-health card), manual continue button remains', async () => {
  const { app, page } = await launchApp();
  try {
    // The owner-controlled replacement is present and always available.
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });

    // The gauge is removed from the DOM everywhere — not merely hidden.
    await expect(page.locator('.gauge-wrap')).toHaveCount(0);
    await expect(page.locator('.ch-gauge')).toHaveCount(0);
    await expect(page.locator('#chat-health')).not.toContainText('Chat length');

    // The Signals tab no longer has a chat-health / rollover card.
    await page.locator('.nav[data-view="signals"]').click();
    await expect(page.locator('.signal-card').filter({ hasText: 'Chat health' })).toHaveCount(0);

    // The separate plan-usage meter is untouched (it is NOT the chat-length meter).
    await expect(page.locator('#usage-meter')).toHaveCount(1);
  } finally {
    await closeApp(app);
  }
});
