// Unit tests for app/state/mutex.js (Part 7 hardening I3, concurrency half).
// Runner: node:test — pure, in-memory, no IO/Electron. Proves the serial mutex
// actually prevents the lost-update race it exists to close, using a deterministic
// read-yield-write critical section (the same shape as lifecycle-state.json's two
// writers reading, doing work, then writing the whole object).

const { test } = require('node:test');
const assert = require('node:assert');
const { createMutex } = require('../../state/mutex');

const yield_ = () => new Promise((r) => setImmediate(r));

// Read a shared value, yield (a window where another task can interleave), then
// write value+1. Concurrently and unserialized, updates are lost.
async function racyIncrement(shared) {
  const v = shared.n;
  await yield_();
  shared.n = v + 1;
}

// Baseline hazard: proves the race is real, so the "with mutex" test below is a
// genuine guard and not vacuously true. All 20 read n before any writes back.
test('WITHOUT the mutex, concurrent read-modify-write loses updates (baseline hazard)', async () => {
  const shared = { n: 0 };
  await Promise.all(Array.from({ length: 20 }, () => racyIncrement(shared)));
  assert.ok(shared.n < 20, `expected lost updates without serialization, got ${shared.n}`);
});

test('WITH runExclusive, the same critical sections serialize (no lost update)', async () => {
  const shared = { n: 0 };
  const m = createMutex();
  await Promise.all(Array.from({ length: 20 }, () => m.runExclusive(() => racyIncrement(shared))));
  assert.strictEqual(shared.n, 20);
});

test('runExclusive returns the section result and preserves FIFO order', async () => {
  const m = createMutex();
  const order = [];
  const results = await Promise.all([1, 2, 3].map((i) =>
    m.runExclusive(async () => { order.push(i); await yield_(); return i * 10; })));
  assert.deepStrictEqual(results, [10, 20, 30]);
  assert.deepStrictEqual(order, [1, 2, 3]);
});

test('a rejecting section propagates its error but does NOT wedge the queue', async () => {
  const m = createMutex();
  await assert.rejects(m.runExclusive(async () => { throw new Error('boom'); }), /boom/);
  const after = await m.runExclusive(async () => 'ok');
  assert.strictEqual(after, 'ok');
});

// The concrete lifecycle case: writer A changes field "phase_kind", writer B (a
// slower path, like the spawned advance) changes field "current_stage" from a stale
// read. Unserialized, B's whole-object write clobbers A. Serialized, both survive.
test('serializes the two lifecycle writers so neither field clobbers the other', async () => {
  const file = { current_stage: 'verify', phase_kind: 'executable' };
  const m = createMutex();
  // B: read whole object, do slow work, write whole object with a new stage.
  const advance = m.runExclusive(async () => {
    const snap = { ...file };
    await yield_(); await yield_();
    file.current_stage = 'work';
    file.phase_kind = snap.phase_kind; // whole-object write carries its stale read
  });
  // A: change phase_kind.
  const setKind = m.runExclusive(async () => {
    const snap = { ...file };
    snap.phase_kind = 'review';
    file.current_stage = snap.current_stage;
    file.phase_kind = snap.phase_kind;
  });
  await Promise.all([advance, setKind]);
  // Both mutations survived: advance moved the stage, setKind's phase_kind was not lost.
  assert.strictEqual(file.current_stage, 'work');
  assert.strictEqual(file.phase_kind, 'review');
});
