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

test('worker auth failure surfaces honestly, as a PLAIN sign-in message (ADR-0018) — not the raw credentials error', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-auth.json') }, async (page) => {
    const r = await callOn(page, 'send', 'hi', undefined, 'c1', true);
    expect(r.ok).toBe(false);
    expect(r.authError).toBe(true);
    expect(r.text).toMatch(/sign back in to Claude Code/i);   // plain, actionable
    expect(r.text).toMatch(/isn.t a PCC bug/i);               // honest about whose fault it is
    expect(r.text).not.toMatch(/Invalid credentials/i);       // the raw CLI error is NOT shown
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

test('R3: a per-turn budget-cap abort is a plain, neutral message — never a scary raw error (ADR-0014)', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-budget-exceeded.json') }, async (page) => {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a turn that will hit the cap');
    await page.locator('#send').click();
    const bubble = page.locator('.bubble.assistant').last();
    await expect(bubble).toContainText('spending cap', { timeout: 15000 });
    await expect(bubble).not.toHaveClass(/error/); // an automatic protection firing, not a failure
    await expect(page.locator('#send')).toBeEnabled(); // the chat is left usable, not stuck
  });
});

test('hitting the Claude PLAN usage limit shows a calm, plain message — never a scary raw error, not styled as a PCC bug', async () => {
  await withApp({ PCC_FAKE_CLAUDE_FIXTURE: FX('worker-usage-limit.json') }, async (page) => {
    await expect(page.locator('.bubble.assistant.thinking')).toHaveCount(0, { timeout: 20000 });
    await page.locator('#input').fill('a message when the plan limit is hit');
    await page.locator('#send').click();
    const bubble = page.locator('.bubble.assistant').last();
    await expect(bubble).toContainText('reached your Claude usage limit', { timeout: 15000 });
    await expect(bubble).toContainText('not a PCC problem');
    await expect(bubble).not.toHaveClass(/error/); // an external plan limit, not a PCC failure
    await expect(bubble).not.toContainText('usage limit reached'); // the raw CLI string is NOT shown
    await expect(page.locator('#send')).toBeEnabled(); // chat stays usable
  });
});

test('R3: send actually passes --max-budget-usd (the value from .cockpit/state/usage-limits.json) to the worker', async () => {
  const argvFile = path.join(require('os').tmpdir(), 'pcc-test-argv-' + Date.now() + '.json');
  await withApp({ PCC_FAKE_CLAUDE_ARGV_FILE: argvFile }, async (page) => {
    const r = await callOn(page, 'send', 'hi', undefined, 'c1', true);
    expect(r.ok).toBe(true); // the flag being present doesn't break a normal turn
    const argv = JSON.parse(require('fs').readFileSync(argvFile, 'utf8'));
    const i = argv.indexOf('--max-budget-usd');
    expect(i).toBeGreaterThanOrEqual(0);
    expect(Number(argv[i + 1])).toBe(3); // the repo's real .cockpit/state/usage-limits.json default
  });
  require('fs').rmSync(argvFile, { force: true });
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
