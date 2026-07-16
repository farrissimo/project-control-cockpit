// Deep mine for the owner profile: voice, escalation triggers, question taxonomy.
// Everything here is counted or quoted verbatim — no invention.
const fs = require('fs');
const turns = process.argv.slice(2).flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')));

const PROFANITY = /\b(fuck|fucking|fucked|shit|hell|damn|jfc|ass|motherfucker|mother fucker|bullshit|christ)\b/i;
const HARD = /\b(you're fired|fuck you|unacceptable|jfc|motherfucker|mother fucker)\b/i;

const out = { total: turns.length };

// 1. Profanity rate + escalation
const cursed = turns.filter((t) => PROFANITY.test(t.text));
out.profanity = { count: cursed.length, pct: ((cursed.length / turns.length) * 100).toFixed(1) };
out.hardRage = turns.filter((t) => HARD.test(t.text)).length;

// 2. What is he saying WHEN he curses? (trigger words co-occurring with profanity)
const TRIGGERS = [
  ['being told what to do / directed',   /\b(don't tell me|i didn't build|not for you to|who asked|did i ask)\b/i],
  ['worker ignored an instruction',      /\b(i (said|told you|already)|didn't i|as i said|the handoff (told|explicitly))\b/i],
  ['worker guessing / not proving',      /\b(guess|circles|nothing burger|never worked|don't know|figure it out)\b/i],
  ['wasted time',                        /\b(wasted|waste|2 hours|hours of|part of my life|thumb up your ass)\b/i],
  ['worker acted without asking',        /\b(made changes while|you stopped|without asking|went and did|automated)\b/i],
  ['trust collapse',                     /\b(trust|how am i supposed to|can't even read|not aligned|fake|lie|lying)\b/i],
  ['role confusion (treated as coder)',  /\b(do i look like|i'm not a coder|not an engineer|what's my role|my role)\b/i],
  ['wall of text / jargon',              /\b(wall of text|word salad|too long|concise|boil it down|jargon)\b/i],
];
out.cursingTriggers = TRIGGERS.map(([name, re]) => [name, cursed.filter((t) => re.test(t.text)).length])
  .sort((a, b) => b[1] - a[1]);

// 3. Question taxonomy — his questions, by opener
const QTYPES = [
  ['why …',            /^\s*why\b/i],
  ['what …',           /^\s*what\b/i],
  ['how …',            /^\s*how\b/i],
  ['can you / can we', /^\s*(can|could) (you|we|i)\b/i],
  ['is / does / do',   /^\s*(is|does|do|are|did)\b/i],
  ['which / who',      /^\s*(which|who)\b/i],
  ['should / would',   /^\s*(should|would)\b/i],
];
const qs = turns.filter((t) => t.text.includes('?'));
out.questionCount = qs.length;
out.questionPct = ((qs.length / turns.length) * 100).toFixed(1);
out.questionTypes = QTYPES.map(([n, re]) => [n, qs.filter((t) => re.test(t.text)).length]).sort((a, b) => b[1] - a[1]);

// 4. Technical vocabulary he uses HIMSELF (proves his real level)
const TECH = ['repo', 'commit', 'branch', 'git', 'api', 'backup', 'restore', 'schema', 'json', 'ci',
  'regression', 'architecture', 'refactor', 'endpoint', 'database', 'cache', 'token', 'sandbox',
  'e2e', 'playwright', 'electron', 'npm', 'llm', 'prompt', 'context', 'drift', 'detector', 'gate'];
out.techVocab = TECH.map((w) => [w, turns.filter((t) => new RegExp('\\b' + w + '\\b', 'i').test(t.text)).length])
  .filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 18);

// 5. Message length distribution — how he actually writes
const lens = turns.map((t) => t.text.length).sort((a, b) => a - b);
const pick = (p) => lens[Math.floor(lens.length * p)];
out.length = { p10: pick(0.1), median: pick(0.5), p90: pick(0.9), under100: turns.filter((t) => t.text.length < 100).length };

// 6. Lowercase / punctuation style
out.style = {
  startsLowercase: turns.filter((t) => /^[a-z]/.test(t.text)).length,
  doubleSpaceAfterPeriod: turns.filter((t) => /\.\s\s+[a-z]/i.test(t.text)).length,
  hasTypos: turns.filter((t) => /\b(t he|teh|wehen|n eed|h ell|chnages|usefuless|i n eed)\b/i.test(t.text)).length,
};

console.log(JSON.stringify(out, null, 1));
