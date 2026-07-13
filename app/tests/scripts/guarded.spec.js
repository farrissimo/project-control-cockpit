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

const REPO = path.join(__dirname, '..', '..', '..');
const SCRIPT = path.join(REPO, 'scripts', 'run-guarded.ps1');

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
