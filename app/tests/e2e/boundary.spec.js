// Real-world boundary behavior: the fakes replay UGLY shapes (worker failures,
// auth errors, empty output; verifier FAIL / malformed / out-of-usage) and we
// assert the app handles each HONESTLY — surfaces the failure, shows "(no output)"
// instead of a silent blank, and never turns a non-PASS into a fake PASS.
// Closes the "fakes are cleaner than reality" gap. Each test launches a fresh app
// with the relevant fixture env.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const path = require('path');

const FX = (n) => path.join(__dirname, '..', 'fixtures', 'boundary', n);
const callOn = (page, m, ...a) => page.evaluate(([mm, aa]) => window.pcc[mm](...aa), [m, a]);

async function withApp(env, fn) {
  const { app, page } = await launchApp(env);
  try { await fn(page); } finally { await closeApp(app); }
}

test('worker non-zero exit surfaces as an error, not a reply', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-nonzero.json') }, async (page) => {
    const r = await callOn(page, 'send', 'hi', undefined, 'c1', true);
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/overloaded|rate limited/i);
  });
});

test('worker auth failure surfaces honestly', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-auth.json') }, async (page) => {
    const r = await callOn(page, 'send', 'hi', undefined, 'c1', true);
    expect(r.ok).toBe(false);
    expect(r.text).toMatch(/logged in|credentials/i);
  });
});

test('empty worker output shows "(no output)", never a silent blank', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-empty.json') }, async (page) => {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('hi');
    await page.locator('#send').click();
    await expect(page.locator('.bubble.assistant').last()).toHaveText('(no output)', { timeout: 15000 });
  });
});

test('verifier FAIL is reported as FAIL, not PASS', async () => {
  await withApp({ PCC_FAKE_CODEX_FIXTURE: FX('verifier-fail.json') }, async (page) => {
    const r = await callOn(page, 'verify');
    expect(r.text).toMatch(/\bFAIL\b/);
    expect(r.text).not.toMatch(/VERDICT:\s*PASS/i);
  });
});

test('verifier malformed output is never turned into a PASS', async () => {
  await withApp({ PCC_FAKE_CODEX_FIXTURE: FX('verifier-malformed.json') }, async (page) => {
    const r = await callOn(page, 'verify');
    expect(r.text).not.toMatch(/\bPASS\b/);
  });
});

test('codex out-of-usage surfaces as unavailable in a second opinion', async () => {
  await withApp({ PCC_FAKE_CODEX_FIXTURE: FX('verifier-outofusage.json') }, async (page) => {
    const r = await callOn(page, 'secondOpinion', 'Q: ok?\nA: yes.');
    // The app surfaces Codex's real unavailability message (never a fake agreement).
    expect(r.text).toMatch(/usage limit|out of usage|no output/i);
    expect(r.text).not.toMatch(/\bAGREE\b/);
  });
});
