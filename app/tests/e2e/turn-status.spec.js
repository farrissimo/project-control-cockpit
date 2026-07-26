// ADR-0018 ext / Task 2.2: the live turn-status line on the "Claude is working…" bubble. Proves
// (1) the pure PCCTurnStatus module is actually loaded/wired in the renderer and stays honest across
// fresh / at-the-hold / stale / unknown readings (never a fake number, never a dollar stopper —
// ADR-0022), and (2) during a real turn the working bubble shows BOTH the elapsed counter and the
// live limiter sub-line.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

// PCCTurnStatus is a real page global (turn-status.js), reached inside page.evaluate.
/* global PCCTurnStatus:readonly */

test('the live limiter reconciler is wired into the renderer and stays honest across all readings', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 }); // app ready
    // Fresh below the hold -> names the real 5-hour usage as nearest stop, no dollars.
    const fresh = await page.evaluate(() => PCCTurnStatus.liveLimiterLine({ available: true, sessionPercent: 62, stale: false }, 90));
    expect(fresh.kind).toBe('usage');
    expect(fresh.text).toMatch(/5-hour Claude usage/);
    expect(fresh.text).not.toContain('$');
    // At/over the hold -> says it is AT the stop.
    const over = await page.evaluate(() => PCCTurnStatus.liveLimiterLine({ available: true, sessionPercent: 93, stale: false }, 90));
    expect(over.text).toMatch(/at the 90% stop/);
    // Stale -> shown but flagged, never dressed as live.
    const stale = await page.evaluate(() => PCCTurnStatus.liveLimiterLine({ available: true, sessionPercent: 50, stale: true }, 90));
    expect(stale.kind).toBe('stale');
    expect(stale.text).toMatch(/too old to trust as live/);
    // Unavailable -> honest unknown, never a fabricated 0%.
    const unk = await page.evaluate(() => PCCTurnStatus.liveLimiterLine({ available: false }, 90));
    expect(unk.kind).toBe('unknown');
    expect(unk.text).toMatch(/unknown/);
    expect(unk.text).not.toMatch(/\b0%/);
  } finally { await closeApp(app); }
});

test('during a slow turn the working bubble shows the elapsed counter AND a live limiter line', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '3500' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a slow turn to watch progress');
    await page.locator('#send').click();

    const thinking = page.locator('.bubble.assistant.thinking');
    await expect(thinking).toBeVisible({ timeout: 5000 });
    await expect(thinking).toContainText(/Claude is working… \(\d+s\)/, { timeout: 4000 }); // elapsed intact
    const sub = thinking.locator('.tw-sub');
    await expect(sub).toBeVisible({ timeout: 4000 });
    await expect(sub).toContainText('5-hour Claude usage'); // the honest live limiter line renders
    expect(await sub.textContent()).not.toContain('$');     // never a dollar stopper (ADR-0022)

    // Gone when the turn completes (timer cleared with the bubble).
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 10000 });
  } finally { await closeApp(app); }
});
