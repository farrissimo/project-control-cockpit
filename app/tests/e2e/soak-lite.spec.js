// Soak regression (DECISION-108 / W3): a soak found that rapid-clicking the
// process-heavy "Refresh" spawned 129 concurrent PowerShell processes, because
// nothing coalesced concurrent detector runs. main.js now hands every caller the
// in-flight run via the singleFlight seam (app/single-flight.js). This E2E guards the
// observable end-to-end behaviour under spam — no crash, no errors, and the detector
// results actually render — by waiting on SEMANTIC completion (status cleared + signal
// cards present), never a fixed sleep or character count. The coalescing law itself
// (concurrent callers share one batch; a call after it settles re-runs) is proven
// deterministically as a pure unit in app/tests/unit/single-flight.test.js.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page, errs;
test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
});
test.afterAll(async () => { await closeApp(app); });

test('rapid Refresh spam is coalesced: no error, results still render', async () => {
  await page.locator('.nav[data-view="signals"]').click();
  await expect(page.locator('#view-signals')).toBeVisible();
  // Rapid spam: 15 near-instant clicks. Coalescing means these SHARE the in-flight
  // detector batch instead of storming the machine — the coalescing law itself is
  // proven deterministically in app/tests/unit/single-flight.test.js.
  for (let i = 0; i < 15; i++) {
    await page.locator('#signals-refresh').click({ noWaitAfter: true }).catch(() => {});
  }
  // Deterministic SEMANTIC completion — no fixed sleeps, no character-count threshold:
  //  1. the refresh finished — the status spinner/"Checking…" cleared to empty;
  //  2. the detector results actually rendered — signal cards are present;
  //  3. nothing errored on the page or console during the burst.
  // (If a detector run had failed, status would be empty but NO .signal-card would
  //  render — so this fails loudly on real breakage rather than masking it.)
  await expect(page.locator('#signals-status')).toBeEmpty({ timeout: 30000 });
  await expect(page.locator('#view-signals .signal-card').first()).toBeVisible({ timeout: 30000 });
  expect(await page.locator('#view-signals .signal-card').count()).toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('rapid view-switching does not error', async () => {
  const views = ['chat', 'project', 'lifecycle', 'signals', 'verify', 'memory', 'rules'];
  for (let r = 0; r < 3; r++) for (const v of views) await page.locator('.nav[data-view="' + v + '"]').click();
  await page.waitForTimeout(1500);
  expect(errs).toEqual([]);
});
