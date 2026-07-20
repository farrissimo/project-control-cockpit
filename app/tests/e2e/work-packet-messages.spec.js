// Work-packet messages (docs/specs/work-packet-messages.md). Proves the lived behaviour
// in the REAL app: when an assistant reply is written in the AGENTS.md reporting shape,
// each recognised section renders as a separately collapsible <details>, collapsed by
// default with its name as the summary; a plain reply is untouched (no regression); code
// inside a section still copies; and partial packets render only the sections present.
/* global addBubbleUI */
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');

let app, page;
test.beforeAll(async () => {
  ({ app, page } = await launchApp());
  // Wait for the app's own startup render to settle before any test seeds #log. boot()
  // asynchronously repaints #log (loadChats), which otherwise wipes an early test's bubble
  // out from under it — the real cause of the flaky "0 sections" failures. See renderer.js.
  await page.waitForFunction(() => window.__pccBooted === true, null, { timeout: 15000 });
});
test.afterAll(async () => { await closeApp(app); });

function clip() { return app.evaluate(({ clipboard }) => clipboard.readText()); }

// AC-1 + AC-2: a full work packet becomes one collapsed section per recognised header,
// each showing its name as a visible summary. Headers use mixed markup (##, **bold**,
// trailing colon, bare line) to prove the parser is tolerant.
test('a work-packet reply renders one collapsed, named section per header', async () => {
  await page.evaluate(() => {
    document.getElementById('log').innerHTML = '';
    const reply = [
      'Short lead-in before any header.',
      '## What I understood',
      'You wanted collapsible sections.',
      '**What I changed**',
      'Added a parser + renderer.',
      'Tests run:',
      'All green locally.',
      'Next legal action',
      'Open a PR.',
    ].join('\n');
    addBubbleUI('assistant', reply);
  });
  const bubble = page.locator('#log .bubble.assistant').last();
  const sections = bubble.locator('details.wp-section');
  await expect(sections).toHaveCount(4);
  // AC-1: collapsed by default (no `open` attribute on any section).
  await expect(bubble.locator('details.wp-section[open]')).toHaveCount(0);
  // AC-2: each section's name is visible as its summary.
  await expect(sections.nth(0).locator('summary')).toHaveText('What I understood');
  await expect(sections.nth(1).locator('summary')).toHaveText('What I changed');
  await expect(sections.nth(2).locator('summary')).toHaveText('Tests run');
  await expect(sections.nth(3).locator('summary')).toHaveText('Next legal action');
  // Lead-in text stays visible outside any section.
  await expect(bubble.locator('.wp-lead')).toContainText('Short lead-in before any header.');
});

// AC-3: a plain reply with no recognised header renders exactly as today — a single bubble
// with no collapsible sections. This is the common case and must never be downgraded.
test('a plain reply renders as one bubble with no sections (no regression)', async () => {
  await page.evaluate(() => {
    document.getElementById('log').innerHTML = '';
    addBubbleUI('assistant', 'Just a normal answer with no work-packet structure at all.');
  });
  const bubble = page.locator('#log .bubble.assistant').last();
  await expect(bubble.locator('details.wp-section')).toHaveCount(0);
  await expect(bubble).toContainText('Just a normal answer');
});

// AC-4: fenced code inside a section is still a working copy block — the delegated copy
// handler fires inside <details> and puts the section's code on the clipboard.
test('code inside a section is still a working copy block', async () => {
  await app.evaluate(({ clipboard }) => clipboard.writeText('SENTINEL-UNCHANGED'));
  await page.evaluate(() => {
    document.getElementById('log').innerHTML = '';
    const reply = [
      '## What I changed',
      'Run the suite:',
      '```',
      'npm test',
      '```',
    ].join('\n');
    addBubbleUI('assistant', reply);
  });
  const section = page.locator('#log .bubble.assistant details.wp-section').first();
  const copyBtn = section.locator('.cb-copy');
  await expect(copyBtn).toHaveCount(1);
  // Sections are collapsed by default, so a real user expands one before copying its code.
  await section.locator('summary').click();
  await expect(section).toHaveAttribute('open', '');
  await copyBtn.click();
  await expect.poll(() => clip()).toBe('npm test');
});

// AC-5: a partial packet renders only the sections that exist, and any pre-header lead-in
// text stays visible.
test('a partial packet renders only present sections plus the lead-in', async () => {
  await page.evaluate(() => {
    document.getElementById('log').innerHTML = '';
    const reply = [
      'Heads up before the section.',
      '## Problems found',
      'One flaky test under load.',
    ].join('\n');
    addBubbleUI('assistant', reply);
  });
  const bubble = page.locator('#log .bubble.assistant').last();
  await expect(bubble.locator('details.wp-section')).toHaveCount(1);
  await expect(bubble.locator('details.wp-section > summary')).toHaveText('Problems found');
  await expect(bubble.locator('.wp-lead')).toContainText('Heads up before the section.');
});
