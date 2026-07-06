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
const crypto = require('crypto');
const { spawn, exec } = require('child_process');

const PROJECT_DIR = path.join(__dirname, '..');
const COCKPIT = path.join(PROJECT_DIR, '.cockpit');

// PCC drives Claude Code through the owner's claude.ai LOGIN, not a paid API key
// (DECISION-003: no paid-API dependency). If ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN
// are present in the environment, Claude Code uses them instead of the login -
// billing the metered API per message and disabling claude.ai org connectors.
// Scrub them from THIS process so every `claude -p` we spawn falls back to the
// login. This only affects PCC's own child processes; the machine-wide User
// variable is left untouched (remove it yourself if you want it gone everywhere).
for (const k of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN']) delete process.env[k];

// BUG FOUND AND FIXED (owner report, 2026-07-06): Claude Code's `--continue`
// resumes "the most recent conversation IN THE CURRENT DIRECTORY" - not this
// app's specific conversation. Proven by direct test: an unrelated `claude -p`
// call from the same repo directory (e.g. any manual testing while the app is
// open) silently hijacks the app's next `--continue`, so the chat replies as a
// stranger with no memory of its own prior turn. Fix: pin every conversation to
// its own UUID (`--session-id` on the first turn, `--resume <uuid>` after),
// which is immune to other claude invocations in the same directory - proven
// with the same interloper test (resumed the pinned session correctly even
// after an unrelated call ran in between).
let sessionId = null;

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

// New-chat handoff: assemble a ready-to-paste briefing from real repo truth so
// the owner never re-briefs a fresh chat by hand. Deterministic script; the app
// only displays and copies it.
ipcMain.handle('pcc:handoff', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/generate-handoff.ps1', { cwd: PROJECT_DIR, maxBuffer: 4 * 1024 * 1024, timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
    const out = (stdout || '').trim();
    if (out) return resolve({ ok: true, text: out });
    resolve({ ok: false, text: 'Could not generate handoff: ' + (err ? (stderr || err.message) : 'no output') });
  });
}));

ipcMain.handle('pcc:hardChecks', async () => {
  const git = await runCmd('git status --short --branch');
  const doctor = await runCmd('pwsh -NoProfile -File scripts/doctor.ps1', 120000);
  return { git, doctor };
});

// Detections - the "human smoke alarm" jobs from DECISION-102, each a
// deterministic script that emits the honest four-part format (Observed / what
// it might mean / what's NOT proven / what to do). The app is a pure consumer:
// it runs the script with -Json and renders the result, never judging itself.
// Add new detectors here as their scripts land; the CLI works without app/.
function runDetector(script) {
  return new Promise((resolve) => {
    exec('pwsh -NoProfile -File ' + script + ' -Json', { cwd: PROJECT_DIR, maxBuffer: 8 * 1024 * 1024, timeout: 30000, windowsHide: true }, (err, stdout) => {
      const out = (stdout || '').trim();
      try { resolve(JSON.parse(out)); }
      catch (e) { resolve({ detector: script, signal: 'unknown', observed: 'Detector could not run: ' + (err ? err.message : 'no output'), might_mean: '', not_proven: '', what_to_do: '', items: [] }); }
    });
  });
}

// Babysitting-reduction metrics: observable proxies only (never a fake score).
ipcMain.handle('pcc:metrics', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/babysitting-metrics.ps1 -Json', { cwd: PROJECT_DIR, maxBuffer: 4 * 1024 * 1024, timeout: 20000, windowsHide: true }, (err, stdout) => {
    try { resolve(JSON.parse((stdout || '').trim())); }
    catch (e) { resolve(null); }
  });
}));

// Recent decisions: carry-forward memory so "what did we decide?" is one click
// away, read straight from the canonical log (docs/DECISIONS.md).
ipcMain.handle('pcc:recentDecisions', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/recent-decisions.ps1 -Json -Count 6', { cwd: PROJECT_DIR, maxBuffer: 4 * 1024 * 1024, timeout: 20000, windowsHide: true }, (err, stdout) => {
    try { resolve(JSON.parse((stdout || '').trim())); }
    catch (e) { resolve({ decisions: [], found: 0, showing: 0 }); }
  });
}));

// Lifecycle: the declared stage map + where you are + the legal next stages.
// Read-only consumer of the same deterministic script the CLI uses.
ipcMain.handle('pcc:lifecycle', async () => runDetector('scripts/lifecycle-status.ps1'));

