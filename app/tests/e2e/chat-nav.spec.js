// Cockpit chat navigation (fix/cockpit-chat-nav): #2 switching chats works WHILE a turn runs, the
// turn resolves into its OWN chat (never misrouted or stalled), and the live "working…" state follows
// whichever chat is on screen; #3 clicking a search hit opens that chat AND lands on the matched
// message. Offline fake worker, zero real usage. Drives the REAL renderer handlers via the app UI.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

const send = (page, text) => page.evaluate((t) => {
  const i = document.getElementById('input'); i.value = t; i.dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('send').click();
}, text);
const rowClass = (page, id) => page.evaluate((cid) => {
  const r = document.querySelector(`#chats-list .chat-row[data-id="${cid}"]`); return r ? r.className : null;
}, id);
const logText = (page) => page.evaluate(() => document.getElementById('log').textContent);
const clickRow = (page, id) => page.evaluate((cid) => {
  document.getElementById('chats-panel').classList.remove('hidden');
  const row = document.querySelector(`#chats-list .chat-row-main[data-id="${cid}"]`); if (row) row.click();
}, id);
const activeRowId = (page) => page.evaluate(() => { const a = document.querySelector('#chats-list .chat-row.active'); return a && a.dataset.id; });
// The app must be FULLY ready before the first send: chats loaded (an active row exists) AND the
// composer enabled (store ready, not recovery). A fixed sleep can't guarantee this — the first send
// silently fails to commit if the store isn't ready yet, so no turn ever starts.
const waitReady = (page) => page.waitForFunction(
  () => !!document.querySelector('#chats-list .chat-row.active') && !!document.getElementById('send') && !document.getElementById('send').disabled,
  null, { timeout: 20000 });

test('#2: chat switches WHILE busy; the turn resolves into its own chat; working-state follows the screen', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '5000' });
  try {
    await waitReady(page);
    // Chat A: send a short message (distinct length -> distinct fake reply "received 4 chars.").
    await send(page, 'AAAA');
    await page.waitForFunction(() => !!document.querySelector('#log .bubble.assistant.thinking'), null, { timeout: 10000 }); // A's turn started
    // Wait until A's turn is FULLY done — busy cleared (send re-enabled), not just the indicator gone.
    // new-chat no-ops while busy, so clicking it in that gap would leave only one chat.
    await page.waitForFunction(() => { const s = document.getElementById('send'); return s && !s.disabled && !document.querySelector('#log .bubble.assistant.thinking'); }, null, { timeout: 20000 });
    // Chat B (becomes active), then start a DELAYED turn on B (distinct "received 10 chars.").
    await page.evaluate(() => document.getElementById('new-chat').click());
    // A second, distinct chat now exists and is active (>=2 tolerates a reused profile carrying extras).
    await page.waitForFunction(() => {
      const rows = [...document.querySelectorAll('#chats-list .chat-row')];
      return rows.length >= 2 && rows.some((r) => r.classList.contains('active')) && rows.some((r) => !r.classList.contains('active'));
    }, null, { timeout: 10000 });
    const ids = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#chats-list .chat-row')];
      return { B: (rows.find((r) => r.classList.contains('active')) || {}).dataset.id, A: (rows.find((r) => !r.classList.contains('active')) || {}).dataset.id };
    });
    expect(ids.A && ids.B && ids.A !== ids.B).toBe(true);
    await send(page, 'BBBBBBBBBB');

    // B's turn is genuinely in flight: working indicator on screen AND its list row marked working.
    await page.waitForFunction((bid) => {
      const r = document.querySelector(`#chats-list .chat-row[data-id="${bid}"]`);
      return document.querySelectorAll('#log .bubble.assistant.thinking').length === 1 && r && r.classList.contains('working');
    }, ids.B, { timeout: 10000 });

    // SWITCH TO A while B is still running — this used to be silently blocked.
    await clickRow(page, ids.A);
    await page.waitForFunction((aid) => { const a = document.querySelector('#chats-list .chat-row.active'); return a && a.dataset.id === aid; }, ids.A, { timeout: 8000 });
    expect(await page.evaluate(() => document.querySelectorAll('#log .bubble.assistant.thinking').length)).toBe(0); // A is not the in-flight chat -> no indicator
    expect(await rowClass(page, ids.B)).toMatch(/working/); // B's turn keeps running in the background

    // Let B's turn RESOLVE while we're viewing A (proves switching did NOT stall/cancel it), then
    // confirm it landed in B, not A. Poll the real condition instead of a fragile fixed sleep.
    await page.waitForFunction((bid) => {
      const r = document.querySelector(`#chats-list .chat-row[data-id="${bid}"]`);
      return r && !r.classList.contains('working');
    }, ids.B, { timeout: 20000 });
    expect(await logText(page)).not.toContain('received 10 chars'); // A's view never shows B's reply

    // Back to B: its reply is there; no leftover working indicator.
    await clickRow(page, ids.B);
    await page.waitForFunction((bid) => { const a = document.querySelector('#chats-list .chat-row.active'); return a && a.dataset.id === bid; }, ids.B, { timeout: 8000 });
    expect(await logText(page)).toContain('received 10 chars'); // B's own reply routed to B
    expect(await page.evaluate(() => document.querySelectorAll('#log .bubble.assistant.thinking').length)).toBe(0);
  } finally {
    await closeApp(app);
  }
});

test('#3: clicking a search hit opens the chat AND flashes the matched message (incl. the active chat)', async () => {
  const { app, page } = await launchApp({ PCC_FAKE_DELAY_MS: '0' });
  try {
    await waitReady(page);
    // Put a locatable phrase into the ACTIVE chat's transcript (the user bubble carries it verbatim).
    await send(page, 'find me later zebra marker');
    await page.waitForFunction(() => [...document.querySelectorAll('#log .bubble')].some((b) => /zebra marker/i.test(b.dataset.raw || '')), null, { timeout: 15000 });
    const activeId = await activeRowId(page);

    // Click a real-shaped search hit for the ACTIVE chat (the old code silently no-opped this case).
    await page.evaluate((cid) => {
      const box = document.getElementById('chats-search-results');
      box.classList.remove('hidden');
      box.innerHTML = '<div class="sr-hit" data-act="open" data-id="' + cid + '" data-quote="zebra marker"><div class="sr-hit-name">hit</div></div>';
      box.querySelector('.sr-hit').click(); // -> openChatToMatch(activeId, 'zebra marker')
    }, activeId);
    // The matched message gets highlighted (flash class). Poll for it — robust to the same-chat (sync)
    // and cross-chat (async switchChat) paths alike; the flash is transient, so catch it, don't sleep.
    await page.waitForFunction(() => {
      const hit = [...document.querySelectorAll('#log .bubble')].find((b) => /zebra marker/i.test(b.dataset.raw || ''));
      return !!(hit && hit.classList.contains('search-hit-flash'));
    }, null, { timeout: 6000 }); // throws if never highlighted -> a dead click would fail the test
  } finally {
    await closeApp(app);
  }
});
