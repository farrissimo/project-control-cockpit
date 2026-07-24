// Fake `claude` worker for tests. Modes:
//  1. Default (cold): drain stdin, print a deterministic canned reply, exit.
//  2. Fixture replay: PCC_FAKE_CLAUDE_FIXTURE -> replay {stdout,stderr,exitCode,delayMs} (or a
//     `sequence` array, one element per spawn) verbatim, so tests drive ugly real boundary shapes.
//  3. Persistent stream-json (warm, ADR-0020 T3): when spawned with `--input-format stream-json` and
//     NO fixture, behave like the real warm worker — read newline-delimited JSON user messages, emit
//     ONE stream-json `result` event per message, and STAY ALIVE until stdin closes. This is what lets
//     the persistent-worker path be exercised in e2e without the real, paid CLI.
// NEVER calls the real Claude Code — tests stay offline, free, deterministic.
const fs = require('fs');
const argv = process.argv.slice(2);
let input = '';
let done = false;

// Test-only instrumentation: record the exact args PCC invoked this fake with (all modes), so a test
// can prove a specific flag (e.g. --max-budget-usd, --max-turns) was actually passed.
if (process.env.PCC_FAKE_CLAUDE_ARGV_FILE) {
  try { fs.writeFileSync(process.env.PCC_FAKE_CLAUDE_ARGV_FILE, JSON.stringify(argv)); } catch (e) { /* best effort */ }
}

const FIXTURE = process.env.PCC_FAKE_CLAUDE_FIXTURE;
function streamInput() {
  const i = argv.indexOf('--input-format');
  return i !== -1 && argv[i + 1] === 'stream-json';
}

// Build the canned reply for a given owner-message text (mirrors the cold default reply).
function cannedReply(text) {
  let out = 'FAKE-CLAUDE-REPLY: received ' + String(text).trim().length + ' chars.';
  if (/copy block/i.test(text)) out += '\n\n```\nsample copy block content\n```';
  return out;
}
// Extract the text content from one stream-json user-message line (concat text blocks).
function userText(line) {
  try {
    const m = JSON.parse(line);
    let t = '';
    const content = m && m.message && m.message.content;
    if (Array.isArray(content)) { for (const c of content) if (c && c.type === 'text' && c.text) t += c.text; }
    return t;
  } catch (e) { return ''; }
}

if (streamInput() && !FIXTURE) {
  // Warm persistent worker: one `result` per JSONL user message; stay alive; exit only on stdin end.
  // No usage/cost fields are emitted, so parseStreamCost/Usage stay null (matches the old plain-text
  // fake) — usage attribution with real numbers is proven separately by the real-Claude evidence.
  let buf = '';
  const delay = parseInt(process.env.PCC_FAKE_DELAY_MS || '0', 10) || 0; // model a slow turn (timer tests)
  process.stdin.on('data', (d) => {
    buf += d.toString();
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const reply = cannedReply(userText(line));
      const evt = { type: 'result', subtype: 'success', is_error: false, result: reply, num_turns: 1, session_id: 'fake' };
      const emit = () => process.stdout.write(JSON.stringify(evt) + '\n'); // one result per owner message; process stays alive
      if (delay > 0) setTimeout(emit, delay); else emit();
    }
  });
  process.stdin.on('end', () => process.exit(0));
} else {
  // Cold path: fixture replay (incl. multi-turn `sequence`) or the plain canned reply.
  const replay = () => {
    if (done) return; done = true;
    if (FIXTURE) {
      let f;
      try { f = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')); }
      catch (e) { process.stderr.write('fixture load error: ' + e.message); return process.exit(1); }
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
    const out = cannedReply(input);
    const delay = parseInt(process.env.PCC_FAKE_DELAY_MS || '0', 10) || 0;
    setTimeout(() => { process.stdout.write(out); process.exit(0); }, delay);
  };

  process.stdin.on('data', (d) => { input += d.toString(); });
  process.stdin.on('end', replay);
  // Fixture mode doesn't depend on stdin ending (the warm path keeps stdin open): replay promptly.
  setTimeout(() => { if (FIXTURE) replay(); }, 500);
}
