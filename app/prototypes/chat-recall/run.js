// Blind runner + scorer for the chat-recall prototype.
//
//   node run.js --dry        deterministic stub AI, zero tokens (plumbing test)
//   node run.js              real worker (claude -p via the claude.ai login)
//   node run.js --stage A    single haystack (target only); default is B (decoys)
//
// The pipeline is BLIND: it only ever receives the chats. GROUND_TRUTH is read
// here, AFTER each answer, purely to score. That separation is the whole point -
// the AI never sees the answer key it is being graded against.

'use strict';
const fx = require('./fixtures');
const { recall, transcriptText } = require('./recall');

const argv = process.argv.slice(2);
const DRY = argv.includes('--dry');
const stage = (argv.includes('--stage') ? argv[argv.indexOf('--stage') + 1] : 'B').toUpperCase();
const chats = stage === 'A' ? fx.stageA : fx.stageB;

// --- deterministic stub AI for --dry: exercises the real plumbing (grep, judge
// selection, JSON parsing, scoring) with zero tokens and stable output.
const STOP = new Set(['when','did','we','the','into','what','say','went','with','before','a','an','to','is','of','on','do','does','how']);
function dryAI(prompt) {
  if (prompt.startsWith('Summarize the following')) {
    const body = prompt.split('TRANSCRIPT:\n')[1] || '';
    return Promise.resolve(JSON.stringify({ title: 'stub', gist: body, decided: [], wentWrong: [], openIdeas: [], importantEvents: [] }));
  }
  if (prompt.includes('Turn this question into')) {
    const q = (prompt.match(/Question: "([^"]+)"/) || [])[1] || '';
    const terms = q.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    return Promise.resolve(JSON.stringify([...new Set(terms)]));
  }
  if (prompt.startsWith('The user asked:')) {
    const q = (prompt.match(/The user asked: "([^"]+)"/) || [])[1] || '';
    const qWords = q.toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const blocks = prompt.split(/\n\n---\n\n/).filter((b) => b.includes('CHAT '));
    let best = null, bestScore = -1, bestQuote = '';
    for (const b of blocks) {
      const id = (b.match(/CHAT (\S+) \(/) || [])[1];
      // Drop any instruction preamble glued to the first block: only the chat's
      // own lines (after its "CHAT <id> (...)" header) are eligible to be quoted.
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
  console.log('=== chat-recall prototype ===  mode=' + (DRY ? 'DRY(stub)' : 'REAL(claude -p)') + '  stage=' + stage + '  chats=' + chats.length + '\n');

  let pass = 0;
  for (const gt of fx.GROUND_TRUTH) {
    const { terms, hits, result } = await recall(gt.query, chats, ai);
    const evidence = ((result && result.answer) || '') + ' ' + ((result && result.quote) || '');
    const picked = result && result.chatId;

    const retrieved = hits.some((h) => h.chatId === gt.expectChatId);        // did grep even surface it
    const pickedRight = picked === gt.expectChatId;                          // did judge choose it
    const rejectedDecoys = !(gt.rejectChatIds || []).includes(picked);       // did it avoid the tempting decoy
    // Semantic answer quality can only be judged on a real AI answer; the stub
    // can't fake it, so `mentioned` is N/A in --dry (plumbing) mode.
    const mentioned = (gt.mustMention || []).every((m) => evidence.toLowerCase().includes(m.toLowerCase()));
    const ok = retrieved && pickedRight && rejectedDecoys && (DRY || mentioned);
    if (ok) pass++;

    console.log('Q: ' + gt.query);
    console.log('   terms:      ' + JSON.stringify(terms));
    console.log('   grep hits:  ' + hits.map((h) => h.chatId + '(' + h.score + '/' + h.tier + ')').join(', '));
    console.log('   picked:     ' + picked + '  quote="' + ((result && result.quote) || '') + '"');
    console.log('   answer:     ' + ((result && result.answer) || ''));
    console.log('   SCORE: retrieved=' + retrieved + ' pickedRight=' + pickedRight
      + ' rejectedDecoys=' + rejectedDecoys + ' mentioned=' + (DRY ? 'n/a' : mentioned) + '  => ' + (ok ? 'PASS' : 'FAIL') + '\n');
  }
  console.log('=== ' + pass + '/' + fx.GROUND_TRUTH.length + ' queries passed ===');
  process.exit(pass === fx.GROUND_TRUTH.length ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
