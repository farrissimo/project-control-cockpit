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
  if (persist) { history.push({ cls, text }); save(); }
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
  verify: document.getElementById('view-verify'),
};
let loadedProject = false, loadedRules = false, loadedMemory = false;

document.querySelectorAll('.nav').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const v = btn.dataset.view;
    Object.entries(views).forEach(([k, el]) => el.classList.toggle('hidden', k !== v));
    if (v === 'project' && !loadedProject) { loadProject(); loadedProject = true; }
    if (v === 'rules' && !loadedRules) { loadRules(); loadedRules = true; }
    if (v === 'memory' && !loadedMemory) { loadMemory(); loadedMemory = true; }
  });
});

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
}

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
  status.textContent = 'Codex is verifying… this can take a minute.';
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
loadHistory();
