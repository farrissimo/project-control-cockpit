const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth.json');
const FX_WITH_SUMMARY = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth-with-summary.json');

test('chat-health warning offers an owner-controlled fresh chat without automatic context injection', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-continue-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

    await page.locator('#input').fill('first message — baseline');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });

    await page.locator('#input').fill('second message — cross the warning threshold');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });

    const action = page.locator('#continue-fresh-chat');
    await expect(action).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');

    await action.click();
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    await expect(page.locator('.welcome')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'No saved summary was available' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#input')).toHaveValue('');

    await page.locator('#chats-btn').click();
    await expect(page.locator('.chat-row', { hasText: 'Continued chat' })).toBeVisible();
    await expect(page.locator('.chat-row')).toHaveCount(2);
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' })).toHaveCount(0);
  } finally {
    await closeApp(app);
  }
});

test('continue in fresh chat pre-fills visible summary text when a summary is already cached', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-continue-summary-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX_WITH_SUMMARY, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await page.locator('#input').fill('first message — baseline');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });

    await page.locator('#input').fill('second message — cross the warning threshold');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });

    await page.locator('#chats-btn').click();
    await page.locator('.chat-row.active [data-act="summary"]').click();
    await expect(page.locator('#summary-body')).toContainText('Use a manual fresh-chat action', { timeout: 20000 });
    await page.locator('#summary-close').click();

    await page.locator('#continue-fresh-chat').click();
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    await expect(page.locator('#input')).toHaveValue(/Continue from this summary[\s\S]*Token Growth Plan[\s\S]*Use a manual fresh-chat action/, { timeout: 20000 });
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'No saved summary was available' })).toHaveCount(0);
  } finally {
    await closeApp(app);
  }
});
