// What does the owner ACTUALLY do? Count real behaviours across the corpus by literal
// phrase match. No interpretation, no LLM — just counts, so the behaviour model is
// grounded in what he really typed rather than what I imagine he'd type.
const fs = require('fs');
const turns = process.argv.slice(2).flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')));

const BEHAVIOURS = [
  ['OPENS/LAUNCHES the app and looks',        /\b(i (opened|open|launched|ran|installed)|open(ing)? the app|launch the (app|program)|shortcut to the exe|take a look)\b/i],
  ['READS a badge/light/chip/meter and asks', /\b(badge|amber|yellow light|green|the light|trust strip|meter|chip|banner|still (amber|red|yellow))\b/i],
  ['CLICKS a button and reacts',              /\b(i clicked|clicked the|the button|button at the top|i hit|i pressed)\b/i],
  ['ASKS "where are we / what now"',          /\b(where are we|what are we (working on|doing)|what's next|pick(ing)? (back )?up|status)\b/i],
  ['CHECKS tools/access/capability',          /\b(do you have|can you confirm|check again|write access|web access|all the tools|your normal access|do you now have)\b/i],
  ['TESTS memory/persistence repeatedly',     /\b(remember it|what is my favorite|do you remember|remember that|still remember)\b/i],
  ['REPORTS something looks WRONG',           /\b(that's wrong|not right|doesn't work|didn't work|never worked|broken|typo|garbled|still just|nope|going in circles)\b/i],
  ['SAYS IT REPEATED ITSELF / was ignored',   /\b(i (said|already said|told you)|i already approved|didn't i|as i said|repeat|again\?)\b/i],
  ['CATCHES a contradiction vs earlier',      /\b(you (said|told me)|earlier|remember how we|what happened to that plan|contradic)\b/i],
  ['ASKS "what is my role"',                  /\b(do i look like a coder|i'm not a coder|not an engineer|what's my role|what is my role)\b/i],
  ['REFUSES on risk/trust grounds',           /\b(not happening|i'm not connecting|3 days old|don't trust|how the fuck am i supposed to trust|no fucking way)\b/i],
  ['DEMANDS concise / no jargon',             /\b(concise|non-tech|short answers|plain english|wall of text|boil it down|too long|word salad)\b/i],
  ['APPROVES / authorizes work',              /\b(approved|the work is approved|go ahead|permission granted|you're authorized)\b/i],
  ['STOPS runaway work mid-discussion',       /\b(we're in the middle|you made changes while|stop|hold on|wait|that is NOT the time)\b/i],
  ['PASTES a screenshot/attachment',          /\(see attached\)|here's what i see|screenshot/i],
  ['FIRES / rage-quits',                      /\b(you're fired|fuck you|jfc|unacceptable|wasted|thumb up your ass)\b/i],
];

const counts = BEHAVIOURS.map(([name, re]) => [name, turns.filter((t) => re.test(t.text)).length]);
counts.sort((a, b) => b[1] - a[1]);
console.log('corpus: ' + turns.length + ' real owner turns\n');
for (const [name, n] of counts) {
  const pct = ((n / turns.length) * 100).toFixed(1);
  console.log(String(n).padStart(4) + '  (' + String(pct).padStart(4) + '%)  ' + name);
}
