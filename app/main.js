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
const { spawn, spawnSync, exec, execFile } = require('child_process');
const { parseVerification } = require('./renderer/verification-parse');
const { createAuthorityStore } = require('./authority-store');
const { decideBackup } = require('./backup-policy');
const { parseGitHubRepo, decideCiStatus, CI_CHECK_NAME } = require('./ci-status');
const { parseStreamJson } = require('./stream-json');
const chatSummary = require('./chat-summary');
const chatRecall = require('./chat-recall');

// This app is the single "home" cockpit. It opens PROJECTS (self-contained
// folders each with their own .cockpit + engine scripts + CLAUDE.md, exactly
// what scripts/bootstrap-project.ps1 scaffolds) and points every read, script,
// chat, and worker call at whichever one is active. HOME_DIR is this repo — it
// is always a registered project and the default active one.
const HOME_DIR = path.join(__dirname, '..');
let projectDir = HOME_DIR;               // active project root (switchable)
const cockpitDir = () => path.join(projectDir, '.cockpit');
const memoryPath = () => path.join(projectDir, 'PROJECT.md');
// Chat history storage root. In tests we isolate it to the throwaway per-launch
// userData dir (launch.js passes --user-data-dir) so the suite can NEVER read or
// mutate the owner's real project chats. The file-backed mirror lives in the
// project's .cockpit ONLY in production. This fixes a real isolation defect: the
// test app defaults projectDir=HOME_DIR, so it was restoring the real backup.json
// (breaking "no chats yet" preconditions) AND rewriting real chat history on every
// `npm test` / pre-commit run.
const chatsDir = () => process.env.PCC_TEST_MODE
  // Per-project subfolder (keyed by the active project path) so switching projects
  // stays isolated exactly like production's per-project cockpitDir() — just rooted
  // in the throwaway userData instead of the real repo.
  ? path.join(app.getPath('userData'), 'chats', crypto.createHash('sha1').update(projectDir).digest('hex').slice(0, 16))
  : path.join(cockpitDir(), 'chats');

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
  } catch (e) { /* fall through */ }
  // W5 fix: scaffolded projects have no project-state.json (the retired track), so
  // the owner's chosen name lived only in vision-promises.json — the switcher was
  // showing the folder basename ("TaxPrepCockpit") instead of "Tax Prep Cockpit".
  try {
    const vp = JSON.parse(fs.readFileSync(path.join(dir, '.cockpit', 'state', 'vision-promises.json'), 'utf8'));
    if (vp && vp.project) return vp.project;
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

// Soak fix F4: track every spawned worker so we can kill it when the app quits.
// Workers are spawned with shell:true, so the real `claude` process is a grandchild
// that OUTLIVES the app if not killed on a tree — orphaning it, which holds the
// chat's session lock and bricks the chat ("session already in use") on next launch.
const activeWorkers = new Set();
function killWorker(child) {
  if (!child || child.killed || !child.pid) return;
  try {
    if (process.platform === 'win32') {
      // SYNCHRONOUS so it actually completes before the app process exits (an async
      // spawn would be abandoned on quit, leaving the orphan alive). /T kills the whole
      // tree (the shell AND the claude grandchild spawned via shell:true).
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, timeout: 4000 });
    } else {
      try { process.kill(-child.pid, 'SIGTERM'); } catch (e) { child.kill('SIGTERM'); }
    }
  } catch (e) { /* best effort — we're shutting down */ }
}
function killAllWorkers() {
  for (const c of Array.from(activeWorkers)) killWorker(c);
  activeWorkers.clear();
}

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

// Owner-approved vision promises (declared project intent), read for the Owner
// Overview. Returns { _error } on missing/malformed so the UI degrades gracefully
// into a "needs owner review" placeholder rather than breaking.
ipcMain.handle('pcc:visionPromises', () => readJson('state', 'vision-promises.json'));

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
ipcMain.handle('pcc:verify', (_e, record) => new Promise((resolve) => {
  // record=true also writes app/last-verification.txt (-WriteFile), so an in-app
  // verify updates the trust strip AND satisfies the lifecycle PASS gate. The
  // plain Verify-tab button passes nothing (display only), preserving old behavior.
  const cmd = 'pwsh -NoProfile -File scripts/verify-work.ps1' + (record ? ' -WriteFile' : '');
  exec(cmd, { cwd: projectDir, maxBuffer: 12 * 1024 * 1024, timeout: 200000, windowsHide: true }, (err, stdout, stderr) => {
    const out = (stdout || '').trim();
    if (out) return resolve({ ok: true, text: out });
    if (err) return resolve({ ok: false, text: 'Verification could not run: ' + (err.killed ? 'timed out' : (stderr || err.message)) });
    resolve({ ok: true, text: (stderr || '(no output)').trim() });
  });
}));

