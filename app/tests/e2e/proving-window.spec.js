// ADR-0016: the trust proving window banner must actually appear on the main chat page — the
// owner's literal ask ("add it to the main chat page... it's a very low bar but it's vital").
// Proves it renders with real content, not just that the code exists.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the proving-window banner is visible on the main chat page with real day/date content', async () => {
  const { app, page } = await launchApp();
  try {
    const banner = page.locator('#proving-window');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Trust proving window');
    await expect(banner).toContainText('2026-08-04'); // the real, owner-locked end date
    await expect(banner).toContainText(/Day \d+ of 14|ended/); // a real day count, not a placeholder
    await expect(banner).toContainText('one full week of regular use without shocking the owner');
  } finally {
    await closeApp(app);
  }
});
