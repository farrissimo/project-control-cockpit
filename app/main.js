// PCC Cockpit - Electron main process.
//
// A real desktop app with a chat that talks to Claude Code (the worker the
// owner already runs) through its SUPPORTED non-interactive mode (`claude -p`),
// NOT by wrapping the interactive terminal - so a Claude Code update can't
// brick it. The owner's standing rules load automatically because Claude Code
// reads CLAUDE.md from the project directory on its own; nothing is injected
// into the prompt stream, so we don't bust Claude's prompt cache.

const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn, exec, execFile } = require('child_process');

// This app is the single "home" cockpit. It opens PROJECTS (self-contained
// folders each with their own .cockpit + engine scripts + CLAUDE.md, exactly
// what scripts/bootstrap-project.ps1 scaffolds) and points every read, script,
// chat, and worker call at whichever one is active. HOME_DIR is this repo — it
// is always a registered project and the default active one.
const HOME_DIR = path.join(__dirname, '..');
let projectDir = HOME_DIR;               // active project root (switchable)
const cockpitDir = () => path.join(projectDir, '.cockpit');
const memoryPath = () => path.join(projectDir, 'PROJECT.md');

// The cross-project registry is machine/app-level (Electron userData), NOT
// inside any repo — so it is independent of which project is active and there
// is no "which copy is home?" ambiguity. Shape: { active, projects: [path...] }.
function registryPath() { return path.join(app.getPath('userData'), 'projects.json'); }

// A folder is a valid PCC project only if it has the engine the app drives:
// its own .cockpit, scripts/, and CLAUDE.md. Switching to a non-PCC folder
// would break the detectors (scripts resolve their own location), so we refuse
// it up front rather than silently half-work (declare the boundary, don't guess).
function isPccProject(dir) {
  try {
    return fs.existsSync(path.join(dir, '.cockpit'))
      && fs.existsSync(path.join(dir, 'scripts'))
      && fs.existsSync(path.join(dir, 'CLAUDE.md'));
  } catch (e) { return false; }
}

function projectName(dir) {
  try {
    const st = JSON.parse(fs.readFileSync(path.join(dir, '.cockpit', 'state', 'project-state.json'), 'utf8'));
    if (st && st.project_name) return st.project_name;
  } catch (e) { /* fall through to folder name */ }
  return path.basename(dir);
}

function readRegistry() {
  let reg = { active: null, projects: [] };
  try { reg = JSON.parse(fs.readFileSync(registryPath(), 'utf8')) || reg; } catch (e) { /* first run */ }
  if (!Array.isArray(reg.projects)) reg.projects = [];
  // HOME is always present, first, and de-duplicated.
  reg.projects = reg.projects.filter((p) => typeof p === 'string' && p !== HOME_DIR && fs.existsSync(p));
  reg.projects.unshift(HOME_DIR);
  reg.projects = [...new Set(reg.projects)];
  if (!reg.active || !reg.projects.includes(reg.active)) reg.active = HOME_DIR;
  return reg;
}

function writeRegistry(reg) {
  try { fs.writeFileSync(registryPath(), JSON.stringify(reg, null, 2), 'utf8'); } catch (e) { /* best effort */ }
}

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
    return JSON.parse(fs.readFileSync(path.join(cockpitDir(), ...rel), 'utf8'));
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
    return { ok: true, text: fs.readFileSync(path.join(projectDir, 'CLAUDE.md'), 'utf8') };
  } catch (e) {
    return { ok: false, text: null };
  }
});

// Project memory: a plain-text brief (PROJECT.md) the owner curates and Claude
// reads at the start of every session (CLAUDE.md points to it). No fake
// auto-extraction - it is exactly what is written here, nothing more. Path is
// resolved per-call against the ACTIVE project so switching projects works.
ipcMain.handle('pcc:getMemory', () => {
  try { return { ok: true, text: fs.readFileSync(memoryPath(), 'utf8') }; }
  catch (e) { return { ok: true, text: '' }; }
});

