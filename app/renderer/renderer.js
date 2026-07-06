// PCC Cockpit - renderer. Chat + Project + Rules + Memory views, plus
// one-click corrections. Conversation persists in localStorage; Claude keeps
// its own side via --continue (main.js), so context survives restarts.

const log = document.getElementById('log');
const input = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('send');
const correctionsBar = document.getElementById('corrections');

const HISTORY_KEY = 'pcc.chat.history';
let history = [];
let busy = false;

const CORRECTIONS = [
  { label: 'Be concise', msg: 'Be concise.' },
  { label: 'No cheerleading', msg: 'No cheerleading - just the facts.' },
  { label: 'Stay in scope', msg: 'Stay in scope. Only do what I asked.' },
  { label: 'Show evidence', msg: 'Show me the evidence for that.' },
  { label: 'Stop reacting', msg: 'Stop reacting. Think it through first.' },
  { label: 'Copy block', msg: 'Put that in a copy block.' },
];

function scrollDown() { log.scrollTop = log.scrollHeight; }
function save() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function addBubble(cls, text, persist) {
  const el = document.createElement('div');
  el.className = 'bubble ' + cls;
  el.textContent = text;
  log.appendChild(el);
  scrollDown();
  if (persist) { history.push({ cls, text, ts: Date.now() }); save(); }
  return el;
}

async function sendMessage(text) {
  const msg = (text || '').trim();
  if (!msg || busy) return;
  const welcome = log.querySelector('.welcome');
  if (welcome) welcome.remove();
  addBubble('user', msg, true);
  busy = true; sendBtn.disabled = true;
  const thinking = addBubble('assistant thinking', 'Claude is working…', false);
  try {
    const res = await window.pcc.send(msg);
    thinking.remove();
    addBubble(res.ok ? 'assistant' : 'assistant error', res.text || '(no output)', true);
  } catch (err) {
    thinking.remove();
    addBubble('assistant error', 'Something went wrong: ' + err.message, true);
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
  }
}

function renderCorrections() {
  CORRECTIONS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'corr';
    b.textContent = c.label;
    b.title = 'Send: ' + c.msg;
    b.addEventListener('click', () => sendMessage(c.msg));
    correctionsBar.appendChild(b);
  });
}

function showWelcome() {
  const wrap = document.createElement('div');
  wrap.className = 'welcome';
  wrap.style.cssText = 'align-self:center;max-width:520px;text-align:center;margin-top:36px;';
  const h = document.createElement('div');
  h.style.cssText = 'font-size:16px;font-weight:600;margin-bottom:8px;';
  h.textContent = "You're in the app, and it's live.";
  wrap.appendChild(h);
  const p = document.createElement('div');
  p.style.cssText = 'font-size:14px;color:#9098a1;line-height:1.5;margin-bottom:16px;';
  p.textContent = 'Type below and hit Send. You are talking to your Claude Code, and it already knows this project and your rules. Or click one to try it:';
  wrap.appendChild(p);
  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
  ['What project am I in and what is its current status?', 'What are my standing rules?', 'List the main folders in this project.'].forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s;
    b.style.cssText = 'background:#1a1d23;border:1px solid #2b2f37;color:#cdd2d9;border-radius:10px;padding:10px 12px;font-size:13px;cursor:pointer;text-align:left;font-weight:400;';
    b.addEventListener('click', () => sendMessage(s));
    chips.appendChild(b);
  });
  wrap.appendChild(chips);
  log.appendChild(wrap);
}

function loadHistory() {
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (e) { history = []; }
  if (history.length === 0) { showWelcome(); return; }
  history.forEach((m) => addBubble(m.cls, m.text, false));
  scrollDown();
}

form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; sendMessage(t); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

// ---- navigation ----
const views = {
  chat: document.getElementById('view-chat'),
  project: document.getElementById('view-project'),
  rules: document.getElementById('view-rules'),
  memory: document.getElementById('view-memory'),
  lifecycle: document.getElementById('view-lifecycle'),
  signals: document.getElementById('view-signals'),
  verify: document.getElementById('view-verify'),
};
let loadedProject = false, loadedRules = false, loadedMemory = false, loadedLifecycle = false, loadedSignals = false, loadedVerify = false;

document.querySelectorAll('.nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== v));
    if (v === 'project' && !loadedProject) { loadProject(); loadedProject = true; }
    if (v === 'rules' && !loadedRules) { loadRules(); loadedRules = true; }
    if (v === 'memory' && !loadedMemory) { loadMemory(); loadedMemory = true; }
    if (v === 'lifecycle' && !loadedLifecycle) { loadLifecycleView(); loadedLifecycle = true; }
    if (v === 'signals' && !loadedSignals) { loadSignals(); loadedSignals = true; }
    if (v === 'verify' && !loadedVerify) { runHardChecks(); loadedVerify = true; }
  });
});

