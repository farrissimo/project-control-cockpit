// Beyond "the button clicks": these assert real outcomes — state that persists
// across a reload, and the busy guard that prevents double-submit. Uses a
// deliberately slow fake worker so the in-flight state is observable.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

test('rename persists across an app reload', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 });
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

test('busy guard: Send disables mid-turn and a second submit is ignored', async () => {
  // 1.2s fake reply so the in-flight window is comfortably observable.
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '1200' });
  try {
    await expect(page.locator('#send')).toBeEnabled({ timeout: 20000 });
    await page.locator('#input').fill('first message');
    await page.locator('#send').click();
    // Immediately in-flight: button disabled.
    await expect(page.locator('#send')).toBeDisabled();
    const usersInFlight = await page.locator('.bubble.user').count();
    // Try to submit again while busy (Enter) — must be ignored.
    await page.locator('#input').fill('second message');
    await page.locator('#input').press('Enter');
    expect(await page.locator('.bubble.user').count()).toBe(usersInFlight);
    // Turn completes: re-enabled, exactly one reply.
    await expect(page.locator('#send')).toBeEnabled({ timeout: 15000 });
    await expect(page.locator('.bubble.assistant').last()).toContainText('FAKE-CLAUDE-REPLY');
  } finally {
    await closeApp(app);
  }
});
