// External-tool preflight banner. PCC drives pwsh/git/claude/codex, which it does NOT bundle; a packaged
// install on a machine missing one should say so up front, not fail silently. In tests the fakebin puts
// claude/codex on PATH (and pwsh/git are real), so nothing is missing and the banner stays hidden — which
// is why existing e2e tests are unaffected. PCC_FAKE_MISSING_TOOLS forces the missing case.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('a missing external tool is surfaced up front in the preflight banner', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_MISSING_TOOLS: 'claude,codex' });
  try {
    const bar = page.locator('#tool-warning');
    await expect(bar).toBeVisible({ timeout: 15000 });
    await expect(bar).toContainText('Claude Code');   // the worker
    await expect(bar).toContainText('Codex CLI');      // the verifier
    await expect(bar).toContainText('not on your PATH');
  } finally { await closeApp(app); }
});

test('only the actually-missing tools are named (git present is not warned about)', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_MISSING_TOOLS: 'codex' });
  try {
    const bar = page.locator('#tool-warning');
    await expect(bar).toBeVisible({ timeout: 15000 });
    await expect(bar).toContainText('Codex CLI');
    // git is real (present), so it must NOT appear in the warning.
    await expect(bar).not.toContainText('Git (git)');
  } finally { await closeApp(app); }
});

test('with every tool present, the preflight banner stays hidden', async () => {
  // Default launch: fakebin provides claude/codex, pwsh + git are real -> nothing missing -> no banner.
  // (This is also why the banner never disrupts the rest of the e2e suite.)
  const { app, page } = await launchApp();
  try {
    await page.waitForTimeout(1200); // let boot()'s async preflight run
    const shown = await page.evaluate(() => {
      const el = document.getElementById('tool-warning');
      return !!(el && el.classList.contains('show'));
    });
    expect(shown).toBe(false);
  } finally { await closeApp(app); }
});
