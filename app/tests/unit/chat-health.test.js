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

test('GROWTH-based: a fresh chat whose FIRST turn is a huge fixed baseline reads ~0%, never rolls over', () => {
  // The 2026-07-21 loop bug: turn one already carries ~252K of fixed overhead. With growth metering,
  // the first reading IS the baseline (growth 0), so the meter is calm and the auto-rollover can't trip.
  const g = computeGauge({ turns: 1, spanHours: 0, contextTokens: 252000, baselineTokens: 252000, model: 'claude-opus-4-8' });
  assert.strictEqual(g.growthTokens, 0);
  assert.strictEqual(g.overRollover, false);      // <-- the loop is structurally impossible
  assert.strictEqual(g.gaugePct, 3);              // driven by messages (1/40), not the 252K baseline
  assert.strictEqual(g.driver, 'messages');
  assert.strictEqual(g.contextMeasured, true);    // context IS measured; it just grew 0 so far
  assert.strictEqual(g.overWindowEstimate, true); // 252K > 200K conservative estimate => real window is larger
});

test('GROWTH-based: only conversation growth past the baseline moves the gauge / trips rollover', () => {
  const base = 252000;
  // Grown 150K past the 252K baseline -> hits the conservative 150K rollover threshold.
  const g = computeGauge({ turns: 6, spanHours: 1, contextTokens: base + 150000, baselineTokens: base, model: 'claude-opus-4-8' });
  assert.strictEqual(g.growthTokens, 150000);
  assert.strictEqual(g.rolloverTokens, 150000);
  assert.strictEqual(g.overRollover, true);       // real growth, not fixed overhead, fires it
  assert.strictEqual(g.driver, 'context');
  assert.strictEqual(g.gaugePct, 100);
  // hover figure is the RAW total vs the window, kept only as secondary detail
  assert.ok(Math.abs(g.pctOfWindow - (base + 150000) / 200000) < 1e-9);
});

test('overRollover fires exactly when GROWTH reaches the threshold, not before', () => {
  const base = 100000;
  assert.strictEqual(computeGauge({ contextTokens: base + 149999, baselineTokens: base, model: 'claude-opus-4-8' }).overRollover, false);
  assert.strictEqual(computeGauge({ contextTokens: base + 150000, baselineTokens: base, model: 'claude-opus-4-8' }).overRollover, true);
});

test('no baseline recorded yet: a lone reading is treated AS the baseline (growth 0), never a false-high', () => {
  const g = computeGauge({ turns: 2, contextTokens: 300000, baselineTokens: null, model: 'claude-opus-4-8' });
  assert.strictEqual(g.growthTokens, 0);
  assert.strictEqual(g.overRollover, false);
  assert.strictEqual(g.contextMeasured, true);
});

test('with a confirmed 1M-window plan, growth rolls over at the 350K floor instead of 150K', () => {
  const base = 252000;
  const g = computeGauge({ turns: 2, contextTokens: base + 200000, baselineTokens: base, model: 'claude-opus-4-8', planWindowCap: 1000000 });
  assert.strictEqual(g.rolloverTokens, ABSOLUTE_ROLLOVER_TOKENS); // 350K
  assert.strictEqual(g.overRollover, false);      // 200K growth < 350K
  assert.ok(g.gaugePct < 60);                     // 200/350 ~ 57%
  assert.strictEqual(g.overWindowEstimate, false); // 452K < 1M
});

test('gauge is the WORST-OF the three terms', () => {
  const base = 10000;
  const g = computeGauge({ turns: 38, spanHours: 0, contextTokens: base, baselineTokens: base, model: 'claude-opus-4-8' });
  assert.strictEqual(g.gaugePct, 95); // messages 38/40 dominate zero growth
  assert.strictEqual(g.driver, 'messages');
});

test('UNMEASURED context (null) is dropped, not coerced to 0 — falls back to messages/time', () => {
  const g = computeGauge({ turns: 20, spanHours: 3, contextTokens: null, model: 'claude-opus-4-8' });
  assert.strictEqual(g.contextMeasured, false);
  assert.strictEqual(g.pctContext, null);
  assert.strictEqual(g.pctOfWindow, null);
  assert.strictEqual(g.growthTokens, null);
  assert.strictEqual(g.overRollover, false);
  assert.strictEqual(g.gaugePct, 50); // max(20/40, 3/6)
});

test('garbage/negative context tokens never become a real reading (treated as unmeasured)', () => {
  for (const bad of [-1, NaN, Infinity, '100000', {}]) {
    const g = computeGauge({ turns: 1, contextTokens: bad, baselineTokens: 100000, model: 'claude-opus-4-8' });
    assert.strictEqual(g.contextMeasured, false, String(bad));
  }
});
