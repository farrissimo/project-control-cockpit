const fs = require('fs');
const turns = process.argv.slice(2).flatMap((p) => JSON.parse(fs.readFileSync(p, 'utf8')));
const short = turns.filter((t) => t.text.length < 300);

const CATS = {
  GREAT_QUESTIONS: /\b(what (prevents|makes|happens)|why (would|is it|are we|the fuck would)|which would be more|what if|how would that work|is that (accurate|a|the)|what's the (path|catch|risk)|does that mean|so what|what are we (actually|really))\b/i,
  PUSHBACK_TECHNICAL: /\b(overengineered|reinvent|don't reinvent|already has|you can just use|that's not|prior art|bloat|scalable|long term|doesn't (make sense|scale))\b/i,
  DEMANDS_PROOF: /\b(prove|proof|how do (you|i) know|show me|did you (test|verify|check)|guessing|assume|untested|evidence)\b/i,
  SCOPE_CONTROL: /\b(low priority|push (it|that) to|defer|postpone|not right now|down the road|park|out of scope|stay in scope|side track)\b/i,
  ROLE_ASSERTION: /\b(do i look like|i'm not a coder|not an engineer|what's my role|my role|i'm the (owner|visionary)|i don't (code|engineer))\b/i,
  APPROVAL: /^\s*(approved|yes|go ahead|do it|proceed|correct|agreed|perfect|that works|#?\d+ it is)\b/i,
  IMPATIENCE: /\b(keep going|just (give|tell|do)|get to the point|move on|asap|hurry|still waiting|come on|cmon|circles)\b/i,
};

for (const [name, re] of Object.entries(CATS)) {
  const hits = short.filter((t) => re.test(t.text));
  console.log('\n########## ' + name + '  (' + hits.length + ' turns) ##########');
  hits.slice(0, Number(process.argv[2] && 0) || 9).forEach((t) => console.log('  • ' + t.text.replace(/\s*\n\s*/g, ' | ')));
}
