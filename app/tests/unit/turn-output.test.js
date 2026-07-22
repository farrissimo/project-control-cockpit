// Parses Claude Code's --output-format json envelope. Pins: never fabricates a cost/text from
// non-JSON or malformed input (always null, so the caller's plain-text fallback stays honest);
// extracts the REAL total_cost_usd verified live 2026-07-20; recognizes a budget-cap abort by its
// structured subtype, not by matching prose (which differs between output formats).
const { test } = require('node:test');
const assert = require('node:assert');
const { parseTurnOutput } = require('../../turn-output.js');

test('a real success envelope (verified live shape) yields text + cost', () => {
  const raw = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', total_cost_usd: 0.030456, session_id: 'x' });
  assert.deepStrictEqual(parseTurnOutput(raw), { text: 'ok', costUsd: 0.030456, isError: false, budgetExceeded: false, contextTokens: null });
});

test('a real budget-exceeded envelope is recognized by subtype, not by matching prose', () => {
  const raw = JSON.stringify({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, total_cost_usd: 0.0307, errors: ['Reached maximum budget ($0.0001)'] });
  const r = parseTurnOutput(raw);
  assert.strictEqual(r.budgetExceeded, true);
  assert.strictEqual(r.isError, true);
  assert.strictEqual(r.text, null); // no `result` field on this abort shape — never fabricated
});

test('plain text (the fakebin worker, or any non-JSON stdout) -> everything null, never fabricated', () => {
  assert.deepStrictEqual(parseTurnOutput('FAKE-CLAUDE-REPLY: received 12 chars.'), { text: null, costUsd: null, isError: null, budgetExceeded: false, contextTokens: null });
});

test('empty string, malformed JSON, and non-object JSON all degrade to the same safe null shape', () => {
  for (const raw of ['', '{not json', '[1,2,3]', '"just a string"', '42', 'null']) {
    assert.deepStrictEqual(parseTurnOutput(raw), { text: null, costUsd: null, isError: null, budgetExceeded: false, contextTokens: null }, JSON.stringify(raw));
  }
});

// --- context-token extraction (ADR-0019): the CURRENT prompt size, not a running sum ---

test('contextTokens = input + cache_read + cache_creation (the full current prompt size)', () => {
  const raw = JSON.stringify({ result: 'ok', total_cost_usd: 0.01, usage: { input_tokens: 1000, cache_read_input_tokens: 5000, cache_creation_input_tokens: 200, output_tokens: 42 } });
  assert.strictEqual(parseTurnOutput(raw).contextTokens, 6200); // output_tokens is NOT context, excluded
});

test('contextTokens with only input_tokens present = input_tokens (missing cache fields treated as 0)', () => {
  assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok', usage: { input_tokens: 1234 } })).contextTokens, 1234);
});

test('no usage block, or usage without a usable input_tokens, yields null — never a fabricated 0', () => {
  assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok' })).contextTokens, null);
  assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok', usage: {} })).contextTokens, null);
  assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok', usage: 'nope' })).contextTokens, null);
});

test('a negative or non-finite input_tokens is rejected (null), never trusted as a real context size', () => {
  for (const bad of [-1, NaN, Infinity, -Infinity, '5000']) {
    assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok', usage: { input_tokens: bad } })).contextTokens, null, String(bad));
  }
});

test('a negative or non-finite total_cost_usd is rejected, never trusted as a real cost', () => {
  for (const bad of [-1, NaN, Infinity, -Infinity]) {
    const raw = JSON.stringify({ result: 'ok', total_cost_usd: bad });
    assert.strictEqual(parseTurnOutput(raw).costUsd, null, String(bad));
  }
});

test('total_cost_usd of exactly 0 is a valid real cost (a trivial/cached turn), not rejected', () => {
  assert.strictEqual(parseTurnOutput(JSON.stringify({ result: 'ok', total_cost_usd: 0 })).costUsd, 0);
});

test('result present but non-string, or total_cost_usd non-numeric, is dropped field-by-field, not the whole object', () => {
  const r = parseTurnOutput(JSON.stringify({ result: 123, total_cost_usd: '5' }));
  assert.strictEqual(r.text, null);
  assert.strictEqual(r.costUsd, null);
});