ipcMain.handle('pcc:saveMemory', (_e, text) => {
  // Reject non-strings: a stray null/undefined must never overwrite PROJECT.md
  // with the literal "null"/"undefined" (the old String(text) coercion would).
  if (typeof text !== 'string') return { ok: false, error: 'saveMemory expects a string' };
  try { fs.writeFileSync(memoryPath(), text, 'utf8'); return { ok: true }; }
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
  exec('pwsh -NoProfile -File scripts/verify-work.ps1', { cwd: projectDir, maxBuffer: 12 * 1024 * 1024, timeout: 200000, windowsHide: true }, (err, stdout, stderr) => {
    const out = (stdout || '').trim();
    if (out) return resolve({ ok: true, text: out });
    if (err) return resolve({ ok: false, text: 'Verification could not run: ' + (err.killed ? 'timed out' : (stderr || err.message)) });
    resolve({ ok: true, text: (stderr || '(no output)').trim() });
  });
}));

// Hard checks - deterministic facts, no LLM, always available: PCC's own
// health check plus the git working-tree/scope facts.
function runCmd(cmd, timeout) {
  return new Promise((res) => exec(cmd, { cwd: projectDir, maxBuffer: 8 * 1024 * 1024, timeout: timeout || 60000, windowsHide: true }, (e, so, se) => {
    let out = ((so || '') + (se ? ('\n' + se) : '')).trim();
    out = out.replace(/\x1b\[[0-9;]*m/g, ''); // strip terminal color codes
    res(out || (e ? e.message : '(no output)'));
  }));
}

// New-chat handoff: assemble a ready-to-paste briefing from real repo truth so
// the owner never re-briefs a fresh chat by hand. Deterministic script; the app
// only displays and copies it.
ipcMain.handle('pcc:handoff', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/generate-handoff.ps1', { cwd: projectDir, maxBuffer: 4 * 1024 * 1024, timeout: 30000, windowsHide: true }, (err, stdout, stderr) => {
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
    exec('pwsh -NoProfile -File ' + script + ' -Json', { cwd: projectDir, maxBuffer: 8 * 1024 * 1024, timeout: 30000, windowsHide: true }, (err, stdout) => {
      const out = (stdout || '').trim();
      try { resolve(JSON.parse(out)); }
      catch (e) { resolve({ detector: script, signal: 'unknown', observed: 'Detector could not run: ' + (err ? err.message : 'no output'), might_mean: '', not_proven: '', what_to_do: '', items: [] }); }
    });
  });
}

// Babysitting-reduction metrics: observable proxies only (never a fake score).
ipcMain.handle('pcc:metrics', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/babysitting-metrics.ps1 -Json', { cwd: projectDir, maxBuffer: 4 * 1024 * 1024, timeout: 20000, windowsHide: true }, (err, stdout) => {
    try { resolve(JSON.parse((stdout || '').trim())); }
    catch (e) { resolve(null); }
  });
}));

// Recent decisions: carry-forward memory so "what did we decide?" is one click
// away, read straight from the canonical log (docs/DECISIONS.md).
ipcMain.handle('pcc:recentDecisions', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/recent-decisions.ps1 -Json -Count 6', { cwd: projectDir, maxBuffer: 4 * 1024 * 1024, timeout: 20000, windowsHide: true }, (err, stdout) => {
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
  highStakes: await runDetector('scripts/detect-high-stakes.ps1'),
}));