// Soak fix F3: run the project's DECLARED local product checks and record a
// local_execution proof (real execution on this machine) — the "Verify product
// behavior" button. A local-first project can prove its own behavior without CI/Codex.
ipcMain.handle('pcc:verifyProduct', () => new Promise((resolve) => {
  exec('pwsh -NoProfile -File scripts/verify-product.ps1 -Json', { cwd: projectDir, timeout: 180000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (err, stdout, stderr) => {
    const out = (stdout || '').trim();
    if (!out && err) return resolve({ ok: false, message: 'Verify could not run: ' + (err.killed ? 'timed out' : (stderr || err.message)) });
    try { resolve(JSON.parse(out)); } catch (e) { resolve({ ok: false, message: out || (stderr || '').trim() || 'No output.' }); }
  });
}));

// Soak fix F4: launch the DECLARED product run command detached, so the product's own
// window opens for the owner — no terminal, no npm commands to type. Non-blocking; the
// product runs independently of the cockpit (it's not a claude worker, so no session lock).
ipcMain.handle('pcc:runProduct', () => {
  try {
    const cfgPath = path.join(projectDir, '.cockpit', 'state', 'product-run.json');
    if (!fs.existsSync(cfgPath)) return { ok: false, message: 'No product-run config yet — build the product first, then this button will run it.' };
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    const cmd = cfg && cfg.run;
    if (!cmd) return { ok: false, message: "No 'run' command declared in .cockpit/state/product-run.json." };
    const child = spawn(cmd, { cwd: projectDir, shell: true, detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true, message: 'Launching the product — its window should open shortly.\nRunning: ' + cmd };
  } catch (e) { return { ok: false, message: 'Could not launch the product: ' + e.message }; }
});

// Owner policy (DECISION): let the owner declare the current phase's KIND. An executable
// phase (default) needs execution proof to close; an explicitly review/docs/planning phase
// may close on review-only evidence. Writes phase_kind into lifecycle-state.json; the
// gate (scripts/lifecycle-advance.ps1) reads it. Starting a new work phase resets it to
// 'executable' so a stale "review" can never let real code close on a review.
ipcMain.handle('pcc:setPhaseKind', (_e, kind) => {
  try {
    const allowed = ['executable', 'review', 'docs', 'planning'];
    if (!allowed.includes(kind)) return { ok: false, message: 'Unknown phase kind: ' + kind };
    const p = path.join(projectDir, '.cockpit', 'state', 'lifecycle-state.json');
    if (!fs.existsSync(p)) return { ok: false, message: 'No lifecycle state to update.' };
    const st = JSON.parse(fs.readFileSync(p, 'utf8'));
    st.phase_kind = kind;
    st.updated_at = new Date().toISOString();
    fs.writeFileSync(p, JSON.stringify(st, null, 2));
    return { ok: true, phase_kind: kind };
  } catch (e) { return { ok: false, message: 'Could not set phase kind: ' + e.message }; }
});

// Upgrade Existing Project (DECISION-111), slice 1 — detection. New projects get the
// fixed engine automatically; existing ones carry the old engine (split-brain that
// increases babysitting). This reports whether a project's engine kit is current, old,
// or unknown vs the home cockpit's, by comparing scripts/engine-version.json. Read-only;
// it changes nothing. (Apply/dry-run/rollback are later slices.)
function readEngineVersion(base) {
  try {
    const p = path.join(base, 'scripts', 'engine-version.json');
    if (!fs.existsSync(p)) return null;
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return typeof j.engine_version === 'number' ? j.engine_version : null;
  } catch (e) { return null; }
}
ipcMain.handle('pcc:engineStatus', (_e, dir) => {
  const target = dir || projectDir;
  const home = readEngineVersion(HOME_DIR);
  const proj = readEngineVersion(target);
  let status, detail;
  if (home == null) { status = 'unknown'; detail = 'The home cockpit has no engine-version marker to compare against.'; }
  else if (proj == null) { status = 'unknown'; detail = 'This project predates engine versioning (no scripts/engine-version.json). Treat it as an upgrade candidate.'; }
  else if (proj === home) { status = 'current'; detail = 'This project is on the current engine (v' + home + ').'; }
  else if (proj < home) { status = 'old'; detail = 'This project is on engine v' + proj + '; the current engine is v' + home + '. An upgrade is available.'; }
  else { status = 'ahead'; detail = 'This project is on engine v' + proj + ', newer than the home cockpit (v' + home + ').'; }
  return { ok: true, status: status, homeVersion: home, projectVersion: proj, project: target, detail: detail };
});

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

// Coalesced: doctor.ps1 is a ~16s run, so overlapping calls (impatient re-clicks)
// would stack expensive work. While one is in flight, every caller gets that run.
let hardChecksInFlight = null;
ipcMain.handle('pcc:hardChecks', () => {
  if (hardChecksInFlight) return hardChecksInFlight;
  const run = (async () => {
    const git = await runCmd('git status --short --branch');
    const doctor = await runCmd('pwsh -NoProfile -File scripts/doctor.ps1', 120000);
    return { git, doctor };
  })();
  hardChecksInFlight = run;
  run.finally(() => { if (hardChecksInFlight === run) hardChecksInFlight = null; });
  return run;
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

// Advance the lifecycle pin. The script enforces the model's legal transitions
// AND the entry gate (phase_close needs a fresh independent PASS), so the app
// can't move state past verification. execFile — the stage id is validated and
// passed as an argument, never through a shell.
ipcMain.handle('pcc:lifecycleAdvance', (_e, toStageId) => new Promise((resolve) => {
  if (typeof toStageId !== 'string' || !/^[a-z_]+$/.test(toStageId)) {
    return resolve({ ok: false, reason: 'bad_input', message: 'Invalid stage id.' });
  }
  execFile('pwsh', ['-NoProfile', '-File', 'scripts/lifecycle-advance.ps1', '-To', toStageId, '-Json'],
    { cwd: projectDir, timeout: 20000, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) => {
      try { resolve(JSON.parse((stdout || '').trim())); }
      catch (e) { resolve({ ok: false, reason: 'error', message: 'Advance could not run: ' + (err ? err.message : 'no output') }); }
    });
}));

// Run the detectors in PARALLEL (they're independent read-only scripts), so the
// Signals tab / trust strip stay snappy as more detectors are added.
// COALESCED (soak finding W3): each call spawns 6 pwsh processes, and a soak showed
// 12 rapid "Refresh" clicks spawning 129 concurrent pwsh. While a batch is in
// flight, every caller (incl. the Project page's two callers) gets the SAME run,
// so impatience can no longer storm the machine. A fresh click AFTER it finishes
// still re-runs, so an explicit refresh is never stale.
let detectionsInFlight = null;
ipcMain.handle('pcc:detections', () => {
  if (detectionsInFlight) return detectionsInFlight;
  const run = (async () => {
    const [untracked, drift, staleDocs, repoSync, bloat, highStakes] = await Promise.all([
      runDetector('scripts/detect-untracked.ps1'),
      runDetector('scripts/detect-drift.ps1'),
      runDetector('scripts/detect-stale-docs.ps1'),
      runDetector('scripts/detect-repo-sync.ps1'),
      runDetector('scripts/detect-bloat.ps1'),
      runDetector('scripts/detect-high-stakes.ps1'),
    ]);
    return { untracked, drift, staleDocs, repoSync, bloat, highStakes };
  })();
  detectionsInFlight = run;
  run.finally(() => { if (detectionsInFlight === run) detectionsInFlight = null; });
  return run;
});

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
      // Structured parse via the ONE shared parser (mirrors the phase-close gate) so a
      // stray "PASS" in prose can't read as a verdict on the trust strip / Overview.
      // TYPE default review_only is the conservative honest assumption when unstated.
      const parsed = parseVerification(text);
      verification = { present: true, verdict: parsed.verdict, type: parsed.type || 'review_only', mtimeEpoch: Math.floor(st.mtimeMs / 1000) };
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

// File-bridge import: scripts/bootstrap-project.ps1 drops freshly-scaffolded
// project paths into .cockpit/state/scaffolded-inbox.json of the repo it ran in
// (the active project). Import any valid, not-yet-registered ones, then clear the
// inbox — so a project created via "New project" shows up in the switcher with no
// manual "Open existing" step.
function importScaffoldedInbox() {
  const inboxPath = path.join(projectDir, '.cockpit', 'state', 'scaffolded-inbox.json');
  let added = 0;
  try {
    if (!fs.existsSync(inboxPath)) return 0;
    let list = JSON.parse(fs.readFileSync(inboxPath, 'utf8'));
    if (typeof list === 'string') list = [list];
    if (!Array.isArray(list)) return 0;
    const reg = readRegistry();
    // BUG FIX (W4, found by soak-building a real project): only DROP entries we
    // actually handle — a registered project, or one already in the registry.
    // Anything not-yet-valid (e.g. a scaffold still being written, or a path that
    // momentarily failed the check) STAYS for retry, so a real project can never be
    // silently lost from the switcher the way Tax Prep Cockpit was. The old code
    // cleared the whole inbox unconditionally, consuming drops it never registered.
    const remaining = [];
    for (const p of list) {
      if (typeof p !== 'string') continue;                 // junk → drop
      if (reg.projects.includes(p)) continue;              // already registered → drop
      if (fs.existsSync(p) && isPccProject(p)) { reg.projects.push(p); added++; } // registered → drop
      else remaining.push(p);                              // not yet valid → KEEP for retry
    }
    if (added) writeRegistry(reg);
    fs.writeFileSync(inboxPath, JSON.stringify(remaining), 'utf8'); // consume only what we handled
  } catch (e) { /* ignore a malformed inbox */ }
  return added;
}

ipcMain.handle('pcc:listProjects', () => {
  importScaffoldedInbox(); // pick up anything "New project" just scaffolded
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

// Execution authority (DECISION-112). Reading context is never authorization to act.
// The chat is read_only by default; only an EXPLICIT owner approval of a bounded job
// grants execution — tied to ONE chat and auto-expiring. State lives here in main (the
// source of truth); no chat message can change it — only the owner-driven IPC below.
const AUTHORITY_LABELS = {
  read_only: 'Read-only — safe to paste context',
  approval_needed: 'Approval needed — PCC wants to start work',
  authorized_running: 'Authorized work running — background work may execute',
  completed_needs_review: 'Work complete — review result',
  blocked: 'Blocked — work stopped',
};
// The state machine + its two-deadline timeout model live in the pure, unit-tested
// authority-logic module (injectable clock). main owns IPC, chatId minting, and the
// tool-flag selection below; every transition delegates here so no logic drifts.
// Durable, per-chat authority store, persisted at app level (userData) — independent of the
// active project, because chat ids are app/renderer-owned so authority lives with the app too.
// Keyed by STABLE chat.id (not the worker session id), so build authority survives an app
// restart and can never desync when a chat's worker session is re-minted for recovery.
function authorityStorePath() { return path.join(app.getPath('userData'), 'authority-store.json'); }
const authority = createAuthorityStore({
  storage: {
    read() { try { return JSON.parse(fs.readFileSync(authorityStorePath(), 'utf8')); } catch (e) { return null; } },
    write(obj) { try { fs.writeFileSync(authorityStorePath(), JSON.stringify(obj, null, 2), 'utf8'); } catch (e) { /* best effort */ } },
  },
});
// Per-chat snapshot for the badge: reflects THIS chat's authority only — never a global state
// that could show "authorized" while a different chat spawns read-only.
function authoritySnapshot(chatId) {
  const s = authority.stateFor(chatId, Date.now());
  return { mode: s.mode, label: AUTHORITY_LABELS[s.mode] || AUTHORITY_LABELS.read_only, job: s.job };
}
// Read-only IPC: report the ACTIVE chat's authority state (by stable chatId). Never mutates.
ipcMain.handle('pcc:authorityState', (_e, chatId) => authoritySnapshot(chatId));
ipcMain.handle('pcc:authorityLog', () => authority.logTail(20));
// Owner-initiated ONLY (wired to explicit UI buttons, never to chat text). Request a
// bounded job -> approval_needed; nothing runs yet.
ipcMain.handle('pcc:requestJob', (_e, type, name, existingChatId) => {
  if (type !== 'new_project') return { ok: false, message: 'Unknown job type.' };
  // Normally we mint a fresh chatId. RESUME (owner reopened a New Project chat that fell
  // back to read-only after an app restart / session expiry) passes the chat's OWN id so
  // the re-approval re-binds build to that same chat. Still gated by the owner confirm +
  // approveJob below — this is not self-authorization, just re-binding to an existing chat.
  const chatId = (typeof existingChatId === 'string' && existingChatId) ? existingChatId : crypto.randomUUID();
  const r = authority.request(type, name, chatId);
  return { ok: true, chatId: r.chatId, job: r.job };
});
// Owner approves the pending job -> authorized_running, bound to that chatId, expiring.
ipcMain.handle('pcc:approveJob', () => authority.approve(Date.now()));
// Owner cancels a pending approval -> read_only.
ipcMain.handle('pcc:cancelJob', () => authority.cancel());
// Disable build for a SPECIFIC chat (by stable chatId) -> that chat returns to read_only.
ipcMain.handle('pcc:endJob', (_e, chatId) => authority.disable(chatId));

// Send a message to Claude Code non-interactively. The prompt goes in over
// stdin (so quotes/newlines in the message can never break shell parsing).
// Each chat is pinned to its own UUID owned by the renderer (chat history), so
// switching between saved chats resumes the right Claude session and no
// unrelated `claude -p` call in this directory can hijack it. The renderer
// passes the chat's id and whether this is its first turn; if it doesn't
// (older callers), we fall back to a locally-generated pinned id.
// --model picks the chosen model; --fallback-model makes an unavailable model
// fall back gracefully instead of crashing the chat.
// parseStreamJson (the attachments/image reply parser) lives in ./stream-json.js so it can be
// unit-tested against a REAL captured stream-json envelope, not just the simplified test fake.

// `attachments` (optional): [{ kind:'image', mediaType, dataBase64 } | { kind:'text', name, content }].
// When present, the worker is spawned in stream-json mode so images/files ride as content blocks.
// `opts` (optional): { cwd, forceBuild }. cwd overrides the active projectDir (used by the New
// Project create-flow to run the worker in an isolated SCRATCH folder, never PCC's own folder —
// DECISION-114). forceBuild grants the build tool profile for that scoped surface without going
// through the per-chat authority store (the create-flow surface IS the owner gate; it is only
// reachable from the dedicated Create-a-project UI, never from pasted cockpit chat text).
function askClaude(message, model, workerSessionId, isFirstTurn, chatId, attachments, opts) {
  return new Promise((resolve) => {
    const cfg = readModels();
    const chosen = model || cfg.default;
    const scopedCwd = (opts && opts.cwd) || projectDir;
    // Authority-gated spawn (DECISION-112). Reading context is never authorization to
    // act. By DEFAULT the chat spawns READ-ONLY: an allowlist of web+read tools only,
    // --strict-mcp-config drops MCP/plugin tools, and a deny-list backstops known
    // execution/mutation/meta tools (deny beats the global settings.json allow).
    // The BUILD profile (adds Bash/PowerShell/Write/Edit so New Project's setup scripts
    // can run) is used ONLY when the owner has explicitly approved a bounded job AND
    // this send belongs to that job's chat (chatId === the approved job's chatId), and
    // only until the session expires. Message content can never flip this — authority is
    // set only by owner-driven IPC (requestJob/approveJob). authorizeSend also RENEWS the
    // idle window on this grant (Task 2L), so a long New-Project interview keeps its build
    // tools right through to the final scaffold write; the hard cap it can't extend still
    // bounds the session. Both profiles proven by the S0 / build-profile spikes.
    const isBuild = (opts && opts.forceBuild) || authority.authorizeSend(chatId, Date.now());
    // --tools makes a built-in tool AVAILABLE; it does NOT grant permission to RUN it. In
    // headless `claude -p` there is no prompt to approve a tool, so anything not explicitly
    // permitted is denied at runtime. Previously only the machine's global settings.json
    // allow-list (Bash/PowerShell/Read/Edit/Write/Glob/Grep) had run-permission — so web
    // tools were listed but silently blocked ("no web access"). We now grant run-permission
    // for exactly this profile's tools via --allowedTools, so the spawn is self-sufficient
    // and no longer depends on global settings. --disallowedTools stays as the deny backstop
    // (deny beats allow), so read-only still cannot run Bash/Write. Proven by the A/B/C
    // headless repros (web denied -> web works -> Bash still denied).
    const toolFlags = isBuild
      ? ['--tools', 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch', '--strict-mcp-config',
         '--allowedTools', 'Bash PowerShell Read Write Edit Glob Grep WebSearch WebFetch',
         '--disallowedTools', 'AskUserQuestion Agent Monitor Skill ToolSearch Task']
      : ['--tools', 'WebSearch WebFetch Read Glob Grep', '--strict-mcp-config',
         '--allowedTools', 'WebSearch WebFetch Read Glob Grep',
         '--disallowedTools', 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task'];
    const args = ['-p', '--model', chosen, ...toolFlags, '--append-system-prompt', CHANNEL_PROMPT];
    if (cfg.fallback_chain) args.push('--fallback-model', cfg.fallback_chain);
    // Worker (Claude) session identity is SEPARATE from authority identity: the renderer
    // passes workerSessionId (the chat's own id, or a re-minted id after crash recovery) for
    // --session-id/--resume, while build authority above is keyed to the stable chatId. So
    // re-minting a worker session can never move or drop a chat's build authorization.
    let isNewSession;
    if (workerSessionId) { sessionId = workerSessionId; isNewSession = !!isFirstTurn; }
    else { isNewSession = !sessionId; if (isNewSession) sessionId = crypto.randomUUID(); }
    args.push(isNewSession ? '--session-id' : '--resume', sessionId);
    // Attachments (images / files) reach the worker as structured content blocks, which headless
    // claude accepts ONLY via stream-json in+out (proven: a base64 image round-trips and the
    // worker sees it). Plain-text sends keep the original text path unchanged — no regression to
    // the authority/read-only spawn behavior, which is identical either way (same tool flags).
    const hasAttach = Array.isArray(attachments) && attachments.length > 0;
    if (hasAttach) args.push('--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose');
    let out = '';
    let err = '';
    let child;
    try {
      child = spawn('claude', args, { cwd: scopedCwd, shell: true });
    } catch (e) {
      return resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message });
    }
    activeWorkers.add(child); // tracked so app-quit can kill it (F4)
    if (opts && typeof opts.onSpawn === 'function') opts.onSpawn(child); // let the create-flow track its worker so Save/Cancel can stop it
    child.on('error', (e) => { activeWorkers.delete(child); resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message }); });
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      activeWorkers.delete(child);
      if (code === 0) resolve({ ok: true, text: hasAttach ? parseStreamJson(out) : out.trim() });
      else {
        // A failed FIRST turn means no session actually exists at that id. When
        // the renderer owns the id it tracks that (keeps the chat "not started"
        // so it retries with --session-id); for the local fallback, reset here.
        if (isNewSession && !workerSessionId) sessionId = null;
        const raw = (err || (hasAttach ? parseStreamJson(out) : out) || ('Claude exited with code ' + code)).trim();
        // Soak fix F4: a stale session lock (a worker orphaned by an earlier crash or
        // mid-turn quit) surfaces as the raw "Session ID ... is already in use". Turn
        // it into a plain-language message and flag it so the renderer can offer a
        // one-click recovery instead of leaving a non-coder owner stuck on a red error.
        if (/session id .* is already in use/i.test(raw)) {
          resolve({ ok: false, sessionInUse: true,
            text: 'This chat’s worker session is locked — a worker was interrupted (a crash, or the app closed mid-reply) and left the session in use. Use “Recover this chat” below to give it a fresh worker session while keeping your history, or start a new chat.' });
        } else {
          resolve({ ok: false, text: raw });
        }
      }
    });
    if (hasAttach) {
      // One user message: attached file text first (context), then the typed message, then image
      // blocks. base64 images ride inline so the worker never needs filesystem access to them.
      const content = [];
      for (const a of attachments) if (a && a.kind === 'text' && a.content) content.push({ type: 'text', text: 'Attached file "' + (a.name || 'file') + '":\n\n' + String(a.content).slice(0, 200000) });
      if (message && message.trim()) content.push({ type: 'text', text: message });
      for (const a of attachments) if (a && a.kind === 'image' && a.dataBase64) content.push({ type: 'image', source: { type: 'base64', media_type: a.mediaType || 'image/png', data: a.dataBase64 } });
      if (!content.some((c) => c.type === 'text')) content.push({ type: 'text', text: '(see attached)' });
      child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content } }) + '\n');
    } else {
      child.stdin.write(message);
    }
    child.stdin.end();
  });
}

