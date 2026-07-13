// Harness tests for scripts/run-guarded.ps1 — the long-run forward-progress guard.
//
// The guard is the mandatory path for every long verification run; its whole job is to make
// "still running" a tool-proven fact and to ABORT a hung run instead of waiting forever. These
// tests prove each honest branch deterministically, with tiny fast child commands:
//   - a healthy command            -> PASSED,  exit 0
//   - a command that exits nonzero -> FAILED,  exit 1, real child exit captured
//   - a command that never outputs -> HUNG,    exit 3, aborted at ~StallSec (NOT forever), child killed
//   - a stale marked test process  -> REAPED before start, and actually dead afterward
//   - the reap SAFETY WALL         -> a marked process whose NAME is not allow-listed is NEVER killed
const { test, expect } = require('@playwright/test');
const { spawnSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const REPO = path.join(__dirname, '..', '..', '..');
const APP = path.join(REPO, 'app');
const SCRIPT = path.join(REPO, 'scripts', 'run-guarded.ps1');
const GUARD_EVIDENCE = path.join(REPO, '.cockpit', 'evidence', 'guard');

// In -Json mode the guard prints ONLY the verdict record to stdout (child output goes to the log
// files, all human lines are suppressed), so we can parse it straight back.
function runGuard(args) {
  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, ...args, '-Json'],
    { cwd: REPO, encoding: 'utf8', timeout: 120000, windowsHide: true });
  const text = (r.stdout || '').trim();
  const at = text.indexOf('{');
  const verdict = at >= 0 ? JSON.parse(text.slice(at)) : null;
  return { exit: r.status, verdict, stderr: r.stderr };
}

const spawned = [];
// A long-lived node process whose command line carries a unique marker (so the reap can find it by
// substring) and a distinct process name we control via the allow-list in the guard call.
function spawnMarker(marker) {
  const child = spawn('node', ['-e', `setInterval(() => {}, 100000); // ${marker}`], { windowsHide: true, detached: false });
  spawned.push(child);
  return child;
}
function isAlive(pid) { try { process.kill(pid, 0); return true; } catch (e) { return false; } }

test.afterAll(() => {
  for (const c of spawned) { try { process.kill(c.pid); } catch (e) { /* already gone */ } }
});

test('a healthy command is PASSED with exit 0', () => {
  const { exit, verdict } = runGuard(['-Label', 'gpass', '-SampleSec', '1', '-StallSec', '8', '-NoKillStale',
    '-Command', 'node -e "console.log(1)"']);
  expect(verdict.state).toBe('passed');
  expect(verdict.exit_code).toBe(0);
  expect(exit).toBe(0);
});

test('a nonzero-exit command is FAILED (exit 1) with the real child exit captured', () => {
  const { exit, verdict } = runGuard(['-Label', 'gfail', '-SampleSec', '1', '-StallSec', '8', '-NoKillStale',
    '-Command', 'node -e "process.exit(3)"']);
  expect(verdict.state).toBe('failed');
  expect(verdict.exit_code).toBe(3);
  expect(exit).toBe(1);
});

test('a command that never makes progress is declared HUNG and ABORTED near StallSec, not forever', () => {
  const started = Date.now();
  const { exit, verdict } = runGuard(['-Label', 'ghang', '-SampleSec', '1', '-StallSec', '3', '-NoKillStale',
    '-Command', 'node -e "setInterval(()=>{},100000)"']);
  const wall = (Date.now() - started) / 1000;
  expect(verdict.state).toBe('hung');
  expect(exit).toBe(3);                       // the machine-readable HUNG code
  expect(verdict.exit_code).toBeNull();       // no honest child exit — never faked to 0
  expect(verdict.elapsed_sec).toBeLessThan(20); // BOUNDED: proven to abort, the whole point
  expect(wall).toBeLessThan(30);
});

