// ADR-0022: the per-chat cumulative dollar cap is DEMOTED to advisory. On a flat plan the dollar
// figure is phantom (ADR-0020), so it must NEVER stop or silently reroute approved work. This suite
// (formerly the ADR-0015 auto-rollover proof) now proves the demotion: cost still ACCUMULATES for
// display, but crossing the old $15 point produces NO rollover notice, NO fresh session, and NO
// counter reset — the chat just keeps going. Each turn replays a fixed real-shaped total_cost_usd (6)
// via the fixture; three turns = $18, which used to cross the $15 cap and roll over.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');
const os = require('os');
const fs = require('fs');

const FX = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-json-cost-6.json');

async function sendAndWait(page, text) {
  await page.locator('#input').fill(text);
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
}

test('cumulative cost past the old cap does NOT reroute — no fresh-session notice, full history kept, chat keeps going', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(page, 'turn one');
    await sendAndWait(page, 'turn two');
    await sendAndWait(page, 'turn three'); // cumulative $18 — would have crossed the old $15 cap

    // No automatic rollover notice bubble is added: exactly the 3 real replies, nothing extra.
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(3);
    for (const t of await page.locator('.bubble.assistant:not(.thinking)').allTextContents()) {
      expect(t).not.toContain('automatically started a fresh worker session');
    }
    // The full history — all three replies — is intact.
    const bubbles = await page.locator('.bubble.assistant:not(.thinking)').allTextContents();
    expect(bubbles.filter((t) => t.includes('FAKE-JSON-REPLY')).length).toBe(3);
  } finally {
    await closeApp(app);
  }
});

test('past the old cap, the NEXT turn stays on the SAME session (--resume, never a fresh --session-id remint)', async () => {
  const argvFile = path.join(os.tmpdir(), 'pcc-test-argv-norollover-' + Date.now() + '.json');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_ARGV_FILE: argvFile });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(page, 'turn one');
    await sendAndWait(page, 'turn two');
    await sendAndWait(page, 'turn three'); // $18 — old cap crossed, but no reroute now
    await sendAndWait(page, 'turn four');
    // Argv capture records only the LAST invocation: it must be a RESUME of the same session,
    // proving no cost-triggered remint happened (the opposite of the old ADR-0015 behavior).
    const argv = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
    expect(argv).toContain('--resume');
    expect(argv).not.toContain('--session-id');
  } finally {
    await closeApp(app);
    fs.rmSync(argvFile, { force: true });
  }
});

test('cost is still ACCUMULATED as advisory telemetry (never deleted), but never signals a rollover', async () => {
  // Drive explicit-chatId sends so we can read the chat's accumulated advisory total back via the
  // read-only pcc:nearestLimitData IPC. Text turns cost $6 each; three of them = $18 (past the old
  // $15). costRollover must be undefined every turn (no reroute), and chatUsd must reflect the real
  // accumulated total (the number is still tracked, just advisory).
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX });
  const send = (chatId, first) => page.evaluate(([id, f]) =>
    window.pcc.send('acc turn', undefined, id, f, id), [chatId, first]);
  const chatUsd = (chatId) => page.evaluate((id) => window.pcc.nearestLimitData(id).then((d) => d.chatUsd), chatId);
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    const r1 = await send('accChat', true);
    expect(r1.ok).toBe(true);
    expect(r1.costRollover).toBeUndefined();
    const r2 = await send('accChat', false);
    expect(r2.costRollover).toBeUndefined();
    const r3 = await send('accChat', false); // cumulative $18 — no rollover signal even past the old cap
    expect(r3.costRollover).toBeUndefined();
    expect(await chatUsd('accChat')).toBe(18); // still tracked, never reset — advisory only
  } finally {
    await closeApp(app);
  }
});
