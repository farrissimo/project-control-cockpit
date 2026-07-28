// Regression for the switch-while-busy defect (spec: docs/specs/switch-while-busy.md): while chat A's
// turn is in flight, a chat B you switch to must stay usable (Send/New chat/chips queue or navigate),
// controls that can't run mid-turn must refuse HONESTLY (not silently), and B must self-recover after
// A's turn. Drives the REAL app with the fake worker (zero real usage) + a slow turn to probe mid-turn.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

// A low, non-holding usage reading so the steering-queue drain never flakes on the >=90% hold.
const ENV = { PCC_FAKE_DELAY_MS: '3500', PCC_FAKE_USAGE: '{"available":true,"sessionPercent":10,"stale":false}' };

const ready = (page) => page.waitForFunction(
  () => !!document.querySelector('#chats-list .chat-row.active') && !!document.getElementById('send') && !document.getElementById('send').disabled,
  null, { timeout: 20000 });
const activeId = (page) => page.evaluate(() => { const a = document.querySelector('#chats-list .chat-row.active'); return a && a.dataset.id; });
const waitActive = (page, id) => page.waitForFunction((x) => { const cur = document.querySelector('#chats-list .chat-row.active'); return cur && cur.dataset.id === x; }, id, { timeout: 8000 });
const clickRow = (page, id) => page.evaluate((cid) => { document.getElementById('chats-panel').classList.remove('hidden'); const r = document.querySelector(`#chats-list .chat-row-main[data-id="${cid}"]`); if (r) r.click(); }, id);
const rowCount = (page) => page.evaluate(() => document.querySelectorAll('#chats-list .chat-row').length);
const userBubbles = (page) => page.evaluate(() => document.querySelectorAll('#log .bubble.user').length);

// Make chat B (idle), return to A, then start a slow turn in A so A is busy while we view B.
async function twoChatsWithABusy(page) {
  await ready(page);
  const A = await activeId(page);
  await page.locator('#new-chat').click();
  await page.waitForFunction((a) => { const cur = document.querySelector('#chats-list .chat-row.active'); return cur && cur.dataset.id !== a; }, A, { timeout: 8000 });
  const B = await activeId(page);
  await clickRow(page, A); await waitActive(page, A);
  await page.locator('#input').fill('slow turn in A');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toBeVisible({ timeout: 5000 }); // A is busy
  await clickRow(page, B); await waitActive(page, B); // view B while A runs
  return { A, B };
}

test('AC-1/AC-3/AC-4: Send + chip work in chat B while A is busy, and B self-recovers', async () => {
  const { app, page } = await launchApp(ENV);
  try {
    await twoChatsWithABusy(page);

    // AC-1: Send button is enabled in B while A is busy (disabled only in recovery).
    expect(await page.evaluate(() => document.getElementById('send').disabled)).toBe(false);

    // AC-3: a correction chip commits + queues in B (a user bubble appears — no silent no-op).
    const before = await userBubbles(page);
    await page.evaluate(() => { const chip = document.querySelector('#corrections .corr') || document.querySelector('.corr'); chip.click(); });
    await expect.poll(() => userBubbles(page), { timeout: 4000 }).toBeGreaterThan(before);

    // AC-1 (send path): a typed Send commits + queues in B too.
    const afterChip = await userBubbles(page);
    await page.locator('#input').fill('hello from B while A busy');
    await page.locator('#send').click();
    await expect.poll(() => userBubbles(page), { timeout: 4000 }).toBeGreaterThan(afterChip);

    // AC-4: the queued B messages drain against B (their own chat) — a reply lands in B — and B
    // self-recovers. The thinking indicator flickers between the stacked drained turns, so wait on
    // the durable end-states (a reply present, queue fully drained, Send re-enabled), not the flicker.
    await expect(page.locator('#log .bubble.assistant', { hasText: 'FAKE-CLAUDE-REPLY' }).first()).toBeVisible({ timeout: 30000 });
    await expect.poll(() => page.evaluate(() => document.querySelectorAll('.bubble.assistant.thinking').length), { timeout: 20000 }).toBe(0);
    await expect.poll(() => page.evaluate(() => document.getElementById('send').disabled), { timeout: 8000 }).toBe(false);
  } finally { await closeApp(app); }
});

test('AC-2: New chat creates and switches while another chat is busy', async () => {
  const { app, page } = await launchApp(ENV);
  try {
    const { B } = await twoChatsWithABusy(page);
    const before = await rowCount(page);
    await page.locator('#new-chat').click();
    await expect.poll(() => rowCount(page), { timeout: 5000 }).toBeGreaterThan(before); // a new chat was created
    // and it became active (switched away from B)
    await expect.poll(async () => (await activeId(page)) !== B, { timeout: 5000 }).toBe(true);
  } finally { await closeApp(app); }
});

test('AC-5: separate-worker controls refuse HONESTLY (not silently) while busy', async () => {
  const { app, page } = await launchApp(ENV);
  try {
    await twoChatsWithABusy(page);
    const clickCorrByText = (label) => page.evaluate((t) => {
      const b = [...document.querySelectorAll('.corr')].find((x) => (x.textContent || '').trim() === t);
      if (b) b.click();
      return !!b;
    }, label);

    expect(await clickCorrByText('Second opinion')).toBe(true);
    await expect(page.locator('#log .bubble.assistant.notice')).toContainText('wait for the current reply', { timeout: 4000 });

    expect(await clickCorrByText('Capture decisions')).toBe(true);
    await expect(page.locator('#log .bubble.assistant.notice')).toHaveCount(2, { timeout: 4000 }); // a second honest notice, still not silent
  } finally { await closeApp(app); }
});
