// PCC Cockpit - renderer. Chat + Project + Rules + Memory views, plus
// one-click corrections. Conversation persists in localStorage; Claude keeps
// its own side via --continue (main.js), so context survives restarts.

const log = document.getElementById('log');
const input = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('send');
const correctionsBar = document.getElementById('corrections');

// Chat history: many named conversations, each pinned to its own id (which is
// also the Claude session id, so switching resumes the right thread). `history`
// stays as a live reference to the ACTIVE chat's messages, so the existing
// signal code (rollover/sycophancy/metrics) that reads `history` keeps working.
const CHATS_KEY = 'pcc.chats.v2';
const ACTIVE_KEY = 'pcc.activeChat.v2';
const OLD_HISTORY_KEY = 'pcc.chat.history';
let chats = [];
let activeId = null;
let history = [];
let busy = false;

function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
function activeChat() { return chats.find((c) => c.id === activeId) || null; }
function newChatObj() { return { id: uuid(), name: 'New chat', started: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; }
function persistChats() { localStorage.setItem(CHATS_KEY, JSON.stringify(chats)); localStorage.setItem(ACTIVE_KEY, activeId || ''); }

const CORRECTIONS = [
  { label: 'Be concise', msg: 'Be concise.' },
  { label: 'No cheerleading', msg: 'No cheerleading - just the facts.' },
  { label: 'Stay in scope', msg: 'Stay in scope. Only do what I asked.' },
  { label: 'Show evidence', msg: 'Show me the evidence for that.' },
  { label: 'Stop reacting', msg: 'Stop reacting. Think it through first.' },
  { label: 'Push back', msg: "Push back on this. What are the real risks, downsides, and the strongest case against it? Don't just agree with me." },
  { label: 'Check prior art', msg: 'Before we build anything: assume this problem is already solved somewhere. Web-search for existing tools/solutions and tell me what already exists and whether we should reuse it instead of building.' },
  { label: 'Rabbit-hole check', msg: "Honestly assess whether this idea is a rabbit hole - disproportionately large or open-ended for its payoff. This is a WARNING, not a blocker: don't refuse it. List the strong signals you see (many unknowns, touches many files/systems, needs new dependencies or research, unclear or shifting scope, low/uncertain payoff vs effort), give a rough size (small / medium / large / open-ended), and say plainly whether it looks like a rabbit hole and why - so I can decide." },
  { label: 'Copy block', msg: 'Put that in a copy block.' },
];

function scrollDown() { log.scrollTop = log.scrollHeight; }
function save() { const c = activeChat(); if (c) c.updatedAt = Date.now(); persistChats(); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// Render an assistant message with working copy blocks. Fenced ```code``` blocks
// become a styled block with a real Copy button; `inline code` is styled; the
// rest is escaped plain text (newlines preserved by CSS pre-wrap). Everything is
// HTML-escaped first, so this is safe against injection. (Owner-found bug: copy
// blocks the worker produced were showing as raw backticks with no way to copy.)
function renderAssistant(text) {
  const parts = String(text).split('```');
  let html = '';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      // Inside a fence. If the first line is a bare language tag (one word, no
      // spaces), drop it; the rest is the code.
      let seg = parts[i];
      const firstNl = seg.indexOf('\n');
      if (firstNl >= 0) {
        const firstLine = seg.slice(0, firstNl).trim();
        if (firstLine && !/\s/.test(firstLine) && firstLine.length < 20) seg = seg.slice(firstNl + 1);
      }
      html += '<div class="codeblock"><button class="cb-copy" type="button">Copy</button><pre class="cb-code">' + escapeHtml(seg.replace(/^\n/, '').replace(/\n$/, '')) + '</pre></div>';
    } else {
      html += escapeHtml(parts[i]).replace(/`([^`\n]+)`/g, '<code class="inline">$1</code>');
    }
  }
  return html;
}

function addBubble(cls, text, persist) {
  const el = document.createElement('div');
  el.className = 'bubble ' + cls;
  const isAssistant = cls.indexOf('assistant') !== -1 && cls.indexOf('thinking') === -1;
  if (isAssistant && String(text).indexOf('```') !== -1) { el.innerHTML = renderAssistant(text); }
  else { el.textContent = text; }
  log.appendChild(el);
  scrollDown();
  if (persist) { history.push({ cls, text, ts: Date.now() }); save(); }
  return el;
}

// Delegated copy handler for code blocks in assistant bubbles.
log.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.cb-copy');
  if (!btn) return;
  const pre = btn.parentElement.querySelector('.cb-code');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    const prev = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = prev; }, 1500);
  }).catch(() => { btn.textContent = 'Copy failed'; });
});

