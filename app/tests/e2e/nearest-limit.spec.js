const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

// ADR-0018 extension / Task 2.1: the "Nearest stop" reconciler. Proves (1) the chip renders in the
// trust strip, and (2) the pure reconciler module is actually loaded/wired in the renderer and ranks
// within each meter's own scale with honest spend-guard labels.

// PCCNearestLimit is a real page global (nearest-limit.js), reached inside page.evaluate.
/* global PCCNearestLimit:readonly */

test('the "Nearest limit" chip renders in the trust strip', async () => {
  const { app, page } = await launchApp();
  try {
    const chip = page.locator('#trust-nearest');
    await expect(chip).toBeVisible({ timeout: 20000 });
    await expect(chip).toContainText('Nearest limit');
  } finally {
    await closeApp(app);
  }
});

test('the nearest-limit reconciler is wired into the renderer and ranks honestly', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('#trust-nearest')).toBeVisible({ timeout: 20000 });
    // 5-hour usage 85% (vs the 90% hold = 0.94) beats chat spend $10/$40 (0.25); it is real plan usage.
    const r = await page.evaluate(() => PCCNearestLimit.nearestStop({ sessionPercent: 85, chatUsd: 10, maxChatUsd: 40 }));
    expect(r.kind).toBe('usage');
    expect(r.isSpendGuard).toBe(false);
    // A dollar cap is labeled a spend guard, not Claude-plan exhaustion.
    const g = await page.evaluate(() => PCCNearestLimit.nearestStop({ chatUsd: 39, maxChatUsd: 40 }));
    expect(g.kind).toBe('chat_usd');
    expect(g.isSpendGuard).toBe(true);
  } finally {
    await closeApp(app);
  }
});
