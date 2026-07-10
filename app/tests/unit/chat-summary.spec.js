// Pure logic for first-class chat history (docs/CHAT_RECALL_SPEC.md): prompt-
// building, worker-output cleaning, tolerant JSON, and the rendered summary card.
// No Electron, no real `claude`, no fs — same isolation as authority-logic.spec.js.
const { test, expect } = require('@playwright/test');
const cs = require('../../chat-summary.js');

const CHAT = [
  { cls: 'user', text: 'Should we build the chat into the tax app?' },
  { cls: 'bot', text: 'Decision recorded: yes, chat is the primary surface.' },
];

test('sanitizeChatId strips path-dangerous characters', () => {
  expect(cs.sanitizeChatId('../../etc/passwd')).toBe('etcpasswd');
  expect(cs.sanitizeChatId('abc-123_DEF')).toBe('abc-123_DEF');
  expect(cs.sanitizeChatId(null)).toBe('');
});

test('transcriptToText labels roles and caps length', () => {
  const t = cs.transcriptToText(CHAT);
  expect(t).toContain('USER: Should we build');
  expect(t).toContain('AI: Decision recorded');
  expect(cs.transcriptToText([{ cls: 'user', text: 'x'.repeat(500) }], 100).length).toBe(100);
});

test('buildNamePrompt and buildSummaryPrompt embed the transcript + their rules', () => {
  expect(cs.buildNamePrompt(CHAT)).toContain('AT MOST 6 words');
  expect(cs.buildNamePrompt(CHAT)).toContain('Decision recorded');
  const sp = cs.buildSummaryPrompt(CHAT);
  expect(sp).toContain('strict JSON');
  expect(sp).toContain('invent'); // quote-not-invent rule present
  expect(sp).toContain('importantEvents');
});

test('cleanTitle strips quotes, Title: prefix, trailing period, and preamble lines', () => {
  expect(cs.cleanTitle('"Tax app chat interface"')).toBe('Tax app chat interface');
  expect(cs.cleanTitle('Title: Backup policy.')).toBe('Backup policy');
  expect(cs.cleanTitle('Here is a title:\nModel switcher fix')).toBe('Model switcher fix');
  expect(cs.cleanTitle('x'.repeat(200)).length).toBe(60);
});

test('safeJsonParse handles clean JSON and JSON buried in prose/fences', () => {
  expect(cs.safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  expect(cs.safeJsonParse('Sure! ```json\n{"a":2}\n``` done')).toEqual({ a: 2 });
  expect(cs.safeJsonParse('not json at all')).toBe(null);
});

test('normalizeSummary fills every field so the UI never hits undefined', () => {
  const n = cs.normalizeSummary({ title: 'T', decided: ['d1', ''], gist: 'g' });
  expect(n.decided).toEqual(['d1']);        // falsy entries dropped
  expect(n.wentRight).toEqual([]);          // missing array -> []
  expect(n.importantEvents).toEqual([]);
  expect(cs.normalizeSummary(null).title).toBe('');
});

test('renderSummaryMd produces all sections and (none) for empty categories', () => {
  const md = cs.renderSummaryMd({ title: 'My chat', gist: 'About X.', decided: ['Do X'] }, 0);
  expect(md).toContain('# My chat');
  expect(md).toContain('## Decided\n- Do X');
  expect(md).toContain('## Went wrong\n- (none)'); // empty category rendered honestly
  expect(md).toContain('quotes the chat, invents nothing');
});
