// nearest-limit unit tests (ADR-0018 extension, Task 2.1). Proves the "Nearest stop" reconciler is
// honest: ranks each meter within its OWN scale, labels dollar caps as spend guards (not Claude-plan
// exhaustion), measures 5-hour usage against the HOLD point, excludes unknown meters, and never
// invents an answer when there is no data. Pure; no DOM/electron.
const { test } = require('node:test');
const assert = require('node:assert');
const { nearestStop, meters, USAGE_HOLD_PCT } = require('../../renderer/nearest-limit.js');

const FULL = { turns: 10, maxTurns: 40, turnUsd: 2, maxTurnUsd: 8, chatUsd: 8, maxChatUsd: 40, sessionPercent: 20 };

test('picks the meter closest to its own cap', () => {
  // turns 25/40=0.625 beats turn$ 2/8=0.25, chat$ 8/40=0.2, usage 20/90=0.22
  const r = nearestStop({ ...FULL, turns: 25 });
  assert.strictEqual(r.kind, 'turns');
  assert.strictEqual(r.label, 'per-message turn cap');
  assert.match(r.detail, /25\/40 turns/);
});

test('5-hour usage is measured against the HOLD point (90%), not 100%', () => {
  // usage 80/90 = 0.889 should beat turns 30/40 = 0.75
  const r = nearestStop({ ...FULL, turns: 30, sessionPercent: 80 });
  assert.strictEqual(r.kind, 'usage');
  assert.match(r.detail, /holds at 90%/);
  assert.strictEqual(USAGE_HOLD_PCT, 90);
});

test('ADR-0022: a demoted spend guard is NEVER the nearest stop, even at/above its cap', () => {
  // turn$ 7.9/8 = 0.9875 is the highest proximity of any meter, but spend guards no longer stop
  // approved work (phantom dollars), so nearestStop must skip it and pick a real stopper.
  const r = nearestStop({ ...FULL, turnUsd: 7.9, chatUsd: 39, turns: 4, sessionPercent: 5 });
  assert.notStrictEqual(r.kind, 'turn_usd');
  assert.notStrictEqual(r.kind, 'chat_usd');
  assert.strictEqual(r.isSpendGuard, false);
  // meters() STILL surfaces the spend guards for advisory display — only the STOP ranking excludes them.
  const ms = meters({ ...FULL, turnUsd: 7.9 });
  assert.ok(ms.some((m) => m.kind === 'turn_usd' && m.isSpendGuard === true), 'spend guards remain available as advisory');
});

test('ADR-0022: when ONLY spend data exists, there is no nearest stop (kind:none) — nothing can actually stop work', () => {
  const r = nearestStop({ turnUsd: 7.9, maxTurnUsd: 8, chatUsd: 39, maxChatUsd: 40 });
  assert.strictEqual(r.kind, 'none');
});

test('an unknown 5-hour reading is EXCLUDED, never inferred', () => {
  const ms = meters({ ...FULL, sessionPercent: null });
  assert.ok(!ms.some((m) => m.kind === 'usage'), 'usage meter must be absent when the reading is unknown');
  // ranking still works over the remaining known meters
  assert.notStrictEqual(nearestStop({ ...FULL, sessionPercent: null }).kind, 'usage');
});

test('no usable data yields kind:none, never a false nearest', () => {
  const r = nearestStop({});
  assert.strictEqual(r.kind, 'none');
  assert.strictEqual(r.label, null);
});

test('a missing/zero cap for one meter drops only that meter', () => {
  const ms = meters({ turns: 5, maxTurns: 0, turnUsd: 4, maxTurnUsd: 8 });
  assert.ok(!ms.some((m) => m.kind === 'turns'), 'a zero cap cannot be ranked (no divide-by-zero)');
  assert.ok(ms.some((m) => m.kind === 'turn_usd'));
});
