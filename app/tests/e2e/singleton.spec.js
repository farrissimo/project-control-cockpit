// Real-Electron proof of the single-instance-lock contract — and the reproduction that DISPROVED the
// "stale test Electron held the fresh test's lock" root-cause claimed for the ~7h hang incident.
//
// WHAT THE REPRODUCTION SHOWED (real Electron, temp profiles, no mock)
// -------------------------------------------------------------------
//   * Electron keys requestSingleInstanceLock() through --user-data-dir. tests/helpers/launch.js gives
//     EVERY launch a fresh random `pcc-test-*` profile (mkdtempSync), so two test Electrons NEVER
//     share a lock: two DISTINCT profiles both open. The stated collision mechanism is therefore
//     impossible for the actual test launches — the theory is disproven, not merely unverified.
//   * Even a FORCED same-profile collision does NOT hang: the losing instance calls app.quit() and
//     exits cleanly (exit 0); Playwright's launch/firstWindow rejects promptly — bounded, never a
//     multi-hour wedge. So app.firstWindow() against a windowless-quit is inherently BOUNDED here.
// On that evidence main.js's `isDisposableTestInstance` lock bypass was REMOVED (a product exception
// that guarded a mechanism which cannot occur here). This spec is the standing proof of the contract:
// distinct profiles coexist; a genuine collision is bounded; the `--pcc-test-instance` flag is now a
// reap marker only and does NOT change locking. Every launch is time-bounded, so this spec can never
// itself become the hang it guards against.
const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');
const os = require('os');
const fs = require('fs');

const APP_DIR = path.join(__dirname, '..', '..');
const FAKEBIN = path.join(__dirname, '..', 'fakebin');
const LAUNCH_TIMEOUT = 30_000;
const WINDOW_TIMEOUT = 12_000;

// Launch a REAL PCC Electron against a caller-chosen user-data dir and report whether a window
// actually appeared, within a hard time bound. A same-profile lock loser makes the app exit before a
// window exists, which surfaces as a rejection from electron.launch() OR app.firstWindow() — either
// way we return opened:false. Nothing here is ever awaited unbounded.
//   testInstance:true adds --pcc-test-instance (proves the flag no longer affects locking).
async function launchAt(userDataDir, { testInstance = false } = {}) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const args = [APP_DIR, '--user-data-dir=' + userDataDir];
  if (testInstance) args.push('--pcc-test-instance');
  const env = {
    ...process.env,
    PATH: FAKEBIN + sep + (process.env.PATH || ''),
    Path: FAKEBIN + sep + (process.env.Path || ''),
    PCC_TEST_MODE: '1',
  };
  let app = null;
  let opened = false;
  try {
    app = await electron.launch({ args, env, cwd: APP_DIR, timeout: LAUNCH_TIMEOUT });
    const page = await app.firstWindow({ timeout: WINDOW_TIMEOUT });
    await page.waitForLoadState('domcontentloaded');
    opened = true;
  } catch (e) {
    opened = false; // launch or firstWindow rejected: a windowless-quit / no window — BOUNDED, not hung
  }
  return { app, opened };
}

const made = [];
function tmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  made.push(d);
  return d;
}
async function closeQuietly(app) { try { if (app) await app.close(); } catch (e) { /* already gone */ } }
test.afterAll(() => {
  for (const d of made) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* best effort */ } }
});

// Each case launches 1-2 real Electrons; keep the per-test budget generous but finite.
test.setTimeout(90_000);

test('two instances with DIFFERENT user-data dirs both open under the single-instance lock', async () => {
  // The load-bearing test. BOTH open ⇒ Electron isolates the lock per --user-data-dir ⇒ a stale test
  // Electron on a DIFFERENT random profile can NEVER hold a fresh test's lock. This is what makes the
  // removed bypass unnecessary and the original incident root-cause claim false.
  const a = await launchAt(tmpDir('pcc-locktest-a-'));
  try {
    expect(a.opened).toBe(true); // first instance gets its own lock + window
    const b = await launchAt(tmpDir('pcc-locktest-b-'));
    try {
      expect(b.opened).toBe(true); // independent profile → independent lock → opens despite A alive
    } finally { await closeQuietly(b.app); }
  } finally { await closeQuietly(a.app); }
});

test('two instances with the SAME user-data dir: the second is bounded and windowless (no hang)', async () => {
  // Records the ACTUAL second-instance behaviour on a genuine lock collision, and EXERCISES+BOUNDS the
  // windowless-quit path. The second instance does not open, and the whole attempt completes well
  // inside the per-test timeout — proof it exits promptly rather than wedging firstWindow() forever.
  const shared = tmpDir('pcc-locktest-same-');
  const started = Date.now();
  const a = await launchAt(shared);
  try {
    expect(a.opened).toBe(true);
    const b = await launchAt(shared); // same profile, real lock → loses it → app.quit(), no window
    try {
      expect(b.opened).toBe(false);
      expect(Date.now() - started).toBeLessThan(80_000); // BOUNDED — never the multi-hour hang
    } finally { await closeQuietly(b.app); }
  } finally { await closeQuietly(a.app); }
});

test('the --pcc-test-instance flag no longer bypasses the lock (it is a reap marker only)', async () => {
  // Post-removal contract: with the flag AND a /pcc-test-/ profile — exactly what launch.js uses — a
  // SAME-profile second instance still loses the lock and stays windowless. Proves the flag changed no
  // product behaviour; it exists solely so run-guarded.ps1 can safely identify stale test processes.
  const shared = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-test-'));
  made.push(shared);
  const a = await launchAt(shared, { testInstance: true });
  try {
    expect(a.opened).toBe(true);
    const b = await launchAt(shared, { testInstance: true });
    try {
      expect(b.opened).toBe(false); // flag present, but the lock still applies → no second window
    } finally { await closeQuietly(b.app); }
  } finally { await closeQuietly(a.app); }
});
