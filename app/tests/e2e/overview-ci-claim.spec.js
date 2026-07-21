// The Owner Overview proof card claimed "live CI status is not yet wired into PCC" — false: the
// trust-strip Verified chip is bound to live exact-SHA CI, and the card's own "Executed proof"
// line reports CI passes. A stale claim that contradicts a visible chip is a confusion/surprise
// risk; fixed during the trust proving window (ADR-0016). This proves the false claim is gone and
// the honest one renders.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('the Owner Overview proof card no longer claims CI is unwired — states it IS surfaced (Verified chip)', async () => {
  const { app, page } = await launchApp();
  try {
    await page.locator('.nav[data-view="project"]').click();
    await expect(page.locator('#view-project')).toBeVisible();
    // The overview fetches live facts in parallel (detections spawns real PowerShell detectors),
    // so it can take ~10-25s to populate on a loaded box — wait for the card, don't race it.
    const proofCard = page.locator('.ov-card').filter({ hasText: 'Proof' });
    await expect(proofCard).toBeVisible({ timeout: 40000 });
    await expect(proofCard).not.toContainText('not yet wired into PCC');
    await expect(proofCard).toContainText('surfaced in the "Verified" chip');
  } finally {
    await closeApp(app);
  }
});
