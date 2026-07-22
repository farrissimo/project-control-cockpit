// ADR-0019: the chat-health meter must be driven by REAL context size, not just message-count.
// This drives ONE short message whose (faked) turn reports 100K tokens of context — under the
// conservative 150K rollover threshold, so it stays put — and proves the gauge reflects that
// context (≈67% of the way to rollover) and discloses the real token count + estimated window,
// rather than staying calm the way the old message-count meter did.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-small.json');

test('a token-heavy turn drives the chat-health gauge by real context size, not message count', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('one short message');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });

    // 1 message is ~2.5% by count — but 100K tokens is ~67% of the way to the 150K rollover, so
    // context drives the gauge and the card names the real token count + estimated window.
    await page.locator('.nav[data-view="signals"]').click();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).toContainText('~100K tokens');
    await expect(card).toContainText('of the estimated window');
    await expect(card.locator('.gauge-val')).toContainText('67%');
    // it is a real reading now, not the "not measured" honest-fallback
    await expect(card).not.toContainText('not yet measured');
  } finally {
    await closeApp(app);
  }
});
