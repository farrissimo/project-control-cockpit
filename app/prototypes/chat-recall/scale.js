// Scaling probe: does RETRIEVAL still surface the right chat as the corpus grows to
// 25 / 100 / 1000 chats? The AI judge only ever reads a small candidate set, so its
// quality is corpus-size-independent — the thing that can break at scale is whether the
// needle reaches the judge at all. That is deterministic, so we measure it for FREE (no
// tokens) with the stub retrieval (a conservative lower bound: real AI query-expansion +
// real summaries only help). Reports recall@grep and recall@candidate (needle in the
// judge's top-CANDIDATE_CAP set) plus grep wall-time.
'use strict';
const fx = require('./fixtures');
const { grep, transcriptText } = require('./recall');

const CANDIDATE_CAP = 8;
const STOP = new Set(['when','did','we','the','into','what','say','went','with','before','a','an','to','is','of','on','do','does','how','are','for','not','that','this','it','at']);
const words = (s) => s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

// Deterministic filler chats. Pulls from a topic pool that DELIBERATELY overlaps some
// needle vocabulary (tax, app, chat, model, decision, scope, test...) so fillers create
// realistic spurious grep hits that dilute retrieval — a fair stress, not a soft one.
const NOUNS = ['login', 'dashboard', 'invoice', 'export', 'cache', 'wizard', 'badge', 'index', 'theme', 'sidebar',
  'model', 'chat', 'app', 'tax', 'report', 'scope', 'test', 'deploy', 'decision', 'backup', 'schema', 'button'];
const VERBS = ['refactor', 'fix', 'discuss', 'tweak', 'review', 'plan', 'debug', 'rename', 'polish', 'audit'];
function rng(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff; }
function makeFillers(n, seed) {
  const r = rng(seed);
  const pick = (a) => a[Math.floor(r() * a.length)];
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = pick(NOUNS), b = pick(VERBS), c = pick(NOUNS);
    out.push({ id: 'filler-' + i, name: b + ' ' + a, messages: [
      { cls: 'user', text: 'Can we ' + b + ' the ' + a + ' ' + c + ' this week?' },
      { cls: 'bot', text: 'Looked at the ' + a + ' ' + c + '; adjusted it. No decision recorded here, just housekeeping.' },
    ] });
  }
  return out;
}

// Stub retrieval mirrors recall.js exactly: summary tier = transcript text (conservative),
// expand = query words, candidate set = grep hits then top-up to the cap.
function retrieve(query, chats) {
  const summarized = chats.map((c) => ({ chatId: c.id, chatName: c.name, summary: null, raw: transcriptText(c) }));
  const t0 = Date.now();
  const hits = grep(words(query), summarized, chats);
  const grepMs = Date.now() - t0;
  const ordered = hits.map((h) => h.chatId);
  for (const c of chats) if (!ordered.includes(c.id) && ordered.length < CANDIDATE_CAP) ordered.push(c.id);
  return { hits, candidates: ordered.slice(0, CANDIDATE_CAP), grepMs };
}

const queries = fx.GROUND_TRUTH.filter((g) => !g.expectNone);
for (const N of [25, 100, 1000]) {
  const chats = fx.chats.concat(makeFillers(N - fx.chats.length, N)); // total corpus = N chats
  let inGrep = 0, inCand = 0, totalMs = 0, maxHits = 0;
  for (const g of queries) {
    const { hits, candidates, grepMs } = retrieve(g.query, chats);
    totalMs += grepMs; maxHits = Math.max(maxHits, hits.length);
    if (hits.some((h) => h.chatId === g.expectChatId)) inGrep++;
    if (candidates.includes(g.expectChatId)) inCand++;
  }
  console.log('N=' + String(N).padStart(4) + '  recall@grep=' + inGrep + '/' + queries.length
    + '  recall@candidate(top' + CANDIDATE_CAP + ')=' + inCand + '/' + queries.length
    + '  maxGrepHits=' + String(maxHits).padStart(4)
    + '  grepTime=' + (totalMs / queries.length).toFixed(1) + 'ms/query');
}
