// ADR-0019 Slice C (growth revision, 2026-07-21): the AUTOMATIC protection, now driven by conversation
// GROWTH. Turn 1 arrives with a ~252K fixed baseline and must NOT roll over (a fresh chat has grown ~0).
// Turn 2 adds ~160K of real conversation — past the conservative 150K growth threshold — and MUST
// auto-roll into a NEW chat, carry a handoff forward, keep the old chat, and delete nothing. This is
// the direct fix for the 2026-07-21 loop: because the trigger is growth past each chat's OWN baseline
// (never the fixed overhead), a fresh/rolled-over chat starts at ~0% and the turn-one loop is impossible.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth.json');

test('growth past the threshold auto-rolls into a NEW chat (turn-one baseline does NOT), keeps the old one, carries a handoff', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-rollover-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)'); // one chat to start

    // Turn 1: the ~252K fixed baseline. This is exactly what used to loop — it must NOT roll over.
    await page.locator('#input').fill('first message — arrives with the big fixed startup overhead');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)'); // still one chat — no false rollover
    await expect(page.locator('.bubble.assistant').last())
      .not.toContainText('automatically continued it here in a fresh chat');

    // Turn 2: adds ~160K of real conversation, past the 150K growth threshold -> auto-rollover.
    await page.locator('#input').fill('second message — the conversation genuinely grows past the limit');
    await page.locator('#send').click();

    // After the turn settles, PCC auto-rolls over: the fresh chat shows the plain rollover notice.
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' }))
      .toBeVisible({ timeout: 25000 });
    await expect(page.locator('.bubble.assistant').last()).not.toHaveClass(/error/); // protection, not a bug

    // The OLD chat is preserved (nothing deleted) — there are now two chats.
    await expect(page.locator('#chats-btn')).toContainText('Chats (2)');
  } finally {
    await closeApp(app);
  }
});