ipcMain.handle('pcc:send', (_e, message, model, workerSessionId, isFirstTurn, chatId, attachments) => askClaude(message, model, workerSessionId, isFirstTurn, chatId, attachments));

// ---- First-class chat history: AI names + structured summaries (docs/CHAT_RECALL_SPEC.md) ----
// A chat is no longer a truncated first line. After the first real exchange we give it an AI
// name; on demand we build a structured summary card. Both are STATELESS, READ-ONLY, one-shot
// worker calls: a fresh random --session-id (so a chat's pinned session is never touched), the
// read-only tool profile, plain text in/out. The summary is mirrored to git-ignored durable files
// under .cockpit/chats/<id>/ (survives a cleared cache, is backed up, greppable for Phase-2 recall).
function oneShotWorker(prompt) {
  return new Promise((resolve) => {
    const cfg = readModels();
    const args = ['-p', '--model', cfg.default,
      '--tools', 'Read Glob Grep', '--strict-mcp-config',
      '--allowedTools', 'Read Glob Grep',
      '--disallowedTools', 'AskUserQuestion Bash BashOutput KillBash PowerShell Edit Write NotebookEdit Agent Monitor Skill ToolSearch Task WebSearch WebFetch',
      '--session-id', crypto.randomUUID()];
    if (cfg.fallback_chain) args.push('--fallback-model', cfg.fallback_chain);
    let out = '', err = '', child;
    try { child = spawn('claude', args, { cwd: projectDir, shell: true }); }
    catch (e) { return resolve({ ok: false, text: 'Could not launch Claude Code: ' + e.message }); }
    activeWorkers.add(child); // tracked so app-quit can kill it (F4)
    child.on('error', (e) => { activeWorkers.delete(child); resolve({ ok: false, text: e.message }); });
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('close', (code) => {
      activeWorkers.delete(child);
      if (code === 0) resolve({ ok: true, text: out.trim() });
      else resolve({ ok: false, text: (err.trim() || ('Claude exited with code ' + code)) });
    });
    child.stdin.write(prompt); child.stdin.end();
  });
}

