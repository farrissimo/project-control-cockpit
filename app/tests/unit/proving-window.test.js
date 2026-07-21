// ADR-0016's two-week trust proving window (2026-07-21 -> 2026-08-04). Pins the honest date math:
// real day counts from a real clock, correct boundaries, and "ended" only once genuinely past.
const { test } = require('node:test');
const assert = require('node:assert');
const { provingWindowStatus } = require('../../renderer/proving-window.js');

const DAY = 24 * 60 * 60 * 1000;
const START = Date.UTC(2026, 6, 21);

test('on the lock date itself, this is Day 1 with the full 14 days remaining', () => {
  const s = provingWindowStatus(START);
  assert.strictEqual(s.dayNumber, 1);
  assert.strictEqual(s.remainingDays, 14);
  assert.strictEqual(s.ended, false);
  assert.strictEqual(s.startDate, '2026-07-21');
  assert.strictEqual(s.endDate, '2026-08-04');
});

test('one day in, dayNumber is 2 and remaining drops to 13', () => {
  const s = provingWindowStatus(START + DAY);
  assert.strictEqual(s.dayNumber, 2);
  assert.strictEqual(s.remainingDays, 13);
});

test('exactly at the end (2026-08-04), the window has ended with 0 remaining', () => {
  const s = provingWindowStatus(START + 14 * DAY);
  assert.strictEqual(s.ended, true);
  assert.strictEqual(s.remainingDays, 0);
});

test('a moment before the end, not yet ended and remainingDays rounds up to at least 1', () => {
  const s = provingWindowStatus(START + 14 * DAY - 1000);
  assert.strictEqual(s.ended, false);
  assert.strictEqual(s.remainingDays, 1);
});

test('well past the end, stays honestly "ended" and never goes negative', () => {
  const s = provingWindowStatus(START + 30 * DAY);
  assert.strictEqual(s.ended, true);
  assert.strictEqual(s.remainingDays, 0);
  assert.strictEqual(s.dayNumber, 14); // never claims a day number beyond the window
});

test('a clock somehow before the lock date never reports a negative or zero day number', () => {
  const s = provingWindowStatus(START - 5 * DAY);
  assert.strictEqual(s.dayNumber, 1);
  assert.strictEqual(s.ended, false);
});

test('the bar text is present and matches the owner-locked wording', () => {
  assert.strictEqual(provingWindowStatus(START).bar,
    'PCC must be usable for one full week of regular use without shocking the owner in a serious way.');
});

test('no clock argument falls back to the real Date.now(), never throws', () => {
  const s = provingWindowStatus();
  assert.strictEqual(typeof s.dayNumber, 'number');
  assert.strictEqual(typeof s.ended, 'boolean');
});
