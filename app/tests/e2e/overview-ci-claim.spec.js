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
    // so it can take ~10-25s to populate on a loaded box — wait for it, don't race it. Assert against
    // the overview container: `.ov-card` filtered by "Proof" is ambiguous (the condition/next-move
    // cards also contain the word "proof"), which tripped Playwright's strict-mode (3 matches).
    const ov = page.locator('#owner-overview');
    await expect(ov).toBeVisible({ timeout: 40000 });
    await expect(ov).not.toContainText('not yet wired into PCC');
    await expect(ov).toContainText('surfaced in the "Verified" chip');
  } finally {
    await closeApp(app);
  }
});
