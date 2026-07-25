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

// activeChat is a real page global (renderer.js), reached inside page.evaluate.
/* global activeChat:readonly */

// ADR-0021 (Task 1.1): build authority does not carry silently, but a build-enabled source offers a
// one-click IN-FLOW re-approval into the continued chat — so it is never a hidden "re-enable build"
// memory task, and the read-only default is never silently escalated.
test('continuing a BUILD-ENABLED chat offers a one-click re-approval bound to the new chat (ADR-0021)', async () => {
  const { app, page } = await launchApp();
  try {
    // Wait until the app is ready (active chat initialized) BEFORE touching authority — otherwise
    // activeChat() is still falsy and the request binds to a throwaway id.
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });
    const srcId = await page.evaluate(() => activeChat() && activeChat().id);
    expect(typeof srcId).toBe('string');
    // Enable build on the ACTIVE chat via the owner-driven request+approve seam (not chat text).
    const req = await page.evaluate((cid) => window.pcc.requestJob('new_project', 'DemoBuild', cid), srcId);
    expect(req.chatId).toBe(srcId); // request is bound to the active chat, not a fresh id
    await page.evaluate(() => window.pcc.approveJob());
    expect((await page.evaluate((cid) => window.pcc.authorityState(cid), srcId)).mode).toBe('authorized_running');

    await page.locator('#continue-fresh-chat').click();

    // The continued chat opens AND an in-flow re-approval modal appears (visible, not a memory task).
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    await expect(page.locator('[data-testid="confirm-overlay"]')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('.pcc-modal-msg')).toContainText('Continue the build session');

    // One explicit click keeps building — bound to the NEW chat.id, not the old one.
    await page.locator('[data-testid="confirm-approve"]').click();
    const newId = await page.evaluate(() => activeChat() && activeChat().id);
    expect(newId).not.toBe(srcId);
    expect((await page.evaluate((cid) => window.pcc.authorityState(cid), newId)).mode).toBe('authorized_running');
  } finally {
    await closeApp(app);
  }
});

test('continuing a READ-ONLY chat carries NO build authority and shows no approval modal (no silent inheritance)', async () => {
  const { app, page } = await launchApp();
  try {
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });
    const srcId = await page.evaluate(() => activeChat() && activeChat().id);
    expect(typeof srcId).toBe('string');
    expect((await page.evaluate((cid) => window.pcc.authorityState(cid), srcId)).mode).toBe('read_only');

    await page.locator('#continue-fresh-chat').click();
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });

    // No approval modal — a read-only source never carries authority — and the new chat stays read-only.
    await expect(page.locator('[data-testid="confirm-overlay"]')).toHaveCount(0);
    const newId = await page.evaluate(() => activeChat() && activeChat().id);
    expect((await page.evaluate((cid) => window.pcc.authorityState(cid), newId)).mode).toBe('read_only');
  } finally {
    await closeApp(app);
  }
});
