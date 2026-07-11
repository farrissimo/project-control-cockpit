// Unit tests for app/state/mutex.js (Part 7 hardening I3, concurrency half).
// Runner: node:test — pure, in-memory, no IO/Electron. Proves the serial mutex
// actually prevents the lost-update race it exists to close, using a deterministic
// read-yield-write critical section (the same shape as lifecycle-state.json's two
// writers reading, doing work, then writing the whole object).

const { test } = require('node:test');
const assert = require('node:assert');
const { createMutex, runExclusiveBound } = require('../../state/mutex');

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

// runExclusiveBound — GPT secondary-verification #4 defect: serializing the two
// lifecycle handlers introduced a delay before they read the switchable global
// `projectDir`, so a queued op could mutate whatever project became active during
// its wait. This reproduces the exact sequence: op captured for Project A, waits
// behind a held section, active switches to B, section opens -> must FAIL CLOSED
// (project_changed) and touch NEITHER project.
test('runExclusiveBound: a queued op fails closed if the active project changed while it waited', async () => {
  const m = createMutex();
  let active = 'A';
  const touched = [];

  // Occupy the mutex so the guarded op below has to queue behind it.
  let releaseHold;
  const hold = m.runExclusive(() => new Promise((r) => { releaseHold = r; }));
  await yield_(); // let the held section actually start (mutex runs it on a microtask)

  // Requested while A is active; binds to A. fn would record which project it ran on.
  const op = runExclusiveBound(m, () => active,
    (requested) => { touched.push(requested); return { ok: true, ran: requested }; },
    () => ({ ok: false, reason: 'project_changed' }));

  // Owner switches to B while the op is still queued, then the holder releases.
  active = 'B';
  releaseHold();
  await hold;
  const res = await op;

  assert.deepStrictEqual(res, { ok: false, reason: 'project_changed' });
  assert.deepStrictEqual(touched, []); // fn never ran -> neither A nor B was mutated
});

test('runExclusiveBound: runs against the captured context when the project is unchanged', async () => {
  const m = createMutex();
  const active = 'A';
  const res = await runExclusiveBound(m, () => active,
    (requested) => ({ ok: true, ran: requested }),
    () => ({ ok: false, reason: 'project_changed' }));
  assert.deepStrictEqual(res, { ok: true, ran: 'A' });
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