// `displayText`, when given, is what's SHOWN and PERSISTED as your bubble
// (and so what future transcript-building sees) - while the full `text` is what
// actually goes to Claude. Needed for "Capture decisions": without this, the
// giant embedded transcript would itself get stored in history, and the NEXT
// capture would re-embed it, growing without bound.
async function sendMessage(text, displayText) {
  const msg = (text || '').trim();
  if (!msg || busy) return;
  const shown = (displayText || msg).trim();
  const chat = activeChat();
  if (!chat) return;
  const welcome = log.querySelector('.welcome');
  if (welcome) welcome.remove();
  // Auto-name a fresh chat from its first message (like Claude Code's Recents).
  if (chat.name === 'New chat' && chat.messages.filter((m) => m.cls === 'user').length === 0) {
    chat.name = shown.replace(/\s+/g, ' ').slice(0, 40) + (shown.length > 40 ? '…' : '');
    renderChatList();
  }
  addBubble('user', shown, true);
  busy = true; sendBtn.disabled = true;
  const thinking = addBubble('assistant thinking', 'Claude is working…', false);
  try {
    const res = await window.pcc.send(msg, getSelectedModel(), chat.id, !chat.started);
    thinking.remove();
    if (res.ok) { chat.started = true; save(); }
    addBubble(res.ok ? 'assistant' : 'assistant error', res.text || '(no output)', true);
  } catch (err) {
    thinking.remove();
    addBubble('assistant error', 'Something went wrong: ' + err.message, true);
  } finally {
    busy = false; sendBtn.disabled = false; input.focus();
  }
}

// ---- model switcher + new chat ----
const MODEL_KEY = 'pcc.model';
function getSelectedModel() {
  const sel = document.getElementById('model-select');
  return (sel && sel.value) || localStorage.getItem(MODEL_KEY) || undefined;
}

async function initModels() {
  const sel = document.getElementById('model-select');
  if (!sel) return;
  let cfg = null;
  try { cfg = await window.pcc.getModels(); } catch (e) { /* leave empty */ }
  const models = (cfg && cfg.models) || [];
  const saved = localStorage.getItem(MODEL_KEY);
  const wanted = saved || (cfg && cfg.default);
  sel.innerHTML = '';
  models.forEach((m) => {
    const o = document.createElement('option');
    o.value = m.id; o.textContent = m.label || m.id;
    if (m.id === wanted) o.selected = true;
    sel.appendChild(o);
  });
  // If the saved model is no longer in the list, fall back to the default
  // (never leave a stale/unavailable model selected).
  if (saved && !models.some((m) => m.id === saved) && cfg && cfg.default) {
    sel.value = cfg.default; localStorage.setItem(MODEL_KEY, cfg.default);
  }
  sel.addEventListener('change', () => localStorage.setItem(MODEL_KEY, sel.value));
}

// Start a new chat: create a fresh named conversation and switch to it. Clean
// start (no auto handoff dump) - with real chat history this is a frequent
// action, like Claude Code's new chat. To carry context into a fresh chat, use
// "Generate handoff" in the Project tab.
function startNewChat() {
  if (busy) return;
  const c = newChatObj();
  chats.unshift(c);
  activeId = c.id;
  history = c.messages;
  persistChats();
  renderActiveChat();
  renderChatList();
  loadTrust();
  input.value = '';
  input.focus();
}
document.getElementById('new-chat').addEventListener('click', startNewChat);

