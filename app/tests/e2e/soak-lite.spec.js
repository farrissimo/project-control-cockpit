// Soak regression (DECISION-108 / W3): a soak found that rapid-clicking the
// process-heavy "Refresh" spawned 129 concurrent PowerShell processes, because
// nothing coalesced concurrent detector runs. main.js now hands every caller the
// in-flight run. This guards that rapid spam neither errors nor breaks rendering
// (we can't reliably count OS processes in CI, so we assert the observable
// behaviour: no crash, results still render after a burst).
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

test('rapid Refresh spam is coalesced: no error, still renders', async () => {
  await page.locator('.nav[data-view="signals"]').click();
  await page.waitForTimeout(2500);
  for (let i = 0; i < 15; i++) {
    await page.locator('#signals-refresh').click({ noWaitAfter: true }).catch(() => {});
  }
  await page.waitForTimeout(5000);
  // The detector results still render (substantial content), and nothing errored.
  const text = await page.locator('#view-signals').innerText();
  expect(text.length).toBeGreaterThan(200);
  expect(errs).toEqual([]);
});

test('rapid view-switching does not error', async () => {
  const views = ['chat', 'project', 'lifecycle', 'signals', 'verify', 'memory', 'rules'];
  for (let r = 0; r < 3; r++) for (const v of views) await page.locator('.nav[data-view="' + v + '"]').click();
  await page.waitForTimeout(1500);
  expect(errs).toEqual([]);
});
