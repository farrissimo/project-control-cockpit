// ADR-0020 T1: the DETERMINISTIC, LOCAL, no-LLM continuation seed carried into a rolled-over chat.
// Pins the guarantees T1 depends on: deterministic (same input -> identical seed), bounded (compact,
// never the full grown history), recent conversation carried VERBATIM, and no summary generated.
const { test } = require('node:test');
const assert = require('node:assert');
const rs = require('../../renderer/rollover-seed.js');

const msgs = (n) => Array.from({ length: n }, (_, i) => ({ cls: i % 2 === 0 ? 'user' : 'assistant', text: 'message number ' + i }));

test('buildContinuationSeed is deterministic — same messages + handoff produce an identical seed', () => {
  const m = msgs(6);
  assert.strictEqual(rs.buildContinuationSeed(m, 'HANDOFF'), rs.buildContinuationSeed(m, 'HANDOFF'));
});

test('carries the RECENT conversation verbatim (most recent last) + the handoff; says no summary was generated', () => {
  const seed = rs.buildContinuationSeed([{ cls: 'user', text: 'hello there' }, { cls: 'assistant', text: 'hi back' }], 'PROJECT BRIEF');
  assert.ok(seed.includes('You: hello there'));
  assert.ok(seed.includes('Claude: hi back'));
  assert.ok(seed.indexOf('You: hello there') < seed.indexOf('Claude: hi back')); // chronological, recent last
  assert.ok(seed.includes('PROJECT BRIEF'));
  assert.ok(/no summary was generated/i.test(seed)); // honest: deterministic, not an LLM summary
});

test('BOUNDED: caps the number of messages and total chars — never the full grown history', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ cls: 'user', text: ('x'.repeat(500)) + ' idx' + i }));
  const t = rs.recentTranscript(many);
  assert.ok(t.length <= rs.MAX_SEED_CHARS + 200, 'transcript stays within the char cap: ' + t.length);
  const kept = (t.match(/idx\d+/g) || []);
  assert.ok(kept.length <= rs.MAX_SEED_MESSAGES, 'at most MAX_SEED_MESSAGES carried: ' + kept.length);
  assert.ok(t.includes('idx99'), 'the MOST RECENT message is always kept'); // recency preserved
});

test('a single over-budget message is truncated with a visible marker, never silently cut', () => {
  const t = rs.recentTranscript([{ cls: 'user', text: 'y'.repeat(rs.MAX_SEED_CHARS + 5000) }]);
  assert.ok(/…\[trimmed\]/.test(t));
  assert.ok(t.length <= rs.MAX_SEED_CHARS + 50);
});

test('empty / malformed messages are safe — no throw, honest empty transcript', () => {
  assert.strictEqual(rs.recentTranscript([]), '');
  assert.strictEqual(rs.recentTranscript(null), '');
  assert.strictEqual(rs.recentTranscript([{}, { text: '' }, { cls: 'user' }]), '');
  const seed = rs.buildContinuationSeed([], '');
  assert.ok(seed.includes('(no prior messages)'));
});

test('roleLabel maps cls to a plain-English speaker', () => {
  assert.strictEqual(rs.roleLabel('user'), 'You');
  assert.strictEqual(rs.roleLabel('assistant error'), 'Claude');
  assert.strictEqual(rs.roleLabel('weird'), 'Note');
});
