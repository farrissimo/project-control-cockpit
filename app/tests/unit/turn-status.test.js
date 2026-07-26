// turn-status unit tests (ADR-0018 ext / Task 2.2). Adversarial: tries to make the live limiter line
// LIE — dress a stale/unknown reading as live, fabricate a number, or reintroduce a dollar stopper
// (forbidden by ADR-0022). Pure; no DOM/electron.
const { test } = require('node:test');
const assert = require('node:assert');
const { liveLimiterLine, DEFAULT_HOLD_PCT } = require('../../renderer/turn-status.js');

const FRESH = { available: true, sessionPercent: 62, weeklyPercent: 30, ageMs: 1000, stale: false };

test('fresh reading below the hold names the real 5-hour usage as the nearest stop', () => {
  const r = liveLimiterLine(FRESH, 90);
  assert.strictEqual(r.kind, 'usage');
  assert.match(r.text, /5-hour Claude usage/);
  assert.match(r.text, /62%/);
  assert.match(r.text, /90%/);
});

test('fresh reading AT/OVER the hold says it is at the stop, not below it', () => {
  assert.strictEqual(liveLimiterLine({ ...FRESH, sessionPercent: 90 }, 90).kind, 'usage');
  assert.match(liveLimiterLine({ ...FRESH, sessionPercent: 90 }, 90).text, /at the 90% stop/);
  assert.match(liveLimiterLine({ ...FRESH, sessionPercent: 97 }, 90).text, /at the 90% stop/);
});

test('a STALE reading is shown but honestly flagged too old — never dressed as live', () => {
  const r = liveLimiterLine({ ...FRESH, stale: true, sessionPercent: 55 }, 90);
  assert.strictEqual(r.kind, 'stale');
  assert.match(r.text, /~55%/);
  assert.match(r.text, /too old to trust as live/);
});

test('unavailable / null / missing-percent readings degrade to an honest "unknown", never a fake 0%', () => {
  for (const bad of [null, undefined, {}, { available: false, sessionPercent: 40 }, { available: true }, { available: true, sessionPercent: 'x' }, { available: true, sessionPercent: NaN }]) {
    const r = liveLimiterLine(bad, 90);
    assert.strictEqual(r.kind, 'unknown', 'expected unknown for ' + JSON.stringify(bad));
    assert.match(r.text, /unknown/);
    assert.match(r.text, /never guesses/);
    assert.doesNotMatch(r.text, /\b0%/); // must not fabricate a 0%
  }
});

test('ADR-0022: no output ever presents a dollar figure as a live stopper', () => {
  for (const reading of [FRESH, { ...FRESH, sessionPercent: 95 }, { ...FRESH, stale: true }, null, { available: false }]) {
    assert.doesNotMatch(liveLimiterLine(reading, 90).text, /\$/);
  }
});

test('the hold threshold is configurable and defaults to 90', () => {
  assert.strictEqual(DEFAULT_HOLD_PCT, 90);
  assert.match(liveLimiterLine(FRESH, 90).text, /90% limit/);
  // A custom hold moves the boundary: 62% is over an 60% hold.
  assert.match(liveLimiterLine({ ...FRESH, sessionPercent: 62 }, 60).text, /at the 60% stop/);
  // A garbage hold falls back to the 90 default rather than throwing.
  assert.match(liveLimiterLine(FRESH, 'nope').text, /90% limit/);
});

test('0% is a REAL fresh reading (usage), not treated as unknown', () => {
  const r = liveLimiterLine({ ...FRESH, sessionPercent: 0 }, 90);
  assert.strictEqual(r.kind, 'usage');
  assert.match(r.text, /0% of the 90% limit/);
});