ipcMain.handle('pcc:detections', async () => ({
  untracked: await runDetector('scripts/detect-untracked.ps1'),
  drift: await runDetector('scripts/detect-drift.ps1'),
  staleDocs: await runDetector('scripts/detect-stale-docs.ps1'),
  repoSync: await runDetector('scripts/detect-repo-sync.ps1'),
  bloat: await runDetector('scripts/detect-bloat.ps1'),
}));

// Trust-strip extras: the two honest facts the always-visible strip needs
// beyond the detectors. "Rules loaded" is just whether CLAUDE.md exists (the
// rules DO auto-load into every Claude session; this proves they are present,
// not that the AI obeyed them). Verification is read from the file the
// scheduled run writes, and is only called fresh if it is newer than HEAD -
// so the strip never claims "verified" for work committed after the check.
ipcMain.handle('pcc:trustExtras', () => new Promise((resolve) => {
  const rulesLoaded = fs.existsSync(path.join(PROJECT_DIR, 'CLAUDE.md'));
  const vPath = path.join(PROJECT_DIR, 'app', 'last-verification.txt');
  let verification = { present: false };
  try {
    if (fs.existsSync(vPath)) {
      const st = fs.statSync(vPath);
      const text = fs.readFileSync(vPath, 'utf8');
      const m = text.match(/\b(PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE)\b/);
      verification = { present: true, verdict: m ? m[1] : null, mtimeEpoch: Math.floor(st.mtimeMs / 1000) };
    }
  } catch (e) { /* leave present:false */ }
  exec('git log -1 --format=%ct', { cwd: PROJECT_DIR, timeout: 10000, windowsHide: true }, (err, stdout) => {
    const headEpoch = parseInt((stdout || '').trim(), 10) || 0;
    resolve({ rulesLoaded, verification, headCommitEpoch: headEpoch });
  });
}));

// Model config: an editable list + default + fallback chain, so the app never
// hard-codes models. If the chosen model is retired/unavailable, Claude Code's
// --fallback-model quietly tries the chain instead of crashing.
function readModels() {
  const fallback = { default: 'claude-sonnet-5', fallback_chain: 'claude-sonnet-5',
    models: [{ id: 'claude-sonnet-5', label: 'Sonnet 5 (default)' }] };
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(COCKPIT, 'state', 'models.json'), 'utf8'));
    return { default: cfg.default || fallback.default, fallback_chain: cfg.fallback_chain || cfg.default || fallback.fallback_chain, models: cfg.models || fallback.models };
  } catch (e) { return fallback; }
}

ipcMain.handle('pcc:getModels', () => readModels());

// Start a fresh chat: assign a brand-new pinned session id, so the next
// message starts an isolated conversation. (The renderer also clears its own
// history.)
ipcMain.handle('pcc:newChat', () => { sessionId = null; return { ok: true }; });

// The chat panel is text-only (no interactive pickers). Tell the worker so it
// answers in plain text and never narrates internal tool failures. BUG FOUND by
// owner: the worker sometimes called the interactive AskUserQuestion tool, which
// can't render here, then replied "The question prompt isn't working in this
// session..." - a confusing non-answer. We both disallow that tool and instruct
// against the behavior. Kept constant so it doesn't bust the prompt cache.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';

// Send a message to Claude Code non-interactively. The prompt goes in over
// stdin (so quotes/newlines in the message can never break shell parsing).
// The conversation is pinned to a UUID (see the note above sessionId) so it
// can never be hijacked by an unrelated `claude -p` call in this directory.
// --model picks the chosen model; --fallback-model makes an unavailable model
// fall back gracefully instead of crashing the chat.
function askClaude(message, model) {
  return new Promise((resolve) => {
    const cfg = readModels();
    const chosen = model || cfg.default;
    const args = ['-p', '--model', chosen, '--disallowedTools', 'AskUserQuestion', '--append-system-prompt', CHANNEL_PROMPT];
    if (cfg.fallback_chain) args.push('--fallback-model', cfg.fallback_chain);
    const isNewSession = !sessionId;
    if (isNewSession) sessionId = crypto.randomUUID();
    args.push(isNewSession ? '--session-id' : '--resume', sessionId);
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
      if (code === 0) resolve({ ok: true, text: out.trim() });
      else {
        // A failed FIRST turn means no session actually exists at that id -
        // reset so the next attempt starts a genuinely fresh one rather than
        // trying to --resume a session that was never created.
        if (isNewSession) sessionId = null;
        resolve({ ok: false, text: (err || out || ('Claude exited with code ' + code)).trim() });
      }
    });
    child.stdin.write(message);
    child.stdin.end();
  });
}

ipcMain.handle('pcc:send', (_e, message, model) => askClaude(message, model));

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
