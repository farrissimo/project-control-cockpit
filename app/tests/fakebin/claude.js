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

// Test-only instrumentation (mirrors PCC_FAKE_CLAUDE_FIXTURE's env-var-driven design, stays
// fully offline/deterministic): when set, record the exact args PCC invoked this fake with, so
// a test can prove a specific flag (e.g. --max-budget-usd) was actually passed, not just that
// the app didn't crash.
if (process.env.PCC_FAKE_CLAUDE_ARGV_FILE) {
  try { fs.writeFileSync(process.env.PCC_FAKE_CLAUDE_ARGV_FILE, JSON.stringify(process.argv.slice(2))); } catch (e) { /* best effort */ }
}

function replay() {
  if (done) return; done = true;
  const fx = process.env.PCC_FAKE_CLAUDE_FIXTURE;
  if (fx) {
    let f;
    try { f = JSON.parse(fs.readFileSync(fx, 'utf8')); }
    catch (e) { process.stderr.write('fixture load error: ' + e.message); return process.exit(1); }
    // Sequence mode: a fixture with a `sequence` array returns a DIFFERENT element per invocation, so
    // a test can drive multi-turn behavior (e.g. turn 1 = baseline tokens, turn 2 = baseline + growth).
    // Each `claude` spawn is a fresh process, so the turn index is persisted in a sidecar counter file
    // named by PCC_FAKE_CLAUDE_SEQ_STATE (required for sequence fixtures so parallel tests never collide).
    if (Array.isArray(f.sequence) && f.sequence.length) {
      const stateFile = process.env.PCC_FAKE_CLAUDE_SEQ_STATE;
      let idx = 0;
      if (stateFile) { try { idx = parseInt(fs.readFileSync(stateFile, 'utf8'), 10) || 0; } catch (e) { idx = 0; } }
      const pick = f.sequence[Math.min(idx, f.sequence.length - 1)];
      if (stateFile) { try { fs.writeFileSync(stateFile, String(idx + 1)); } catch (e) { /* best effort */ } }
      if (pick && pick.stderr) process.stderr.write(pick.stderr);
      return setTimeout(() => {
        if (pick && pick.stdout) process.stdout.write(pick.stdout);
        process.exit(pick && typeof pick.exitCode === 'number' ? pick.exitCode : 0);
      }, (pick && pick.delayMs) || 0);
    }
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
