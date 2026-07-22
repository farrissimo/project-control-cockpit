// ADR-0019: the Chat health signal now measures REAL context fullness (latest turn's prompt tokens
// ÷ the model window), not just message-count/hours. Its "not proven" text no longer claims tokens
// are unmeasurable. On a fresh launch with no token-bearing turn yet, it is HONEST that context is
// "not yet measured" rather than faking a green — the whole point of ADR-0016.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the chat-rollover signal no longer claims tokens are unmeasurable; it is honest about context', async () => {
  const { app, page } = await launchApp();
  try {
    await page.locator('.nav[data-view="signals"]').click();
    await expect(page.locator('#view-signals')).toBeVisible();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).not.toContainText('NOT measurable from here'); // stale pre-2026-07-20 claim, gone
    await expect(card).not.toContainText('does not track that');      // old cost-only framing, gone
    // No token-bearing turn yet (the plain-text fake carries no usage), so context is honestly
    // reported as unmeasured rather than a fabricated green.
    await expect(card).toContainText('not yet measured');
  } finally {
    await closeApp(app);
  }
});
