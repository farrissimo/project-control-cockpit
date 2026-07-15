// End-to-end: drive the REAL app and exercise every button / interactive
// control the owner can click. The worker (claude) and verifier (codex) are
// faked on PATH, so Send and Verify return deterministic canned output; the
// local PowerShell detectors run for real. One app instance is shared across
// the file (fresh throwaway user-data dir), so state accrues in reading order.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  try { await app.context().grantPermissions(['clipboard-read', 'clipboard-write']); } catch (e) { /* best effort */ }
});
test.afterAll(async () => { await closeApp(app); });

// #send stays enabled during a turn now (steering: mid-turn messages queue, IDEA-017), but
// wait for idle before each test so these single-shot button flows start from a clean state.
test.beforeEach(async () => {
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
});

// --- sidebar navigation: every view opens and renders without an error state ---
test('nav: all seven views open and render content', async () => {
  const views = ['project', 'rules', 'memory', 'lifecycle', 'signals', 'verify', 'chat'];
  for (const v of views) {
    await page.locator('.nav[data-view="' + v + '"]').click();
    const container = page.locator('#view-' + v);
    await expect(container).toBeVisible();
    // The nav button becomes active.
    await expect(page.locator('.nav[data-view="' + v + '"]')).toHaveClass(/active/);
  }
});

// --- chat: Send routes a message through the (faked) worker and renders a reply ---
test('chat: Send produces a user bubble and a worker reply', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  await page.locator('#input').fill('hello from the test');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.user').last()).toHaveText(/hello from the test/);
  await expect(page.locator('.bubble.assistant').last()).toContainText('FAKE-CLAUDE-REPLY', { timeout: 15000 });
});

// --- correction quick-buttons: clicking one sends its canned instruction ---
test('corrections: a quick-button sends and gets a reply', async () => {
  const before = await page.locator('.bubble.user').count();
  await page.locator('.corr', { hasText: 'Be concise' }).first().click();
  await expect(page.locator('.bubble.user')).toHaveCount(before + 1);
  await expect(page.locator('.bubble.user').last()).toHaveText(/Be concise/);
});

// --- copy block: worker fenced output renders a working Copy button ---
test('copy block: renders and the Copy button reports success', async () => {
  await page.locator('.corr', { hasText: 'Copy block' }).first().click();
  const copyBtn = page.locator('.cb-copy').last();
  await expect(copyBtn).toBeVisible({ timeout: 15000 });
  await copyBtn.click();
  // Handler flips the label to "Copied" on success (or "Copy failed" if the OS
  // clipboard is blocked) — either proves the click handler actually ran.
  await expect(copyBtn).toHaveText(/Copied|Copy failed/);
});

// --- capture decisions: grounded in this chat's transcript, sends a scan ---
test('capture decisions: button sends a transcript scan', async () => {
  const before = await page.locator('.bubble.user').count();
  await page.locator('.corr', { hasText: 'Capture decisions' }).first().click();
  await expect(page.locator('.bubble.user')).toHaveCount(before + 1);
  await expect(page.locator('.bubble.user').last()).toContainText('Capture decisions');
});

// --- chats panel: toggles open, lists chats, closes ---
test('chats panel: toggle open and closed', async () => {
  const panel = page.locator('#chats-panel');
  await page.locator('#chats-btn').click();
  await expect(panel).not.toHaveClass(/hidden/);
  await expect(page.locator('.chat-row')).not.toHaveCount(0);
  await page.locator('#chats-btn').click();
  await expect(panel).toHaveClass(/hidden/);
});

// --- new chat: resets to the welcome screen ---
test('new chat: returns to the welcome screen', async () => {
  await page.locator('#new-chat').click();
  await expect(page.locator('.welcome')).toBeVisible();
});

// --- model switcher: populated from the config ---
test('model switcher: has at least one option', async () => {
  await expect(page.locator('#model-select option')).not.toHaveCount(0);
});

// --- signals view: refresh renders detector cards (real detectors) ---
test('signals: refresh renders detector cards', async () => {
  await page.locator('.nav[data-view="signals"]').click();
  await page.locator('#signals-refresh').click();
  await expect(page.locator('.signal-card').first()).toBeVisible({ timeout: 30000 });
  // The app-side chat + sycophancy signals always exist, so >= 2 cards.
  expect(await page.locator('.signal-card').count()).toBeGreaterThanOrEqual(2);
  // The governor "Change stakes" card surfaces live at the top (ADR-0006 Surface slice).
  // .first(): a back-to-back nav+refresh in this test can render two batches; real usage
  // has seconds between them. We only need the governor card to be present.
  await expect(page.locator('.signal-card', { hasText: 'Change stakes (governor)' }).first()).toBeVisible();
});

// --- project view: handoff generation (real deterministic script) ---
test('project: Generate handoff produces output', async () => {
  await page.locator('.nav[data-view="project"]').click();
  await page.locator('#handoff-gen').click();
  const out = page.locator('#handoff-out');
  await expect(out).toBeVisible({ timeout: 30000 });
  await expect(out).not.toHaveText('(no output)');
});

// --- memory view: save writes and reports success ---
test('memory: Save reports success', async () => {
  await page.locator('.nav[data-view="memory"]').click();
  const original = await page.locator('#memory-text').inputValue();
  await page.locator('#memory-save').click();
  await expect(page.locator('#memory-status')).toHaveText(/Saved\./, { timeout: 15000 });
  // Leave PROJECT.md byte-for-byte as we found it (save rewrites the file).
  expect(await page.locator('#memory-text').inputValue()).toBe(original);
});

// --- verify view: Run drives the (faked) verifier to a PASS verdict ---
test('verify: Run returns a verdict from the faked verifier', async () => {
  await page.locator('.nav[data-view="verify"]').click();
  await page.locator('#verify-run').click();
  await expect(page.locator('#verify-result')).toContainText('PASS', { timeout: 40000 });
});

// --- lifecycle top-bar shortcut navigates to the Lifecycle view ---
test('top bar: lifecycle shortcut opens the Lifecycle view', async () => {
  await page.locator('.nav[data-view="chat"]').click();
  await page.locator('#lifecycle').click();
  await expect(page.locator('#view-lifecycle')).toBeVisible();
});