// Trust-strip extras: the two honest facts the always-visible strip needs
// beyond the detectors. "Rules loaded" is just whether CLAUDE.md exists (the
// rules DO auto-load into every Claude session; this proves they are present,
// not that the AI obeyed them). Verification is read from the file the
// scheduled run writes, and is only called fresh if it is newer than HEAD -
// so the strip never claims "verified" for work committed after the check.
ipcMain.handle('pcc:trustExtras', () => new Promise((resolve) => {
  const rulesLoaded = fs.existsSync(path.join(projectDir, 'CLAUDE.md'));
  const vPath = path.join(projectDir, 'app', 'last-verification.txt');
  let verification = { present: false };
  try {
    if (fs.existsSync(vPath)) {
      const st = fs.statSync(vPath);
      const text = fs.readFileSync(vPath, 'utf8');
      const m = text.match(/\b(PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE)\b/);
      verification = { present: true, verdict: m ? m[1] : null, mtimeEpoch: Math.floor(st.mtimeMs / 1000) };
    }
  } catch (e) { /* leave present:false */ }
  exec('git log -1 --format=%ct', { cwd: projectDir, timeout: 10000, windowsHide: true }, (err, stdout) => {
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
    const cfg = JSON.parse(fs.readFileSync(path.join(cockpitDir(), 'state', 'models.json'), 'utf8'));
    return { default: cfg.default || fallback.default, fallback_chain: cfg.fallback_chain || cfg.default || fallback.fallback_chain, models: cfg.models || fallback.models };
  } catch (e) { return fallback; }
}

ipcMain.handle('pcc:getModels', () => readModels());

// Start a fresh chat: assign a brand-new pinned session id, so the next
// message starts an isolated conversation. (The renderer also clears its own
// history.)
ipcMain.handle('pcc:newChat', () => { sessionId = null; return { ok: true }; });

// ---- multi-project switching ----
// The home cockpit points at one active project at a time. These handlers list
// the registered projects, switch the active one (re-pointing every read/script/
// worker call at it), add an existing folder, and register a freshly-scaffolded
// one. HOME is always present. Switching resets the local session fallback; the
// renderer also reloads its per-project chat history.
function projectEntry(p) { return { path: p, name: projectName(p), isHome: p === HOME_DIR }; }

ipcMain.handle('pcc:listProjects', () => {
  const reg = readRegistry();
  return { active: reg.active, projects: reg.projects.map(projectEntry) };
});

ipcMain.handle('pcc:getActiveProject', () => projectEntry(projectDir));

ipcMain.handle('pcc:setActiveProject', (_e, dir) => {
  const reg = readRegistry();
  if (typeof dir !== 'string' || !reg.projects.includes(dir)) return { ok: false, error: 'Unknown project.' };
  if (!isPccProject(dir)) return { ok: false, error: 'Not a PCC project (missing .cockpit / scripts / CLAUDE.md).' };
  projectDir = dir;
  sessionId = null;                 // don't carry a worker session across projects
  reg.active = dir; writeRegistry(reg);
  return { ok: true, active: projectEntry(dir) };
});

// Add an already-existing folder as a project (must be a valid PCC project).
ipcMain.handle('pcc:addProject', (_e, dir) => {
  if (typeof dir !== 'string' || !dir) return { ok: false, error: 'No folder given.' };
  if (!fs.existsSync(dir)) return { ok: false, error: 'Folder does not exist.' };
  if (!isPccProject(dir)) return { ok: false, error: 'Not a PCC project. A project needs its own .cockpit, scripts/, and CLAUDE.md (create one with "New project").' };
  const reg = readRegistry();
  if (!reg.projects.includes(dir)) reg.projects.push(dir);
  writeRegistry(reg);
  return { ok: true, project: projectEntry(dir) };
});

// Native folder picker for "Open existing project".
ipcMain.handle('pcc:pickFolder', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory'], title: 'Open an existing PCC project' });
  if (r.canceled || !r.filePaths || !r.filePaths.length) return { path: null };
  return { path: r.filePaths[0] };
});

// The chat panel is text-only (no interactive pickers). Tell the worker so it
// answers in plain text and never narrates internal tool failures. BUG FOUND by
// owner: the worker sometimes called the interactive AskUserQuestion tool, which
// can't render here, then replied "The question prompt isn't working in this
// session..." - a confusing non-answer. We both disallow that tool and instruct
// against the behavior. Kept constant so it doesn't bust the prompt cache.
const CHANNEL_PROMPT = 'You are replying inside PCC\'s text-only chat panel: there is no interactive UI, no clickable pickers or buttons you can present. Never use interactive tools such as AskUserQuestion; if you need to ask the owner something, ask it as plain text with the options listed inline. Never narrate internal tool, prompt, or mechanism failures to the owner (e.g. do not say a tool "isn\'t working") - just answer or ask plainly. The owner is a non-coder product lead: be concise and plain-language.';

// Send a message to Claude Code non-interactively. The prompt goes in over
// stdin (so quotes/newlines in the message can never break shell parsing).
// Each chat is pinned to its own UUID owned by the renderer (chat history), so
// switching between saved chats resumes the right Claude session and no
// unrelated `claude -p` call in this directory can hijack it. The renderer
// passes the chat's id and whether this is its first turn; if it doesn't
// (older callers), we fall back to a locally-generated pinned id.
// --model picks the chosen model; --fallback-model makes an unavailable model
// fall back gracefully instead of crashing the chat.
function askClaude(message, model, chatId, isFirstTurn) {
  return new Promise((resolve) => {
    const cfg = readModels();
    const chosen = model || cfg.default;
    // WebSearch/WebFetch explicitly allowed (surgical grant, tested to work
    // headlessly), NOT --dangerously-skip-permissions: that flag's own docs say
    // "recommended only for sandboxes with no internet access" - the opposite of
    // what we want here - and it would silently approve every other tool too.
    const args = ['-p', '--model', chosen, '--allowedTools', 'WebSearch WebFetch', '--disallowedTools', 'AskUserQuestion', '--append-system-prompt', CHANNEL_PROMPT];
    if (cfg.fallback_chain) args.push('--fallback-model', cfg.fallback_chain);
    let isNewSession;
    if (chatId) { sessionId = chatId; isNewSession = !!isFirstTurn; }
    else { isNewSession = !sessionId; if (isNewSession) sessionId = crypto.randomUUID(); }
    args.push(isNewSession ? '--session-id' : '--resume', sessionId);
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn('claude', args, { cwd: projectDir, shell: true });
    } catch (e) {
      return resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message });
    }
    child.on('error', (e) => resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message }));
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      if (code === 0) resolve({ ok: true, text: out.trim() });
      else {
        // A failed FIRST turn means no session actually exists at that id. When
        // the renderer owns the id it tracks that (keeps the chat "not started"
        // so it retries with --session-id); for the local fallback, reset here.
        if (isNewSession && !chatId) sessionId = null;
        resolve({ ok: false, text: (err || out || ('Claude exited with code ' + code)).trim() });
      }
    });
    child.stdin.write(message);
    child.stdin.end();
  });
}

