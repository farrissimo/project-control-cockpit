// Pure recall logic (docs/CHAT_RECALL_SPEC.md): prompt-building, the local grep net, the
// recall-safe candidate set, and tolerant match parsing. No Electron / no `claude` / no fs.
const { test, expect } = require('@playwright/test');
const cr = require('../../chat-recall.js');

const CHATS = [
  { id: 'a', name: 'Tax app planning', messages: [
    { cls: 'user', text: 'Build the chat interface into the tax app?' },
    { cls: 'bot', text: 'Decision: chat interface is the primary surface.' } ] },
  { id: 'b', name: 'Backup policy', messages: [
    { cls: 'user', text: 'How often to back up off-machine?' },
    { cls: 'bot', text: 'Local-only is a valid tier.' } ] },
  { id: 'c', name: 'Summarized chat', messages: [{ cls: 'user', text: 'raw text ignored when summary present' }],
    summary: { gist: 'We decided to use the claude.ai login not a paid API key.', decided: ['use login'], wentRight: [], wentWrong: [], openIdeas: [], importantEvents: [] } },
];

test('docText prefers the summary when present, else the transcript', () => {
  expect(cr.docText(CHATS[2])).toContain('claude.ai login');   // from summary
  expect(cr.docText(CHATS[2])).not.toContain('raw text ignored'); // transcript not used when summary exists
  expect(cr.docText(CHATS[0])).toContain('primary surface');    // from transcript (no summary)
});

test('buildExpandPrompt embeds the question and asks for a JSON array', () => {
  const p = cr.buildExpandPrompt('when did we decide X?');
  expect(p).toContain('when did we decide X?');
  expect(p).toContain('JSON array');
});

test('parseTerms reads a JSON array and always folds in the question words', () => {
  const t = cr.parseTerms('["login","billing"]', 'how do we pay the model');
  expect(t).toContain('login');
  expect(t).toContain('billing');
  expect(t).toContain('pay');    // question word folded in
  expect(t).toContain('model');
  // Even if expansion is garbage, question words keep grep alive.
  expect(cr.parseTerms('not json', 'crypto scope creep')).toEqual(expect.arrayContaining(['crypto', 'scope', 'creep']));
});

test('grep ranks chats by term hits and drops zero-hit chats', () => {
  const hits = cr.grep(['tax', 'chat', 'interface'], CHATS);
  expect(hits[0].id).toBe('a');                       // best match ranked first
  expect(hits.some((h) => h.id === 'b')).toBe(false); // backup chat has no hits
});

test('selectCandidates is recall-safe: grep hits first, then top up to the cap', () => {
  const hits = cr.grep(['tax'], CHATS);               // only chat "a" hits
  const cand = cr.selectCandidates(CHATS, hits, 8);
  expect(cand[0]).toBe('a');                          // hit first
  expect(cand).toContain('b');                        // non-hits topped up so judge still sees them
  expect(cand).toContain('c');
  expect(cand.length).toBeLessThanOrEqual(8);
});

test('buildJudgePrompt includes candidates and the match rules', () => {
  const p = cr.buildJudgePrompt('q?', CHATS.slice(0, 1));
  expect(p).toContain('CHAT a');
  expect(p).toContain('DEFERRED');   // the "discussed != decided" rule
  expect(p).toContain('REVERSES');   // the supersession rule
});

// ADR-0020 T7: an oversized search question (a giant paste into the search box) is bounded with the
// SAME deterministic cap in every stage — the expand prompt, the local term-fold, and the judge prompt —
// so it can't create oversized one-shot Claude calls and the AI/local stages can't disagree.
test('T7: an oversized search question is head+tail capped in both the expand and judge prompts', () => {
  const huge = 'Q'.repeat(20000);
  for (const p of [cr.buildExpandPrompt(huge), cr.buildJudgePrompt(huge, CHATS.slice(0, 1))]) {
    expect(p.length).toBeLessThan(huge.length);   // the full 20k paste never reaches the model
    expect(p).toContain('truncated');             // visible head+tail marker, not a silent cut
  }
  // the local term-fold reads the SAME capped question (parseTerms folds question words) — bounded too
  const terms = cr.parseTerms('[]', huge);
  expect(terms.join(' ').length).toBeLessThan(huge.length);
});

test('parseMatches tolerates prose/fences and drops entries without a chatId', () => {
  expect(cr.parseMatches('{"matches":[{"chatId":"a","answer":"x","quote":"y"}]}')).toEqual([{ chatId: 'a', answer: 'x', quote: 'y' }]);
  expect(cr.parseMatches('sure: ```json\n{"matches":[{"chatId":"b"}]}\n```')).toEqual([{ chatId: 'b', answer: '', quote: '' }]);
  expect(cr.parseMatches('{"matches":[{"answer":"no id"}]}')).toEqual([]);
  expect(cr.parseMatches('garbage')).toEqual([]);
});
