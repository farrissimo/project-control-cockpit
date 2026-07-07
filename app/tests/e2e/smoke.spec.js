// Smoke test: proves Playwright can launch the real PCC Electron app, the
// window loads, and the shell renders. If this fails, nothing else can run.
const { test, expect } = require('@playwright/test');
const { launchApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await app.close(); });

test('app window opens and shows the chat composer', async () => {
  await expect(page.locator('#composer')).toBeVisible();
  await expect(page.locator('#input')).toBeVisible();
  await expect(page.locator('#send')).toBeVisible();
});

test('sidebar nav has all seven views', async () => {
  const views = ['chat', 'project', 'rules', 'memory', 'lifecycle', 'signals', 'verify'];
  for (const v of views) {
    await expect(page.locator('.nav[data-view="' + v + '"]')).toHaveCount(1);
  }
});
