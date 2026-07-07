// Lifecycle view is actionable: it renders "Advance to <stage>" buttons for the
// legal next steps. We assert the buttons render (wiring is present) but do NOT
// click — a real advance would move the home repo's pin. The gate logic itself
// is covered exhaustively in tests/scripts/lifecycle-advance.spec.js.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

test('Lifecycle view shows at least one Advance button', async () => {
  await page.locator('.nav[data-view="lifecycle"]').click();
  await expect(page.locator('#view-lifecycle')).toBeVisible();
  await expect(page.locator('.lc-advance').first()).toBeVisible({ timeout: 15000 });
});