// New project: start a guided, chat-first intake (reuses CCB's intake logic via
// scripts/new-project-intake.ps1). Opens a fresh named chat and kicks off the
// interview; the worker runs the protocol, interviews in plain language, and
// scaffolds via bootstrap-project.ps1 when the owner approves.
document.getElementById('new-project').addEventListener('click', () => {
  if (busy) return;
  const name = prompt('What would you like to call the new project?');
  if (!name || !name.trim()) return;
  const nm = name.trim();
  document.querySelector('.nav[data-view="chat"]').click();
  startNewChat();
  const c = activeChat();
  if (c) { c.name = 'New project: ' + nm.slice(0, 30); renderChatList(); }
  const kickoff = 'I want to start a NEW project called "' + nm + '". '
    + 'Run `scripts/new-project-intake.ps1` to load the intake protocol, then interview me in plain language following it, one or two questions at a time. '
    + 'Do not skip the approval gates. When I approve the blueprint, scaffold the project into a new folder next to this one using `scripts/bootstrap-project.ps1` with the blueprint, and tell me how to open it. Ask me the first question now.';
  sendMessage(kickoff);
});

// Quick buttons act on the conversation, smartly (owner feedback):
//  - If you've TYPED a question, the modifier is applied to it and sent in ONE
//    turn (e.g. type a question, click "Be concise" -> concise answer).
//  - If the box is EMPTY, the modifier acts on the LAST answer (e.g. a long
//    reply is up, click "Be concise" -> it shortens what it just posted).
function renderCorrections() {
  CORRECTIONS.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'corr';
    b.textContent = c.label;
    b.title = 'Applies to your typed question, or to the last answer if the box is empty: "' + c.msg + '"';
    b.addEventListener('click', () => {
      if (busy) return;
      const typed = input.value.trim();
      if (typed) { input.value = ''; sendMessage(typed + '\n\n' + c.msg); }
      else { sendMessage(c.msg); }
    });
    correctionsBar.appendChild(b);
  });
  correctionsBar.appendChild(makeCaptureDecisionsButton());
}

// ---- Capture decisions (roadmap #12) ----
// Owner's design: a button, but it must ground itself in the literal chat
// transcript - NOT in Claude's own conversational memory (which this session
// already proved can be hijacked/lost - see the --resume session-pinning fix).
// So this reads the ACTIVE chat's own already-persisted messages (verbatim,
// from `history`/localStorage - real, non-memory data) and hands that text to
// Claude, asking it to quote candidate agreements from within it - never invent
// one - and to get the owner's confirmation before writing anything to
// docs/DECISIONS.md. Honest limit: it can only see THIS chat's own history: a
// decision made in a different or already-closed chat is invisible to it.
const CAPTURE_TRANSCRIPT_MAX_CHARS = 12000;

function buildChatTranscript() {
  const msgs = history.filter((m) => m.cls === 'user' || m.cls === 'assistant');
  const lines = msgs.map((m) => (m.cls === 'user' ? 'OWNER: ' : 'ASSISTANT: ') + m.text);
  let text = lines.join('\n\n');
  let truncated = false;
  if (text.length > CAPTURE_TRANSCRIPT_MAX_CHARS) {
    text = text.slice(text.length - CAPTURE_TRANSCRIPT_MAX_CHARS);
    truncated = true;
  }
  return { text, truncated, count: msgs.length };
}

function makeCaptureDecisionsButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'corr';
  b.textContent = 'Capture decisions';
  b.title = 'Scans THIS chat\'s own transcript (not memory) for agreements you made, and proposes them - quoted, never invented - for you to confirm before writing to docs/DECISIONS.md.';
  b.addEventListener('click', () => {
    if (busy) return;
    const { text, truncated, count } = buildChatTranscript();
    if (!count) { addBubble('assistant error', 'Nothing to scan yet - this chat has no messages.', true); return; }
    const note = truncated ? '\n(Transcript truncated to the most recent ~' + CAPTURE_TRANSCRIPT_MAX_CHARS + ' characters - only what fits below was scanned.)' : '';
    const prompt = 'Scan the transcript of THIS chat below (verbatim, provided fresh - do not rely on your own memory of the conversation) for any concrete decision or agreement the owner made that is not yet recorded in docs/DECISIONS.md. '
      + 'Only use what was actually said - do not infer or invent a decision that was not explicitly stated. '
      + 'For each candidate, quote the exact line(s) it came from and give a one-line plain-English summary. '
      + 'If none are found, say so plainly - do not force one. '
      + 'Do NOT write anything yet: list the candidates and ask me which (if any) to record as a new DECISION-NNN in docs/DECISIONS.md.' + note
      + '\n\n=== THIS CHAT\'S TRANSCRIPT (' + count + ' message(s)) ===\n' + text;
    // Show/store a short label, not the giant embedded transcript - otherwise
    // the next capture would re-scan this capture's own huge prompt too.
    sendMessage(prompt, 'Capture decisions (scanned ' + count + ' message(s) from this chat' + (truncated ? ', truncated' : '') + ')');
  });
  return b;
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

// Render the active chat's messages (or the welcome screen if empty).
function renderActiveChat() {
  log.innerHTML = '';
  const c = activeChat();
  if (!c || c.messages.length === 0) { showWelcome(); return; }
  c.messages.forEach((m) => addBubble(m.cls, m.text, false));
  scrollDown();
}

function loadChats() {
  try { chats = JSON.parse(localStorage.getItem(CHATS_KEY)) || []; } catch (e) { chats = []; }
  if (!Array.isArray(chats)) chats = [];
  // One-time migration: fold a pre-history single conversation into one chat.
  if (chats.length === 0) {
    let old = [];
    try { old = JSON.parse(localStorage.getItem(OLD_HISTORY_KEY)) || []; } catch (e) { old = []; }
    if (old.length) {
      const first = old.find((m) => m.cls === 'user');
      const nm = first ? first.text.replace(/\s+/g, ' ').slice(0, 40) : 'Imported chat';
      chats.push({ id: uuid(), name: nm, started: true, messages: old, createdAt: Date.now(), updatedAt: Date.now() });
      localStorage.removeItem(OLD_HISTORY_KEY);
    }
  }
  if (chats.length === 0) chats.push(newChatObj());
  const savedActive = localStorage.getItem(ACTIVE_KEY);
  activeId = (savedActive && chats.some((c) => c.id === savedActive)) ? savedActive : chats[0].id;
  history = activeChat().messages;
  persistChats();
  renderActiveChat();
  renderChatList();
}

function switchChat(id) {
  if (busy || id === activeId) { closeChatsPanel(); return; }
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  activeId = id;
  history = c.messages;
  persistChats();
  renderActiveChat();
  renderChatList();
  loadTrust();
  closeChatsPanel();
}

function renameChat(id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  const name = prompt('Rename this chat:', c.name);
  if (name && name.trim()) { c.name = name.trim().slice(0, 60); persistChats(); renderChatList(); }
}

function deleteChat(id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  if (!confirm('Delete "' + c.name + '"? This removes it from the list (Claude may still have the session on disk).')) return;
  chats = chats.filter((x) => x.id !== id);
  if (chats.length === 0) chats.push(newChatObj());
  if (id === activeId) { activeId = chats[0].id; history = activeChat().messages; renderActiveChat(); loadTrust(); }
  persistChats();
  renderChatList();
}

function relTime(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm ago';
  if (s < 86400) return Math.floor(s / 3600) + 'h ago';
  return Math.floor(s / 86400) + 'd ago';
}

function closeChatsPanel() { const p = document.getElementById('chats-panel'); if (p) p.classList.add('hidden'); }