async function runHardChecks() {
  const el = document.getElementById('verify-checks');
  try {
    const r = await window.pcc.hardChecks();
    el.textContent = 'GIT — what changed:\n' + (r.git || '(clean)') + '\n\nPCC HEALTH CHECK:\n' + (r.doctor || '(no output)');
  } catch (e) {
    el.textContent = 'Could not run hard checks: ' + e.message;
  }
}

// ---- signals view ----
// Renders each detector in the honest four-part format. The renderer only
// displays what the deterministic scripts report; it never invents a verdict.
const SIGNAL_TITLES = { 'untracked-files': 'Untracked files', 'scope-drift': 'Out-of-scope / drift', 'stale-docs': 'Stale docs', 'repo-sync': 'Work backed up? (repo sync)', 'chat-rollover': 'Chat health / rollover' };

// Chat rollover signal (roadmap #8). Computed from THIS chat's own history in
// localStorage - the only honest data the app actually has. Named thresholds,
// not mind-reading. It deliberately does NOT claim to measure tokens or true
// context degradation (not observable from here); those go under NOT proven.
const ROLLOVER_TURNS = 40;   // soft notice past this many of your messages
const ROLLOVER_HOURS = 6;    // soft notice past this long on one chat

function computeChatSignal() {
  const userMsgs = history.filter((m) => m.cls === 'user');
  const turns = userMsgs.length;

  // Repeats: same message (whitespace/case-normalized) sent 2+ times - the
  // exact "don't make me repeat myself" wound, and directly observable.
  const norm = (t) => (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const counts = {};
  userMsgs.forEach((m) => { const k = norm(m.text); if (k) counts[k] = (counts[k] || 0) + 1; });
  const repeats = Object.entries(counts).filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1]);
  const repeatItems = repeats.map(([k, n]) => n + '×  "' + (k.length > 60 ? k.slice(0, 60) + '…' : k) + '"');

  // Elapsed span from whatever timestamps exist (older messages predate ts).
  const ts = history.map((m) => m.ts).filter((t) => typeof t === 'number');
  let spanHours = null;
  if (ts.length >= 2) spanHours = (Math.max(...ts) - Math.min(...ts)) / 3600000;

  const notice = (turns >= ROLLOVER_TURNS) || (repeats.length > 0) || (spanHours !== null && spanHours >= ROLLOVER_HOURS);

  let observed = turns + ' message(s) sent in this chat';
  if (spanHours !== null) observed += ', spanning ~' + (spanHours < 1 ? '<1' : spanHours.toFixed(1)) + ' hour(s)';
  observed += '.';
  if (repeats.length) observed += ' ' + repeats.length + ' message(s) were sent more than once.';

  return {
    detector: 'chat-rollover',
    signal: notice ? 'notice' : 'clear',
    checked_at: new Date().toISOString(),
    items: repeatItems,
    observed,
    might_mean: notice
      ? 'Long or looping chats tend to drift, lose the earlier thread, and make you repeat yourself. A fresh chat started from the handoff/brief often works better than pushing this one further.'
      : 'This chat is still short and shows no repeated messages - no reason to roll over yet.',
    not_proven: 'Token usage and whether context has actually degraded are NOT measurable from here. Whether a fresh chat is warranted is a judgment; these are just observable counts. Messages from before this update have no timestamp, so the time span may undercount.',
    what_to_do: notice
      ? 'If it feels like you are repeating yourself or the chat is drifting, start a new chat and paste the handoff block / PROJECT.md brief (roadmap #7). Otherwise keep going.'
      : 'Nothing needed.',
  };
}

function signalCard(d) {
  const sig = (d.signal || 'unknown');
  const card = document.createElement('div');
  card.className = 'signal-card ' + sig;
  const title = SIGNAL_TITLES[d.detector] || d.detector || 'Signal';
  let html = '<div class="signal-head"><span class="signal-title">' + escapeHtml(title)
    + '</span><span class="signal-badge ' + sig + '">' + escapeHtml(sig) + '</span></div>';
  html += '<div class="signal-row"><span class="k">Observed</span>' + escapeHtml(d.observed || '—') + '</div>';
  if (Array.isArray(d.items) && d.items.length) {
    html += '<ul class="signal-items">' + d.items.map((i) => '<li>' + escapeHtml(i) + '</li>').join('') + '</ul>';
  }
  html += '<div class="signal-row"><span class="k">What it might mean</span>' + escapeHtml(d.might_mean || '—') + '</div>';
  html += '<div class="signal-row"><span class="k">What is NOT proven</span>' + escapeHtml(d.not_proven || '—') + '</div>';
  html += '<div class="signal-row"><span class="k">What to do</span>' + escapeHtml(d.what_to_do || '—') + '</div>';
  if (d.checked_at) html += '<div class="signal-foot">Checked ' + escapeHtml(d.checked_at) + '</div>';
  card.innerHTML = html;
  return card;
}

