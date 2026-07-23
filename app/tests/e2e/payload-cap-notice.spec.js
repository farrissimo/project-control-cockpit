// ADR-0020 T7 truncation-visibility correction. The per-send caps already TRIM oversized input; this
// proves the OWNER is told DIRECTLY and deterministically when they fire — never by relying on the
// worker to echo the marker injected into its payload. Drives the REAL app; the worker is faked and its
// reply deliberately does NOT contain any cap text, so a visible notice can only come from PCC itself.
const { test, expect } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { launchApp, closeApp } = require('../helpers/launch');
const pc = require('../../payload-caps.js');

let app, page, dir, fixturePath;
test.beforeAll(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-capnotice-'));
  fixturePath = path.join(dir, 'fixture.json');
  // A neutral reply with NO cap wording in it — so any "trimmed" notice must come from res.caps.
  fs.writeFileSync(fixturePath, JSON.stringify({ stdout: 'PLAIN-WORKER-REPLY', exitCode: 0 }), 'utf8');
  ({ app, page } = await launchApp({ PCC_FAKE_CLAUDE_FIXTURE: fixturePath }));
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
});
test.afterAll(async () => {
  await closeApp(app);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ }
});

test('a normal message shows NO trim notice (the notice is not spurious)', async () => {
  await page.locator('#input').fill('a perfectly normal short message');
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  await expect(page.locator('.bubble.assistant').last()).toContainText('PLAIN-WORKER-REPLY');
  await expect(page.locator('.bubble.cap-notice')).toHaveCount(0);
});

test('an over-cap typed message surfaces a deterministic, worker-independent trim notice to the owner', async () => {
  const huge = 'x'.repeat(pc.MAX_MESSAGE_CHARS + 5000); // one giant paste, over the per-send message cap
  await page.locator('#input').fill(huge);
  await page.locator('#send').click();
  await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
  // The notice appears as its OWN bubble — driven by res.caps, not by the worker's reply.
  const notice = page.locator('.bubble.cap-notice');
  await expect(notice).toHaveCount(1);
  await expect(notice).toContainText('trimmed this send'); // plain-English, owner-facing
  await expect(notice).toContainText('200K characters');   // the real cap value, passed from main (never hardcoded in the view)
  await expect(notice).not.toHaveClass(/error/);           // a protection firing, not a bug
  // Worker-independence: the faked reply carried no cap text, yet the owner still learns of the trim.
  await expect(page.locator('.bubble.assistant').filter({ hasText: 'PLAIN-WORKER-REPLY' }).last()).toBeVisible();
});

test('IPC send returns the exact trim facts for attachments (excluded count + text truncation), worker-independent', async () => {
  // Drive the send IPC directly with oversized attachments and read the returned res.caps — this proves
  // main.js reports WHAT it trimmed back to the renderer (the source of the owner notice), regardless of
  // what the worker replies. MAX_ATTACHMENTS + 1 text files => exactly one excluded for count.
  const overCount = pc.MAX_ATTACHMENTS + 1;
  const bigLen = pc.MAX_ATTACH_TOTAL_CHARS + 100;
  const caps = await page.evaluate(async ({ overCount, bigLen }) => {
    // eslint-disable-next-line no-undef
    const chatId = activeChat().id;
    // eslint-disable-next-line no-undef
    const model = getSelectedModel();
    const many = Array.from({ length: overCount }, (_, i) => ({ kind: 'text', content: 'x', name: 'f' + i }));
    // eslint-disable-next-line no-undef
    const r1 = await window.pcc.send('hello', model, null, false, chatId, many);
    const oneBig = [{ kind: 'text', content: 'y'.repeat(bigLen), name: 'big' }];
    // eslint-disable-next-line no-undef
    const r2 = await window.pcc.send('hello', model, null, false, chatId, oneBig);
    return { excluded: r1.caps, truncated: r2.caps };
  }, { overCount, bigLen });
  expect(caps.excluded.excludedAttachments).toBe(1);        // exactly the over-count attachment
  expect(caps.excluded.maxAttachments).toBe(pc.MAX_ATTACHMENTS);
  expect(caps.truncated.attachmentTextTruncated).toBe(true); // the over-budget attachment text was trimmed
});