function renderChatList() {
  const panel = document.getElementById('chats-panel');
  const btn = document.getElementById('chats-btn');
  if (btn) btn.textContent = 'Chats (' + chats.length + ')';
  if (!panel) return;
  const ordered = chats.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  panel.innerHTML = ordered.map((c) =>
    '<div class="chat-row' + (c.id === activeId ? ' active' : '') + '" data-id="' + c.id + '">'
    + '<div class="chat-row-main" data-act="switch" data-id="' + c.id + '">'
    + '<div class="chat-name">' + escapeHtml(c.name) + '</div>'
    + '<div class="chat-when">' + relTime(c.updatedAt) + '</div></div>'
    + '<button class="chat-mini" data-act="rename" data-id="' + c.id + '" title="Rename">✎</button>'
    + '<button class="chat-mini" data-act="delete" data-id="' + c.id + '" title="Delete">🗑</button>'
    + '</div>'
  ).join('') || '<div class="chat-when" style="padding:8px;">No chats yet.</div>';
}

// Delegated actions for the chats panel + toggle button.
document.getElementById('chats-btn').addEventListener('click', (e) => {
  e.stopPropagation();
  const p = document.getElementById('chats-panel');
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) renderChatList();
});
document.getElementById('chats-panel').addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id, act = el.dataset.act;
  if (act === 'switch') switchChat(id);
  else if (act === 'rename') renameChat(id);
  else if (act === 'delete') deleteChat(id);
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('chats-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (e.target.closest('#chats-panel') || e.target.closest('#chats-btn')) return;
  closeChatsPanel();
});

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
const SIGNAL_TITLES = { 'untracked-files': 'Untracked files', 'scope-drift': 'Out-of-scope / drift', 'stale-docs': 'Stale docs', 'repo-sync': 'Work backed up? (repo sync)', 'bloat': 'Project bloat', 'sycophancy': 'Never says no?', 'chat-rollover': 'Chat health / rollover' };

// Sycophancy / never-says-no nudge (roadmap #17). Honest and light: it checks
// whether the most recent substantive AI answer used ANY risk/pushback language.
// Absence is a weak signal (an answer can push back without these exact words),
// so it is framed as a nudge, never a verdict. The "Push back" correction button
// is the solid half; this just surfaces when a second look might be worth it.
const RISK_WORDS = ['risk', 'downside', 'trade-off', 'tradeoff', 'drawback', 'limitation',
  'caveat', 'concern', 'caution', 'pitfall', "won't work", 'not recommend', "don't recommend",
  'disagree', 'watch out', 'not proven', 'however', 'on the other hand', 'the catch'];

