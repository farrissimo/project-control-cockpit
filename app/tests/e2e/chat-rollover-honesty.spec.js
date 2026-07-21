// The Chat health/rollover signal's "not proven" text used to claim token usage was "NOT
// measurable from here" — true before 2026-07-20, false now that real cost tracking + automatic
// per-chat rollover exist (ADR-0014/0015). Fixed during the trust proving window (ADR-0016): the
// signal now points the owner at the REAL mechanism instead of leaving a stale, misleading claim.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the chat-rollover signal no longer claims cost is unmeasurable — points to the real automatic protection', async () => {
  const { app, page } = await launchApp();
  try {
    await page.locator('.nav[data-view="signals"]').click();
    await expect(page.locator('#view-signals')).toBeVisible();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 15000 });
    await expect(card).not.toContainText('NOT measurable from here');
    await expect(card).toContainText('SEPARATE, automatic mechanism');
  } finally {
    await closeApp(app);
  }
});
