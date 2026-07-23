// Pure-logic tests for the token-usage diagnostic (app/usage-log.js). The writer (logCall) is
// best-effort I/O; these pin the extraction that turns a worker's JSON into honest token counts —
// LLM-agnostic (raw tokens), and never a fabricated zero for a call that reported no usage.
const test = require('node:test');
const assert = require('node:assert');
const { usageFrom, usageFromJson, turnsFromJson, reconcile, KNOWN_TRIGGERS } = require('../../usage-log');

test('usageFrom sums input + both cache fields into promptTokens, adds output for total', () => {
  const u = usageFrom({ input_tokens: 3, cache_creation_input_tokens: 17037, cache_read_input_tokens: 7391, output_tokens: 74 });
  assert.strictEqual(u.promptTokens, 3 + 17037 + 7391);
  assert.strictEqual(u.totalTokens, 3 + 17037 + 7391 + 74);
  assert.strictEqual(u.cacheCreate, 17037);
  assert.strictEqual(u.cacheRead, 7391);
});

test('missing/partial cache fields are treated as 0, never NaN', () => {
  const u = usageFrom({ input_tokens: 100, output_tokens: 20 });
  assert.strictEqual(u.promptTokens, 100);
  assert.strictEqual(u.totalTokens, 120);
});

test('negative / non-finite / wrong-type token values are dropped to 0, never trusted', () => {
  const u = usageFrom({ input_tokens: -5, cache_read_input_tokens: 'x', cache_creation_input_tokens: Infinity, output_tokens: 10 });
  assert.strictEqual(u.promptTokens, 0);
  assert.strictEqual(u.totalTokens, 10);
});

test('no usage object, or an all-zero call, yields null — never a fabricated "free" record', () => {
  assert.strictEqual(usageFrom(null), null);
  assert.strictEqual(usageFrom({}), null);
  assert.strictEqual(usageFrom({ input_tokens: 0, output_tokens: 0 }), null);
});

test('usageFromJson extracts usage from a real --output-format json blob', () => {
  const raw = JSON.stringify({ type: 'result', result: 'OK', total_cost_usd: 0.09, usage: { input_tokens: 2, cache_creation_input_tokens: 24428, cache_read_input_tokens: 0, output_tokens: 64 } });
  const u = usageFromJson(raw);
  assert.strictEqual(u.promptTokens, 2 + 24428);
  assert.strictEqual(u.output, 64);
});

test('usageFromJson returns null on non-JSON (the test fakebin\'s plain text) — never throws', () => {
  assert.strictEqual(usageFromJson('just plain text\n'), null);
  assert.strictEqual(usageFromJson(''), null);
});

// ADR-0020 Step 1 (T9 spine): surface the agentic-turn count per call — how far one message fanned out.
test('turnsFromJson reads a real num_turns; absent/non-JSON/negative -> null, never a fabricated count', () => {
  assert.strictEqual(turnsFromJson(JSON.stringify({ type: 'result', num_turns: 7, usage: {} })), 7);
  assert.strictEqual(turnsFromJson(JSON.stringify({ type: 'result', num_turns: 0 })), 0); // a real zero is kept
  assert.strictEqual(turnsFromJson(JSON.stringify({ type: 'result' })), null);            // absent -> null (not 0)
  assert.strictEqual(turnsFromJson(JSON.stringify({ num_turns: -3 })), null);             // negative dropped
  assert.strictEqual(turnsFromJson(JSON.stringify({ num_turns: 'x' })), null);            // wrong type dropped
  assert.strictEqual(turnsFromJson('plain text'), null);                                   // non-JSON, never throws
});

// ADR-0020 Step 1 (T9 spine): "no unattributed calls" is a checkable fact, not a claim.
test('reconcile classifies every record as known or unattributed against KNOWN_TRIGGERS', () => {
  const records = [
    { trigger: 'chat-turn' }, { trigger: 'chat-turn-attach' }, { trigger: 'summary' },
    { trigger: 'recall-expand' }, { trigger: 'recall-judge' }, { trigger: 'one-shot' },
    { trigger: 'mystery-call' }, { trigger: 'mystery-call' }, { trigger: '' }, {},
  ];
  const r = reconcile(records);
  assert.strictEqual(r.total, 10);
  assert.strictEqual(r.knownCount, 6);
  // the two unknown 'mystery-call' records are collapsed with a count; the empty/absent trigger is its own bucket
  const mystery = r.unattributed.find((u) => u.trigger === 'mystery-call');
  assert.strictEqual(mystery.count, 2);
  assert.strictEqual(r.unattributed.reduce((n, u) => n + u.count, 0), 4); // 2 mystery + 2 empty-trigger
});

test('reconcile: an all-known set reports zero unattributed; empty/garbage input is safe', () => {
  const clean = KNOWN_TRIGGERS.map((t) => ({ trigger: t }));
  assert.deepStrictEqual(reconcile(clean).unattributed, []);
  assert.strictEqual(reconcile(clean).knownCount, KNOWN_TRIGGERS.length);
  assert.deepStrictEqual(reconcile([]), { total: 0, knownCount: 0, unattributed: [] });
  assert.deepStrictEqual(reconcile(null), { total: 0, knownCount: 0, unattributed: [] });
});