// Auto-name: cheap, runs once after the first real exchange. Returns a title only.
ipcMain.handle('pcc:autoNameChat', async (_e, messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, text: 'No messages to name.' };
  const r = await oneShotWorker(chatSummary.buildNamePrompt(messages));
  if (!r.ok) return { ok: false, text: r.text };
  const title = chatSummary.cleanTitle(r.text);
  return title ? { ok: true, title } : { ok: false, text: 'No usable title returned.' };
});

// Summarize: on-demand structured card + durable three-tier mirror on disk.
ipcMain.handle('pcc:summarizeChat', async (_e, chatId, messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false, text: 'This chat has no messages yet.' };
  const r = await oneShotWorker(chatSummary.buildSummaryPrompt(messages));
  if (!r.ok) return { ok: false, text: r.text };
  const parsed = chatSummary.safeJsonParse(r.text);
  if (!parsed) return { ok: false, text: 'The summarizer did not return usable JSON. Try refreshing.' };
  const summary = chatSummary.normalizeSummary(parsed);
  const at = Date.now();
  try {
    const dir = path.join(chatsDir(), chatSummary.sanitizeChatId(chatId));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify({ chatId, at, summary }, null, 2), 'utf8');
    fs.writeFileSync(path.join(dir, 'summary.md'), chatSummary.renderSummaryMd(summary, at), 'utf8');
    fs.writeFileSync(path.join(dir, 'transcript.jsonl'), messages.map((m) => JSON.stringify(m)).join('\n'), 'utf8');
  } catch (e) { /* durable mirror is best-effort; the card still returns to the UI */ }
  return { ok: true, summary, at };
});

