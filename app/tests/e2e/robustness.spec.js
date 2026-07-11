// Beyond "the button clicks": these assert real outcomes — state that persists
// across a reload, and the busy guard that prevents double-submit. Uses a
// deliberately slow fake worker so the in-flight state is observable.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('rename persists across an app reload', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    // Ensure the panel is open, then rename the first chat via the in-app modal.
    const panel = page.locator('#chats-panel');
    if (await panel.evaluate((el) => el.classList.contains('hidden'))) await page.locator('#chats-btn').click();
    await expect(panel).not.toHaveClass(/hidden/);
    await page.locator('.chat-mini[data-act="rename"]').first().click();
    await page.locator('[data-testid="prompt-input"]').fill('Persisted Name');
    await page.locator('[data-testid="prompt-ok"]').click();
    await expect(page.locator('.chat-name').first()).toHaveText('Persisted Name');

    // Reload the window — localStorage should survive.
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await page.locator('#chats-btn').click();
    await expect(page.locator('.chat-name', { hasText: 'Persisted Name' })).toHaveCount(1, { timeout: 10000 });
  } finally {
    await closeApp(app);
  }
});

test('steering: composer stays usable mid-turn; a second message queues and both send in order', async () => {
  // 1.2s fake reply so the in-flight window is comfortably observable.
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '1200' });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('first message');
    await page.locator('#send').click();
    // Steering (IDEA-017): the composer does NOT lock while a turn is in flight.
    await expect(page.locator('#send')).toBeEnabled();
    const usersInFlight = await page.locator('.bubble.user').count();
    // Send a second message while the first turn is running — it is QUEUED and shown, NOT dropped.
    await page.locator('#input').fill('second message');
    await page.locator('#input').press('Enter');
    expect(await page.locator('.bubble.user').count()).toBe(usersInFlight + 1);
    // Both turns complete in order → two real assistant replies.
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });
  } finally {
    await closeApp(app);
  }
});

// I4: the live trust strip is a boot/action snapshot. A worker turn can commit/push/
// edit the repo, so it must be refreshed when a turn completes — otherwise the chips
// show a stale snapshot as current. We plant a sentinel in the Verified chip (nothing
// else re-renders it during a turn) and prove the post-turn refresh replaces it.
test('the trust strip refreshes after a worker turn completes (no stale snapshot)', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('#trust-verified')).toBeVisible();
    await page.evaluate(() => { document.getElementById('trust-verified').innerHTML = 'STALE-SENTINEL'; });
    await expect(page.locator('#trust-verified')).toHaveText('STALE-SENTINEL');
    await page.locator('#input').fill('do a turn');
    await page.locator('#send').click();
    await page.waitForSelector('.bubble.assistant:not(.thinking)', { timeout: 20000 });
    // The completed turn triggered a trust refresh, which re-rendered the chip. Give it
    // real headroom: loadTrust awaits detections (a PowerShell spawn) + trustExtras (git)
    // before it re-renders, which can take several seconds on a loaded machine.
    await expect(page.locator('#trust-verified')).not.toHaveText('STALE-SENTINEL', { timeout: 25000 });
  } finally {
    await closeApp(app);
  }
});
