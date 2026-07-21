// R3 slice 2 (desktop-parity, ADR-0015): automatic cross-turn cost rollover — many small turns
// accumulating over hours (the ACTUAL 2026-07-20 mechanism; slice 1's per-turn cap does not cover
// this). Each turn replays a fixed real-shaped total_cost_usd (6) via the fixture mechanism; the
// repo's real .cockpit/state/usage-limits.json caps a whole chat at 15 — so cumulative cost crosses
// the cap on the 3rd turn (6+6+6=18 >= 15), and PCC must roll the chat over with ZERO owner action.
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

test('cumulative cost across many turns triggers an automatic rollover — an honest notice, full history kept, zero owner action', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(page, 'turn one');
    // 1st turn: cumulative $6 — well under the $15 cap. No rollover notice yet.
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(1);
    await expect(page.locator('.bubble.assistant').last()).not.toContainText('automatically started a fresh worker session');

    await sendAndWait(page, 'turn two');
    // 2nd turn: cumulative $12 — still under. Still no rollover notice.
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(2);
    await expect(page.locator('.bubble.assistant').last()).not.toContainText('automatically started a fresh worker session');

    await sendAndWait(page, 'turn three');
    // 3rd turn: cumulative $18 >= $15 — the cap is crossed. An automatic rollover notice appears
    // as its OWN extra bubble, right after the real reply — the owner did nothing to trigger it.
    await expect(page.locator('.bubble.assistant:not(.thinking)')).toHaveCount(4); // 3 real replies + 1 rollover notice
    const notice = page.locator('.bubble.assistant').last();
    await expect(notice).toContainText('automatically started a fresh worker session');
    await expect(notice).toContainText('$18.00'); // the real accumulated total, not a vague "a lot"
    await expect(notice).not.toHaveClass(/error/); // protection firing, not a failure

    // The FULL history — all three original replies — is still there; nothing was lost.
    const bubbles = await page.locator('.bubble.assistant:not(.thinking)').allTextContents();
    expect(bubbles.filter((t) => t.includes('FAKE-JSON-REPLY')).length).toBe(3);
  } finally {
    await closeApp(app);
  }
});

test('after a rollover, the NEXT turn genuinely starts a fresh session (--session-id, not --resume)', async () => {
  const argvFile = path.join(os.tmpdir(), 'pcc-test-argv-rollover-' + Date.now() + '.json');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX, PCC_FAKE_CLAUDE_ARGV_FILE: argvFile });
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(page, 'turn one');
    await sendAndWait(page, 'turn two');
    await sendAndWait(page, 'turn three'); // crosses the cap — rollover fires
    await expect(page.locator('.bubble.assistant').last()).toContainText('automatically started a fresh worker session');
    // Argv capture records only the LAST invocation, so this send's argv proves what the remint
    // actually did — a fresh session request, not merely a cosmetic notice over the same session.
    await sendAndWait(page, 'turn four');
    const argv = JSON.parse(fs.readFileSync(argvFile, 'utf8'));
    expect(argv).toContain('--session-id');
    expect(argv).not.toContain('--resume');
  } finally {
    await closeApp(app);
    fs.rmSync(argvFile, { force: true });
  }
});

test('attachment/image turns (stream-json path) count toward the per-chat cap too — the most expensive turns are not a blind spot (ADR-0017)', async () => {
  // Attachment turns use --output-format stream-json, a different parser than text turns. They are
  // the most token-expensive, so leaving them uncounted meant an image-heavy chat could balloon
  // fastest yet never roll over. This drives real attachment sends (a text attachment triggers the
  // hasAttach path) whose fake worker reports total_cost_usd:8; two of them = $16 >= the $15 cap.
  const FX8 = path.join(__dirname, '..', 'fixtures', 'boundary', 'worker-streamjson-cost-8.json');
  const { app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX8 });
  const send = (chatId, first) => page.evaluate(([id, f]) =>
    window.pcc.send('describe this', undefined, id, f, id, [{ kind: 'text', name: 'note.txt', content: 'hello' }]),
  [chatId, first]);
  try {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    const r1 = await send('imgChat', true);
    expect(r1.ok).toBe(true);
    expect(r1.text).toBe('IMG-REPLY');       // the attachment reply is parsed correctly
    expect(r1.costRollover).toBeUndefined(); // $8 — under the $15 cap
    const r2 = await send('imgChat', false);
    expect(r2.ok).toBe(true);
    expect(r2.costRollover).toBeTruthy();     // $16 >= $15 — the attachment cost DID accumulate and cross
    expect(r2.costRollover.totalUsd).toBe(16);
  } finally {
    await closeApp(app);
  }
});

test('accumulated cost SURVIVES an app restart — the rollover still fires on a chat resumed after relaunch (ADR-0015 residue closed)', async () => {
  // The whole point: during the 2026-07-20 crisis the owner restarted repeatedly. If cost tracking
  // were in-memory only, a long chat resumed after a restart would reset to $0 and balloon again.
  // Share ONE user-data dir across a close+relaunch so both the chat AND its persisted cost survive.
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-restart-'));
  try {
    // Run 1: two turns => cumulative $12, under the $15 cap, no rollover yet.
    const a1 = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX }, { userDataDir: shared });
    await expect(a1.page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(a1.page, 'turn one');
    await sendAndWait(a1.page, 'turn two');
    await expect(a1.page.locator('.bubble.assistant').last()).not.toContainText('automatically started a fresh worker session');
    await closeApp(a1.app); // "restart" — the shared dir (chat + persisted cost) is kept, not deleted

    // Run 2: the SAME chat resumes; ONE more turn => $18 >= $15. If cost had reset to 0 on restart,
    // this would be only $6 and NOT roll over — so a passing assertion proves the total persisted.
    const a2 = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: FX }, { userDataDir: shared });
    await expect(a2.page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await sendAndWait(a2.page, 'turn three (post-restart)');
    await expect(a2.page.locator('.bubble.assistant').last()).toContainText('automatically started a fresh worker session');
    await expect(a2.page.locator('.bubble.assistant').last()).toContainText('$18.00'); // the total carried across the restart
    await closeApp(a2.app);
  } finally {
    fs.rmSync(shared, { recursive: true, force: true });
  }
});
