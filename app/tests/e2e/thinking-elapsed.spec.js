// A long turn must read as "alive and progressing", not an ambiguous frozen "Claude is working…"
// line — the exact 2026-07-20 confusion ("it doesn't respond once it says Claude is thinking").
// The thinking bubble shows a live elapsed-time counter; paired with Stop, the owner can see how
// long it's taken and act. Uses a slow fake worker so the counter is observable.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the "Claude is working…" bubble shows a live elapsed-time counter during a turn, gone when done', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '3500' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a slow turn');
    await page.locator('#send').click();
    const thinking = page.locator('.bubble.assistant.thinking');
    await expect(thinking).toBeVisible({ timeout: 5000 });
    // It ticks: within a couple seconds the bubble shows an elapsed count like "(1s)" / "(2s)".
    await expect(thinking).toContainText(/Claude is working… \(\d+s\)/, { timeout: 4000 });
    // And it's genuinely counting up, not stuck at 0 — grab it, wait, and confirm it advanced.
    const first = await thinking.textContent();
    await page.waitForTimeout(1500);
    const later = await thinking.textContent();
    expect(later).not.toBe(first); // the counter advanced — the turn reads as progressing, not frozen
    // When the turn finishes the thinking bubble (and its timer) are gone; a real reply is shown.
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1);
  } finally {
    await closeApp(app);
  }
});
