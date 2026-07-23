// Live Worker Feed slice 2 — incremental stream-json parser (ADR-0011 / docs/specs/owner-cockpit.md).
// The two guarantees this pins: (1) the final reply is BYTE-IDENTICAL to the shipped one-shot
// parseStreamJson for ANY chunk-splitting of the same stdout, and (2) no hidden reasoning ever
// leaks — plus the strengthened robustness list (partial chunks, malformed lines, tool/denial,
// crash mid-event, result fallback, no tool events). Pure logic under node:test.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { createStreamParser, parseAll, normalizeUsage } = require('../../stream-parser.js');
const { parseStreamJson, parseStreamTurns } = require('../../stream-json.js');

const REAL = fs.readFileSync(path.join(__dirname, '..', 'fixtures', 'real', 'claude-streamjson-success.txt'), 'utf8');

const L = (o) => JSON.stringify(o);
const asst = (content) => L({ type: 'assistant', message: { content } });
const usr = (content) => L({ type: 'user', message: { content } });
const txt = (t) => ({ type: 'text', text: t });
const think = (t) => ({ type: 'thinking', thinking: t, signature: 'SIG' });
const tool = (name, input) => ({ type: 'tool_use', id: 'u1', name, input });
const tres = (is_error, content) => ({ type: 'tool_result', tool_use_id: 'u1', is_error, content });
const rl = (info) => L({ type: 'rate_limit_event', rate_limit_info: info });

function runChunks(raw, size) {
  const p = createStreamParser();
  for (let i = 0; i < raw.length; i += size) p.push(raw.slice(i, i + size));
  p.finalize();
  return { text: p.getText(), events: p.getEvents() };
}

// --- byte-identical final reply (AC-16) ---
test('final reply is byte-identical to parseStreamJson on the REAL capture, for every chunk size', () => {
  const expected = parseStreamJson(REAL);
  assert.strictEqual(expected, 'PONG');
  for (const size of [REAL.length, 1, 3, 7, 29, 256]) {
    assert.strictEqual(runChunks(REAL, size).text, expected, 'chunk size ' + size);
  }
});

test('parseAll(raw).text equals parseStreamJson(raw)', () => {
  assert.strictEqual(parseAll(REAL).text, parseStreamJson(REAL));
});

// --- partial JSON split across flushes ---
test('a JSON object split across two flushes is not parsed until its newline arrives', () => {
  const line = asst([txt('HELLO')]);
  const p = createStreamParser();
  p.push(line.slice(0, 20));
  assert.strictEqual(p.getText(), '');          // incomplete line: nothing yet
  p.push(line.slice(20) + '\n');
  assert.strictEqual(p.getText(), 'HELLO');
});

// --- malformed lines are ignored ---
test('a malformed JSON line is ignored, not fatal', () => {
  const p = createStreamParser();
  p.push('this is not json\n');
  p.push(asst([txt('OK')]) + '\n');
  assert.strictEqual(p.getText(), 'OK');
});

// --- tool_use -> safe action events ---
test('tool_use blocks become read/edit/run events (with targets), returned from push', () => {
  const p = createStreamParser();
  const out = p.push(asst([
    tool('Read', { file_path: 'auth-flow.js' }),
    tool('Edit', { file_path: 'app-routes.js' }),
    tool('Bash', { command: 'npm test', description: 'run the tests' }),
  ]) + '\n');
  assert.deepStrictEqual(out.map((e) => e.kind), ['read', 'edit', 'run']);
  assert.strictEqual(out[0].file, 'auth-flow.js');
  assert.strictEqual(out[1].file, 'app-routes.js');
  assert.strictEqual(out[2].name, 'run the tests');
  assert.strictEqual(p.getText(), '');          // tool_use never adds to the reply text
});

test('an unknown tool is NOT invented into an event', () => {
  const p = createStreamParser();
  const out = p.push(asst([tool('WebSearch', { query: 'x' })]) + '\n');
  assert.strictEqual(out.length, 0);
});

// --- no hidden reasoning ---
test('thinking blocks never leak into the reply or become events', () => {
  const p = createStreamParser();
  const out = p.push(asst([think('secret private reasoning'), txt('VISIBLE')]) + '\n');
  assert.strictEqual(p.getText(), 'VISIBLE');
  assert.ok(!/secret|thinking|reasoning|SIG/i.test(p.getText()));
  assert.strictEqual(out.length, 0);
});

// --- tool/permission denial ---
test('a permission-denied tool_result is a "denied" event; a plain error is "error"', () => {
  const p = createStreamParser();
  assert.strictEqual(p.push(usr([tres(true, 'permission denied to edit that file')]) + '\n')[0].kind, 'denied');
  assert.strictEqual(p.push(usr([tres(true, 'boom, something broke')]) + '\n')[0].kind, 'error');
  assert.strictEqual(p.push(usr([tres(false, 'all good')]) + '\n').length, 0); // success => no event
});

// --- result fallback + assistant text wins (identity with reference) ---
test('falls back to the result string only when there is no assistant text', () => {
  const p = createStreamParser();
  p.push(L({ type: 'result', result: 'FROM_RESULT' }) + '\n');
  assert.strictEqual(p.getText(), 'FROM_RESULT');
});

test('mixed result + assistant text matches parseStreamJson exactly (assistant text wins)', () => {
  const raw = asst([txt('REAL_REPLY')]) + '\n' + L({ type: 'result', result: 'FALLBACK' }) + '\n';
  assert.strictEqual(parseAll(raw).text, parseStreamJson(raw));
  assert.strictEqual(parseAll(raw).text, 'REAL_REPLY');
});

