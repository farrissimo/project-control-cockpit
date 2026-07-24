// Lifecycle tests for the ONE persistent warm claude worker (ADR-0020 T3). Drives the state machine
// with a FAKE child process so it proves the real process-LAUNCH COUNT and every reuse / restart /
// stop / crash / idle transition — no Electron, no real `claude`, zero plan usage. This is the test
// the directive demands: "prove process counts and lifecycle behavior rather than merely mocking
// responses" and "Test process-launch counts explicitly. Do not infer reuse merely from matching
// session IDs."
const { test } = require('node:test');
const assert = require('node:assert');
const { createPersistentWorker, identityKey } = require('../../persistent-worker.js');

function makeFakeChild(pid) {
  const L = { data: [], close: [], error: [], sdata: [] };
  const child = {
    pid, writes: [], ended: false, killed: false,
    stdout: { on(ev, cb) { if (ev === 'data') L.data.push(cb); } },
    stderr: { on(ev, cb) { if (ev === 'data') L.sdata.push(cb); } },
    on(ev, cb) { if (ev === 'close') L.close.push(cb); else if (ev === 'error') L.error.push(cb); return child; },
    _emitData(s) { for (const cb of L.data) cb(Buffer.from(s)); },
    _emitStderr(s) { for (const cb of L.sdata) cb(Buffer.from(s)); },
    _emitClose(code) { for (const cb of L.close) cb(code); },
    _emitError(e) { for (const cb of L.error) cb(e); },
  };
  child.stdin = { write(s) { child.writes.push(s); }, end() { child.ended = true; } };
  return child;
}

function harness() {
  const spawned = [], kills = [], opened = [], closed = [];
  let pidSeq = 100;
  const worker = createPersistentWorker({
    kill: (c) => { c.killed = true; kills.push(c); },
    onSpawn: (c) => opened.push(c),
    onClose: (c) => closed.push(c),
  });
  const thunk = () => { const c = makeFakeChild(pidSeq++); spawned.push(c); return c; };
  return { worker, spawned, kills, opened, closed, thunk };
}

function resultLine(obj) {
  return JSON.stringify(Object.assign(
    { type: 'result', subtype: 'success', is_error: false, result: 'ok', num_turns: 1, usage: { input_tokens: 1 } }, obj)) + '\n';
}
const tick = () => new Promise((r) => setImmediate(r));
function idFor(over) {
  return Object.assign({ cwd: '/p', chatId: 'A', sessionId: 'sA', model: 'm', fallback: 'f', isBuild: false, channelPrompt: 'cp' }, over);
}
// Complete the in-flight turn on the active child with a result line.
async function complete(h, promise, obj) {
  const c = h.worker.activeChild();
  c._emitData(resultLine(obj));
  return promise;
}

test('AC1/AC4: two — then three — text sends in one unchanged chat launch EXACTLY ONE process', async () => {
  const h = harness();
  const id = idFor();
  const o1 = await complete(h, h.worker.runTextTurn(id, h.thunk, 'm1'), { result: 'ONE' });
  const c1 = h.worker.activeChild();
  const o2 = await complete(h, h.worker.runTextTurn(id, h.thunk, 'm2'), { result: 'TWO' });
  const o3 = await complete(h, h.worker.runTextTurn(id, h.thunk, 'm3'), { result: 'THREE' });
  assert.equal(o1.kind, 'result'); assert.equal(o2.kind, 'result'); assert.equal(o3.kind, 'result');
  assert.equal(h.worker.launchCount(), 1, 'must be ONE real process across three sends');
  assert.equal(h.spawned.length, 1, 'thunk spawned exactly one child');
  assert.equal(h.worker.activeChild(), c1, 'the same live process is reused');
  assert.equal(c1.writes.length, 3, 'three user messages written to the SAME stdin');
});

test('AC1: each send receives its OWN result (1:1 correlation)', async () => {
  const h = harness();
  const id = idFor();
  const o1 = await complete(h, h.worker.runTextTurn(id, h.thunk, 'm1'), { result: 'ONE' });
  const o2 = await complete(h, h.worker.runTextTurn(id, h.thunk, 'm2'), { result: 'TWO' });
  assert.match(o1.jsonText, /ONE/); assert.match(o2.jsonText, /TWO/);
});

test('AC2/AC19: after a result the worker stays alive and IDLE — no model work, no extra resolve', async () => {
  const h = harness();
  const p = h.worker.runTextTurn(idFor(), h.thunk, 'm1');
  const c = h.worker.activeChild();
  let resolves = 0; p.then(() => { resolves += 1; });
  c._emitData(resultLine({ result: 'ONE' }));
  await tick();
  assert.equal(resolves, 1, 'exactly one resolution for one send');
  assert.equal(h.worker.isAlive(), true, 'process idle and alive after the result');
  // A second, UNSOLICITED result line must NOT resolve anything (no pending turn) — no fabricated send.
  c._emitData(resultLine({ result: 'GHOST' }));
  await tick();
  assert.equal(resolves, 1, 'no phantom extra resolution between sends');
});

test('AC3: chat change terminates the old process and starts exactly one new one', async () => {
  const h = harness();
  await complete(h, h.worker.runTextTurn(idFor({ chatId: 'A' }), h.thunk, 'm1'), {});
  const first = h.worker.activeChild();
  const p2 = h.worker.runTextTurn(idFor({ chatId: 'B' }), h.thunk, 'm2');
  assert.equal(first.killed, true, 'old chat worker killed before the new one runs');
  assert.notEqual(h.worker.activeChild(), first, 'a new process serves the new chat');
  assert.equal(h.spawned.length, 2); assert.equal(h.worker.launchCount(), 2);
  await complete(h, p2, {});
  assert.equal(h.kills.length, 1, 'never two workers alive: exactly one teardown');
});

