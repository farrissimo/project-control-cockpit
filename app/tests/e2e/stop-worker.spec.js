// R2 (desktop-parity, ADR-0013): a real Stop control for a running chat turn — the direct fix
// for "PCC just sits on 'Claude is working…' and I can't stop it short of closing the app"
// (2026-07-20 incident). Uses a deliberately slow fake worker (PCC_FAKE_DELAY_MS) so the
// in-flight window is comfortably observable and Stop's effect is provable, not assumed.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('Stop is always visible (dim when idle), enables while a turn runs, and ends it — a plain "Stopped" bubble, not a raw error', async () => {
  // 8s fake reply: a wide margin so the "stopped before it would have finished" check is robust
  // even on a heavily loaded box (killWorker's taskkill /T can itself take a second or two).
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '8000' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('#stop')).toBeVisible();  // always present so it's discoverable
    await expect(page.locator('#stop')).toBeDisabled(); // ...but dim/disabled when no turn is running
    const started = Date.now();
    await page.locator('#input').fill('a message that will be stopped');
    await page.locator('#send').click();
    await expect(page.locator('#stop')).toBeEnabled({ timeout: 5000 });
    await page.locator('#stop').click();
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 10000 });
    // Resolved well before the fake worker's own 8s delay would have finished on its own —
    // proves the turn was actually killed, not merely waited out. Wide margin for a loaded box.
    expect(Date.now() - started).toBeLessThan(6000);
    await expect(page.locator('.bubble.assistant').last()).toContainText('Stopped');
    await expect(page.locator('.bubble.assistant').last()).not.toHaveClass(/error/);
    await expect(page.locator('#stop')).toBeDisabled(); // disabled again once the turn is done (still visible)
  } finally {
    await closeApp(app);
  }
});

test('after a stop, the chat still accepts a new message (not permanently stuck)', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '3000' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('will be stopped');
    await page.locator('#send').click();
    await expect(page.locator('#stop')).toBeEnabled({ timeout: 5000 });
    await page.locator('#stop').click();
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('#send')).toBeEnabled();
    await page.locator('#input').fill('a follow-up after the stop');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });
  } finally {
    await closeApp(app);
  }
});

test('stopWorker requires an EXACT chatId match — a missing/undefined/wrong id never stops the wrong (or any unnamed) turn (Codex-caught)', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '3000' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a real running turn');
    await page.locator('#send').click();
    await expect(page.locator('#stop')).toBeEnabled({ timeout: 5000 });
    // No chatId, and a wrong chatId, must both be rejected — the earlier `chatId && ...` form
    // silently let a missing id stop whatever was running; this proves that path is closed.
    const noId = await page.evaluate(() => window.pcc.stopWorker(undefined));
    expect(noId).toEqual({ ok: true, stopped: false, reason: 'chat_mismatch' });
    const wrongId = await page.evaluate(() => window.pcc.stopWorker('definitely-not-the-running-chat'));
    expect(wrongId).toEqual({ ok: true, stopped: false, reason: 'chat_mismatch' });
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(1); // still running, untouched
    // The UI's own Stop button (which always supplies the correct id) still works.
    await page.locator('#stop').click();
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.bubble.assistant').last()).toContainText('Stopped');
  } finally {
    await closeApp(app);
  }
});

test('clicking Stop with no turn running is a safe no-op (pcc:stopWorker)', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    const r = await page.evaluate(() => window.pcc.stopWorker('no-such-chat-id'));
    expect(r.ok).toBe(true);
    expect(r.stopped).toBe(false);
    expect(r.reason).toBe('no_active_turn');
  } finally {
    await closeApp(app);
  }
});