function computeSycophancySignal() {
  const answers = history.filter((m) => m.cls === 'assistant');
  const last = answers.length ? answers[answers.length - 1] : null;
  // Only judge a substantive answer; a short reply isn't sycophancy.
  if (!last || (last.text || '').length < 400) {
    return {
      detector: 'sycophancy', signal: 'clear', checked_at: new Date().toISOString(), items: [],
      observed: last ? 'The latest answer is short; not evaluated.' : 'No AI answers in this chat yet.',
      might_mean: 'Nothing to flag.',
      not_proven: 'This only looks at the most recent substantive answer, by keywords - it cannot truly judge whether the AI pushed back.',
      what_to_do: 'Nothing needed.',
    };
  }
  const lower = last.text.toLowerCase();
  const hasRisk = RISK_WORDS.some((w) => lower.includes(w));
  return {
    detector: 'sycophancy',
    signal: hasRisk ? 'clear' : 'notice',
    checked_at: new Date().toISOString(),
    items: [],
    observed: hasRisk
      ? 'The latest substantive answer did mention risk / downside / pushback language.'
      : 'The latest substantive answer named no risk, downside, or trade-off.',
    might_mean: hasRisk
      ? 'The AI at least surfaced some caution - no nudge needed.'
      : 'The AI may just be agreeing without weighing the downside (the "never says no" trap) - OR the answer genuinely had no downside to raise.',
    not_proven: 'This is a keyword heuristic on one answer, not proof of sycophancy. An answer can push back without these words, or use a word without really pushing back.',
    what_to_do: hasRisk ? 'Nothing needed.' : 'If it felt one-sided, hit the "Push back" button to make it argue the other side.',
  };
}

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

  // Gauge fill = how close this chat is to the rollover thresholds (real,
  // already-declared limits: ROLLOVER_TURNS / ROLLOVER_HOURS). Honest, bounded.
  const pctTurns = turns / ROLLOVER_TURNS;
  const pctSpan = spanHours !== null ? spanHours / ROLLOVER_HOURS : 0;
  const gaugePct = Math.min(100, Math.round(100 * Math.max(pctTurns, pctSpan)));

  let observed = turns + ' message(s) sent in this chat';
  if (spanHours !== null) observed += ', spanning ~' + (spanHours < 1 ? '<1' : spanHours.toFixed(1)) + ' hour(s)';
  observed += '.';
  if (repeats.length) observed += ' ' + repeats.length + ' message(s) were sent more than once.';

  return {
    detector: 'chat-rollover',
    signal: notice ? 'notice' : 'clear',
    checked_at: new Date().toISOString(),
    gauge: { value: gaugePct, label: 'Chat length' },
    items: repeatItems,
    observed,
    might_mean: notice
      ? 'Long or looping chats tend to drift, lose the earlier thread, and make you repeat yourself. A fresh chat started from the handoff/brief often works better than pushing this one further.'
      : 'This chat is still short and shows no repeated messages - no reason to roll over yet.',
    not_proven: 'Token usage and whether context has actually degraded are NOT measurable from here. Whether a fresh chat is warranted is a judgment; these are just observable counts. Messages from before this update have no timestamp, so the time span may undercount.',
    what_to_do: notice
      ? 'If it feels like you are repeating yourself or the chat is drifting, hit the "New chat" button (top of the chat) - it starts a fresh thread and loads the handoff briefing for you to send. Otherwise keep going.'
      : 'Nothing needed.',
  };
}

// Reusable gauge (roadmap #23). A semicircle "speedometer/tank" for a single,
// bounded metric approaching a limit (chat length, bloat). Color reinforces but
// never carries meaning alone: the fill LEVEL and the numeric readout convey the
// value even without color (WCAG + colorblind-safe). Zones: green under 60%,
// amber 60-85%, red 85%+. pathLength=100 lets the fill be a simple percentage.
function zoneForPct(p) { return p < 60 ? 'success' : (p < 85 ? 'warning' : 'danger'); }
function gaugeSVG(pct, label) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const arc = 'M 12 60 A 40 40 0 0 1 108 60';
  return '<div class="gauge-wrap" role="img" aria-label="' + escapeHtml(label + ': ' + p + ' percent') + '">'
    + '<svg viewBox="0 0 120 70" class="gauge">'
    + '<path class="gauge-track" d="' + arc + '" pathLength="100"/>'
    + '<path class="gauge-fill ' + zoneForPct(p) + '" d="' + arc + '" pathLength="100" stroke-dasharray="' + p + ' 100"/>'
    + '<text x="60" y="55" text-anchor="middle" class="gauge-val">' + p + '%</text>'
    + '</svg><div class="gauge-cap">' + escapeHtml(label) + '</div></div>';
}

