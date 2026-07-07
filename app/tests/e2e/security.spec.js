// Electron security regression guards. These protect the trust boundary between
// the renderer (which renders untrusted worker output) and the main process.
// Runtime checks prove the live page is sandboxed; static checks prove the
// config that makes it so isn't quietly regressed.
const { test, expect } = require('@playwright/test');
const { launchApp, closeApp } = require('../helpers/launch');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', '..');

let app, page;
test.beforeAll(async () => { ({ app, page } = await launchApp()); });
test.afterAll(async () => { await closeApp(app); });

test('renderer is sandboxed: no Node, no raw ipcRenderer, only the pcc bridge', async () => {
  const probe = await page.evaluate(() => ({
    hasPcc: typeof window.pcc === 'object' && window.pcc !== null,
    hasRequire: typeof window.require !== 'undefined',
    hasProcess: typeof window.process !== 'undefined',
    hasModule: typeof window.module !== 'undefined',
    hasIpcRenderer: typeof window.ipcRenderer !== 'undefined',
  }));
  expect(probe.hasPcc).toBe(true);          // the narrow API is present
  expect(probe.hasRequire).toBe(false);     // nodeIntegration off
  expect(probe.hasProcess).toBe(false);
  expect(probe.hasModule).toBe(false);
  expect(probe.hasIpcRenderer).toBe(false); // no raw ipc exposed to the page
});

test('main process pins the secure webPreferences', () => {
  const src = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
  expect(src).toMatch(/contextIsolation:\s*true/);
  expect(src).toMatch(/nodeIntegration:\s*false/);
});

test('preload exposes only the pcc bridge (no raw ipcRenderer)', () => {
  const src = fs.readFileSync(path.join(APP, 'preload.js'), 'utf8');
  const exposeCalls = src.match(/exposeInMainWorld\(/g) || [];
  expect(exposeCalls.length).toBe(1);
  expect(src).toMatch(/exposeInMainWorld\(\s*['"]pcc['"]/);
  // ipcRenderer may be used INSIDE wrappers, but must never itself be exposed.
  expect(src).not.toMatch(/exposeInMainWorld\(\s*['"]ipcRenderer['"]/);
});

test('a Content-Security-Policy is declared', () => {
  const html = fs.readFileSync(path.join(APP, 'renderer', 'index.html'), 'utf8');
  expect(html).toMatch(/http-equiv=["']Content-Security-Policy["']/i);
  expect(html).toMatch(/default-src\s+'self'/);
});

test('app invokes pwsh (PowerShell 7), never powershell.exe (5.1)', () => {
  // PS 5.1 and PS 7 differ materially on default output encoding; the app pins
  // pwsh so its behavior is consistent. Guard against a regression to 5.1.
  const src = fs.readFileSync(path.join(APP, 'main.js'), 'utf8');
  expect(src).toMatch(/\bpwsh\b/);
  expect(src).not.toMatch(/\bpowershell\.exe\b/);
});