test('a stale marked test process is REAPED before start and is actually dead afterward', () => {
  const marker = 'pcc-guardtest-reap-A';
  const m = spawnMarker(marker);
  // give it a moment to appear in the process table with its command line populated
  spawnSync('pwsh', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 500'], { windowsHide: true });
  expect(isAlive(m.pid)).toBe(true);
  const { verdict } = runGuard(['-Label', 'greap', '-SampleSec', '1', '-StallSec', '8',
    '-KillStalePattern', marker, '-Command', 'node -e "console.log(1)"']);
  const reapedPids = (verdict.stale_reaped || []).map((x) => x.pid);
  expect(reapedPids).toContain(m.pid);
  // taskkill is synchronous-ish; poll briefly for the process to disappear.
  let dead = false;
  for (let i = 0; i < 20 && !dead; i++) { if (!isAlive(m.pid)) { dead = true; break; } spawnSync('pwsh', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 200'], { windowsHide: true }); }
  expect(dead).toBe(true);
});

test('a bad invocation exits with the SETUP-ERROR code (2), which the release gate maps to UNKNOWN not FAIL', () => {
  // Contract: exit 2 means "the guard could not even run", distinct from a real test failure (1) or a
  // hang (3). run-release-gate.ps1 relies on this to keep infra trouble out of the pass/fail verdict.
  const r = spawnSync('pwsh', ['-NoProfile', '-File', SCRIPT, '-Label', 'gsetup', '-NoKillStale', '-Command', '   '],
    { cwd: REPO, encoding: 'utf8', timeout: 30000 });
  expect(r.status).toBe(2);
});

test('the reap SAFETY WALL: a marked process whose name is not allow-listed is NEVER killed', () => {
  const marker = 'pcc-guardtest-wall-B';
  const m = spawnMarker(marker);
  spawnSync('pwsh', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 500'], { windowsHide: true });
  expect(isAlive(m.pid)).toBe(true);
  // Node process carries the marker, but we allow-list ONLY electron.exe, so node must be spared.
  const { verdict } = runGuard(['-Label', 'gwall', '-SampleSec', '1', '-StallSec', '8',
    '-KillStaleName', 'electron.exe', '-KillStalePattern', marker, '-Command', 'node -e "console.log(1)"']);
  expect((verdict.stale_reaped || []).length).toBe(0);
  expect(isAlive(m.pid)).toBe(true);          // the safety wall held: a non-allow-listed name survives
  try { process.kill(m.pid); } catch (e) { /* cleanup */ }
});

test('reap ignores an allow-listed process whose command line lacks the marker', () => {
  // The other half of the safety wall: name IS allow-listed (node.exe) but the marker is absent, so
  // the process must be spared. Prevents an over-broad reap from killing an unrelated node process.
  const m = spawnMarker('pcc-guardtest-unrelated-D');
  spawnSync('pwsh', ['-NoProfile', '-Command', 'Start-Sleep -Milliseconds 500'], { windowsHide: true });
  expect(isAlive(m.pid)).toBe(true);
  const { verdict } = runGuard(['-Label', 'gnomark', '-SampleSec', '1', '-StallSec', '8',
    '-KillStaleName', 'node.exe', '-KillStalePattern', 'a-marker-this-process-does-not-carry',
    '-Command', 'node -e "console.log(1)"']);
  expect((verdict.stale_reaped || []).length).toBe(0);
  expect(isAlive(m.pid)).toBe(true);
  try { process.kill(m.pid); } catch (e) { /* cleanup */ }
});

// --- ACTIVITY vs EVIDENCE PROGRESS (the Part 3 correction) ---------------------------------------

test('a CPU-burning infinite loop is HUNG within the evidence-stall bound, NOT at the hard cap', () => {
  // The core activity-vs-progress test. The child burns CPU forever but emits NO output — it is
  // ACTIVE but not ADVANCING. CPU buys only the small bounded grace, so it must abort at ~StallSec+
  // CpuGraceSec, far below the generous -MaxSec, proving CPU alone never postpones hang detection.
  const started = Date.now();
  const { exit, verdict } = runGuard(['-Label', 'gcpu', '-SampleSec', '1', '-StallSec', '3', '-CpuGraceSec', '2',
    '-MaxSec', '120', '-NoKillStale', '-Command', 'node -e "while(true){Math.sqrt(Math.random())}"']);
  const wall = (Date.now() - started) / 1000;
  expect(verdict.state).toBe('hung');
  expect(exit).toBe(3);
  expect(verdict.exit_code).toBeNull();          // no honest child exit — never faked to 0
  expect(verdict.elapsed_sec).toBeLessThan(20);  // aborted at StallSec+grace, NOT the 120s cap
  expect(wall).toBeLessThan(30);
});

test('a child that keeps producing output is NOT falsely hung, even past StallSec', () => {
  // Output growth is EVIDENCE progress, so a run that streams a line every 300ms keeps resetting the
  // stall clock and completes as PASSED — even though StallSec (2s) is shorter than the total runtime.
  // Also proves a legitimate short silent gap between ticks does not false-abort.
  const { exit, verdict } = runGuard(['-Label', 'gprog', '-SampleSec', '1', '-StallSec', '2', '-CpuGraceSec', '0',
    '-MaxSec', '60', '-NoKillStale',
    '-Command', 'node -e "let n=0;const t=setInterval(()=>{console.log(\'tick\',++n);if(n>=12){clearInterval(t);process.exit(0)}},300)"']);
  expect(verdict.state).toBe('passed');
  expect(exit).toBe(0);
});

test('a child that emits endless output but never finishes is stopped by the hard cap', () => {
  // Endless EVIDENCE progress (constant output) means the stall check never fires — so the hard
  // -MaxSec cap is the backstop that stops an endless-but-progressing run. Proven to abort at the cap.
  const started = Date.now();
  const { exit, verdict } = runGuard(['-Label', 'gcap', '-SampleSec', '1', '-StallSec', '30', '-MaxSec', '4',
    '-NoKillStale', '-Command', 'node -e "setInterval(()=>console.log(Date.now()),100)"']);
  const wall = (Date.now() - started) / 1000;
  expect(verdict.state).toBe('cap');
  expect(exit).toBe(4);
  expect(wall).toBeLessThan(25);
});

test('the verdict distinguishes evidence progress from CPU activity (atomically readable)', () => {
  // The heartbeat/verdict must separate "advanced" (evidence) from "busy" (activity). Both fields are
  // present and distinct, and the JSON parses cleanly (Write-JsonAtomic writes temp->move, so a reader
  // never sees a half-written record).
  const { verdict } = runGuard(['-Label', 'gfields', '-SampleSec', '1', '-StallSec', '8', '-NoKillStale',
    '-Command', 'node -e "console.log(1)"']);
  expect(verdict.schema).toMatch(/run-guarded\/v2/);
  expect(verdict).toHaveProperty('since_evidence_sec'); // evidence-progress clock
  expect(verdict).toHaveProperty('tree_cpu_ms');        // activity (diagnostic only)
  expect(verdict).toHaveProperty('cpu_grace_sec');      // the bounded grace, disclosed
  const hb = JSON.parse(fs.readFileSync(path.join(GUARD_EVIDENCE, 'gfields.heartbeat.json'), 'utf8'));
  expect(hb).toHaveProperty('since_evidence_sec');
  expect(hb).toHaveProperty('cpu_active');              // activity flag, kept separate from progress
});

// --- THE GUARD IS THE CANONICAL, NON-BYPASSABLE PATH (the Part 4 correction) ----------------------

test('the canonical `npm test` entrypoint (guarded-test.js) cannot silently bypass the guard', () => {
  // Running the canonical suite entrypoint with PCC_GUARDED unset MUST route through the guard: a
  // guard verdict is written. PCC_GUARD_INNER swaps the heavy suite for a trivial child so the test is
  // fast; PCC_GUARD_LABEL gives it a distinct label so it never collides with the outer guarded suite
  // this test may itself be running inside. The routing (not the suite) is what is under test.
  const verdictPath = path.join(GUARD_EVIDENCE, 'suite-bypasstest.verdict.json');
  try { fs.rmSync(verdictPath, { force: true }); } catch (e) { /* fresh */ }
  const r = spawnSync('node', ['tools/guarded-test.js'], {
    cwd: APP, encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, PCC_GUARD_INNER: 'node -e "process.exit(0)"', PCC_GUARDED: '', PCC_GUARD_LABEL: 'suite-bypasstest' },
  });
  expect(r.status).toBe(0);
  expect(fs.existsSync(verdictPath)).toBe(true);   // the guard actually wrapped the run
  const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
  expect(v.state).toBe('passed');
  expect(v.schema).toMatch(/run-guarded\/v2/);
});

test('an already-guarded suite run does NOT wrap itself in a second guard', () => {
  // Inside the guard (PCC_GUARDED=1), the canonical entrypoint runs the suite RAW — no nested guard,
  // no double reap. Proven by the absence of a fresh guard verdict for this inner run.
  const verdictPath = path.join(GUARD_EVIDENCE, 'suite-doubleguardtest.verdict.json');
  try { fs.rmSync(verdictPath, { force: true }); } catch (e) { /* fresh */ }
  const r = spawnSync('node', ['tools/guarded-test.js'], {
    cwd: APP, encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, PCC_GUARD_INNER: 'node -e "process.exit(0)"', PCC_GUARDED: '1', PCC_GUARD_LABEL: 'suite-doubleguardtest' },
  });
  expect(r.status).toBe(0);
  expect(fs.existsSync(verdictPath)).toBe(false);  // ran raw: no second guard verdict written
});

test('the canonical entrypoint forwards subset args (with spaces) to Playwright intact', () => {
  // Regression guard for a twice-flagged issue: subset args must survive the guard's `cmd /c` and reach
  // Playwright unmangled — boundaries intact, spaces preserved, cmd's %VAR% expansion avoided (args go
  // via a PowerShell -EncodedCommand, not a hand-quoted cmd string). We select an existing test by a
  // --grep that contains a SPACE; if forwarding mangled it, the grep would match nothing and Playwright
  // would exit nonzero -> guard state 'failed'. A clean PASS with real captured output proves the path
  // + spaced arg arrived intact. (Exact %/&/space survival through cmd->pwsh is proven separately in
  // docs/HARDENING_LONG_RUN_GUARD.md; here we assert the deterministic verdict, written last.)
  const verdictPath = path.join(GUARD_EVIDENCE, 'suite-argfwd.verdict.json');
  try { fs.rmSync(verdictPath, { force: true }); } catch (e) { /* fresh */ }
  const r = spawnSync('node', ['tools/guarded-test.js', 'tests/scripts/guarded.spec.js', '--grep', 'healthy command is PASSED'], {
    cwd: APP, encoding: 'utf8', timeout: 60000, windowsHide: true,
    env: { ...process.env, PCC_GUARDED: '', PCC_GUARD_LABEL: 'suite-argfwd' },
  });
  expect(r.status).toBe(0);
  expect(fs.existsSync(verdictPath)).toBe(true);
  const v = JSON.parse(fs.readFileSync(verdictPath, 'utf8'));
  expect(v.state).toBe('passed');           // the spaced --grep matched -> the arg arrived intact
  expect(v.output_bytes).toBeGreaterThan(0); // the inner suite actually produced output
});

test('the canonical mutation-proof command is bounded (routes through the guard)', () => {
  // With PCC_GUARDED unset, `run-mutation-proof.ps1` re-execs itself through the guard BEFORE it does
  // any real work. A deliberately-missing manifest makes the inner fail fast, but the guard verdict is
  // still written — proof the canonical command can never run unbounded.
  const verdictPath = path.join(GUARD_EVIDENCE, 'mutation-proof.verdict.json');
  try { fs.rmSync(verdictPath, { force: true }); } catch (e) { /* fresh */ }
  spawnSync('pwsh', ['-NoProfile', '-File', path.join(REPO, 'scripts', 'run-mutation-proof.ps1'),
    '-ManifestPath', path.join(REPO, 'scripts', '__no_such_manifest__.json')],
    { cwd: REPO, encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, PCC_GUARDED: '' } });
  expect(fs.existsSync(verdictPath)).toBe(true);
});

test('the canonical failure-injection command is bounded (routes through the guard)', () => {
  const verdictPath = path.join(GUARD_EVIDENCE, 'failure-injection.verdict.json');
  try { fs.rmSync(verdictPath, { force: true }); } catch (e) { /* fresh */ }
  spawnSync('pwsh', ['-NoProfile', '-File', path.join(REPO, 'scripts', 'run-failure-injection.ps1'),
    '-ManifestPath', path.join(REPO, 'scripts', '__no_such_manifest__.json')],
    { cwd: REPO, encoding: 'utf8', timeout: 60000, windowsHide: true, env: { ...process.env, PCC_GUARDED: '' } });
  expect(fs.existsSync(verdictPath)).toBe(true);
});
