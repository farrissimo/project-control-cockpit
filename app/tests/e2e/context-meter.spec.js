// ADR-0019 (growth revision, 2026-07-21): the chat-health meter must measure conversation GROWTH
// past each chat's fixed first-turn baseline (the large per-turn overhead Claude Code re-sends every
// turn: system prompt + tool defs + CLAUDE.md/AGENTS.md), NOT the raw total. This reproduces the real
// pattern that caused the loop: turn 1 arrives already ~252K (huge fixed baseline) — the meter must
// stay CALM (near 0), not slam to 100%. A later turn that adds 75K of real conversation must move the
// gauge to ~50% of the way to rollover. Uses a two-turn sequence fixture (baseline, then +75K growth).
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth-small.json');

test('the chat-health gauge measures conversation GROWTH past a fixed baseline, not the constant per-turn overhead', async () => {
  const seqState = path.join(os.tmpdir(), 'pcc-seq-meter-' + Date.now() + '.txt');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqState });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });

    // Turn 1: the very first reply already carries a ~252K fixed baseline (the exact shape that used
    // to loop). The meter must NOT read full — a fresh chat has grown ~0 so far.
    await page.locator('#input').fill('first message — arrives with the big fixed startup overhead');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });

    await page.locator('.nav[data-view="signals"]').click();
    const card = page.locator('.signal-card').filter({ hasText: 'Chat health' });
    await expect(card).toBeVisible({ timeout: 20000 });
    // Calm on turn one despite the 252K baseline: growth ~0, driven by message count, NOT 100%.
    await expect(card).toContainText('grown ~0K tokens past its ~252K startup baseline', { timeout: 20000 });
    await expect(card.locator('.gauge-val')).not.toContainText('100%');
    await expect(card).not.toContainText('not yet measured');

    // Turn 2: adds ~75K of real conversation. Growth = 75K of the 150K rollover threshold => ~50%.
    await page.locator('.nav[data-view="chat"]').click();
    await page.locator('#input').fill('second message — the conversation actually grows now');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2, { timeout: 20000 });

    // Back to the signals view, then recompute (loadSignals only auto-runs on first view). Refresh
    // tears the card down and rebuilds it asynchronously (detections reload), so wait for the rebuilt
    // card and give the content assertions headroom under load.
    await page.locator('.nav[data-view="signals"]').click();
    await page.locator('#signals-refresh').click();
    await expect(card).toBeVisible({ timeout: 20000 });
    await expect(card).toContainText('grown ~75K tokens past its ~252K startup baseline', { timeout: 20000 });
    await expect(card.locator('.gauge-val')).toContainText('50%', { timeout: 20000 });
  } finally {
    await closeApp(app);
  }
});
