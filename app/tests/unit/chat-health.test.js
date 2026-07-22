// Chat-health gauge (ADR-0019): the fix for the meter that stayed green through 426K tokens, now a
// GENERAL, model+plan-agnostic design. Pins: per-model windows, conservative-safe plan default,
// the "roll over on whichever comes first (absolute floor OR % of estimated window)" trigger, an
// UNMEASURED context dropped (never a false-green 0), and window always flagged estimated.
const { test } = require('node:test');
const assert = require('node:assert');
const {
  computeGauge, contextWindowFor, modelDeclaredWindow, rolloverTokensFor,
  ASSUMED_PLAN_WINDOW, ABSOLUTE_ROLLOVER_TOKENS,
} = require('../../renderer/chat-health.js');

test('per-model declared window: opus/sonnet = 1M, haiku = 200K, unknown = conservative', () => {
  assert.strictEqual(modelDeclaredWindow('claude-opus-4-8'), 1000000);
  assert.strictEqual(modelDeclaredWindow('Opus 4.8 (most capable)'), 1000000);
  assert.strictEqual(modelDeclaredWindow('claude-sonnet-5'), 1000000);
  assert.strictEqual(modelDeclaredWindow('claude-haiku-4-5'), 200000);
  assert.strictEqual(modelDeclaredWindow('some-future-model'), ASSUMED_PLAN_WINDOW);
  assert.strictEqual(modelDeclaredWindow(''), ASSUMED_PLAN_WINDOW);
});

test('effective window is capped by the conservative plan default and ALWAYS flagged estimated', () => {
  // Opus can run 1M, but with no plan override we assume the conservative non-Max cap.
  const noCap = contextWindowFor('claude-opus-4-8');
  assert.strictEqual(noCap.window, ASSUMED_PLAN_WINDOW); // 200K, safe default
  assert.strictEqual(noCap.declared, 1000000);
  assert.strictEqual(noCap.estimated, true);
  // A confirmed larger-context plan lifts the cap.
  assert.strictEqual(contextWindowFor('claude-opus-4-8', { planWindowCap: 1000000 }).window, 1000000);
  // Haiku is 200K regardless of a bigger cap.
  assert.strictEqual(contextWindowFor('claude-haiku-4-5', { planWindowCap: 1000000 }).window, 200000);
});

test('rollover threshold = whichever comes first: absolute floor OR 75% of window', () => {
  assert.strictEqual(rolloverTokensFor(200000), 150000);   // small window -> 75% (before the wall)
  assert.strictEqual(rolloverTokensFor(1000000), ABSOLUTE_ROLLOVER_TOKENS); // big window -> 350K floor
});

test('on a conservative (200K) assumption, a growing chat rolls over at 150K — safe on ANY plan', () => {
  const g = computeGauge({ turns: 2, spanHours: 0.5, contextTokens: 160000, model: 'claude-opus-4-8' });
  assert.strictEqual(g.rolloverTokens, 150000);
  assert.strictEqual(g.overRollover, true);       // 160K >= 150K
  assert.strictEqual(g.driver, 'context');
  assert.strictEqual(g.gaugePct, 100);            // 160/150 capped at 100 — reads full exactly at rollover
  assert.strictEqual(g.contextMeasured, true);
  assert.ok(Math.abs(g.pctOfWindow - 160000 / 200000) < 1e-9); // hover figure: 80% of the estimated window
});

test('with a confirmed 1M-window plan, the same 160K chat is calm and rolls over at 350K', () => {
  const g = computeGauge({ turns: 2, spanHours: 0.5, contextTokens: 160000, model: 'claude-opus-4-8', planWindowCap: 1000000 });
  assert.strictEqual(g.rolloverTokens, ABSOLUTE_ROLLOVER_TOKENS); // 350K
  assert.strictEqual(g.overRollover, false);      // 160K < 350K
  assert.ok(g.gaugePct < 50);                     // 160/350 ~ 46%
  assert.ok(Math.abs(g.pctOfWindow - 160000 / 1000000) < 1e-9); // 16% of the 1M window
});

test('gauge is the WORST-OF the three terms', () => {
  const g = computeGauge({ turns: 38, spanHours: 0, contextTokens: 10000, model: 'claude-opus-4-8' });
  assert.strictEqual(g.gaugePct, 95); // messages 38/40 dominate a tiny context
  assert.strictEqual(g.driver, 'messages');
});

test('UNMEASURED context (null) is dropped, not coerced to 0 — falls back to messages/time', () => {
  const g = computeGauge({ turns: 20, spanHours: 3, contextTokens: null, model: 'claude-opus-4-8' });
  assert.strictEqual(g.contextMeasured, false);
  assert.strictEqual(g.pctContext, null);
  assert.strictEqual(g.pctOfWindow, null);
  assert.strictEqual(g.overRollover, false);
  assert.strictEqual(g.gaugePct, 50); // max(20/40, 3/6)
});

test('garbage/negative context tokens never become a real reading (treated as unmeasured)', () => {
  for (const bad of [-1, NaN, Infinity, '100000', {}]) {
    const g = computeGauge({ turns: 1, contextTokens: bad, model: 'claude-opus-4-8' });
    assert.strictEqual(g.contextMeasured, false, String(bad));
  }
});

test('overRollover fires exactly at the threshold, not before', () => {
  assert.strictEqual(computeGauge({ contextTokens: 149999, model: 'claude-opus-4-8' }).overRollover, false);
  assert.strictEqual(computeGauge({ contextTokens: 150000, model: 'claude-opus-4-8' }).overRollover, true);
});
