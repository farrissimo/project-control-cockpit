// Deterministic proof of the refresh-coalescing law (soak W3 / soak-lite.spec.js).
// Runner: node:test — pure, no Electron, no timers. Uses a MANUALLY-controlled
// deferred so "concurrent" and "after it settles" are exact, not timing-based.
const { test } = require('node:test');
const assert = require('node:assert');
const { singleFlight } = require('../../single-flight');

// A controlled async fn: counts invocations and hands back a promise we resolve/reject by hand.
function controlled() {
  let calls = 0;
  let resolveCurrent, rejectCurrent;
  const fn = () => {
    calls += 1;
    return new Promise((res, rej) => { resolveCurrent = res; rejectCurrent = rej; });
  };
  return { fn, calls: () => calls, resolve: (v) => resolveCurrent(v), reject: (e) => rejectCurrent(e) };
}

test('concurrent calls during one in-flight run invoke fn ONCE and share the batch', async () => {
  const c = controlled();
  const run = singleFlight(c.fn);
  const a = run(); const b = run(); const d = run(); // 3 concurrent callers
  assert.equal(c.calls(), 1, 'the underlying batch ran exactly once for 3 concurrent callers');
  assert.strictEqual(a, b, 'callers share the SAME promise');
  assert.strictEqual(b, d);
  assert.equal(run.pending(), true, 'a run is in flight');
  c.resolve({ ok: 1 });
  assert.deepEqual(await a, { ok: 1 });
  assert.deepEqual(await b, { ok: 1 }, 'every concurrent caller gets the shared result');
  assert.deepEqual(await d, { ok: 1 });
});

test('a call AFTER the run settles starts a FRESH batch (an explicit refresh is never stale)', async () => {
  const c = controlled();
  const run = singleFlight(c.fn);
  const first = run();
  c.resolve('v1');
  await first;
  assert.equal(run.pending(), false, 'no run in flight after it settled');
  const second = run(); // fresh click after completion
  assert.equal(c.calls(), 2, 'the second call re-ran the batch');
  assert.notStrictEqual(first, second, 'a fresh promise, not the stale one');
  c.resolve('v2');
  assert.equal(await second, 'v2');
});

test('a REJECTED run also clears in-flight, so the next refresh re-runs (no stuck state)', async () => {
  const c = controlled();
  const run = singleFlight(c.fn);
  const first = run();
  c.reject(new Error('detector blew up'));
  await assert.rejects(first, /detector blew up/);
  assert.equal(run.pending(), false, 'a failed run does not stick');
  const second = run();
  assert.equal(c.calls(), 2, 'the next call re-runs after a failure');
  c.resolve('recovered');
  assert.equal(await second, 'recovered');
});

test('a fn that THROWS SYNCHRONOUSLY yields a rejected promise (run never throws), and clears state', async () => {
  let calls = 0;
  const run = singleFlight(() => { calls += 1; throw new Error('sync boom'); });
  let p;
  assert.doesNotThrow(() => { p = run(); }, 'run() must not throw synchronously — it returns a promise');
  await assert.rejects(p, /sync boom/);
  assert.equal(run.pending(), false, 'a sync-throwing run does not wedge in-flight');
  await assert.rejects(run(), /sync boom/, 'the next call re-runs (no stuck state)');
  assert.equal(calls, 2);
});

test('singleFlight rejects a non-function up front (fail closed on misuse)', () => {
  assert.throws(() => singleFlight(null), /expects a function/);
  assert.throws(() => singleFlight(123), /expects a function/);
});
