// Blind runner + scorer for the chat-recall prototype (wider, harder corpus).
//
//   node run.js --dry     deterministic stub AI, zero tokens (plumbing + keyword-only control)
//   node run.js           real worker (claude -p via the claude.ai login)
//
// Pipeline is BLIND: it only receives the chats. GROUND_TRUTH is read here, AFTER each
// answer, purely to score. Summaries are built ONCE and reused across all queries (token
// thrift + realism: one summary per chat, many searches).

'use strict';
const fx = require('./fixtures');
const { recall, summarize } = require('./recall');

const DRY = process.argv.slice(2).includes('--dry');
const chats = fx.chats;

const STOP = new Set(['when','did','we','the','into','what','say','went','with','before','a','an','to','is','of','on','do','does','how','are','for','not','that','this','it','at']);
function words(s) { return s.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)); }

// Deterministic stub AI for --dry: exercises the plumbing AND acts as the "dumb keyword-only"
// control — it has no judgment, so it should FAIL the cases that need real understanding.
function dryAI(prompt) {
  if (prompt.startsWith('Summarize the following')) {
    const body = prompt.split('TRANSCRIPT:\n')[1] || '';
    return Promise.resolve(JSON.stringify({ title: 'stub', gist: body, decided: [], wentRight: [], wentWrong: [], openIdeas: [], importantEvents: [] }));
  }
  if (prompt.includes('Turn this question into')) {
    const q = (prompt.match(/Question: "([^"]+)"/) || [])[1] || '';
    return Promise.resolve(JSON.stringify([...new Set(words(q))]));
  }
  if (prompt.startsWith('The user asked:')) {
    const q = (prompt.match(/The user asked: "([^"]+)"/) || [])[1] || '';
    const qWords = words(q);
    const blocks = prompt.split(/\n\n---\n\n/).filter((b) => b.includes('CHAT '));
    let best = null, bestScore = -1, bestQuote = '';
    for (const b of blocks) {
      const id = (b.match(/CHAT (\S+) \(/) || [])[1];
      const all = b.split('\n');
      const lines = all.slice(all.findIndex((l) => /^CHAT \S+ \(/.test(l)) + 1);
      let score = 0, quote = '';
      for (const ln of lines) {
        const l = ln.toLowerCase();
        const hit = qWords.filter((w) => l.includes(w)).length;
        score += hit;
        if (hit > 0 && !quote) quote = ln.replace(/^(USER|AI): /, '');
      }
      if (score > bestScore) { bestScore = score; best = id; bestQuote = quote; }
    }
    return Promise.resolve(JSON.stringify({ chatId: best, answer: 'stub-selected ' + best, quote: bestQuote }));
  }
  return Promise.resolve('{}');
}

async function main() {
  const ai = DRY ? dryAI : require('./worker').askAI;
  console.log('=== chat-recall battery ===  mode=' + (DRY ? 'DRY(keyword-only control)' : 'REAL(claude -p)')
    + '  chats=' + chats.length + '  queries=' + fx.GROUND_TRUTH.length + '\n');

  // Build each chat's summary ONCE, reuse for every query.
  const summaries = await Promise.all(chats.map((c) => summarize(c, ai)));

  let pass = 0;
  const fails = [];
  for (const gt of fx.GROUND_TRUTH) {
    const { terms, hits, result } = await recall(gt.query, chats, ai, { summaries });
    const picked = result && result.chatId;
    const isRealChat = !!picked && chats.some((c) => c.id === picked);

    let ok, detail;
    if (gt.expectNone) {
      // Anti-hallucination: correct = picked nothing (null/none/not a real chat).
      ok = !isRealChat;
      detail = 'expectNone picked=' + picked + ' -> ' + (ok ? 'correctly found nothing' : 'HALLUCINATED a chat');
    } else {
      const evidence = ((result && result.answer) || '') + ' ' + ((result && result.quote) || '');
      const retrieved = hits.some((h) => h.chatId === gt.expectChatId);
      const pickedRight = picked === gt.expectChatId;
      const rejectedDecoys = !(gt.rejectChatIds || []).includes(picked);
      const mentioned = (gt.mustMention || []).every((m) => evidence.toLowerCase().includes(m.toLowerCase()));
      ok = retrieved && pickedRight && rejectedDecoys && (DRY || mentioned);
      detail = 'retrieved=' + retrieved + ' pickedRight=' + pickedRight + ' rejectedDecoys=' + rejectedDecoys + ' mentioned=' + (DRY ? 'n/a' : mentioned);
    }
    if (ok) pass++; else fails.push(gt.category);

    console.log('[' + (ok ? 'PASS' : 'FAIL') + '] (' + gt.category + ') ' + gt.query);
    console.log('   picked: ' + picked + (result && result.quote ? '  quote="' + result.quote + '"' : ''));
    if (!DRY && result && result.answer) console.log('   answer: ' + result.answer);
    console.log('   ' + detail + '\n');
  }
  console.log('=== ' + pass + '/' + fx.GROUND_TRUTH.length + ' passed ==='
    + (fails.length ? '   FAILED: ' + fails.join(', ') : '  (clean sweep)'));
  process.exit(pass === fx.GROUND_TRUTH.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