ipcMain.handle('pcc:send', (_e, message, model, chatId, isFirstTurn) => askClaude(message, model, chatId, isFirstTurn));

// Second opinion: hand a composed prompt to Codex (a DIFFERENT model) over stdin
// and return its independent take. The worker (Claude) never grades itself; this
// is the cross-check. Read-only sandbox — Codex inspects but changes nothing.
ipcMain.handle('pcc:secondOpinion', (_e, prompt) => new Promise((resolve) => {
  if (typeof prompt !== 'string' || !prompt.trim()) return resolve({ ok: false, text: 'Nothing to review yet.' });
  let child;
  try {
    child = spawn('pwsh', ['-NoProfile', '-File', 'scripts/second-opinion.ps1'], { cwd: projectDir, shell: true });
  } catch (e) {
    return resolve({ ok: false, text: 'Could not run second opinion: ' + e.message });
  }
  let out = '', err = '';
  child.on('error', (e) => resolve({ ok: false, text: 'Could not run second opinion: ' + e.message }));
  child.stdout.on('data', (d) => { out += d.toString(); });
  child.stderr.on('data', (d) => { err += d.toString(); });
  child.on('close', (code) => {
    const t = out.trim();
    if (t) resolve({ ok: true, text: t });
    else resolve({ ok: false, text: (err.trim() || ('Codex second opinion exited with code ' + code)) });
  });
  child.stdin.write(prompt);
  child.stdin.end();
}));

