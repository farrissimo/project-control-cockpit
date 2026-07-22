// ADR-0020 T2: the live agentic-turn counter that lets PCC kill a message spiralling into hundreds
// of model turns. Pins the behavior the runaway-kill relies on: assistant lines count as turns,
// everything else does not, partial stdout chunks are buffered correctly, and the breach test never
// silently disables the cap on a bad limit.
const { test } = require('node:test');
const assert = require('node:assert');
const { isAssistantTurnLine, createTurnCounter, isBreached } = require('../../turn-cap.js');

const asst = (t) => JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: t }] } });
const toolResult = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'ok' }] } });
const systemLine = JSON.stringify({ type: 'system', subtype: 'init' });
const resultLine = JSON.stringify({ type: 'result', subtype: 'success', result: 'done', num_turns: 3 });

test('isAssistantTurnLine: only assistant events count as a turn', () => {
  assert.strictEqual(isAssistantTurnLine(asst('hi')), true);
  assert.strictEqual(isAssistantTurnLine(toolResult), false);   // tool_result comes back as type:user
  assert.strictEqual(isAssistantTurnLine(systemLine), false);
  assert.strictEqual(isAssistantTurnLine(resultLine), false);
});

test('isAssistantTurnLine: non-JSON / blank / partial lines are never miscounted as a turn', () => {
  for (const junk of ['', '   ', 'not json', '{"type":"assist', '[banner]', null, undefined]) {
    assert.strictEqual(isAssistantTurnLine(junk), false, JSON.stringify(junk));
  }
});

test('createTurnCounter: counts one turn per assistant line across a realistic stream', () => {
  const c = createTurnCounter();
  const stream = [systemLine, asst('thinking'), toolResult, asst('more'), toolResult, asst('final'), resultLine].join('\n') + '\n';
  assert.strictEqual(c.feed(stream), 3);
  assert.strictEqual(c.count(), 3);
});

test('createTurnCounter: buffers a line split across chunks (no double- or under-count)', () => {
  const c = createTurnCounter();
  const line = asst('split me');
  const mid = Math.floor(line.length / 2);
  assert.strictEqual(c.feed(line.slice(0, mid)), 0);       // no newline yet -> not counted
  assert.strictEqual(c.feed(line.slice(mid)), 0);          // still no newline
  assert.strictEqual(c.feed('\n'), 1);                     // newline completes the line -> counted once
  assert.strictEqual(c.count(), 1);
});

test('createTurnCounter: a trailing partial line stays uncounted until its newline arrives', () => {
  const c = createTurnCounter();
  assert.strictEqual(c.feed(asst('a') + '\n' + asst('b')), 1); // second line has no newline yet
  assert.strictEqual(c.feed('\n'), 2);
});

test('isBreached: fires at or above the cap, not below', () => {
  assert.strictEqual(isBreached(59, 60), false);
  assert.strictEqual(isBreached(60, 60), true);
  assert.strictEqual(isBreached(61, 60), true);
});

test('isBreached: a non-finite/<1 cap is treated as "never breached" (config layer fails bad values closed, not here)', () => {
  for (const bad of [0, -1, NaN, Infinity, undefined, null, '60']) {
    assert.strictEqual(isBreached(1000, bad), false, JSON.stringify(bad));
  }
});