// Persist a chat's FULL transcript to disk (no AI) so recall always has a greppable corpus —
// the safety-net tier that exists even for chats you never summarized. Called on leave and after
// each turn. Cheap, best-effort. (Search greps summaries first, falls back to these transcripts.)
ipcMain.handle('pcc:persistChat', (_e, chatId, messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return { ok: false };
  try {
    const dir = path.join(chatsDir(), chatSummary.sanitizeChatId(chatId));
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'transcript.jsonl'), messages.map((m) => JSON.stringify(m)).join('\n'), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, text: e.message }; }
});

// Durable chat backup (2026-07-10): localStorage proved fragile here — it kept resetting to a
// blank "New chat" (corruption / races / kills-mid-write), losing the chat list. So the full chat
// list is ALSO mirrored to a plain file, and the renderer restores from it whenever localStorage
// comes up empty. This is the real source of truth for "never lose a chat".
function chatsBackupPath() { return path.join(chatsDir(), 'backup.json'); }
ipcMain.handle('pcc:saveChatsBackup', (_e, chats) => {
  try {
    if (!Array.isArray(chats) || chats.length === 0) return { ok: false };
    fs.mkdirSync(chatsDir(), { recursive: true });
    fs.writeFileSync(chatsBackupPath(), JSON.stringify({ savedAt: Date.now(), chats }), 'utf8');
    return { ok: true };
  } catch (e) { return { ok: false, text: e.message }; }
});
ipcMain.handle('pcc:loadChatsBackup', () => {
  try {
    const p = chatsBackupPath();
    if (!fs.existsSync(p)) return { ok: true, chats: [] };
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { ok: true, chats: Array.isArray(j.chats) ? j.chats : [] };
  } catch (e) { return { ok: false, chats: [], text: e.message }; }
});

