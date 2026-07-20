// Composer sizing (owner ask 2026-07-20): the chat box was a single fixed line,
// painful for pasting. Proves the lived behaviour in the REAL app: a comfortable
// multi-line default, a draggable (resize:vertical) grip, auto-grow with content,
// and a remembered height that survives a reload.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

test('composer defaults to multi-line and is vertically resizable', async () => {
  await expect(page.locator('#input')).toBeVisible();
  const { h, resize } = await page.evaluate(() => {
    const i = document.getElementById('input');
    return { h: i.offsetHeight, resize: getComputedStyle(i).resize };
  });
  expect(h).toBeGreaterThanOrEqual(60);   // ~3 lines, not a single 1-line box
  expect(resize).toBe('vertical');         // owner can drag the grip taller
});

test('composer auto-grows as content is added', async () => {
  const before = await page.evaluate(() => document.getElementById('input').offsetHeight);
  const after = await page.evaluate(() => {
    const i = document.getElementById('input');
    i.value = Array.from({ length: 12 }, (_, n) => 'line ' + n).join('\n');
    i.dispatchEvent(new Event('input', { bubbles: true }));
    return i.offsetHeight;
  });
  expect(after).toBeGreaterThan(before);
  // reset for a clean state
  await page.evaluate(() => {
    const i = document.getElementById('input');
    i.value = '';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
});

test('a set composer height is remembered across a reload', async () => {
  await page.evaluate(() => localStorage.setItem('pcc.composer.height', '320'));
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await expect(page.locator('#input')).toBeVisible();
  const h = await page.evaluate(() => document.getElementById('input').offsetHeight);
  expect(h).toBeGreaterThanOrEqual(300);
});
