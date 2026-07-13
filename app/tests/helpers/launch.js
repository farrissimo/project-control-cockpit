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

async function launchApp(extraEnv = {}) {
  const sep = process.platform === 'win32' ? ';' : ':';
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pcc-test-'));
  const env = {
    ...process.env,
    PATH: FAKEBIN + sep + (process.env.PATH || ''),
    Path: FAKEBIN + sep + (process.env.Path || ''),          // Windows env var casing
    PCC_TEST_MODE: '1',
    ...extraEnv,
  };
  const app = await electron.launch({
    // --pcc-test-instance is an unmistakable marker no real launch ever carries. Two jobs:
    //   (1) main.js only skips the single-instance lock when it sees this flag (so an accidentally
    //       inherited PCC_TEST_MODE on a normal launch can't disable the lock on the real profile);
    //   (2) scripts/run-guarded.ps1 reaps stale test electrons by matching THIS flag in the command
    //       line, never a loose 'pcc-test' substring that could hit an unrelated user process.
    args: [APP_DIR, '--user-data-dir=' + userDataDir, '--pcc-test-instance'],
    env,
    cwd: APP_DIR,
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  app._pccUserDataDir = userDataDir;
  return { app, page };
}

async function closeApp(app) {
  try { await app.close(); } catch (e) { /* already gone */ }
  try { if (app && app._pccUserDataDir) fs.rmSync(app._pccUserDataDir, { recursive: true, force: true }); }
  catch (e) { /* temp dir cleanup is best-effort */ }
}

module.exports = { launchApp, closeApp, APP_DIR, FAKEBIN };
