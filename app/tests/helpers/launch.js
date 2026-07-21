// Shared Electron-launch helper for Playwright tests. Launches the REAL PCC
// Electron app, but:
//   1. Prepends tests/fakebin to PATH so any `claude`/`codex`/`agy` the app
//      spawns resolves to the deterministic fakes — never the real, paid,
//      non-deterministic worker/verifier. (Local PowerShell detectors still
//      run for real; they're fast and safe.)
//   2. Points Electron at a throwaway user-data dir so localStorage (chat
//      history, model choice) never leaks between tests — each launch is clean.
const path = require('path');
const os = require('os');
const fs = require('fs');
const { _electron: electron } = require('@playwright/test');

const APP_DIR = path.join(__dirname, '..', '..');            // app/
const FAKEBIN = path.join(__dirname, '..', 'fakebin');       // app/tests/fakebin

async function launchApp(extraEnv = {}, opts = {}) {
  const sep = process.platform === 'win32' ? ';' : ':';
  // opts.userDataDir: reuse a caller-owned dir so state survives a close+relaunch (restart tests).
  // The caller owns its cleanup, so closeApp must NOT delete it — flagged via _pccKeepUserDataDir.
  const userDataDir = opts.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-test-'));
  // Normal launches PREPEND fakebin so any claude/codex the app spawns resolves to the
  // deterministic fakes. opts.rawPath REPLACES PATH entirely (no fakebin) — used only by the
  // preflight real-detection test, which needs a genuinely tool-less PATH so the real `where`
  // lookup reports "missing" through detectTools() itself, not the PCC_FAKE_MISSING_TOOLS seam.
  const pathValue = opts.rawPath != null ? opts.rawPath : (FAKEBIN + sep + (process.env.PATH || ''));
  const env = {
    ...process.env,
    PATH: pathValue,
    Path: pathValue,                                         // Windows env var casing
    PCC_TEST_MODE: '1',
    ...extraEnv,
  };
  const app = await electron.launch({
    // --pcc-test-instance is an unmistakable marker no real launch ever carries. Its ONLY job is to
    // let scripts/run-guarded.ps1 identify and reap stale test electrons by matching THIS flag in the
    // command line (never a loose 'pcc-test' substring that could hit an unrelated user process). It
    // does NOT change any product behaviour: each launch already gets its own throwaway
    // --user-data-dir, so it simply takes the normal single-instance lock on its own isolated profile
    // (the former lock bypass was removed — see main.js / app/tests/e2e/singleton.spec.js).
    args: [APP_DIR, '--user-data-dir=' + userDataDir, '--pcc-test-instance'],
    env,
    cwd: APP_DIR,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  app._pccUserDataDir = userDataDir;
  app._pccKeepUserDataDir = !!opts.userDataDir; // caller-owned dir: don't delete it on close
  return { app, page };
}

async function closeApp(app) {
  try { await app.close(); } catch (e) { /* already gone */ }
  try { if (app && app._pccUserDataDir && !app._pccKeepUserDataDir) fs.rmSync(app._pccUserDataDir, { recursive: true, force: true }); }
  catch (e) { /* temp dir cleanup is best-effort */ }
}

module.exports = { launchApp, closeApp, APP_DIR, FAKEBIN };
