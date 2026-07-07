// Fake `claude` worker for tests. Two modes:
//  1. Default: drain stdin and print a deterministic canned reply.
//  2. Fixture replay: if PCC_FAKE_CLAUDE_FIXTURE points at a JSON fixture
//     ({stdout, stderr, exitCode, delayMs}), replay it verbatim — so tests can
//     drive UGLY real-world boundary shapes (failures, auth errors, empty
//     output) and prove the app handles them honestly, not just the happy path.
// NEVER calls the real Claude Code — tests stay offline, free, deterministic.
const fs = require('fs');
let input = '';
let done = false;

function replay() {
  if (done) return; done = true;
  const fx = process.env.PCC_FAKE_CLAUDE_FIXTURE;
  if (fx) {
    let f;
    try { f = JSON.parse(fs.readFileSync(fx, 'utf8')); }
    catch (e) { process.stderr.write('fixture load error: ' + e.message); return process.exit(1); }
    if (f.stderr) process.stderr.write(f.stderr);
    return setTimeout(() => {
      if (f.stdout) process.stdout.write(f.stdout);
      process.exit(typeof f.exitCode === 'number' ? f.exitCode : 0);
    }, f.delayMs || 0);
  }
  const wantsBlock = /copy block/i.test(input);
  let out = 'FAKE-CLAUDE-REPLY: received ' + input.trim().length + ' chars.';
  if (wantsBlock) out += '\n\n```\nsample copy block content\n```';
  const delay = parseInt(process.env.PCC_FAKE_DELAY_MS || '0', 10) || 0;
  setTimeout(() => { process.stdout.write(out); process.exit(0); }, delay);
}

process.stdin.on('data', (d) => { input += d.toString(); });
process.stdin.on('end', replay);
// Fixture mode doesn't depend on stdin; replay promptly if stdin never ends.
setTimeout(() => { if (process.env.PCC_FAKE_CLAUDE_FIXTURE) replay(); }, 500);
