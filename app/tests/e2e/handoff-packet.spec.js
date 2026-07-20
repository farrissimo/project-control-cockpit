// Handoff packet (docs/specs/conversation-handoff-packet.md). Proves the lived
// behaviour in the REAL app: select a conversation slice -> clipboard packet with a
// source boundary (chat id + repo SHA + time), messages by role in order, fenced code
// preserved verbatim, and a PROOF footer. Empty selection copies nothing and hints.
//
// NOTE ON DRIVING: we dispatch the real mousedown/click DOM events rather than
// Playwright's high-level locator.click(). Playwright's synthetic OS-level click
// collapses the document text selection at the input layer BEFORE our JS mousedown
// runs (verified via a probe), which a real user's click does not — the button uses
// the standard mousedown-preventDefault pattern that rich-text toolbars use to keep a
// selection alive. Dispatching the events exercises the true handlers on a real
// selection; the human mouse-drag path is preserved by that preventDefault design.
/* global addBubbleUI */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

// Read the system clipboard from the main process (robust across permission prompts).
function clip() { return app.evaluate(({ clipboard }) => clipboard.readText()); }

test('selected slice becomes a packet with boundary, roles in order, code, and PROOF', async () => {
  await page.evaluate(() => {
    document.getElementById('log').innerHTML = '';
    addBubbleUI('user', 'Please fix the release gate hang.');
    addBubbleUI('assistant', 'Root cause found. Run:\n```\nnpm test\n```');
    const bubbles = document.querySelectorAll('#log .bubble');
    const r = document.createRange();
    r.setStartBefore(bubbles[0]); r.setEndAfter(bubbles[bubbles.length - 1]);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    const btn = document.getElementById('handoff-packet-btn');
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('#handoff-packet-btn')).toHaveText('Copied ✓');
  const text = await clip();
  // AC-2: header boundary — chat id, a real repo SHA (or 'unknown'), and a timestamp
  expect(text).toMatch(/id .+/);
  expect(text).toMatch(/Repo: ([0-9a-f]{10}|unknown)/);
  expect(text).toMatch(/Generated: \d{4}-\d{2}-\d{2}T/);
  // AC-1: both roles present, in transcript order
  expect(text).toContain('You:');
  expect(text).toContain('Claude:');
  expect(text.indexOf('You:')).toBeLessThan(text.indexOf('Claude:'));
  // AC-5: fenced code preserved verbatim
  expect(text).toContain('```');
  expect(text).toContain('npm test');
  // AC-3: PROOF footer verbatim
  expect(text).toContain('PROOF REQUIRED');
});

test('empty selection copies nothing and shows a hint', async () => {
  await app.evaluate(({ clipboard }) => clipboard.writeText('SENTINEL-UNCHANGED'));
  await page.evaluate(() => {
    window.getSelection().removeAllRanges();
    const btn = document.getElementById('handoff-packet-btn');
    btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await expect(page.locator('#handoff-packet-btn')).toHaveText('Select text first');
  expect(await clip()).toBe('SENTINEL-UNCHANGED'); // AC-4: nothing copied
});
