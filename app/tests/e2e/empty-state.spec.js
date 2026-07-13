// Packaged first-run empty state (slice 1b). A packaged install has no HOME project, so the app must
// open to a "create or open your first project" surface instead of a broken active project or a chat
// pane that throws. app.isPackaged is false under Playwright, so PCC_FORCE_NO_HOME simulates the
// packaged "no home" path on a dev checkout — same code path (HOME_DIR null), real regression cover.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

async function withNoHome(fn) {
  const { app, page } = await launchApp({ PCC_FORCE_NO_HOME: '1' });
  try { await fn(page); } finally { await closeApp(app); }
}

test('with no home project, the app shows the "create or open" empty state, not a broken project', async () => {
  await withNoHome(async (page) => {
    const overlay = page.locator('#no-project');
    await expect(overlay).toBeVisible({ timeout: 15000 });
    await expect(overlay).toContainText('Welcome to PCC');
    await expect(page.locator('#np-new')).toBeVisible();   // create new project
    await expect(page.locator('#np-open')).toBeVisible();  // open existing folder
  });
});

test('the empty state loads without a blocking error (no chat/trust throw on a null project)', async () => {
  // The chat + trust load handlers used to throw on a null project; boot() must skip them in the empty
  // state. We assert no uncaught error surfaced and the empty state is the only thing shown.
  await withNoHome(async (page) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await expect(page.locator('#no-project')).toBeVisible({ timeout: 15000 });
    // The chat error banner (showChatLoadError) must NOT be the surface the user lands on.
    const chatError = await page.evaluate(() => {
      const b = document.body.innerText || '';
      return /could not (load|read).*chat/i.test(b);
    }).catch(() => false);
    expect(chatError).toBe(false);
    expect(errors).toEqual([]);
  });
});

test('with a real project (dev default), the empty state is NOT shown', async () => {
  // Regression guard the other way: the normal dev app (HOME_DIR = repo root, a valid project) must
  // boot straight into the cockpit, never the empty state.
  const { app, page } = await launchApp();
  try {
    // Give boot() its async project resolution, then confirm the overlay stayed hidden.
    await page.waitForTimeout(1500);
    const shown = await page.evaluate(() => {
      const el = document.getElementById('no-project');
      return !!(el && el.classList.contains('show'));
    });
    expect(shown).toBe(false);
  } finally { await closeApp(app); }
});
