// Parses Claude Code's --output-format json envelope. Pins: never fabricates a cost/text from
// non-JSON or malformed input (always null, so the caller's plain-text fallback stays honest);
// extracts the REAL total_cost_usd verified live 2026-07-20; recognizes a budget-cap abort by its
// structured subtype, not by matching prose (which differs between output formats).
const { test } = require('node:test');
const assert = require('node:assert');
const { parseTurnOutput } = require('../../turn-output.js');

test('a real success envelope (verified live shape) yields text + cost', () => {
  const raw = JSON.stringify({ type: 'result', subtype: 'success', is_error: false, result: 'ok', total_cost_usd: 0.030456, session_id: 'x' });
  assert.deepStrictEqual(parseTurnOutput(raw), { text: 'ok', costUsd: 0.030456, isError: false, budgetExceeded: false });
});

test('a real budget-exceeded envelope is recognized by subtype, not by matching prose', () => {
  const raw = JSON.stringify({ type: 'result', subtype: 'error_max_budget_usd', is_error: true, total_cost_usd: 0.0307, errors: ['Reached maximum budget ($0.0001)'] });
  const r = parseTurnOutput(raw);
  assert.strictEqual(r.budgetExceeded, true);
  assert.strictEqual(r.isError, true);
  assert.strictEqual(r.text, null); // no `result` field on this abort shape — never fabricated
});

test('plain text (the fakebin worker, or any non-JSON stdout) -> everything null, never fabricated', () => {
  assert.deepStrictEqual(parseTurnOutput('FAKE-CLAUDE-REPLY: received 12 chars.'), { text: null, costUsd: null, isError: null, budgetExceeded: false });
});

test('empty string, malformed JSON, and non-object JSON all degrade to the same safe null shape', () => {
  for (const raw of ['', '{not json', '[1,2,3]', '"just a string"', '42', 'null']) {
    assert.deepStrictEqual(parseTurnOutput(raw), { text: null, costUsd: null, isError: null, budgetExceeded: false }, JSON.stringify(raw));
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