async function loadSignals() {
  const list = document.getElementById('signals-list');
  const status = document.getElementById('signals-status');
  status.textContent = 'Checking…';
  list.innerHTML = '';
  try {
    const r = await window.pcc.detections();
    const cards = Object.values(r || {});
    cards.push(computeChatSignal()); // app-side signal from this chat's own history
    cards.forEach((d) => list.appendChild(signalCard(d)));
    status.textContent = '';
  } catch (e) {
    list.innerHTML = '<p class="muted">Could not run signals: ' + escapeHtml(e.message) + '</p>';
    status.textContent = '';
  }
}

document.getElementById('signals-refresh').addEventListener('click', () => { loadSignals(); loadTrust(); });

// ---- lifecycle view (roadmap #6) ----
// Renders the declared stage map (current highlighted) and only the legal next
// stages, straight from the deterministic script. Never invents a next step.
async function loadLifecycleView() {
  const map = document.getElementById('lifecycle-map');
  const detail = document.getElementById('lifecycle-detail');
  map.innerHTML = ''; detail.innerHTML = '<p class="muted">Loading…</p>';
  let r = null;
  try { r = await window.pcc.lifecycle(); } catch (e) { detail.innerHTML = '<p class="muted">Could not read lifecycle: ' + escapeHtml(e.message) + '</p>'; return; }

  if (!r || r.signal !== 'ok') {
    detail.innerHTML = '<p class="muted">' + escapeHtml((r && r.observed) || 'Lifecycle not set.') + '</p>';
    (r && r.all_stages ? r.all_stages : []).forEach((s, i) => {
      if (i) map.appendChild(Object.assign(document.createElement('span'), { className: 'lc-arrow', textContent: '→' }));
      const el = document.createElement('span'); el.className = 'lc-stage'; el.textContent = s.label; map.appendChild(el);
    });
    return;
  }

  (r.all_stages || []).forEach((s, i) => {
    if (i) map.appendChild(Object.assign(document.createElement('span'), { className: 'lc-arrow', textContent: '→' }));
    const el = document.createElement('span');
    el.className = 'lc-stage' + (s.is_current ? ' current' : '');
    el.textContent = s.label;
    map.appendChild(el);
  });

  const c = r.current;
  let html = '<div class="lc-card">'
    + '<div class="v" style="font-weight:600;color:#dbe8ff;">You are here: ' + escapeHtml(c.label) + '</div>'
    + '<span class="k">What this stage is</span><div class="v">' + escapeHtml(c.description) + '</div>'
    + '<span class="k">What to do now</span><div class="v">' + escapeHtml(c.what_to_do) + '</div>'
    + '<span class="k">Exit this stage when</span><div class="v">' + escapeHtml(c.exit_criteria) + '</div>'
    + '</div>';
  html += '<div class="lc-next"><h3>Legal next steps</h3>';
  (r.next || []).forEach((n) => {
    html += '<div class="lc-next-item"><div class="lbl">→ ' + escapeHtml(n.label) + '</div><div class="do">' + escapeHtml(n.what_to_do) + '</div></div>';
  });
  html += '</div>';
  detail.innerHTML = html;
}

// ---- live trust strip (roadmap #14) ----
// Always-visible, and honest: each chip is green ONLY when a real deterministic
// check says so. "Verified" stays amber unless a fresh PASS exists that is
// newer than the latest commit; it never fakes green.
function setChip(id, cls, text, title) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'trust-chip ' + cls;
  el.innerHTML = '<span class="dot"></span>' + escapeHtml(text);
  el.title = title || '';
}

function railsFrom(d) {
  const parts = [d && d.drift, d && d.staleDocs].filter(Boolean);
  if (!parts.length || parts.some((p) => p.signal === 'unknown')) return 'unknown';
  return parts.some((p) => p.signal === 'notice') ? 'warn' : 'good';
}

