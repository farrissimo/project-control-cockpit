// PCC Cockpit - Electron main process.
//
// A real desktop app with a chat that talks to Claude Code (the worker the
// owner already runs) through its SUPPORTED non-interactive mode (`claude -p`),
// NOT by wrapping the interactive terminal - so a Claude Code update can't
// brick it. The owner's standing rules load automatically because Claude Code
// reads CLAUDE.md from the project directory on its own; nothing is injected
// into the prompt stream, so we don't bust Claude's prompt cache.

const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, exec } = require('child_process');

const PROJECT_DIR = path.join(__dirname, '..');
const COCKPIT = path.join(PROJECT_DIR, '.cockpit');

let conversationStarted = false;

function readJson(...rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(COCKPIT, ...rel), 'utf8'));
  } catch (e) {
    return { _error: e.message };
  }
}

ipcMain.handle('pcc:getState', () => ({
  project: readJson('state', 'project-state.json'),
  task: readJson('state', 'task-state.json'),
}));

// Read the standing rules (CLAUDE.md) so the Rules view can show exactly what
// loads into every Claude session. Read-only.
ipcMain.handle('pcc:getRules', () => {
  try {
    return { ok: true, text: fs.readFileSync(path.join(PROJECT_DIR, 'CLAUDE.md'), 'utf8') };
  } catch (e) {
    return { ok: false, text: null };
  }
});

// Project memory: a plain-text brief (PROJECT.md) the owner curates and Claude
// reads at the start of every session (CLAUDE.md points to it). No fake
// auto-extraction - it is exactly what is written here, nothing more.
const MEMORY_PATH = path.join(PROJECT_DIR, 'PROJECT.md');

ipcMain.handle('pcc:getMemory', () => {
  try { return { ok: true, text: fs.readFileSync(MEMORY_PATH, 'utf8') }; }
  catch (e) { return { ok: true, text: '' }; }
});

ipcMain.handle('pcc:saveMemory', (_e, text) => {
  try { fs.writeFileSync(MEMORY_PATH, String(text), 'utf8'); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});

// Independent verification: drive Codex CLI's supported non-interactive mode
// (`codex exec`) in a read-only sandbox, so the verifier can inspect and run
// checks but cannot change anything. Codex reads AGENTS.md for the verdict
// format. The worker (Claude) never grades its own work.
// Independent verification runs through one reusable script (scripts/
// verify-work.ps1): Codex primary, Antigravity/agy fallback. The app button and
// scheduled after-10am-MT test both call it, so there is one source of truth.
ipcMain.handle('pcc:verify', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/verify-work.ps1', { cwd: PROJECT_DIR, maxBuffer: 12 * 1024 * 1024, timeout: 200000, windowsHide: true }, (err, stdout, stderr) => {
    const out = (stdout || '').trim();
    if (out) return resolve({ ok: true, text: out });
    if (err) return resolve({ ok: false, text: 'Verification could not run: ' + (err.killed ? 'timed out' : (stderr || err.message)) });
    resolve({ ok: true, text: (stderr || '(no output)').trim() });
  });
}));

// Hard checks - deterministic facts, no LLM, always available: PCC's own
// health check plus the git working-tree/scope facts.
function runCmd(cmd, timeout) {
  return new Promise((res) => exec(cmd, { cwd: PROJECT_DIR, maxBuffer: 8 * 1024 * 1024, timeout: timeout || 60000, windowsHide: true }, (e, so, se) => {
    let out = ((so || '') + (se ? ('\n' + se) : '')).trim();
    out = out.replace(/\x1b\[[0-9;]*m/g, ''); // strip terminal color codes
    res(out || (e ? e.message : '(no output)'));
  }));
}

ipcMain.handle('pcc:hardChecks', async () => {
  const git = await runCmd('git status --short --branch');
  const doctor = await runCmd('pwsh -NoProfile -File scripts/doctor.ps1', 120000);
  return { git, doctor };
});

// Send a message to Claude Code non-interactively. The prompt goes in over
// stdin (so quotes/newlines in the message can never break shell parsing).
// After the first turn we pass --continue so Claude keeps the conversation.
function askClaude(message) {
  return new Promise((resolve) => {
    const args = ['-p'];
    if (conversationStarted) args.push('--continue');
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn('claude', args, { cwd: PROJECT_DIR, shell: true });
    } catch (e) {
      return resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message });
    }
    child.on('error', (e) => resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message }));
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      conversationStarted = true;
      if (code === 0) resolve({ ok: true, text: out.trim() });
      else resolve({ ok: false, text: (err || out || ('Claude exited with code ' + code)).trim() });
    });
    child.stdin.write(message);
    child.stdin.end();
  });
}

ipcMain.handle('pcc:send', (_e, message) => askClaude(message));

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    backgroundColor: '#101216',
    title: 'PCC Cockpit',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
