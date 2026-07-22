const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth.json');
const FX_WITH_SUMMARY = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth-with-summary.json');

// The handoff is assembled from real repo truth (scripts/generate-handoff.ps1), so these markers
// are always present in a successful handoff and prove the CARRIED CONTEXT actually landed in the
// composer — not an empty room.
const HANDOFF_MARKER = /You are picking up[\s\S]*ORIENT FROM REPO TRUTH FIRST[\s\S]*CURRENT STATE/;

test('continue in fresh chat carries the handoff into the composer, even before the chat is heavy', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#continue-fresh-chat')).toHaveClass(/clear/);

    await page.locator('#continue-fresh-chat').click();
    // A new chat opens...
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    // ...and it opens WITH the carried context visible in the composer, ready to edit. Nothing sent.
    await expect(page.locator('#input')).toHaveValue(HANDOFF_MARKER, { timeout: 20000 });
    await expect(page.locator('#input')).toHaveValue(/Carried context from your previous chat/);
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0);
    // No auto-send: no worker turn ran (no assistant bubble produced by this action).
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(0);
  } finally {
    await closeApp(app);
  }
});

test('chat-health warning offers an owner-controlled fresh chat that carries context, without auto-send', async () => {
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
    const bubblesBefore = await page.locator('.bubble.assistant:not(.thinking)').count();

    await action.click();
    // New chat opens with the handoff carried into the composer.
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    await expect(page.locator('#input')).toHaveValue(HANDOFF_MARKER, { timeout: 20000 });

    // Old chat is intact and reachable, and NOTHING was auto-sent (no new worker turn).
    await page.locator('#chats-btn').click();
    await expect(page.locator('.chat-row', { hasText: 'Continued chat' })).toBeVisible();
    await expect(page.locator('.chat-row')).toHaveCount(2);
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' })).toHaveCount(0);
    expect(bubblesBefore).toBe(2); // guard: the source chat still had exactly its two worker replies before the click
  } finally {
    await closeApp(app);
  }
});

test('continue in fresh chat appends the cached summary on top of the handoff', async () => {
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
    // The composer carries BOTH: the required handoff AND the cached summary appended under it.
    await expect(page.locator('#input')).toHaveValue(HANDOFF_MARKER, { timeout: 20000 });
    await expect(page.locator('#input')).toHaveValue(/Conversation summary[\s\S]*Token Growth Plan[\s\S]*Use a manual fresh-chat action/, { timeout: 20000 });
  } finally {
    await closeApp(app);
  }
});

test('if the handoff cannot be built, PCC holds in the source chat and never opens an empty continued chat', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_HANDOFF_FAIL: '1' });
  try {
    const action = page.locator('#continue-fresh-chat');
    await expect(action).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');

    await action.click();
    // The hold notice appears IN the current chat, and no second chat is created.
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'staying in THIS chat rather than opening an empty one' })).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');
    // No "Continued chat" was created, and the composer was not seeded.
    await page.locator('#chats-btn').click();
    await expect(page.locator('.chat-row', { hasText: 'Continued chat' })).toHaveCount(0);
    await expect(page.locator('#input')).not.toHaveValue(/You are picking up/);
  } finally {
    await closeApp(app);
  }
});
