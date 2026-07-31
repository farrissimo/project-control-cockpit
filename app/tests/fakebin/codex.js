// Fake `codex` verifier for tests. Two modes:
//  1. Default: print output that serves BOTH consumers — verify-work.ps1 (needs a
//     VERDICT line) and second-opinion.ps1 (needs a recognizable reply).
//  2. Fixture replay: if PCC_FAKE_CODEX_FIXTURE points at a JSON fixture
//     ({stdout, stderr, exitCode, delayMs}), replay it — so tests can drive real
//     verifier shapes (FAIL / INSUFFICIENT / malformed / out-of-usage) and prove
//     the app never turns them into a fake PASS. Never calls real Codex.
const fs = require('fs');
const argv = process.argv.slice(2);
let input = '';

function captureInvocation() {
  const file = process.env.PCC_FAKE_CODEX_ARGV_FILE;
  if (!file) return;
  try { fs.writeFileSync(file, JSON.stringify({ argv, input }, null, 2), 'utf8'); } catch (e) { /* best effort test aid */ }
}

function argValue(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

function cannedReply(text) {
  let out = 'FAKE-CODEX-REPLY: received ' + String(text).trim().length + ' chars.';
  if (/copy block/i.test(text)) out += '\n\n```\nsample copy block content\n```';
  return out;
}

const fx = process.env.PCC_FAKE_CODEX_FIXTURE;
if (fx) {
  let f;
  try { f = JSON.parse(fs.readFileSync(fx, 'utf8')); }
  catch (e) { process.stderr.write('fixture load error: ' + e.message); process.exit(1); }
  if (f.stderr) process.stderr.write(f.stderr);
  setTimeout(() => {
    if (f.stdout) process.stdout.write(f.stdout);
    process.exit(typeof f.exitCode === 'number' ? f.exitCode : 0);
  }, f.delayMs || 0);
} else if (argValue('-o') || argValue('--output-last-message')) {
  const outFile = argValue('-o') || argValue('--output-last-message');
  const finish = () => {
    const delay = parseInt(process.env.PCC_FAKE_DELAY_MS || process.env.PCC_FAKE_CODEX_DELAY_MS || '0', 10) || 0;
    setTimeout(() => {
      captureInvocation();
      try { if (outFile) fs.writeFileSync(outFile, cannedReply(input), 'utf8'); } catch (e) { process.stderr.write('write error: ' + e.message); process.exit(1); return; }
      process.stdout.write('FAKE-CODEX-EXEC\n');
      process.exit(0);
    }, delay);
  };
  process.stdin.on('data', (d) => { input += d.toString(); });
  process.stdin.on('end', finish);
} else {
  captureInvocation();
  process.stdout.write(
    'AGREE\n'
    + 'FAKE-CODEX-REPLY: deterministic stub for verify + second-opinion\n'
    + 'VERDICT: PASS\n'
    + 'EVIDENCE:\n- fake verifier: deterministic test output\n'
    + 'NOT PROVEN: this is a stubbed verifier used only in the test suite\n'
  );
  process.exit(0);
}
