// ADR-0020 T9: a FAILED turn (budget / max-turns / usage-limit / error) still spent tokens, so it must
// land in the usage ledger — "no invisible burn" can't have a hole on the failure paths. This pins two
// things: (1) the specific attachment parser bug that silently dropped attachment-failure usage, and
// (2) that askClaude's cold-path failure branches actually attribute via logFailUsage (a source guard,
// mirroring spawn-sites.test.js). Pure node:test — no Electron, no real data.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { usageFrom, usageFromJson } = require('../../usage-log.js');
const { parseStreamUsage } = require('../../stream-json.js');

// A real attachment/image turn's output is MULTI-LINE stream-json (system + assistant + result events).
const STREAM_JSON_WITH_USAGE = [
  '{"type":"system","subtype":"init"}',
  '{"type":"assistant","message":{"content":[{"type":"text","text":"hi"}]}}',
  '{"type":"result","subtype":"success","is_error":false,"result":"hi","num_turns":3,"usage":{"input_tokens":200,"cache_creation_input_tokens":0,"cache_read_input_tokens":10,"output_tokens":50}}',
].join('\n');

test('THE BUG: usageFromJson drops usage from multi-line stream-json; parseStreamUsage recovers it', () => {
  // The old attachment failure path called usageFromJson(out) on stream-json output. JSON.parse of a
  // MULTI-line blob throws, so it returned null -> the attachment turn's real spend went UNLOGGED.
  assert.strictEqual(usageFromJson(STREAM_JSON_WITH_USAGE), null);
  // The fix parses the stream-json result event instead, so the real tokens are recovered.
  const u = usageFrom(parseStreamUsage(STREAM_JSON_WITH_USAGE));
  assert.ok(u, 'usage must be recovered from the stream-json result event');
  assert.strictEqual(u.promptTokens, 210); // 200 input + 0 cache_create + 10 cache_read
  assert.strictEqual(u.output, 50);
  assert.strictEqual(u.totalTokens, 260);
});

test('the non-attachment (json) path still extracts usage from a single --output-format json blob', () => {
  const jsonBlob = '{"type":"result","subtype":"success","is_error":false,"result":"x","usage":{"input_tokens":100,"output_tokens":20}}';
  const u = usageFromJson(jsonBlob);
  assert.ok(u);
  assert.strictEqual(u.promptTokens, 100);
  assert.strictEqual(u.output, 20);
});

// Source guard (like spawn-sites.test.js): the cold-path FAILURE branches in askClaude must attribute
// spend, so a future edit cannot silently reopen an unlogged-burn hole. Comments are stripped so the
// guard reads real code, not documentation that quotes the pattern.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}
const MAIN = stripComments(fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8'));

test('askClaude defines a shape-correct failure-usage parser (stream-json for attachments, json otherwise)', () => {
  assert.ok(/const failUsage = hasAttach \? usageLog\.usageFrom\(parseStreamUsage\(out\)\) : usageLog\.usageFromJson\(out\)/.test(MAIN),
    'the cold failure path must pick the parser by hasAttach (parseStreamUsage for attachments)');
});

test('every classified cold-path failure branch attributes usage via logFailUsage', () => {
  for (const trigger of ['chat-turn-budget', 'chat-turn-max-turns', 'chat-turn-error']) {
    assert.ok(new RegExp("logFailUsage\\('" + trigger + "'").test(MAIN),
      'a failure branch must attribute usage under trigger ' + trigger + ' (unlogged-burn guard)');
  }
});