// --- no tool events, and crash mid-event ---
test('a plain-text stream yields the reply and no events', () => {
  const raw = asst([txt('just ')]) + '\n' + asst([txt('talking')]) + '\n';
  const r = parseAll(raw);
  assert.strictEqual(r.text, 'just talking');
  assert.strictEqual(r.events.length, 0);
});

test('a crash mid-event (incomplete trailing line) is ignored; earlier reply survives', () => {
  const p = createStreamParser();
  p.push(asst([txt('DONE')]) + '\n');
  p.push('{"type":"assistant","message":{"content":[{"type":"te');  // cut off, no newline
  const f = p.finalize();                                            // must not throw
  assert.strictEqual(f.text, 'DONE');
});

// --- property: identity holds across many split points on a rich synthetic stream ---
test('byte-identity holds across many chunk sizes on a rich stream (thinking + tools + text + result)', () => {
  const raw = [
    L({ type: 'system', subtype: 'init' }),
    asst([think('planning'), tool('Read', { file_path: 'a.js' }), txt('part one ')]),
    L({ type: 'rate_limit_event' }),
    usr([tres(false, 'ok')]),
    asst([tool('Edit', { file_path: 'a.js' }), txt('part two')]),
    L({ type: 'result', result: 'IGNORED_BECAUSE_TEXT_EXISTS' }),
  ].join('\n') + '\n';
  const expected = parseStreamJson(raw);
  assert.strictEqual(expected, 'part one part two');
  for (const size of [1, 2, 5, 11, 40, raw.length]) {
    assert.strictEqual(runChunks(raw, size).text, expected, 'size ' + size);
  }
});

// --- rate_limit_event: mirror the owner's 5-hour usage stat, HONESTLY (desktop-parity R1) ---
const FIVE_HOUR = { status: 'allowed', resetsAt: 1784611200, rateLimitType: 'five_hour', overageStatus: 'rejected', isUsingOverage: false };

test('rate_limit_event is surfaced as usage (status + reset + type) via getUsage/finalize/parseAll', () => {
  const raw = asst([txt('hi')]) + '\n' + rl(FIVE_HOUR) + '\n';
  const p = createStreamParser();
  p.push(raw);
  const f = p.finalize();
  assert.deepStrictEqual(p.getUsage(), { status: 'allowed', resetsAt: 1784611200, rateLimitType: 'five_hour', isUsingOverage: false });
  assert.deepStrictEqual(f.usage, p.getUsage());
  assert.deepStrictEqual(parseAll(raw).usage, p.getUsage());
});

test('usage capture never touches the reply text or events (the two guarantees hold)', () => {
  const raw = asst([think('secret'), tool('Read', { file_path: 'a.js' }), txt('REPLY')]) + '\n' + rl(FIVE_HOUR) + '\n';
  const r = parseAll(raw);
  assert.strictEqual(r.text, parseStreamJson(raw));                 // byte-identical to the shipped parser
  assert.strictEqual(r.text, 'REPLY');
  assert.deepStrictEqual(r.events.map((e) => e.kind), ['read']);    // rate_limit is NOT surfaced as an action event
  assert.strictEqual(r.usage.rateLimitType, 'five_hour');
});

test('honesty: no percent is invented; only present fields are kept; missing info => null', () => {
  const u = normalizeUsage(FIVE_HOUR);
  assert.ok(!('percent' in u) && !('used' in u) && !('remaining' in u)); // the event has no %, so none is fabricated
  assert.strictEqual(normalizeUsage({}), null);
  assert.strictEqual(normalizeUsage(null), null);
  assert.deepStrictEqual(normalizeUsage({ status: 'allowed' }), { status: 'allowed' }); // only what's actually there
  const p = createStreamParser();
  p.push(L({ type: 'rate_limit_event' }) + '\n');                   // no rate_limit_info at all
  assert.strictEqual(p.getUsage(), null);
});

test('the latest rate_limit_event wins (usage reflects the most recent status)', () => {
  const p = createStreamParser();
  p.push(rl({ status: 'allowed', rateLimitType: 'five_hour' }) + '\n');
  p.push(rl({ status: 'rejected', rateLimitType: 'five_hour' }) + '\n');
  assert.strictEqual(p.getUsage().status, 'rejected');
});

test('the REAL capture surfaces its five_hour rate_limit_event', () => {
  const u = parseAll(REAL).usage;
  assert.ok(u, 'usage present in the real capture');
  assert.strictEqual(u.rateLimitType, 'five_hour');
  assert.strictEqual(u.status, 'allowed');
  assert.strictEqual(typeof u.resetsAt, 'number');
});

// ADR-0020 Step 1 (T9 spine): the attachment/image path (stream-json) must also surface num_turns.
test('parseStreamTurns reads num_turns from the result event; the real capture reports its count', () => {
  const stream = [
    L({ type: 'assistant', message: { content: [txt('hi')] } }),
    L({ type: 'result', result: 'hi', num_turns: 5, usage: { input_tokens: 1 } }),
  ].join('\n');
  assert.strictEqual(parseStreamTurns(stream), 5);
  assert.strictEqual(parseStreamTurns(REAL), 1);                              // real captured envelope
  assert.strictEqual(parseStreamTurns(L({ type: 'result', result: 'x' })), null); // absent -> null, not 0
  assert.strictEqual(parseStreamTurns(L({ type: 'result', num_turns: -2 })), null); // negative dropped
  assert.strictEqual(parseStreamTurns('not json\n'), null);                  // never throws
});
