// Fake `agy` reviewer for tests. Supports both the plain second-opinion path and
// fixture replay for unavailable/error cases. Never calls the real Antigravity CLI.
const fs = require('fs');
const argv = process.argv.slice(2);

function captureInvocation() {
  const file = process.env.PCC_FAKE_AGY_ARGV_FILE;
  if (!file) return;
  try { fs.writeFileSync(file, JSON.stringify({ argv }, null, 2), 'utf8'); } catch (e) { /* best effort test aid */ }
}

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

function cannedReply(text) {
  let out = 'FAKE-AGY-REPLY: received ' + String(text).trim().length + ' chars.';
  if (/copy block/i.test(text)) out += '\n\n```\nsample AG copy block content\n```';
  return out;
}

const fx = process.env.PCC_FAKE_AGY_FIXTURE;
if (fx) {
  let f;
  try { f = JSON.parse(fs.readFileSync(fx, 'utf8')); }
  catch (e) { process.stderr.write('fixture load error: ' + e.message); process.exit(1); }
  if (f.stderr) process.stderr.write(f.stderr);
  setTimeout(() => {
    if (f.stdout) process.stdout.write(f.stdout);
    process.exit(typeof f.exitCode === 'number' ? f.exitCode : 0);
  }, f.delayMs || 0);
} else if (argValue('-p') || argValue('--print') || argValue('--prompt')) {
  captureInvocation();
  const text = argValue('-p') || argValue('--print') || argValue('--prompt') || '';
  process.stdout.write(cannedReply(text));
  process.exit(0);
} else {
  captureInvocation();
  process.stdout.write('FAKE-AGY-REPLY: deterministic stub\n');
  process.exit(0);
}
