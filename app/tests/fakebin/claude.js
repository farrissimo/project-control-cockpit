// Fake `claude` worker for tests. Drains stdin (so main.js's stdin.write/end
// never hits EPIPE) and prints a deterministic canned reply. NEVER calls the
// real Claude Code — tests must be offline, free, and repeatable.
let input = '';
process.stdin.on('data', (d) => { input += d.toString(); });
process.stdin.on('end', () => {
  // Echo a stable, recognizable reply. If the prompt asks for a copy block,
  // include a fenced block so the renderer's copy-block path is exercised.
  const wantsBlock = /copy block/i.test(input);
  let out = 'FAKE-CLAUDE-REPLY: received ' + input.trim().length + ' chars.';
  if (wantsBlock) out += '\n\n```\nsample copy block content\n```';
  // Optional delay so a test can observe the app's in-flight (busy) state.
  const delay = parseInt(process.env.PCC_FAKE_DELAY_MS || '0', 10) || 0;
  setTimeout(() => { process.stdout.write(out); process.exit(0); }, delay);
});
// If stdin never ends (shouldn't happen), don't hang forever.
setTimeout(() => { process.stdout.write('FAKE-CLAUDE-REPLY: (no stdin)'); process.exit(0); }, 4000);