async function loadTrust() {
  let d = null, x = null;
  try { d = await window.pcc.detections(); } catch (e) { /* leave unknown */ }
  try { x = await window.pcc.trustExtras(); } catch (e) { /* leave unknown */ }

  // On the rails: no drift, no stale docs.
  const rails = railsFrom(d);
  setChip('trust-rails',
    rails === 'good' ? 'good' : rails === 'warn' ? 'warn' : 'unknown',
    'On the rails',
    rails === 'good' ? 'No drift and no stale docs detected.'
      : rails === 'warn' ? 'A drift or stale-docs signal is raised — see the Signals tab.'
      : 'Could not read the drift/stale-docs signals.');

  // Backed up: repo-sync clear.
  const rs = d && d.repoSync && d.repoSync.signal;
  setChip('trust-backup',
    rs === 'clear' ? 'good' : rs === 'notice' ? 'warn' : 'unknown',
    'Backed up',
    rs === 'clear' ? 'Working tree clean and branch level with its remote.'
      : rs === 'notice' ? 'Work is not fully backed up — see the Signals tab.'
      : 'Could not read the repo-sync signal.');

  // Verified: honest freshness against HEAD; never fake green.
  const v = x && x.verification;
  if (!x) {
    setChip('trust-verified', 'unknown', 'Verified', 'Could not read verification status.');
  } else if (!v || !v.present) {
    setChip('trust-verified', 'warn', 'Not verified yet', 'No independent verification recorded for the current work yet (the scheduled Codex run writes one).');
  } else if (v.verdict === 'PASS' && v.mtimeEpoch >= (x.headCommitEpoch || 0)) {
    setChip('trust-verified', 'good', 'Verified (fresh)', 'Independent PASS recorded, newer than the latest commit.');
  } else if (v.verdict === 'PASS') {
    setChip('trust-verified', 'warn', 'Verified (stale)', 'Last verdict was PASS but it predates the latest commit — re-verify.');
  } else if (v.verdict) {
    setChip('trust-verified', 'bad', 'Verified: ' + v.verdict, 'Last recorded verdict was ' + v.verdict + '.');
  } else {
    setChip('trust-verified', 'warn', 'Verification unclear', 'A verification file exists but no clear verdict was found in it.');
  }

  // Rules loaded: CLAUDE.md present (proves the rules load, not that they were obeyed).
  const rl = x && x.rulesLoaded;
  setChip('trust-rules',
    rl ? 'good' : (x ? 'bad' : 'unknown'),
    'Rules loaded',
    rl ? 'CLAUDE.md is present and auto-loads into every Claude session. (Proves the rules load, not that they were obeyed.)'
      : x ? 'CLAUDE.md not found — standing rules are NOT loading.'
      : 'Could not read rules status.');
}

// ---- project view ----
function row(label, value) {
  const shown = (value !== undefined && value !== null && String(value).trim())
    ? escapeHtml(String(value)) : '<span class="muted">—</span>';
  return '<tr><th>' + label + '</th><td>' + shown + '</td></tr>';
}

async function initHeader() {
  try {
    const s = await window.pcc.getState();
    const p = s.project || {};
    if (p.project_name) document.getElementById('project').textContent = p.project_name;
  } catch (e) { /* header is cosmetic */ }
}

// Lifecycle bar: where you are, the next action, and a "Decision required"
// flag - all read from real state. Honest: if there's no next action it says
// "not set", it never invents one.
async function loadLifecycle() {
  try {
    const s = await window.pcc.getState();
    const p = s.project || {}, t = s.task || {};
    document.getElementById('lc-phase').textContent = (p.current_phase || 'unknown') + (t.task_status ? '  ·  ' + t.task_status : '');
    document.getElementById('lc-next').textContent = p.next_expected_action || 'not set';
    const dec = t.owner_decision_request;
    const q = dec && (dec.question || (typeof dec === 'string' ? dec : ''));
    const el = document.getElementById('lc-decision');
    if (q) { el.style.display = 'inline'; el.textContent = 'Decision required: ' + q; }
    else { el.style.display = 'none'; }
  } catch (e) { /* state optional */ }
}

async function loadProject() {
  const body = document.getElementById('project-body');
  try {
    const s = await window.pcc.getState();
    const p = s.project || {}, t = s.task || {};
    if (p._error) { body.innerHTML = '<p class="muted">No project state found yet.</p>'; return; }
    body.innerHTML = '<table class="state">'
      + row('Project', (p.project_name || '') + (p.project_id ? '  (' + p.project_id + ')' : ''))
      + row('Phase', p.current_phase)
      + row('Current task', t.task_id ? (t.task_id + ' — ' + (t.task_title || '')) : '')
      + row('Task status', t.task_status)
      + row('Last verdict', t.verification_verdict)
      + row('Current blocker', t.current_blocker)
      + row('Next action', p.next_expected_action)
      + '</table>';
  } catch (e) {
    body.innerHTML = '<p class="muted">Could not read project state.</p>';
  }
  loadDecisions();
}

