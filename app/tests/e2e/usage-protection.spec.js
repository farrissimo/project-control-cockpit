// ADR-0020 T4: automatic usage protection from the REAL 5-hour usage %. Drives the fresh reading via
// the PCC_FAKE_USAGE test seam (main.js pcc:usage) so the >=90% HOLD, the one-message override, and the
// fail-honest (stale never holds) paths are deterministic — no real desktop-app cache, zero plan usage.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-usage-growth.json');
const FRESH_95 = JSON.stringify({ ok: true, available: true, stale: false, sessionPercent: 95, weeklyPercent: 20, ageMs: 1000 });
const STALE_95 = JSON.stringify({ ok: true, available: true, stale: true, sessionPercent: 95, weeklyPercent: 20, ageMs: 3600000 });
const seqFile = (tag) => path.join(os.tmpdir(), 'pcc-seq-usageprot-' + tag + '-' + Date.now() + '.txt');

test('fresh 5-hour usage >=90% HOLDS the next send behind a 3-action gate — the worker never runs', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_USAGE: FRESH_95, PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqFile('hold') });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a message sent while usage is high');
    await page.locator('#send').click();

    const gate = page.locator('.bubble.usage-hold');
    await expect(gate).toBeVisible({ timeout: 20000 });
    await expect(gate).toContainText('95% of your 5-hour Claude usage limit');
    await expect(gate.getByRole('button', { name: 'Continue in fresh chat' })).toBeVisible();
    await expect(gate.getByRole('button', { name: 'Send this message anyway' })).toBeVisible();
    await expect(gate.getByRole('button', { name: 'Cancel' })).toBeVisible();
    // The worker was NOT invoked: no thinking bubble, no assistant REPLY bubble (the gate is a
    // usage-hold bubble, excluded).
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0);
    await expect(page.locator('.bubble.assistant:not(.usage-hold)')).toHaveCount(0);
  } finally { await closeApp(app); }
});

test('"Send this message anyway" overrides for exactly that message and the worker runs', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_USAGE: FRESH_95, PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqFile('override') });
  try {
    await page.locator('#input').fill('send me anyway');
    await page.locator('#send').click();
    const gate = page.locator('.bubble.usage-hold');
    await expect(gate).toBeVisible({ timeout: 20000 });

    await gate.getByRole('button', { name: 'Send this message anyway' }).click();
    // The override authorizes this send: a real worker turn now runs and replies.
    await expect(page.locator('.bubble.assistant:not(.usage-hold):not(.thinking)')).toHaveCount(1, { timeout: 20000 });
  } finally { await closeApp(app); }
});

test('"Cancel" leaves the message unsent with an honest note — the worker never runs', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_USAGE: FRESH_95, PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqFile('cancel') });
  try {
    await page.locator('#input').fill('never mind this one');
    await page.locator('#send').click();
    const gate = page.locator('.bubble.usage-hold');
    await expect(gate).toBeVisible({ timeout: 20000 });

    await gate.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.bubble.assistant').filter({ hasText: 'held and not sent (usage protection)' })).toBeVisible({ timeout: 20000 });
    // Still no worker reply.
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0);
  } finally { await closeApp(app); }
});

test('FAIL HONEST: a STALE high reading never holds — the send proceeds normally', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_USAGE: STALE_95, PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_SEQ_STATE: seqFile('stale') });
  try {
    await page.locator('#input').fill('usage reading is stale, so send normally');
    await page.locator('#send').click();
    // No gate; the worker runs and replies.
    await expect(page.locator('.bubble.usage-hold')).toHaveCount(0);
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1, { timeout: 20000 });
  } finally { await closeApp(app); }
});