// Remove a deleted chat's on-disk record (transcript + summary) so nothing is orphaned when the
// owner deletes a chat — tidiness + privacy.
ipcMain.handle('pcc:deleteChatFiles', (_e, chatId) => {
  try {
    const dir = path.join(chatsDir(), chatSummary.sanitizeChatId(chatId));
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    return { ok: true };
  } catch (e) { return { ok: false, text: e.message }; }
});

// Search chat history (docs/CHAT_RECALL_SPEC.md): the "smart grep". Not a keyword box — the
// front end expands the plain-English question, a local (free) grep narrows the corpus recall-
// safely, and the finisher reads the candidates and returns ALL genuine matches by MEANING (or
// nothing, never inventing). Both AI stages are the stateless read-only one-shot worker. The
// corpus is the live chats the renderer passes (always fresh); disk files serve extractability.
ipcMain.handle('pcc:searchChats', async (_e, query, chats) => {
  if (typeof query !== 'string' || !query.trim()) return { ok: false, text: 'Type something to search for.' };
  const corpus = (Array.isArray(chats) ? chats : []).filter((c) => c && c.id && Array.isArray(c.messages) && c.messages.length);
  if (corpus.length === 0) return { ok: true, matches: [], terms: [] };
  // 1) expand (AI, cheap) — plain English -> keyword+synonym list.
  const exp = await oneShotWorker(chatRecall.buildExpandPrompt(query));
  const terms = chatRecall.parseTerms(exp.ok ? exp.text : '', query);
  // 2) grep (local, free) + recall-safe candidate set.
  const hits = chatRecall.grep(terms, corpus);
  const byId = Object.fromEntries(corpus.map((c) => [c.id, c]));
  const candidateChats = chatRecall.selectCandidates(corpus, hits, chatRecall.CANDIDATE_CAP).map((id) => byId[id]);
  // 3) judge (AI) — return every genuine match, or none.
  const jr = await oneShotWorker(chatRecall.buildJudgePrompt(query, candidateChats));
  if (!jr.ok) return { ok: false, text: jr.text };
  const matches = chatRecall.parseMatches(jr.text)
    .filter((m) => byId[m.chatId])
    .map((m) => ({ chatId: m.chatId, chatName: byId[m.chatId].name || 'chat', answer: m.answer, quote: m.quote }));
  return { ok: true, matches, terms };
});

