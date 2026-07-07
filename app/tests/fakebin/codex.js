// Fake `codex` verifier for tests. Two modes:
//  1. Default: print output that serves BOTH consumers — verify-work.ps1 (needs a
//     VERDICT line) and second-opinion.ps1 (needs a recognizable reply).
//  2. Fixture replay: if PCC_FAKE_CODEX_FIXTURE points at a JSON fixture
//     ({stdout, stderr, exitCode, delayMs}), replay it — so tests can drive real
//     verifier shapes (FAIL / INSUFFICIENT / malformed / out-of-usage) and prove
//     the app never turns them into a fake PASS. Never calls real Codex.
const fs = require('fs');

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
} else {
  process.stdout.write(
    'AGREE\n'
    + 'FAKE-CODEX-REPLY: deterministic stub for verify + second-opinion\n'
    + 'VERDICT: PASS\n'
    + 'EVIDENCE:\n- fake verifier: deterministic test output\n'
    + 'NOT PROVEN: this is a stubbed verifier used only in the test suite\n'
  );
  process.exit(0);
}
