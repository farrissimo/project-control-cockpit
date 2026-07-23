// ADR-0020 Step 1 (T9 spine): directly exercise measure-usage.js's extraction path. The PCC measurement
// arm records num_turns per turn; this pins that extract() records a real non-negative count and coerces
// an absent / malformed / negative / nonnumeric value to null (never a fabricated number). By design the
// module is require-safe: requiring it runs NO real `claude` and writes NO owner evidence — the auto-run
// measurement is guarded behind `require.main === module`, and extract() is pure. Pure node:test.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Requiring the module must NOT spawn a worker or touch evidence (the require-safety guarantee).
const { extract } = require('../../tools/measure-usage.js');
// The evidence log the CLI path would write to — used below to prove extract() writes nothing.
const EVIDENCE_LOG = path.join(__dirname, '..', '..', '..', '.cockpit', 'evidence', 'usage-diagnostics.jsonl');

const blob = (over) => JSON.stringify(Object.assign({
  type: 'result', result: 'ok', is_error: false, total_cost_usd: 0.01, duration_ms: 1200,
  usage: { input_tokens: 5, cache_creation_input_tokens: 100, cache_read_input_tokens: 20, output_tokens: 8 },
}, over));

test('extract records a real non-negative num_turns from a valid result blob', () => {
  const m = extract(blob({ num_turns: 4 }));
  assert.strictEqual(m.numTurns, 4);
  assert.strictEqual(m.promptTokens, 5 + 100 + 20); // the rest of the extraction still holds
  assert.strictEqual(m.output, 8);
});

test('a real zero num_turns is kept as 0, not coerced away', () => {
  assert.strictEqual(extract(blob({ num_turns: 0 })).numTurns, 0);
});

test('absent / negative / nonnumeric / malformed num_turns all become null (never fabricated)', () => {
  assert.strictEqual(extract(blob({})).numTurns, null);              // absent
  assert.strictEqual(extract(blob({ num_turns: -2 })).numTurns, null); // negative
  assert.strictEqual(extract(blob({ num_turns: 'x' })).numTurns, null); // nonnumeric
  assert.strictEqual(extract(blob({ num_turns: NaN })).numTurns, null); // NaN via JSON -> null anyway
  assert.strictEqual(extract(blob({ num_turns: {} })).numTurns, null);  // wrong-type object
  assert.strictEqual(extract(blob({ num_turns: 3.5 })).numTurns, 3.5);  // finite non-negative kept as-is
});

test('a wholly malformed (non-JSON) body yields null — extract never throws', () => {
  assert.strictEqual(extract('not json at all'), null);
  assert.strictEqual(extract(''), null);
});

test('extract is pure: exercising it writes NO owner evidence and spawns nothing', () => {
  const before = fs.existsSync(EVIDENCE_LOG) ? fs.statSync(EVIDENCE_LOG).size : -1;
  for (let i = 0; i < 25; i++) { extract(blob({ num_turns: i })); extract('garbage'); }
  const after = fs.existsSync(EVIDENCE_LOG) ? fs.statSync(EVIDENCE_LOG).size : -1;
  assert.strictEqual(after, before, 'extract() must not append to the evidence log');
  assert.strictEqual(typeof extract, 'function'); // module required without running its CLI measurement
});