// Recent decisions carry-forward (roadmap #5): surfaced from docs/DECISIONS.md.
async function loadDecisions() {
  const el = document.getElementById('decisions-body');
  if (!el) return;
  try {
    const r = await window.pcc.recentDecisions();
    const ds = (r && r.decisions) || [];
    if (!ds.length) { el.innerHTML = '<p class="muted">No decisions found.</p>'; return; }
    el.innerHTML = ds.map((d) =>
      '<div class="decision-item"><div class="d-head">' + escapeHtml(d.id)
      + (d.date ? ' · ' + escapeHtml(d.date) : '')
      + (d.status ? ' · <span class="d-status">' + escapeHtml(d.status) + '</span>' : '')
      + '</div><div class="d-title">' + escapeHtml(d.title) + '</div></div>'
    ).join('');
  } catch (e) {
    el.innerHTML = '<p class="muted">Could not read decisions.</p>';
  }
}

// ---- new-chat handoff (roadmap #7) ----
const handoffOut = document.getElementById('handoff-out');
const handoffCopy = document.getElementById('handoff-copy');

document.getElementById('handoff-gen').addEventListener('click', async () => {
  const status = document.getElementById('handoff-status');
  const btn = document.getElementById('handoff-gen');
  btn.disabled = true; status.textContent = 'Assembling from repo truth…';
  try {
    const r = await window.pcc.handoff();
    handoffOut.textContent = r && r.text ? r.text : '(no output)';
    handoffOut.style.display = 'block';
    handoffCopy.style.display = (r && r.ok) ? 'inline-block' : 'none';
    status.textContent = (r && r.ok) ? 'Ready — copy and paste into a new chat.' : 'Could not generate.';
  } catch (e) {
    handoffOut.textContent = 'Error: ' + e.message; handoffOut.style.display = 'block';
    status.textContent = '';
  } finally { btn.disabled = false; }
});

handoffCopy.addEventListener('click', async () => {
  const status = document.getElementById('handoff-status');
  try { await navigator.clipboard.writeText(handoffOut.textContent); status.textContent = 'Copied.'; }
  catch (e) { status.textContent = 'Copy failed — select the text and copy manually.'; }
  setTimeout(() => { status.textContent = ''; }, 2500);
});

// ---- rules view ----
async function loadRules() {
  const el = document.getElementById('rules-content');
  try {
    const r = await window.pcc.getRules();
    el.textContent = (r && r.ok && r.text) ? r.text : 'No CLAUDE.md found yet.';
  } catch (e) {
    el.textContent = 'Could not read rules.';
  }
}

// ---- memory view ----
async function loadMemory() {
  const el = document.getElementById('memory-text');
  try { const r = await window.pcc.getMemory(); el.value = (r && r.text) || ''; }
  catch (e) { el.value = ''; }
}

document.getElementById('memory-save').addEventListener('click', async () => {
  const status = document.getElementById('memory-status');
  status.textContent = 'Saving…';
  try {
    const r = await window.pcc.saveMemory(document.getElementById('memory-text').value);
    status.textContent = r && r.ok ? 'Saved.' : ('Error: ' + (r && r.error ? r.error : 'unknown'));
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
  setTimeout(() => { status.textContent = ''; }, 2500);
});

// ---- verify view ----
document.getElementById('verify-run').addEventListener('click', async () => {
  const status = document.getElementById('verify-status');
  const result = document.getElementById('verify-result');
  const btn = document.getElementById('verify-run');
  btn.disabled = true;
  status.textContent = 'Codex is reviewing… (needs usage available; can take a minute)';
  result.style.display = 'none';
  try {
    const r = await window.pcc.verify();
    result.textContent = (r && r.text) ? r.text : '(no result)';
    result.style.display = 'block';
    status.textContent = (r && r.ok) ? '' : 'Verifier error.';
  } catch (e) {
    result.textContent = 'Error: ' + e.message;
    result.style.display = 'block';
    status.textContent = '';
  } finally {
    btn.disabled = false;
  }
});

// ---- boot ----
renderCorrections();
initHeader();
loadLifecycle();
loadTrust();
loadHistory();