// ---- New Project create-flow (DECISION-114): "New Project" is a new document ----
// Clicking New Project takes the owner OUT of the cockpit into a dedicated create surface. The
// as-yet-unsaved project lives in a SCRATCH folder that belongs to the app (userData), never
// PCC's repo — the create-flow worker runs there (cwd=scratch) with build tools, so an intake can
// no longer run in, or scribble on, the home cockpit's folder (the exact hazard DECISION-114
// removes). "Save Project" materializes it: scaffold into the owner's chosen folder, fold the
// scratch work in, register, and switch the active project to it (its first checkpoint). Cancel
// discards the scratch. Honest limit: scoping is by working directory (as with any claude -p
// worker) — there is no OS jail, so this prevents running IN PCC, not every conceivable
// absolute-path write.
const createFlow = { active: false, saving: false, scratchDir: null, chatId: null, started: false, child: null, pending: null };
function scratchRoot() { return path.join(app.getPath('userData'), 'pcc-scratch'); }
function rmScratch(dir) { try { if (dir && fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* best effort */ } }
// Stop any in-flight interview worker and WAIT for it to actually settle. Save/Cancel call this
// FIRST so nothing (copy / scaffold / rmScratch) can race a worker still writing to the scratch,
// and no build-capable worker lingers past materialization. killWorker tree-kills (taskkill /T);
// the timeout is only a safety net if a killed child's stdio never closes.
async function stopCreateFlowWorker() {
  if (createFlow.child) killWorker(createFlow.child);
  const pending = createFlow.pending;
  if (pending) await Promise.race([pending.catch(() => {}), new Promise((r) => setTimeout(r, 4000))]);
  createFlow.child = null; createFlow.pending = null;
}
// A safe project folder name from the owner's project name (no path traversal / illegal chars).
function slugify(name) {
  const s = String(name || '').trim().replace(/[^A-Za-z0-9._ -]/g, '').replace(/\s+/g, '-').replace(/^[-.]+|-+$/g, '');
  return s || 'new-project';
}

// Start (or restart) a create-flow: mint a fresh scratch workspace under app data. The intake
// protocol script is SEEDED into the scratch (single source of truth) so the worker reads its own
// copy and never has to reach into PCC's folder for it. Save later scaffolds the full engine on top.
ipcMain.handle('pcc:createFlowStart', () => {
  try {
    rmScratch(createFlow.scratchDir);            // clear any prior abandoned scratch
    const id = crypto.randomUUID();
    const dir = path.join(scratchRoot(), id);
    fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
    try {
      const intakeSrc = path.join(HOME_DIR, 'scripts', 'new-project-intake.ps1');
      if (fs.existsSync(intakeSrc)) fs.copyFileSync(intakeSrc, path.join(dir, 'scripts', 'new-project-intake.ps1'));
    } catch (e) { /* the worker can still interview without the printed protocol */ }
    createFlow.active = true; createFlow.scratchDir = dir; createFlow.chatId = id; createFlow.started = false;
    return { ok: true, id };
  } catch (e) { return { ok: false, error: 'Could not start a new project workspace: ' + e.message }; }
});

// Send to the create-flow worker: runs in the scratch folder with build tools. isFirstTurn is
// tracked here in main so the renderer can never resume a session that was never opened.
ipcMain.handle('pcc:createFlowSend', async (_e, message, model, attachments) => {
  if (!createFlow.active || createFlow.saving || !createFlow.scratchDir) return { ok: false, text: 'No project is being created.' };
  const isFirstTurn = !createFlow.started;
  const p = askClaude(message, model, createFlow.chatId, isFirstTurn, createFlow.chatId, attachments,
    { cwd: createFlow.scratchDir, forceBuild: true, onSpawn: (c) => { createFlow.child = c; } });
  createFlow.pending = p;                               // tracked so Save/Cancel can wait it out
  const res = await p;
  if (createFlow.pending === p) { createFlow.pending = null; createFlow.child = null; }
  if (res && res.ok) createFlow.started = true;
  return res;
});

// Cancel: stop any running worker, then discard the scratch. Nothing was registered, so there is
// nothing else to undo. active is cleared FIRST so an in-flight send can't keep the flow alive.
ipcMain.handle('pcc:createFlowCancel', async () => {
  // Refuse mid-materialize: a Cancel during Save must not delete the scratch or mutate state
  // while Save is copying/scaffolding from it (the Save/Cancel race).
  if (createFlow.saving) return { ok: false, error: 'Save in progress — cannot cancel right now.' };
  createFlow.active = false;
  await stopCreateFlowWorker();
  rmScratch(createFlow.scratchDir);
  createFlow.scratchDir = null; createFlow.chatId = null; createFlow.started = false;
  return { ok: true };
});

// Native folder picker for "Save Project": choose the PARENT folder the project will live in.
ipcMain.handle('pcc:createFlowPickLocation', async () => {
  const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: 'Choose where to save the new project' });
  if (r.canceled || !r.filePaths || !r.filePaths.length) return { path: null };
  return { path: r.filePaths[0] };
});

// Save Project: materialize the scratch into a real, registered, active project.
//   name     — the owner's project name;  location — the PARENT folder (project = <location>/<slug>)
// Fold scratch content in → scaffold on top (bootstrap-project.ps1 -Force -NoInbox; we register
// directly, so no inbox round-trip) → register + set active. Renderer then switches into it.
ipcMain.handle('pcc:createFlowSave', async (_e, name, location) => {
  if (!createFlow.active || !createFlow.scratchDir) return { ok: false, error: 'No project is being created.' };
  const nm = (typeof name === 'string' ? name.trim() : '');
  if (!nm) return { ok: false, error: 'Give the project a name.' };
  if (typeof location !== 'string' || !location.trim()) return { ok: false, error: 'Choose where to save the project.' };
  if (!fs.existsSync(location)) return { ok: false, error: 'That location does not exist.' };
  const target = path.join(location, slugify(nm));
  if (fs.existsSync(target)) {
    try { if (fs.readdirSync(target).length > 0) return { ok: false, error: 'A non-empty folder already exists there: ' + target }; }
    catch (e) { return { ok: false, error: 'Could not read the target folder: ' + e.message }; }
  }
  // Commit to materializing: block any further interview sends, and stop the in-flight worker
  // BEFORE folding the scratch in, so the copy can't race a write and no build-capable worker
  // survives materialization. On failure below, `saving` is cleared so the owner can retry.
  createFlow.saving = true;
  await stopCreateFlowWorker();
  try {                                            // 1. fold scratch → target (cross-drive safe copy)
    fs.mkdirSync(target, { recursive: true });
    fs.cpSync(createFlow.scratchDir, target, { recursive: true });
  } catch (e) { createFlow.saving = false; return { ok: false, error: 'Could not copy the new project into place: ' + e.message }; }
  // 2. scaffold the cockpit engine on top (deterministic; a blueprint.json from the intake is used if present)
  const bootstrap = path.join(HOME_DIR, 'scripts', 'bootstrap-project.ps1');
  const args = ['-NoProfile', '-File', bootstrap, '-Target', target, '-Name', nm, '-Force', '-NoInbox'];
  const bp = path.join(target, 'blueprint.json');
  if (fs.existsSync(bp)) args.push('-Blueprint', bp);
  // Async spawn (not spawnSync) so scaffolding — which copies the engine + git-inits, a few
  // seconds — never blocks the Electron main process / IPC while the owner watches "Saving…".
  const r = await new Promise((resolve) => {
    let so = '', se = '', child;
    try { child = spawn('pwsh', args, { cwd: HOME_DIR }); }
    catch (e) { return resolve({ status: -1, stderr: e.message }); }
    child.stdout.on('data', (d) => { so += d.toString(); });
    child.stderr.on('data', (d) => { se += d.toString(); });
    child.on('error', (e) => resolve({ status: -1, stderr: e.message }));
    child.on('close', (code) => resolve({ status: code, stdout: so, stderr: se }));
  });
  if (r.status !== 0) { createFlow.saving = false; return { ok: false, error: 'Scaffolding failed: ' + ((r.stderr || r.stdout || '').trim() || ('exit ' + r.status)) }; }
  if (!isPccProject(target)) { createFlow.saving = false; return { ok: false, error: 'Scaffolding did not produce a valid project (missing .cockpit / scripts / CLAUDE.md).' }; }
  // 3. register + make active
  const reg = readRegistry();
  if (!reg.projects.includes(target)) reg.projects.push(target);
  reg.active = target; writeRegistry(reg);
  projectDir = target; sessionId = null;
  // 4. done — discard scratch, close the create-flow
  rmScratch(createFlow.scratchDir);
  createFlow.active = false; createFlow.saving = false; createFlow.scratchDir = null; createFlow.chatId = null; createFlow.started = false;
  return { ok: true, project: projectEntry(target) };
});

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

