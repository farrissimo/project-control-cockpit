// ADR-0020 T1 (owner decision 2026-07-23): rollover is OWNER-TRIGGERED. The meter WARNS and the
// "Continue in fresh chat" button makes the switch one click, but PCC never switches chats by itself —
// the 2026-07-21 survival-trial "no auto-switch" stance holds. (The automatic path is built and loop-safe
// behind AUTO_ROLLOVER_ENABLED; post-T1 Gate 0 decides whether to flip it.)
// Two properties this pins:
//   (1) growth that CROSSES the rollover threshold WARNS but does NOT switch — no surprise switch, ever;
//   (2) taking the offered switch carries the recent conversation forward VERBATIM + the handoff, built
//       LOCALLY and DETERMINISTICALLY (no LLM summary is generated), and sends nothing until Send.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX_CROSS = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-rollover.json'); // +400K growth, well over the threshold

// Real marker from the deterministic handoff (scripts/generate-handoff.ps1) — proves the project briefing landed.
const HANDOFF_MARKER = /You are picking up[\s\S]*CURRENT STATE/;

// Drive the chat past the rollover threshold: turn 1 sets the baseline (~100K), turn 2 reads ~500K
// => +400K growth, over the threshold. Returns once both worker replies have landed.
async function growPastThreshold(page) {
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  await page.locator('#input').fill('turn one — baseline');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });
  await page.locator('#input').fill('turn two — this crosses the rollover threshold');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });
}

test('growth that CROSSES the rollover threshold warns and OFFERS the switch, but never switches by itself', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-cross-warn-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX_CROSS, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');
    await growPastThreshold(page);

    await page.waitForTimeout(3000); // give any (not-expected) automatic rollover a real chance to fire

    // THE guarantee: still exactly one chat, and no auto-rollover notice was ever posted.
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' })).toHaveCount(0);

    // The switch is OFFERED, one click away, and the meter says so honestly (no stale "will automatically
    // continue" claim now that the owner drives it).
    await expect(page.locator('#continue-fresh-chat')).toBeVisible({ timeout: 20000 });
    await page.locator('.nav[data-view="signals"]').click();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('PCC will NOT switch chats on you');
    await expect(card).not.toContainText('automatically continue it in a fresh chat');
  } finally {
    await closeApp(app);
  }
});

test('taking the offered switch carries the recent conversation forward verbatim + the handoff, with no summary generated', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-cross-carry-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX_CROSS, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await growPastThreshold(page);

    const action = page.locator('#continue-fresh-chat');
    await expect(action).toBeVisible({ timeout: 20000 });
    await action.click();

    // A fresh chat opens, with the carried context VISIBLE in the composer (not a hidden seed).
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)', { timeout: 20000 });
    const input = page.locator('#input');
    await expect(input).toHaveValue(HANDOFF_MARKER, { timeout: 20000 });
    // The CONVERSATION carries forward verbatim — this is what the handoff alone never carried.
    await expect(input).toHaveValue(/Recent conversation \(verbatim, most recent last\)/);
    await expect(input).toHaveValue(/You: turn two — this crosses the rollover threshold/);
    await expect(input).toHaveValue(/Claude: ROLLOVER-GROWN/);

    // Nothing was sent, and no LLM summary was generated to build any of it (deterministic, local).
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0);
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(0);
    await expect(input).not.toHaveValue(/Conversation summary/);

    // The old chat is intact and reachable — nothing was deleted.
    await page.locator('#chats-btn').click();
    await expect(page.locator('.chat-row')).toHaveCount(2);
    await expect(page.locator('.chat-row', { hasText: 'Continued chat' })).toBeVisible();
  } finally {
    await closeApp(app);
  }
});
