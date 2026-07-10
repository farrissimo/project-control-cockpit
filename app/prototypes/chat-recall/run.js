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
    // Keyword-only control returns just its single top pick — no judgment, so it can't
    // reason about multiple genuine matches; that's the point of the control.
    return Promise.resolve(JSON.stringify({ matches: best ? [{ chatId: best, answer: 'stub-selected ' + best, quote: bestQuote }] : [] }));
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
    const { matches } = await recall(gt.query, chats, ai, { summaries });
    const pickedIds = (matches || []).map((m) => m.chatId);
    const realPicks = pickedIds.filter((id) => chats.some((c) => c.id === id));
    const evidence = (matches || []).map((m) => (m.answer || '') + ' ' + (m.quote || '')).join(' ');

    let ok, detail;
    if (gt.expectNone) {
      // Anti-hallucination: correct = returned no real chat.
      ok = realPicks.length === 0;
      detail = 'expectNone returned=[' + pickedIds.join(', ') + '] -> ' + (ok ? 'correctly found nothing' : 'HALLUCINATED');
    } else {
      const want = gt.expectChatIds || [gt.expectChatId];      // single or multi
      const foundAll = want.every((id) => pickedIds.includes(id));
      const rejectedDecoys = !(gt.rejectChatIds || []).some((id) => pickedIds.includes(id));
      const noExtras = pickedIds.every((id) => want.includes(id)); // returned matches are exactly the wanted set
      const mentioned = (gt.mustMention || []).every((m) => evidence.toLowerCase().includes(m.toLowerCase()));
      ok = foundAll && rejectedDecoys && noExtras && (DRY || mentioned);
      detail = 'want=[' + want.join(',') + '] got=[' + pickedIds.join(',') + '] foundAll=' + foundAll
        + ' rejectedDecoys=' + rejectedDecoys + ' noExtras=' + noExtras + ' mentioned=' + (DRY ? 'n/a' : mentioned);
    }
    if (ok) pass++; else fails.push(gt.category);

    console.log('[' + (ok ? 'PASS' : 'FAIL') + '] (' + gt.category + ') ' + gt.query);
    for (const m of (matches || [])) console.log('   match: ' + m.chatId + (m.quote ? '  quote="' + m.quote + '"' : ''));
    console.log('   ' + detail + '\n');
  }
  console.log('=== ' + pass + '/' + fx.GROUND_TRUTH.length + ' passed ==='
    + (fails.length ? '   FAILED: ' + fails.join(', ') : '  (clean sweep)'));
  process.exit(pass === fx.GROUND_TRUTH.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