// ---- in-app git backup / sync ----
// One-click "back up" (commit + push) and "get latest" (pull), so the owner never
// drops to a terminal to save or sync work. execFile('git', [...]) — no shell, so
// messages/paths can't break parsing. Runs against the ACTIVE project.
function git(args, timeout) {
  return new Promise((resolve) => {
    execFile('git', args, { cwd: projectDir, timeout: timeout || 30000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, so, se) => {
      resolve({ failed: !!err, out: (so || '').trim(), err: (se || '').trim() });
    });
  });
}

ipcMain.handle('pcc:syncStatus', async () => {
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out;
  const porcelain = await git(['status', '--porcelain']);
  const lines = porcelain.out ? porcelain.out.split('\n') : [];
  const untracked = lines.filter((l) => l.startsWith('??')).length;
  const dirty = lines.filter((l) => l && !l.startsWith('??')).length;
  let ahead = 0, behind = 0, hasUpstream = false, upstream = null;
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (!up.failed) {
    hasUpstream = true; upstream = up.out;
    const counts = await git(['rev-list', '--left-right', '--count', '@{u}...HEAD']);
    if (!counts.failed) { const [b, a] = counts.out.split(/\s+/).map((n) => parseInt(n, 10) || 0); behind = b; ahead = a; }
  }
  const clean = untracked === 0 && dirty === 0 && ahead === 0;
  return { branch, untracked, dirty, ahead, behind, hasUpstream, upstream, clean };
});

// Back up = stage all + commit (if there are changes) + push. --no-verify: a
// backup is a "don't lose my work" snapshot, NOT a verified checkpoint, so it must
// never be blocked by the test hook (you may want to snapshot broken WIP). An
// optional message is used verbatim; otherwise a timestamped default.
ipcMain.handle('pcc:backup', async (_e, message) => {
  const status = await git(['status', '--porcelain']);
  const steps = [];
  if (status.out) {
    const add = await git(['add', '-A']);
    if (add.failed) return { ok: false, text: 'Staging failed: ' + (add.err || 'unknown') };
    const msg = (typeof message === 'string' && message.trim())
      ? message.trim()
      : 'PCC backup ' + new Date().toISOString().slice(0, 16).replace('T', ' ');
    const commit = await git(['commit', '--no-verify', '-m', msg], 60000);
    if (commit.failed && !/nothing to commit/i.test(commit.out + commit.err)) {
      return { ok: false, text: 'Commit failed: ' + (commit.err || commit.out) };
    }
    steps.push('Committed your changes');
  } else {
    steps.push('No new changes to commit');
  }
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  let push;
  if (up.failed) {
    const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out;
    push = await git(['push', '-u', 'origin', branch], 120000);
  } else {
    push = await git(['push'], 120000);
  }
  if (push.failed) return { ok: false, text: steps.join('. ') + '. Push FAILED: ' + (push.err || push.out || 'unknown') };
  steps.push('Pushed to the remote (backed up)');
  return { ok: true, text: steps.join('. ') + '.' };
});

// Get latest = pull, fast-forward ONLY. If the branch has diverged we refuse and
// say so (surface the conflict honestly rather than create a silent merge).
ipcMain.handle('pcc:pull', async () => {
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (up.failed) return { ok: false, text: 'No upstream branch is set yet — back up first, then you can pull.' };
  const pull = await git(['pull', '--ff-only'], 120000);
  if (pull.failed) {
    return { ok: false, text: 'Could not fast-forward — your branch and the remote have diverged, or you have uncommitted changes. This needs a manual merge (ask Claude in chat). Details: ' + (pull.err || pull.out) };
  }
  return { ok: true, text: pull.out || 'Already up to date.' };
});

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
  // Restore the last-active project (registry needs app.getPath, so read it here).
  try {
    const reg = readRegistry();
    if (reg.active && isPccProject(reg.active)) projectDir = reg.active;
    writeRegistry(reg); // normalizes (ensures HOME present) on first run
  } catch (e) { /* stay on HOME_DIR */ }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
