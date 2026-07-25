// Automatic usage protection decision (ADR-0020 T4). Pins the bounded contract: warn at fresh
// fh>=70, INTERCEPT at fresh fh>=90, and FAIL HONEST — a stale or unavailable reading never holds.
const { test } = require('node:test');
const assert = require('node:assert');
const { usageProtectionAction, WARN_PCT, HOLD_PCT } = require('../../renderer/usage-protection.js');

const fresh = (pct) => ({ available: true, stale: false, sessionPercent: pct, weeklyPercent: 10, ageMs: 1000 });

test('thresholds are the established 5-hour severity numbers (70 / 90)', () => {
  assert.strictEqual(WARN_PCT, 70);
  assert.strictEqual(HOLD_PCT, 90);
});

test('fresh reading: <70 none, 70-89 warn, >=90 hold (boundaries exact)', () => {
  assert.strictEqual(usageProtectionAction(fresh(0)), 'none');
  assert.strictEqual(usageProtectionAction(fresh(69)), 'none');
  assert.strictEqual(usageProtectionAction(fresh(70)), 'warn');   // boundary: warn starts at 70
  assert.strictEqual(usageProtectionAction(fresh(89)), 'warn');
  assert.strictEqual(usageProtectionAction(fresh(90)), 'hold');   // boundary: hold starts at 90
  assert.strictEqual(usageProtectionAction(fresh(100)), 'hold');
});

test('FAIL HONEST: a STALE reading never holds, even at 100%', () => {
  assert.strictEqual(usageProtectionAction({ available: true, stale: true, sessionPercent: 100 }), 'none');
});

test('FAIL HONEST: an UNAVAILABLE reading never holds', () => {
  assert.strictEqual(usageProtectionAction({ available: false, reason: 'no_file' }), 'none');
  assert.strictEqual(usageProtectionAction(null), 'none');
  assert.strictEqual(usageProtectionAction(undefined), 'none');
});

test('a non-numeric / out-of-shape percent never holds', () => {
  assert.strictEqual(usageProtectionAction({ available: true, stale: false, sessionPercent: NaN }), 'none');
  assert.strictEqual(usageProtectionAction({ available: true, stale: false, sessionPercent: '95' }), 'none');
  assert.strictEqual(usageProtectionAction({ available: true, stale: false }), 'none');
});