function signalCard(d) {
  const sig = (d.signal || 'unknown');
  const card = document.createElement('div');
  card.className = 'signal-card ' + sig;
  const title = SIGNAL_TITLES[d.detector] || d.detector || 'Signal';
  let html = '<div class="signal-head"><span class="signal-title">' + escapeHtml(title)
    + '</span><span class="signal-badge ' + sig + '">' + escapeHtml(sig) + '</span></div>';
  if (d.gauge) html += gaugeSVG(d.gauge.value, d.gauge.label || '');
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
    cards.push(computeSycophancySignal()); // app-side: never-says-no nudge
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

// Lifecycle bar: where you are and the next action - now sourced from the SAME
// declared lifecycle system as the Lifecycle tab (scripts/lifecycle-status.ps1),
// not project-state.json's next_expected_action. That field tracks an older,
// separate governance task track and had gone stale (BUG FOUND by the owner:
// the bar was showing a leftover pre-app-build task while the Lifecycle tab
// correctly showed "Milestone"). Honest: if lifecycle isn't set, say "not set",
// never invent one. "Decision required" still reads task-state's explicit flag
// (a real flag, not a narrative guess) and only shows when actually present.
async function loadLifecycle() {
  const phaseEl = document.getElementById('lc-phase');
  const nextEl = document.getElementById('lc-next');
  try {
    const lc = await window.pcc.lifecycle();
    if (lc && lc.signal === 'ok' && lc.current) {
      phaseEl.textContent = lc.current.label;
      const nexts = (lc.next || []).map((n) => n.label);
      nextEl.textContent = nexts.length ? nexts.join(' or ') : 'not set';
      nextEl.title = (lc.next || []).map((n) => n.label + ': ' + n.what_to_do).join('\n') || 'Open the Lifecycle tab for detail.';
    } else {
      phaseEl.textContent = 'unknown';
      nextEl.textContent = 'not set';
    }
  } catch (e) {
    phaseEl.textContent = 'unknown';
    nextEl.textContent = 'not set';
  }
  try {
    const s = await window.pcc.getState();
    const t = s.task || {};
    const dec = t.owner_decision_request;
    const q = dec && (dec.question || (typeof dec === 'string' ? dec : ''));
    const el = document.getElementById('lc-decision');
    if (q) { el.style.display = 'inline'; el.textContent = 'Decision required: ' + q; }
    else { el.style.display = 'none'; }
  } catch (e) { /* decision flag is optional */ }
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
  loadMetrics();
}

// Babysitting-reduction metrics (roadmap #19): repo-side proxies from the script
// combined with this chat's own proxies. Honest - labeled proxies, not a score.
async function loadMetrics() {
  const el = document.getElementById('metrics-body');
  if (!el) return;
  let m = null;
  try { m = await window.pcc.metrics(); } catch (e) { /* leave null */ }

  // Chat-side proxies from history.
  const userMsgs = history.filter((x) => x.cls === 'user');
  const correctionSet = new Set(CORRECTIONS.map((c) => c.msg));
  const corrections = userMsgs.filter((x) => correctionSet.has((x.text || '').trim())).length;
  const norm = (t) => (t || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const counts = {};
  userMsgs.forEach((x) => { const k = norm(x.text); if (k) counts[k] = (counts[k] || 0) + 1; });
  const repeats = Object.values(counts).filter((n) => n >= 2).length;

  const rows = [];
  if (m) {
    rows.push(['Automated watch-jobs now run for you', m.watchers + '  (' + m.detector_scripts + ' scripts + ' + m.in_app_watchers + ' in-app)']);
    rows.push(['Snapshots (commits) so nothing is lost', m.commits_total + ' total · ' + m.commits_this_branch + ' on this branch']);
    rows.push(['Days active (first→last commit)', String(m.days_active)]);
  }
  rows.push(['This chat: your messages', String(userMsgs.length)]);
  rows.push(['This chat: correction-clicks needed', String(corrections)]);
  rows.push(['This chat: messages you repeated', String(repeats)]);

  el.innerHTML = '<table class="state">'
    + rows.map((r) => '<tr><th>' + escapeHtml(r[0]) + '</th><td>' + escapeHtml(r[1]) + '</td></tr>').join('')
    + '</table>'
    + '<p class="muted" style="margin-top:8px;">' + escapeHtml((m && m.note) || 'Observable proxies only — not proof babysitting dropped.') + '</p>';
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
document.getElementById('lifecycle').addEventListener('click', () => document.querySelector('.nav[data-view="lifecycle"]').click());

renderCorrections();
initModels();
initHeader();
loadLifecycle();
loadTrust();
loadChats();
