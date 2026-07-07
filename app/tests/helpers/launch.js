// Shared Electron-launch helper for Playwright tests. Launches the REAL PCC
// Electron app, but prepends tests/fakebin to PATH so any `claude`/`codex`/`agy`
// the app spawns resolves to the deterministic fakes — never the real,
// paid, non-deterministic worker/verifier. The deterministic PowerShell
// detectors still run for real (they're local, fast, and safe).
const path = require('path');
const { _electron: electron } = require('@playwright/test');

const APP_DIR = path.join(__dirname, '..', '..');            // app/
const FAKEBIN = path.join(__dirname, '..', 'fakebin');       // app/tests/fakebin

async function launchApp() {
  const sep = process.platform === 'win32' ? ';' : ':';
  const env = {
    ...process.env,
    PATH: FAKEBIN + sep + (process.env.PATH || ''),
    Path: FAKEBIN + sep + (process.env.Path || ''),          // Windows env var casing
    PCC_TEST_MODE: '1',
  };
  const app = await electron.launch({ args: [APP_DIR], env, cwd: APP_DIR });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

module.exports = { launchApp, APP_DIR, FAKEBIN };