// Live CI status for the ACTIVE project's current commit (roadmap: surface CI into the Verified
// chip). Read-only, best-effort, and — critically — HONEST: it only ever reports a real, current
// pass/fail observed from GitHub's public check-runs API, and returns { available:false } for every
// case where it cannot know (no remote / not GitHub / offline / private / rate-limited / test mode),
// so the trust chip can never show a fabricated green OR a false red. The fetch runs HERE in the
// main process (Node), not the renderer, so it is outside the renderer CSP. Green is inherently
// fresh because the API is queried by the exact HEAD sha.
ipcMain.handle('pcc:ciStatus', async () => {
  // Keep the test suite offline + deterministic (the fakebin design): never hit the network in tests.
  if (process.env.PCC_TEST_MODE) return { ok: true, available: false, reason: 'test_mode' };
  try {
    const head = await git(['rev-parse', 'HEAD']);
    if (head.failed || !head.out) return { ok: true, available: false, reason: 'no_git' };
    const remote = await git(['remote', 'get-url', 'origin']);
    if (remote.failed || !remote.out) return { ok: true, available: false, reason: 'no_remote' };
    const gh = parseGitHubRepo(remote.out);
    if (!gh) return { ok: true, available: false, reason: 'not_github' }; // e.g. a local-only project
    const url = 'https://api.github.com/repos/' + gh.owner + '/' + gh.repo + '/commits/' + head.out + '/check-runs';
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    let res;
    try {
      res = await fetch(url, { signal: ctrl.signal, headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'PCC-Cockpit' } });
    } finally { clearTimeout(timer); }
    if (res.status === 403) return { ok: true, available: false, reason: 'rate_limited' };
    if (res.status === 404) return { ok: true, available: false, reason: 'not_found_or_private' };
    if (!res.ok) return { ok: true, available: false, reason: 'http_' + res.status };
    const body = await res.json();
    return { ok: true, available: true, state: decideCiStatus(body && body.check_runs, CI_CHECK_NAME), sha: head.out };
  } catch (e) {
    return { ok: true, available: false, reason: 'unreachable' }; // offline / DNS / abort — never a red
  }
});

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
  return { branch, untracked, dirty, ahead, behind, hasUpstream, upstream, clean, mode: readBackupPolicy() };
});

// Back up = stage all + commit (if there are changes) + push. --no-verify: a
// backup is a "don't lose my work" snapshot, NOT a verified checkpoint, so it must
// never be blocked by the test hook (you may want to snapshot broken WIP). An
// optional message is used verbatim; otherwise a timestamped default.
// Read the active project's declared backup tier (owner policy 2026-07-09). Missing file =
// no declared tier (the decision helper treats that as remote-backed if an upstream exists,
// else as an undecided "setup" state — never a failure).
function readBackupPolicy() {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(projectDir, '.cockpit', 'state', 'backup-policy.json'), 'utf8'));
    return (p && typeof p.mode === 'string') ? p.mode : null;
  } catch (e) { return null; }
}
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
  // Policy-driven push decision. A local-only (or undecided-no-remote) project checkpoints
  // LOCALLY and never pushes — that is success for its tier, NOT a "Push FAILED" error.
  const up = await git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  const decision = decideBackup(readBackupPolicy(), !up.failed);
  if (!decision.push) {
    return { ok: true, text: steps.join('. ') + '. ' + decision.noPushMessage };
  }
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

// Single-instance lock (2026-07-10 data-loss fix). WITHOUT this, every desktop-shortcut click
// launches a SEPARATE copy of the app; multiple copies share one localStorage and race their
// writes, which silently corrupted chat history — a project's chats got overwritten by a stale
// instance's empty "New chat", and closing one window left the others running as ghosts. Now a
// second launch just focuses the existing window and exits: one app, one owner of the storage.
// (window-all-closed already quits the single instance cleanly.)
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });
}

app.whenReady().then(() => {
  if (!gotSingleInstanceLock) return; // a second copy: never build a window or touch storage
  // Load the persisted per-chat build authority (needs app.getPath, so do it here). Any
  // session already past its idle/hard deadline is dropped on load.
  try { authority.load(Date.now()); } catch (e) { /* start with an empty authority set */ }
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

// Soak fix F4: kill in-flight workers when the app goes away so stray `claude`
// processes don't pile up. This does NOT by itself cure "session already in use": a
// force-kill can't let claude clean up its session lock, so an interrupted turn can
// still leave a chat's session locked. The reliable cure is the in-chat "Recover this
// chat" action (a fresh session id). before-quit covers the quit path; window-all-closed
// covers closing the last window.
app.on('before-quit', () => { killAllWorkers(); });
app.on('window-all-closed', () => {
  killAllWorkers();
  if (process.platform !== 'darwin') app.quit();
});
