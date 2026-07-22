// ADR-0019 (survival-trial rule, 2026-07-21): during the ADR-0016 trust proving window, PCC must NOT
// take control — no automatic chat switching that could surprise the owner. Forced auto-rollover is
// held OFF (AUTO_ROLLOVER_ENABLED = false). This test proves the SAFETY property that matters this
// week: a turn that grows the conversation PAST the warning threshold must NOT switch to a new chat —
// it stays put, nothing is deleted, and the meter warns instead. (When an owner-controlled one-click
// "continue in a fresh chat with handoff" flow is approved, a separate test will cover that path.)
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth.json');

test('growth past the warning threshold does NOT auto-switch chats (no surprise) — it stays put and warns', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-rollover-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)'); // one chat to start

    // Turn 1: the ~252K fixed baseline. Must NOT switch (this is exactly what used to loop).
    await page.locator('#input').fill('first message — arrives with the big fixed startup overhead');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)');

    // Turn 2: adds ~160K of real conversation, PAST the warning threshold. PCC must still NOT switch.
    await page.locator('#input').fill('second message — the conversation genuinely grows past the limit');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });

    // Give any (forbidden) automatic rollover a chance to fire, then assert it did NOT.
    await page.waitForTimeout(3000);
    await expect(page.locator('#chats-btn')).toContainText('Chats (1)'); // STILL one chat — no surprise switch
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'automatically continued it here in a fresh chat' }))
      .toHaveCount(0);

    // The meter warns instead: the Chat health signal is in its 'notice' state.
    await page.locator('.nav[data-view="signals"]').click();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('WARNING only', { timeout: 20000 });
    await expect(card).toContainText('will NOT switch chats on you');
  } finally {
    await closeApp(app);
  }
});
