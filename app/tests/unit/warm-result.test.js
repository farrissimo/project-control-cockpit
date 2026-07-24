// classifyResult (ADR-0020 T3, Task 2A) — pure per-turn result-envelope disposition. Proves Defect 3
// (every structured result maps to exactly one attribution trigger + deferred-rollover for capped turns)
// and Defect 4 (a structured is_error result, or a malformed/unknown shape, is NEVER success — it fails
// closed and terminates the worker). No I/O, no Electron, zero plan usage.
const { test } = require('node:test');
const assert = require('node:assert');
const { classifyResult } = require('../../warm-result.js');

const env = (o) => JSON.stringify(Object.assign({ type: 'result' }, o));

test('successful result -> kind success, trigger chat-turn, roll-over-now, never terminate', () => {
  const d = classifyResult(env({ subtype: 'success', is_error: false, result: 'hi', total_cost_usd: 0.01, num_turns: 1, usage: { input_tokens: 5, cache_read_input_tokens: 10, cache_creation_input_tokens: 2 } }));
  assert.equal(d.kind, 'success'); assert.equal(d.trigger, 'chat-turn');
  assert.equal(d.deferRollover, false); assert.equal(d.terminate, false);
  assert.equal(d.text, 'hi'); assert.equal(d.costUsd, 0.01); assert.equal(d.numTurns, 1); assert.equal(d.contextTokens, 17);
});

test('error_max_turns -> kind max_turns, trigger chat-turn-max-turns, deferred rollover, not terminate', () => {
  const d = classifyResult(env({ subtype: 'error_max_turns', is_error: true, num_turns: 3, total_cost_usd: 0.05, usage: { input_tokens: 3 } }));
  assert.equal(d.kind, 'max_turns'); assert.equal(d.trigger, 'chat-turn-max-turns');
  assert.equal(d.deferRollover, true); assert.equal(d.terminate, false);
  assert.equal(d.numTurns, 3); assert.equal(d.costUsd, 0.05);
});

test('error_max_budget_usd -> kind budget, trigger chat-turn-budget, deferred rollover, not terminate', () => {
  const d = classifyResult(env({ subtype: 'error_max_budget_usd', is_error: true, total_cost_usd: 0.5, usage: { input_tokens: 9 } }));
  assert.equal(d.kind, 'budget'); assert.equal(d.trigger, 'chat-turn-budget');
  assert.equal(d.deferRollover, true); assert.equal(d.terminate, false); assert.equal(d.costUsd, 0.5);
});

test('generic is_error:true (with a result string) is NEVER success — kind error, terminate, deferred', () => {
  const d = classifyResult(env({ subtype: 'error_during_execution', is_error: true, result: 'boom', total_cost_usd: 0.02, usage: { input_tokens: 4 } }));
  assert.equal(d.kind, 'error'); assert.equal(d.trigger, 'chat-turn-error');
  assert.equal(d.deferRollover, true); assert.equal(d.terminate, true);
  assert.equal(d.costUsd, 0.02); // real cost still attributed
});

test('unknown error subtype with is_error:true -> kind error (fail closed), not success', () => {
  const d = classifyResult(env({ subtype: 'error_something_new', is_error: true, result: 'x' }));
  assert.equal(d.kind, 'error'); assert.equal(d.terminate, true);
});

test('malformed / non-JSON -> kind malformed, terminate (fail closed), never ok; no usage/cost to lose', () => {
  const d = classifyResult('this is not json at all');
  assert.equal(d.kind, 'malformed'); assert.equal(d.terminate, true);
  assert.equal(d.text, null); assert.equal(d.costUsd, null); // non-JSON: nothing to attribute
  // Task 2A: even the malformed path is attributed + deferred so a JSON-but-unknown envelope is never dropped.
  assert.equal(d.trigger, 'chat-turn-error'); assert.equal(d.deferRollover, true);
});

test('result object with no text and no protective subtype (unknown shape) -> malformed, fail closed', () => {
  const d = classifyResult(env({ is_error: false })); // no result, no subtype
  assert.equal(d.kind, 'malformed'); assert.equal(d.terminate, true);
  assert.equal(d.trigger, 'chat-turn-error'); assert.equal(d.deferRollover, true);
});

test('Task 2A: a JSON-but-unknown-shape envelope carrying real usage/cost is ATTRIBUTED + deferred, not dropped', () => {
  // The exact gap Codex flagged: no `result` text, no error subtype, is_error absent, but a real usage +
  // total_cost_usd block. It must fail closed AND still attribute the spend (one trigger, deferred rollover).
  const d = classifyResult(env({ total_cost_usd: 0.07, num_turns: 4, usage: { input_tokens: 8, cache_read_input_tokens: 20 } }));
  assert.equal(d.kind, 'malformed');           // never ok:true
  assert.equal(d.terminate, true);             // fail closed
  assert.equal(d.trigger, 'chat-turn-error');  // usage will be logged exactly once (req 6)
  assert.equal(d.deferRollover, true);         // failed-turn cost deferred, not immediately rolled (req 7)
  assert.equal(d.costUsd, 0.07);               // real cost preserved, not fabricated/dropped
});

test('missing usage/cost is not fabricated (success with no usage/cost)', () => {
  const d = classifyResult(env({ subtype: 'success', is_error: false, result: 'ok' }));
  assert.equal(d.kind, 'success'); assert.equal(d.costUsd, null); assert.equal(d.contextTokens, null);
});

test('exactly one attribution trigger per envelope (or null for malformed)', () => {
  const triggers = ['success', 'error_max_turns', 'error_max_budget_usd'].map((st) =>
    classifyResult(env({ subtype: st, is_error: st !== 'success', result: 'r' })).trigger);
  assert.deepEqual(triggers, ['chat-turn', 'chat-turn-max-turns', 'chat-turn-budget']);
  // every non-null trigger is a KNOWN_TRIGGERS name (reconciliation guarantee)
  const { KNOWN_TRIGGERS } = require('../../usage-log.js');
  for (const t of triggers) assert.ok(KNOWN_TRIGGERS.includes(t), t + ' must be a known trigger');
  assert.ok(KNOWN_TRIGGERS.includes('chat-turn-error'));
});