test('AC3: project / model / authority changes each force a deliberate restart', async () => {
  for (const change of [{ cwd: '/other' }, { model: 'other' }, { fallback: 'other' }, { isBuild: true }]) {
    const h = harness();
    await complete(h, h.worker.runTextTurn(idFor(), h.thunk, 'm1'), {});
    const first = h.worker.activeChild();
    const p2 = h.worker.runTextTurn(idFor(change), h.thunk, 'm2');
    assert.equal(first.killed, true, 'change ' + JSON.stringify(change) + ' must kill the old worker');
    assert.equal(h.worker.launchCount(), 2, 'change ' + JSON.stringify(change) + ' must launch a new worker');
    await complete(h, p2, {});
  }
});

test('AC4/AC6: shutdown() (attachment fallback / app exit / project switch) kills the worker; next text send relaunches', async () => {
  const h = harness();
  await complete(h, h.worker.runTextTurn(idFor(), h.thunk, 'm1'), {});
  const first = h.worker.activeChild();
  h.worker.shutdown();
  assert.equal(first.killed, true, 'shutdown kills the live process');
  assert.equal(h.worker.isAlive(), false);
  assert.equal(h.closed.length, 1, 'onClose fired so activeWorkers would drop it');
  // The next text turn resumes through a NEW persistent worker.
  await complete(h, h.worker.runTextTurn(idFor(), h.thunk, 'm2'), {});
  assert.equal(h.worker.launchCount(), 2, 'relaunched after shutdown');
});

test('AC5: Stop kills the process, resolves the turn as stopped, and ignores late output — no auto-restart', async () => {
  const h = harness();
  const p = h.worker.runTextTurn(idFor(), h.thunk, 'm1');
  const c = h.worker.activeChild();
  const stopped = h.worker.stopCurrent();
  const o = await p;
  assert.equal(stopped, true);
  assert.equal(o.kind, 'stopped');
  assert.equal(c.killed, true, 'Stop kills the process');
  assert.equal(h.worker.isAlive(), false, 'no worker survives a Stop');
  // Late output from the killed process must be ignored (no throw, no phantom resolve, no relaunch).
  c._emitData(resultLine({ result: 'LATE' }));
  await tick();
  assert.equal(h.worker.launchCount(), 1, 'Stop performs no automatic restart');
});

test('AC7: a crash (non-zero close) mid-turn yields ONE failure and NO automatic retry', async () => {
  const h = harness();
  const p = h.worker.runTextTurn(idFor(), h.thunk, 'm1');
  const c = h.worker.activeChild();
  c._emitStderr('boom');
  c._emitClose(1);
  const o = await p;
  assert.equal(o.kind, 'closed');
  assert.equal(o.code, 1);
  assert.match(o.err, /boom/, 'stderr is surfaced for honest classification');
  assert.equal(h.worker.isAlive(), false, 'the dead worker is marked dead');
  assert.equal(h.worker.launchCount(), 1, 'no automatic respawn / resend after a crash');
});

test('AC-honesty: malformed / non-result stream output can NEVER be attributed as a completed turn', async () => {
  const h = harness();
  const p = h.worker.runTextTurn(idFor(), h.thunk, 'm1');
  const c = h.worker.activeChild();
  let done = false; p.then(() => { done = true; });
  c._emitData('not json at all\n');
  c._emitData(JSON.stringify({ type: 'assistant', message: 'partial' }) + '\n');
  c._emitData(JSON.stringify({ type: 'system', subtype: 'init' }) + '\n');
  await tick();
  assert.equal(done, false, 'no non-result line may resolve the turn as success');
  // Only a real result event completes it.
  c._emitData(resultLine({ result: 'REAL' }));
  const o = await p;
  assert.equal(o.kind, 'result');
});

test('AC20: the worker never writes to stdin without an explicit runTextTurn (no hidden auto-send)', async () => {
  const h = harness();
  await complete(h, h.worker.runTextTurn(idFor(), h.thunk, 'only-message'), {});
  const c = h.worker.activeChild();
  assert.deepEqual(c.writes, ['only-message\n'], 'exactly the one owner message was sent, nothing else');
});

test('AC-honesty: a result blob delivered WITHOUT a trailing newline is handed to main (out) on close, not lost', async () => {
  // A one-shot json blob (e.g. a fixture, or a max-turns/budget envelope) may arrive without a trailing
  // newline, so it is never a complete "line". The module must still surface the full stdout to main via
  // the closed outcome so main can parse it — otherwise a real max-turns/budget result would be misread
  // as a bare crash (the boundary.spec regression this fixes).
  const h = harness();
  const p = h.worker.runTextTurn(idFor(), h.thunk, 'm1');
  const c = h.worker.activeChild();
  const blob = JSON.stringify({ type: 'result', subtype: 'error_max_turns', is_error: true, num_turns: 2 });
  c._emitData(blob);   // NO trailing newline
  c._emitClose(1);
  const o = await p;
  assert.equal(o.kind, 'closed');
  assert.equal(o.out, blob, 'the full accumulated stdout is handed to main to parse on close');
  assert.equal(o.code, 1);
});

test('identityKey: stable for identical inputs, distinct when any contract field changes', () => {
  const base = idFor();
  assert.equal(identityKey(base), identityKey(idFor()), 'same inputs => same key (reuse)');
  for (const change of [{ cwd: 'x' }, { chatId: 'x' }, { sessionId: 'x' }, { model: 'x' }, { fallback: 'x' }, { isBuild: true }, { channelPrompt: 'x' }]) {
    assert.notEqual(identityKey(base), identityKey(idFor(change)), 'changing ' + Object.keys(change)[0] + ' must change the key');
  }
});
