// External-tool preflight banner. PCC drives pwsh/git/claude/codex, which it does NOT bundle; a packaged
// install on a machine missing one should say so up front, not fail silently. In tests the fakebin puts
// claude/codex on PATH (and pwsh/git are real), so nothing is missing and the banner stays hidden — which
// is why existing e2e tests are unaffected. PCC_FAKE_MISSING_TOOLS forces the missing case.
const path = require('path');
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

// The three tests above force the "missing" verdict with PCC_FAKE_MISSING_TOOLS, which
// short-circuits present() in main.js BEFORE the real `where` lookup runs — so they prove the
// banner RENDERS a missing verdict, not that detectTools() actually DETECTS a genuinely-absent
// tool. This test closes that gap: it launches with a genuinely tool-less PATH (only the Windows
// system dirs, so `where.exe` and Electron still resolve, but pwsh/git/claude/codex do NOT) and
// sets NO fake seam. The banner can only appear if the real `where`-based detection correctly
// returns status != 0 for every missing tool. This is the packaged-on-a-bare-machine case proven
// in software instead of on a physical clean box.
test('real where-detection: a genuinely absent tool fires the banner (no fake seam)', async () => {
  const winDir = process.env.SystemRoot || 'C:\\Windows';
  const rawPath = [path.join(winDir, 'System32'), winDir].join(';'); // where.exe lives in System32
  const { app, page } = await launchApp({}, { rawPath });
  try {
    const bar = page.locator('#tool-warning');
    await expect(bar).toBeVisible({ timeout: 15000 });
    await expect(bar).toContainText('not on your PATH');
    // With NO tool on PATH, real detection must name all four.
    await expect(bar).toContainText('PowerShell 7');
    await expect(bar).toContainText('Git (git)');
    await expect(bar).toContainText('Claude Code');
    await expect(bar).toContainText('Codex CLI');
    // And the underlying IPC verdict — from the real `where` path — must agree.
    const status = await page.evaluate(() => window.pcc.toolStatus());
    expect(status.present).toEqual({ pwsh: false, git: false, claude: false, codex: false });
    expect(status.missing.map((m) => m.tool).sort()).toEqual(['claude', 'codex', 'git', 'pwsh']);
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
