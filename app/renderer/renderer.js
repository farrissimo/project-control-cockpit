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
// Chat history is namespaced per ACTIVE project so switching projects never
// bleeds one project's chats into another. activeProjectPath is set at boot from
// the main process (the active project in the registry).
const LEGACY_CHATS_KEY = 'pcc.chats.v2';        // pre-multi-project global key (migrated once)
const LEGACY_ACTIVE_KEY = 'pcc.activeChat.v2';
const OLD_HISTORY_KEY = 'pcc.chat.history';
let activeProjectPath = null;
function chatsKey() { return LEGACY_CHATS_KEY + '::' + (activeProjectPath || 'home'); }
function activeChatKey() { return LEGACY_ACTIVE_KEY + '::' + (activeProjectPath || 'home'); }
let chats = [];
let activeId = null;
let history = [];
let busy = false;

function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
function activeChat() { return chats.find((c) => c.id === activeId) || null; }
function newChatObj() { return { id: uuid(), name: 'New chat', started: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; }
function persistChats() { localStorage.setItem(chatsKey(), JSON.stringify(chats)); localStorage.setItem(activeChatKey(), activeId || ''); }

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

// In-app replacement for window.prompt(). Electron does NOT support prompt() —
// it throws "prompt() is not supported.", which silently killed the New-project
// and rename buttons (found by the E2E test suite). Returns a Promise resolving
// to the entered string, or null if cancelled. Enter = OK, Escape/backdrop = Cancel.
function pccPrompt(message, defaultValue) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pcc-modal-overlay';
    overlay.setAttribute('data-testid', 'prompt-overlay');
    const modal = document.createElement('div');
    modal.className = 'pcc-modal';
    const msg = document.createElement('div');
    msg.className = 'pcc-modal-msg';
    msg.textContent = message || '';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = defaultValue != null ? String(defaultValue) : '';
    inp.setAttribute('data-testid', 'prompt-input');
    const actions = document.createElement('div');
    actions.className = 'pcc-modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Cancel';
    cancel.setAttribute('data-testid', 'prompt-cancel');
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'primary'; ok.textContent = 'OK';
    ok.setAttribute('data-testid', 'prompt-ok');
    actions.appendChild(cancel); actions.appendChild(ok);
    modal.appendChild(msg); modal.appendChild(inp); modal.appendChild(actions);
    overlay.appendChild(modal);
    let done = false;
    const close = (val) => { if (done) return; done = true; overlay.remove(); resolve(val); };
    ok.addEventListener('click', () => close(inp.value));
    cancel.addEventListener('click', () => close(null));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(inp.value); }
      else if (e.key === 'Escape') { e.preventDefault(); close(null); }
    });
    document.body.appendChild(overlay);
    inp.focus(); inp.select();
  });
}

// Approve/Cancel modal (execution authority, DECISION-112). Resolves true ONLY if the
// owner clicks Approve. Used to gate build-mode jobs like New Project.
function pccConfirm(message, approveLabel) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'pcc-modal-overlay';
    overlay.setAttribute('data-testid', 'confirm-overlay');
    const modal = document.createElement('div');
    modal.className = 'pcc-modal';
    const msg = document.createElement('div');
    msg.className = 'pcc-modal-msg';
    msg.textContent = message || '';
    const actions = document.createElement('div');
    actions.className = 'pcc-modal-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.textContent = 'Cancel';
    cancel.setAttribute('data-testid', 'confirm-cancel');
    const ok = document.createElement('button');
    ok.type = 'button'; ok.className = 'primary'; ok.textContent = approveLabel || 'Approve';
    ok.setAttribute('data-testid', 'confirm-approve');
    actions.appendChild(cancel); actions.appendChild(ok);
    modal.appendChild(msg); modal.appendChild(actions);
    overlay.appendChild(modal);
    let done = false;
    const close = (val) => { if (done) return; done = true; overlay.remove(); resolve(val); };
    ok.addEventListener('click', () => close(true));
    cancel.addEventListener('click', () => close(false));
    overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(false); });
    document.body.appendChild(overlay);
    ok.focus();
  });
}

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
    // The claude session id is chat.sessionId when set (after a recovery re-mint),
    // else the chat id — so a stale-locked session can be replaced without losing
    // the chat's visible history (soak fix F4).
    const res = await window.pcc.send(msg, getSelectedModel(), chat.sessionId || chat.id, !chat.started);
    thinking.remove();
    if (res.ok) { chat.started = true; save(); }
    addBubble(res.ok ? 'assistant' : 'assistant error', res.text || '(no output)', true);
    // Soak fix F4: a stale worker is holding this chat's session — give the owner a
    // one-click way out instead of a dead-end red error.
    if (!res.ok && res.sessionInUse) addRecoveryAction();
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
// Soak fix F4: recovery affordances shown under a "session locked" error. Killing the
// worker doesn't free claude's session lock (a force-kill can't clean it up), so the
// real fix is to give THIS chat a fresh worker session id — keeping its visible history
// — or start a brand-new chat. Either escapes the stale lock.
function recoverThisChat() {
  const chat = activeChat();
  if (!chat) return;
  chat.sessionId = uuid(); // fresh claude session, decoupled from the chat's identity
  chat.started = false;    // next send opens the new session cleanly
  save();
  addBubble('assistant', 'Fresh worker session started for this chat — your history is kept. Send your message again.', true);
}
function addRecoveryAction() {
  const div = document.createElement('div');
  div.className = 'bubble assistant recovery';
  const b1 = document.createElement('button');
  b1.className = 'corr';
  b1.textContent = 'Recover this chat';
  b1.title = 'Give this chat a fresh worker session (keeps your history)';
  b1.addEventListener('click', () => recoverThisChat());
  const b2 = document.createElement('button');
  b2.className = 'corr';
  b2.textContent = 'Start a fresh chat';
  b2.addEventListener('click', () => startNewChat());
  div.appendChild(b1);
  div.appendChild(b2);
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

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
document.getElementById('new-project').addEventListener('click', async () => {
  if (busy) return;
  const name = await pccPrompt('What would you like to call the new project?');
  if (!name || !name.trim()) return;
  const nm = name.trim();
  // Execution authority (DECISION-112): New Project needs the build profile, so it is
  // gated behind an EXPLICIT approval. requestJob -> approval_needed (nothing runs);
  // the owner Approves or Cancels; only Approve enters authorized_running, bound to a
  // dedicated chat id. Pasted chat text can never reach this path.
  const req = await window.pcc.requestJob('new_project', nm);
  if (!req || !req.ok) return;
  loadTrust(); // badge -> "Approval needed"
  const approved = await pccConfirm(
    'Start a new project "' + nm + '"?\n\nPCC will interview you, then create a new project folder by running its setup scripts. This runs commands on your computer for THIS build session only, and returns to read-only when it ends.',
    'Approve & start');
  if (!approved) { await window.pcc.cancelJob(); loadTrust(); return; }
  const appr = await window.pcc.approveJob();
  if (!appr || !appr.ok) { await window.pcc.cancelJob(); loadTrust(); return; }
  loadTrust(); // badge -> "Authorized work running"
  document.querySelector('.nav[data-view="chat"]').click();
  startNewChat();
  const c = activeChat();
  // Pin this chat to the approved job's id so its sends get the build profile (askClaude
  // only grants build when chatId === the approved job's chatId).
  // Mark this as a build chat + remember the job name, so if it later falls back to
  // read-only (app restart / session expiry) the owner gets a one-click "Resume build
  // session" instead of a permanently stranded, un-writable New Project chat.
  if (c) { c.name = 'New project: ' + nm.slice(0, 30); c.sessionId = appr.chatId; c.buildChat = true; c.buildName = nm; persistChats(); renderChatList(); }
  const kickoff = 'I want to start a NEW project called "' + nm + '". '
    + 'Run `scripts/new-project-intake.ps1` to load the intake protocol, then interview me in plain language following it, one or two questions at a time. '
    + 'Do not skip the approval gates. When I approve the blueprint, scaffold the project into a new folder next to this one using `scripts/bootstrap-project.ps1` with the blueprint, and tell me how to open it. Ask me the first question now.';
  sendMessage(kickoff);
});

// End an approved build session on demand -> authority returns to read_only.
{
  const authorityEndBtn = document.getElementById('authority-end');
  if (authorityEndBtn) authorityEndBtn.addEventListener('click', async () => { await window.pcc.endJob(); loadTrust(); });
}

// Is the active chat a New Project build chat? (flagged at creation, or by its name for
// chats created before the flag existed). Used to offer "Resume build session".
function activeIsBuildChat() {
  const c = activeChat();
  return !!(c && (c.buildChat || /^New project:/.test(c.name || '')));
}

// Resume build for the active New Project chat. Build authority lives only in the running
// app's memory, so an app restart or session expiry drops the chat back to read-only with
// no way to keep building. This re-approves build BOUND TO THIS SAME CHAT — still behind an
// explicit owner confirm (never self-authorizing, never pasted-text driven), still one chat,
// still expiring. On approval the chat's send id is re-pinned to the approved id so its next
// send gets the build profile.
async function resumeBuildForActiveChat() {
  if (busy) return;
  const c = activeChat();
  if (!c || !activeIsBuildChat()) return;
  const chatId = c.sessionId || c.id;
  const name = c.buildName || (c.name || '').replace(/^New project:\s*/, '') || 'this project';
  const req = await window.pcc.requestJob('new_project', name, chatId);
  if (!req || !req.ok) return;
  loadTrust();
  const ok = await pccConfirm(
    'Resume the build session for "' + name + '"?\n\nThis lets THIS chat run commands and write files again for a bounded build session, then returns to read-only when it ends.',
    'Resume build');
  if (!ok) { await window.pcc.cancelJob(); loadTrust(); return; }
  const appr = await window.pcc.approveJob();
  if (!appr || !appr.ok) { await window.pcc.cancelJob(); loadTrust(); return; }
  c.sessionId = appr.chatId; c.buildChat = true; c.buildName = name; persistChats();
  loadTrust();
  addBubble('assistant', 'Build session resumed for this chat — you can continue building. Send your next message.', true);
}
{
  const authorityResumeBtn = document.getElementById('authority-resume');
  if (authorityResumeBtn) authorityResumeBtn.addEventListener('click', resumeBuildForActiveChat);
}

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
  correctionsBar.appendChild(makeSecondOpinionButton());
}

// ---- second opinion (Claude<->Codex cross-check) ----
// Has Codex (a DIFFERENT model) independently review Claude's latest answer. Codex
// self-declares AGREE / PARTIALLY AGREE / DISAGREE — we never fake an agreement
// verdict by comparing two free-text answers; the second model states its own stance.
function makeSecondOpinionButton() {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'corr';
  b.textContent = 'Second opinion';
  b.title = "Have Codex (a different model) independently review Claude's latest answer — a real cross-check, not self-agreement.";
  b.addEventListener('click', async () => {
    if (busy) return;
    const assistants = history.filter((m) => m.cls === 'assistant');
    const lastA = assistants.length ? assistants[assistants.length - 1] : null;
    if (!lastA || !(lastA.text || '').trim()) { addBubble('assistant error', 'No answer to review yet — ask something first.', true); return; }
    const idx = history.lastIndexOf(lastA);
    let question = '';
    for (let i = idx - 1; i >= 0; i--) { if (history[i].cls === 'user') { question = history[i].text; break; } }
    const answer = (lastA.text || '').slice(0, 6000);
    const prompt = "You are Codex, giving an INDEPENDENT second opinion on another assistant (Claude)'s answer. Be willing to disagree; do not just agree.\n"
      + 'Begin your reply with EXACTLY one of: AGREE / PARTIALLY AGREE / DISAGREE.\n'
      + 'Then give: your reasoning, any risk/downside or error Claude missed, and whether this warrants closer scrutiny.\n\n'
      + '=== QUESTION ===\n' + (question || '(not captured)') + "\n\n=== CLAUDE'S ANSWER ===\n" + answer;
    busy = true; sendBtn.disabled = true;
    const thinking = addBubble('assistant thinking', 'Codex is reviewing…', false);
    try {
      const res = await window.pcc.secondOpinion(prompt);
      thinking.remove();
      addBubble(res.ok ? 'assistant codex' : 'assistant error', (res.ok ? 'Codex second opinion:\n\n' : '') + (res.text || '(no output)'), true);
    } catch (e) {
      thinking.remove();
      addBubble('assistant error', 'Second opinion failed: ' + e.message, true);
    } finally {
      busy = false; sendBtn.disabled = false;
    }
  });
  return b;
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
  try { chats = JSON.parse(localStorage.getItem(chatsKey())) || []; } catch (e) { chats = []; }
  if (!Array.isArray(chats)) chats = [];
  // One-time migration: adopt the pre-multi-project GLOBAL chats into this
  // (home) project's namespace, then drop the global key.
  if (chats.length === 0) {
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_CHATS_KEY)) || []; } catch (e) { legacy = []; }
    if (Array.isArray(legacy) && legacy.length) {
      chats = legacy;
      localStorage.removeItem(LEGACY_CHATS_KEY);
      localStorage.removeItem(LEGACY_ACTIVE_KEY);
    }
  }
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
  const savedActive = localStorage.getItem(activeChatKey());
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

async function renameChat(id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  const name = await pccPrompt('Rename this chat:', c.name);
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
  el.innerHTML = '<span class="spinner"></span>Running the health check (git + doctor.ps1) — this can take ~15 seconds…';
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
const SIGNAL_TITLES = { 'untracked-files': 'Untracked files', 'scope-drift': 'Out-of-scope / drift', 'stale-docs': 'Stale docs', 'repo-sync': 'Work backed up? (repo sync)', 'bloat': 'Project bloat', 'high-stakes': 'High-stakes change — second opinion?', 'sycophancy': 'Never says no?', 'chat-rollover': 'Chat health / rollover' };

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
  status.innerHTML = '<span class="spinner"></span>Checking…';
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
  map.innerHTML = ''; detail.innerHTML = '<p class="muted"><span class="spinner"></span>Loading the stage map…</p>';
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
  html += '<div class="lc-next"><h3>Advance to the next stage</h3>';
  (r.next || []).forEach((n) => {
    html += '<div class="lc-next-item"><div class="lbl">→ ' + escapeHtml(n.label) + '</div><div class="do">' + escapeHtml(n.what_to_do) + '</div>'
      + '<button class="lc-advance" data-to="' + escapeHtml(n.id) + '">Advance to ' + escapeHtml(n.label) + '</button></div>';
  });
  html += '</div><div id="lc-advance-status" class="lc-advance-status"></div>';
  detail.innerHTML = html;
  detail.querySelectorAll('.lc-advance').forEach((b) => b.addEventListener('click', () => advanceStage(b.dataset.to)));
}

// Advance the pin. The main process enforces legal transitions + the PASS gate;
// the renderer just reacts honestly. If the gate blocks (needs_verification), it
// offers a one-click "Verify now & advance" that runs the real verifier, records
// the verdict, and only advances on a fresh PASS — the auto-verify + gating loop.
async function advanceStage(toId) {
  const status = document.getElementById('lc-advance-status');
  if (!status) return;
  status.className = 'lc-advance-status'; status.textContent = 'Advancing…';
  let r;
  try { r = await window.pcc.lifecycleAdvance(toId); } catch (e) { status.className = 'lc-advance-status bad'; status.textContent = 'Advance failed: ' + e.message; return; }
  if (r.ok) {
    // Advanced. Surface a soft "vision unconfirmed" advisory if the move raised one
    // (soak fix F2) — non-blocking, but the owner is told rather than silently skipped.
    if (r.warning) { status.className = 'lc-advance-status warn'; status.textContent = (r.message || 'Advanced.') + ' ' + r.warning; }
    else { status.className = 'lc-advance-status good'; status.textContent = r.message || 'Advanced.'; }
    loadLifecycleView(); loadLifecycle(); return;
  }
  // Owner policy (DECISION): an executable phase needs EXECUTION proof, not a review-only
  // pass. Offer the honest routes: run the product's checks, or — if this is genuinely a
  // review/docs/planning phase — declare it and retry.
  if (r.reason === 'needs_execution_proof') {
    status.className = 'lc-advance-status warn';
    status.textContent = (r.message || 'This phase changes behavior — it needs execution proof, not just a review.') + ' ';
    const goVerify = document.createElement('button');
    goVerify.className = 'lc-advance';
    goVerify.textContent = 'Open Verify → run the product';
    goVerify.addEventListener('click', () => { const n = document.querySelector('.nav[data-view="verify"]'); if (n) n.click(); });
    const markReview = document.createElement('button');
    markReview.className = 'lc-advance';
    markReview.style.marginLeft = '8px';
    markReview.textContent = 'This is a review/docs phase → mark & retry';
    markReview.addEventListener('click', async () => {
      const res = await window.pcc.setPhaseKind('review');
      if (res && res.ok) advanceStage(toId);
      else { status.textContent = (res && res.message) || 'Could not mark the phase.'; }
    });
    status.appendChild(goVerify);
    status.appendChild(markReview);
    return;
  }
  if (r.reason === 'needs_verification') {
    status.className = 'lc-advance-status warn';
    status.textContent = (r.message || 'A fresh independent PASS is required first.') + ' ';
    const btn = document.createElement('button');
    btn.className = 'lc-advance';
    btn.textContent = 'Verify now & advance';
    btn.addEventListener('click', () => verifyThenAdvance(toId));
    status.appendChild(btn);
    return;
  }
  status.className = 'lc-advance-status bad';
  status.textContent = r.message || ('Could not advance (' + (r.reason || 'error') + ').');
}

async function verifyThenAdvance(toId) {
  const status = document.getElementById('lc-advance-status');
  status.className = 'lc-advance-status'; status.textContent = 'Running independent verification (records the verdict; can take a minute)…';
  let v;
  try { v = await window.pcc.verify(true); } catch (e) { status.className = 'lc-advance-status bad'; status.textContent = 'Verification failed: ' + e.message; return; }
  const parsedVerdict = PCCVerification.parseVerification((v && v.text) || '').verdict;
  loadTrust();
  if (parsedVerdict !== 'PASS') {
    status.className = 'lc-advance-status bad';
    status.textContent = 'Verifier verdict: ' + (parsedVerdict || 'unclear') + '. Not advancing — see the Verify tab.';
    return;
  }
  status.textContent = 'Independent PASS recorded — advancing…';
  const r = await window.pcc.lifecycleAdvance(toId);
  if (r.ok) { status.className = 'lc-advance-status good'; status.textContent = r.message || 'Advanced.'; loadLifecycleView(); loadLifecycle(); }
  else { status.className = 'lc-advance-status bad'; status.textContent = r.message || 'Still could not advance.'; }
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

// Authority badge (DECISION-112): show the main-process authority state in the chat
// header. Read-only source of truth — the renderer only displays it, never sets it.
// For this slice it is always read_only; falls back to the safe read_only label if the
// state can't be read.
async function loadAuthorityBadge() {
  const clsFor = { read_only: 'readonly', approval_needed: 'warn', authorized_running: 'warn', completed_needs_review: 'good', blocked: 'bad' };
  let s = null;
  try { s = await window.pcc.authorityState(); } catch (e) { /* keep the safe default */ }
  const mode = (s && s.mode) || 'read_only';
  let label = (s && s.label) || 'Read-only — safe to paste context';
  if (mode === 'authorized_running' && s && s.job && s.job.name) label += ' — ' + s.job.name;
  setChip('trust-authority', clsFor[mode] || 'readonly', label,
    'PCC chat authority. Read-only means it can read, explain, and plan — it cannot run commands, change files, or launch anything. Reading context is never authorization to act.');
  const endBtn = document.getElementById('authority-end');
  if (endBtn) endBtn.classList.toggle('hidden', mode !== 'authorized_running');
  // Offer "Resume build session" when the active chat is a New Project build chat but the
  // app is NOT currently in an authorized build (dropped to read-only after a restart or
  // expiry). This is the escape hatch from a stranded, un-writable New Project chat.
  const resumeBtn = document.getElementById('authority-resume');
  if (resumeBtn) resumeBtn.classList.toggle('hidden', !(activeIsBuildChat() && mode !== 'authorized_running'));
}

async function loadTrust() {
  loadAuthorityBadge();
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

  // Verified: honest freshness against HEAD AND honest about the KIND of proof
  // (DECISION-105 proof taxonomy). A code review that ran nothing must never wear
  // the same green as a real execution — otherwise PCC recreates fake-green with
  // nicer wording. Executed proof (ci_execution / live_boundary / local_execution)
  // earns green; a fresh review_only PASS is amber "Reviewed, not run". Uses the ONE
  // shared isExecutedType so this can never diverge from the Overview again.
  const v = x && x.verification;
  const executed = v && PCCVerification.isExecutedType(v.type);
  if (!x) {
    setChip('trust-verified', 'unknown', 'Verified', 'Could not read verification status.');
  } else if (!v || !v.present) {
    setChip('trust-verified', 'warn', 'Not verified yet', 'No independent verification recorded for the current work yet.');
  } else if (v.verdict === 'PASS' && v.mtimeEpoch >= (x.headCommitEpoch || 0) && executed) {
    // local_execution is real execution but on THIS machine — label it honestly, never
    // as a clean-room CI run.
    const local = v.type === 'local_execution';
    setChip('trust-verified', 'good', local ? 'Verified (ran locally)' : 'Verified (executed)',
      local ? 'The product’s own checks ran and passed on THIS machine (local execution) — real execution, but not a clean-room CI run.'
        : 'Independent PASS that actually ran the code (' + v.type + '), newer than the latest commit.');
  } else if (v.verdict === 'PASS' && v.mtimeEpoch >= (x.headCommitEpoch || 0)) {
    setChip('trust-verified', 'warn', 'Reviewed, not run', 'A reviewer read the code and found no problems, but nothing was executed — that is not proof it runs. Execution proof comes from CI/tests.');
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

  renderChatHealth(d); // keep the chat-screen health strip in sync (reuses `d`)
}

// Project-health strip on the chat screen (roadmap #23). Surfaces the same
// signals as the Signals tab — including the chat-length gauge — at a glance,
// where the owner actually spends time. Each tile is a shortcut into the full
// Signals tab. Reuses the detections result `d` that loadTrust already fetched
// (no extra IPC), plus the two app-side signals. Honest: status is shown as a
// word and a colored dot, never color alone.
const CH_LABELS = { 'untracked-files': 'Untracked', 'scope-drift': 'Drift', 'stale-docs': 'Stale docs',
  'repo-sync': 'Backed up', 'bloat': 'Bloat', 'high-stakes': 'High-stakes', 'sycophancy': 'Never says no?', 'chat-rollover': 'Chat length' };
function renderChatHealth(d) {
  const el = document.getElementById('chat-health');
  if (!el) return;
  const signals = Object.values(d || {});
  try { signals.push(computeSycophancySignal()); } catch (e) { /* app-side, optional */ }
  try { signals.push(computeChatSignal()); } catch (e) { /* app-side, optional */ }
  if (!signals.length) { el.innerHTML = ''; return; }

  const openSignals = () => { const n = document.querySelector('.nav[data-view="signals"]'); if (n) n.click(); };

  // The one gauge we have today (chat length) gets its own prominent box.
  let gaugeHtml = '';
  const withGauge = signals.find((s) => s && s.gauge);
  if (withGauge) gaugeHtml = '<div class="ch-gauge" title="Click for detail in the Signals tab.">'
    + gaugeSVG(withGauge.gauge.value, withGauge.gauge.label || '') + '</div>';

  const tiles = signals.map((s) => {
    const sig = (s && s.signal) || 'unknown';
    const cls = (sig === 'clear' || sig === 'notice') ? sig : 'unknown';
    const label = CH_LABELS[s && s.detector] || (s && s.detector) || 'Signal';
    return '<span class="ch-tile ' + cls + '" data-open="1">'
      + '<span class="ch-dot"></span>' + escapeHtml(label)
      + '<span class="ch-status">' + escapeHtml(sig) + '</span></span>';
  }).join('');

  el.innerHTML = gaugeHtml + '<div class="ch-tiles">' + tiles + '</div>';
  el.querySelectorAll('[data-open], .ch-gauge').forEach((t) => t.addEventListener('click', openSignals));
}

// ---- project view ----
function row(label, value) {
  const shown = (value !== undefined && value !== null && String(value).trim())
    ? escapeHtml(String(value)) : '<span class="muted">—</span>';
  return '<tr><th>' + label + '</th><td>' + shown + '</td></tr>';
}

async function initHeader() {
  // The active project's name is shown by the project switcher (loadProjectSwitcher);
  // fall back to project-state here only if the switcher name is still a placeholder.
  try {
    const s = await window.pcc.getState();
    const p = s.project || {};
    const el = document.getElementById('proj-name');
    if (el && p.project_name && (!el.textContent || el.textContent === '…')) el.textContent = p.project_name;
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

// Project "at a glance" dashboard (roadmap #23): the visual hero of the Project
// page. Real data only — lifecycle position, live signals (+ chat gauge), and
// metrics. Consolidated health takes the highest-attention color (any red > any
// amber > green), shown as a word + color, never color alone.
async function loadProjectGlance() {
  const el = document.getElementById('project-glance');
  if (!el) return;
  let det = null, m = null;
  try { det = await window.pcc.detections(); } catch (e) { /* optional */ }
  try { m = await window.pcc.metrics(); } catch (e) { /* optional */ }

  let html = '';

  // (The lifecycle stepper moved to the Owner Overview's Journey strip — DECISION-107
  //  — so there's a single "where are we" source. This hero is now evidence: the
  //  signal health tiles + metrics, under the "evidence" fold.)

  // 2. Signals health (+ chat gauge). Reuses the same signal objects the Signals
  //    tab renders, plus the two app-side ones.
  const signals = Object.values(det || {});
  try { signals.push(computeSycophancySignal()); } catch (e) { /* optional */ }
  const chatSig = (() => { try { return computeChatSignal(); } catch (e) { return null; } })();
  if (chatSig) signals.push(chatSig);
  if (signals.length) {
    const nClear = signals.filter((s) => s && s.signal === 'clear').length;
    const nNotice = signals.filter((s) => s && s.signal === 'notice').length;
    const nUnknown = signals.filter((s) => s && s.signal === 'unknown').length;
    const headCls = nUnknown ? 'unknown' : (nNotice ? 'notice' : 'clear');
    const headTxt = nUnknown ? (nUnknown + ' need a look') : (nNotice ? (nNotice + ' to review · ' + nClear + ' clear') : (nClear + ' all clear'));
    const tiles = signals.map((s) => {
      const sig = (s && s.signal) || 'unknown';
      const cls = (sig === 'clear' || sig === 'notice') ? sig : 'unknown';
      const label = CH_LABELS[s && s.detector] || (s && s.detector) || 'Signal';
      return '<span class="ch-tile ' + cls + '"><span class="ch-dot"></span>' + escapeHtml(label)
        + '<span class="ch-status">' + escapeHtml(sig) + '</span></span>';
    }).join('');
    const gaugeHtml = (chatSig && chatSig.gauge) ? gaugeSVG(chatSig.gauge.value, chatSig.gauge.label) : '';
    html += '<div class="glance-card"><div class="glance-title">Health</div>'
      + '<div class="glance-headline ' + headCls + '">' + escapeHtml(headTxt) + '</div>'
      + '<div class="glance-flex">' + gaugeHtml + '<div class="glance-health">' + tiles + '</div></div></div>';
  }

  // 3. Metrics as stat cards.
  if (m) {
    html += '<div class="pg-stats">'
      + '<div class="pg-stat"><div class="pg-num">' + (m.watchers != null ? m.watchers : '—') + '</div><div class="pg-cap">watch-jobs automated for you</div></div>'
      + '<div class="pg-stat"><div class="pg-num">' + (m.commits_total != null ? m.commits_total : '—') + '</div><div class="pg-cap">commits (snapshots)</div></div>'
      + '<div class="pg-stat"><div class="pg-num">' + (m.days_active != null ? m.days_active : '—') + '</div><div class="pg-cap">days active</div></div>'
      + '</div>';
  }

  el.innerHTML = html || '<p class="muted">No project data yet.</p>';
}

// Owner/Visionary Overview (DECISION-107): the meaning layer. Deterministic
// translation of EXISTING truth (lifecycle, detections, verification taxonomy,
// sync) into owner-facing answers: condition, needs-owner, next best move, journey
// (rendered from the REAL lifecycle — never a second model), vision promises
// (declared self-assessment, kept visually distinct from proof), and an honest
// proof card. Zero LLM; every value is fact-derived. Guardrails per the spec:
//  - "owner decision needed" is NOT a driver yet: no live source outside the
//    retired task-state.json (DECISION-104). We never read stale task-state here.
//  - Next Best Move and the Journey strip defer to the lifecycle, so there is no
//    second source of truth for "where are we / what's next".
async function loadOwnerOverview() {
  const el = document.getElementById('owner-overview');
  if (!el) return;
  el.innerHTML = '<p class="muted"><span class="spinner"></span>Reading the project…</p>';
  // Fetch every fact in parallel — detections alone spawns several PowerShell
  // detectors, so sequential awaits would leave the overview on "Loading…" for
  // seconds. Each failure degrades to null (computeOverview handles nulls).
  const [lc, det, x, sync, state, vp] = await Promise.all([
    window.pcc.lifecycle().catch(() => null),
    window.pcc.detections().catch(() => null),
    window.pcc.trustExtras().catch(() => null),
    window.pcc.syncStatus().catch(() => null),
    window.pcc.getState().catch(() => null),
    window.pcc.visionPromises().catch(() => null),
  ]);
  const data = { lc, det, x, sync, state, vp };

  let m;
  try { m = PCCOverview.computeOverview(data); }
  catch (e) { el.innerHTML = '<p class="muted">Could not build the overview.</p>'; return; }

  const journeyHtml = m.journey.length
    ? m.journey.map((s) => '<span class="ov-step ' + s.cls + '">' + escapeHtml(s.label) + '</span>').join('<span style="color:var(--muted)">›</span>')
    : '<span class="ov-step">lifecycle not set</span>';

  let reviewBanner = '', promisesHtml, promisesFoot = '';
  if (m.vision.status === 'missing') {
    promisesHtml = '<p class="ov-declared-hint">No vision promises set for this project yet. Add .cockpit/state/vision-promises.json (owner-approved intent) so “is it still the thing I meant to build?” can be answered here.</p>';
  } else {
    if (m.vision.needsReview) reviewBanner = '<div class="ov-review-banner">These vision promises need your review — they haven’t been confirmed as this project’s real intent yet.</div>';
    promisesHtml = '<div class="ov-promises">' + m.vision.cards.map((c) => {
      const note = (c.notProven ? '<div class="ov-promise-note"><b>Not proven:</b> ' + escapeHtml(c.notProven) + '</div>' : '')
        + (c.evidence ? '<div class="ov-promise-note">' + escapeHtml(c.evidence) + '</div>' : '');
      return '<div class="ov-promise"><div class="ov-promise-label">' + escapeHtml(c.label) + '</div>'
        + '<span class="ov-declared ' + c.statusCls + '">declared: ' + escapeHtml(c.status.replace(/_/g, ' ')) + '</span>' + note + '</div>';
    }).join('') + '</div>';
    promisesFoot = '<p class="ov-declared-hint">Declared = the owner’s self-assessment, not machine proof (see the Proof card). '
      + (m.vision.lastReviewed ? 'Owner-reviewed ' + escapeHtml(m.vision.lastReviewed) + '.' : 'Not yet owner-reviewed.') + '</p>';
  }

  el.innerHTML =
    '<div class="ov-status ' + m.cond.cls + '">'
    + '<div class="ov-proj">' + escapeHtml(m.projName) + '</div>'
    + '<div class="ov-condition">' + escapeHtml(m.cond.label) + '</div>'
    + '<div class="ov-why">' + escapeHtml(m.cond.why) + '</div>'
    + '<div class="ov-safe">Safe to continue: <b>' + escapeHtml(m.cond.safe) + '</b></div>'
    + '</div>'
    + '<div class="ov-grid">'
    + '<div class="ov-card' + (m.needs.attn ? ' attention' : '') + '"><div class="ov-card-title">Needs you</div>'
    + '<div class="ov-card-main">' + escapeHtml(m.needs.main) + '</div>'
    + (m.needs.sub ? '<div class="ov-card-sub">' + escapeHtml(m.needs.sub) + '</div>' : '') + '</div>'
    + '<div class="ov-card"><div class="ov-card-title">Next best move</div>'
    + '<div class="ov-card-main">' + escapeHtml(m.move.main) + '</div>'
    + (m.move.sub ? '<div class="ov-card-sub">' + escapeHtml(m.move.sub) + '</div>' : '') + '</div>'
    + '</div>'
    + '<div class="ov-section-title">Project journey</div><div class="ov-journey">' + journeyHtml + '</div>'
    + '<div class="ov-section-title">Vision alignment</div>' + reviewBanner + promisesHtml + promisesFoot
    + '<div class="ov-card"><div class="ov-card-title">Proof</div>'
    + '<div class="ov-card-sub">Independent review: <b style="color:var(--text)">' + escapeHtml(m.proof.review) + '</b></div>'
    + '<div class="ov-card-sub">Executed proof in app: <b style="color:var(--text)">' + escapeHtml(m.proof.exec) + '</b></div>'
    + '<div class="ov-card-sub">CI: runs on GitHub every push; live CI status is not yet wired into PCC.</div>'
    + '<div class="ov-card-sub">Real Claude/Codex boundary behavior: not proven yet.</div></div>';
}

async function loadProject() {
  const body = document.getElementById('project-body');
  loadOwnerOverview();
  loadProjectGlance();
  try {
    const s = await window.pcc.getState();
    const p = s.project || {};
    if (p._error) { body.innerHTML = '<p class="muted">No project state found yet.</p>'; return; }
    // Details come from LIVE truth — the same lifecycle system the bar/hero use,
    // plus the real verification record — NOT project-state.json/task-state.json.
    // Those are the retired CLI governance track and go stale (owner caught the
    // bar showing a leftover pre-app-build task; that fix missed this table too,
    // so it kept showing the July-5 post-brr/pcc-pathD-009 snapshot). See
    // DECISION-104. Project name is identity, not stale, so it stays from state.
    let lc = null, trust = null;
    try { lc = await window.pcc.lifecycle(); } catch (e) { /* optional */ }
    try { trust = await window.pcc.trustExtras(); } catch (e) { /* optional */ }

    const phase = (lc && lc.signal === 'ok' && lc.current) ? lc.current.label : 'not set';
    const task = (lc && lc.active_task) ? lc.active_task : '—';
    const nexts = (lc && Array.isArray(lc.next)) ? (lc.next.map((n) => n.label).join(' or ') || 'not set') : 'not set';

    // Verified: mirror the trust strip exactly — a PASS only counts as current if
    // the verification file is newer than HEAD; otherwise the code moved past it.
    let verified = '—';
    if (trust && trust.verification && trust.verification.present) {
      const v = trust.verification;
      if (v.verdict === 'PASS') {
        const fresh = v.mtimeEpoch >= (trust.headCommitEpoch || 0); // exact parity with the trust strip (line ~835)
        const executed = v.type === 'ci_execution' || v.type === 'live_boundary'; // proof taxonomy (DECISION-105)
        if (!fresh) verified = 'PASS (stale — code changed since)';
        else if (executed) verified = 'PASS (executed — matches current code)';
        else verified = 'PASS (review only — code read, not run)';
      } else {
        verified = v.verdict || 'unknown';
      }
    }

    body.innerHTML = '<table class="state">'
      + row('Project', (p.project_name || '') + (p.project_id ? '  (' + p.project_id + ')' : ''))
      + row('Phase', phase)
      + row('Current task', task)
      + row('Verified', verified)
      + row('Next action', nexts)
      + '</table>';
  } catch (e) {
    body.innerHTML = '<p class="muted">Could not read project state.</p>';
  }
  loadDecisions();
  loadMetrics();
  loadSync();
}

// ---- back up & sync (in-app git) ----
// One-click backup (commit + push) and get-latest (pull), so the owner never
// drops to a terminal to save or sync work. Honest status + honest failures.
async function loadSync() {
  const statusEl = document.getElementById('sync-status');
  if (!statusEl) return;
  statusEl.className = 'sync-status muted'; statusEl.textContent = 'Checking…';
  let s = null;
  try { s = await window.pcc.syncStatus(); } catch (e) { statusEl.textContent = 'Could not read git status.'; return; }
  let cls = 'good', msg;
  if (s.clean && s.behind === 0) {
    msg = 'On ' + s.branch + ' — everything is backed up' + (s.hasUpstream ? '' : ' (no remote set yet)') + '.';
  } else {
    const parts = [];
    if (s.dirty) parts.push(s.dirty + ' uncommitted change' + (s.dirty > 1 ? 's' : ''));
    if (s.untracked) parts.push(s.untracked + ' new file' + (s.untracked > 1 ? 's' : ''));
    if (s.ahead) parts.push(s.ahead + ' commit' + (s.ahead > 1 ? 's' : '') + ' not pushed');
    if (s.behind) parts.push(s.behind + ' new on the remote');
    msg = 'On ' + s.branch + ' — ' + (parts.join(', ') || 'changes to review') + '.';
    cls = (s.dirty || s.untracked || s.ahead || s.behind) ? 'warn' : 'good';
  }
  statusEl.className = 'sync-status ' + cls;
  statusEl.textContent = msg;
}

function setSyncBusy(b) {
  ['sync-backup', 'sync-pull', 'sync-refresh'].forEach((id) => { const el = document.getElementById(id); if (el) el.disabled = b; });
}

async function doBackup() {
  const result = document.getElementById('sync-result');
  const msgEl = document.getElementById('sync-msg');
  setSyncBusy(true);
  result.className = 'sync-result'; result.textContent = 'Backing up…';
  try {
    const r = await window.pcc.backup(msgEl ? msgEl.value : '');
    result.className = 'sync-result ' + (r.ok ? 'good' : 'bad');
    result.textContent = r.text || (r.ok ? 'Done.' : 'Failed.');
    if (r.ok && msgEl) msgEl.value = '';
  } catch (e) { result.className = 'sync-result bad'; result.textContent = 'Backup failed: ' + e.message; }
  finally { setSyncBusy(false); loadSync(); loadTrust(); }
}

async function doPull() {
  const result = document.getElementById('sync-result');
  setSyncBusy(true);
  result.className = 'sync-result'; result.textContent = 'Getting latest…';
  try {
    const r = await window.pcc.pull();
    result.className = 'sync-result ' + (r.ok ? 'good' : 'bad');
    result.textContent = r.text || (r.ok ? 'Up to date.' : 'Failed.');
  } catch (e) { result.className = 'sync-result bad'; result.textContent = 'Get latest failed: ' + e.message; }
  finally { setSyncBusy(false); loadSync(); loadTrust(); }
}

document.getElementById('sync-backup').addEventListener('click', doBackup);
document.getElementById('sync-pull').addEventListener('click', doPull);
document.getElementById('sync-refresh').addEventListener('click', loadSync);

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

  const nn = (v) => (v == null ? '—' : v);
  const rows = [];
  if (m) {
    rows.push(['Automated watch-jobs now run for you', nn(m.watchers) + '  (' + nn(m.detector_scripts) + ' scripts + ' + nn(m.in_app_watchers) + ' in-app)']);
    rows.push(['Snapshots (commits) so nothing is lost', nn(m.commits_total) + ' total · ' + nn(m.commits_this_branch) + ' on this branch']);
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

// Soak fix F4: "Run the product" launches the declared run command detached — the
// product's own window opens, no terminal. Soak fix F3: "Verify product behavior"
// runs the product's declared checks and records a local_execution proof.
(function wireProductButtons() {
  const runBtn = document.getElementById('run-product');
  const verBtn = document.getElementById('verify-product');
  const status = document.getElementById('product-status');
  const result = document.getElementById('product-result');
  if (runBtn) runBtn.addEventListener('click', async () => {
    runBtn.disabled = true; status.textContent = 'Launching…'; result.style.display = 'none';
    try {
      const r = await window.pcc.runProduct();
      status.textContent = '';
      result.textContent = (r && r.message) ? r.message : (r && r.ok ? 'Launched.' : 'Could not launch.');
      result.style.display = 'block';
    } catch (e) { result.textContent = 'Error: ' + e.message; result.style.display = 'block'; status.textContent = ''; }
    finally { runBtn.disabled = false; }
  });
  if (verBtn) verBtn.addEventListener('click', async () => {
    verBtn.disabled = true; status.textContent = 'Running the product’s checks…'; result.style.display = 'none';
    try {
      const r = await window.pcc.verifyProduct();
      if (r && r.ok) {
        status.textContent = '';
        result.textContent = 'Local execution proof recorded: ' + r.verdict + ' (ran: ' + r.command + ').\n'
          + (r.verdict === 'PASS' ? 'The product’s own checks passed on this machine. This is real execution proof — honestly local, not a clean-room CI run.'
            : 'The product’s checks did NOT pass. Fix the failures before treating this as done.');
        // refresh trust/overview so the new proof shows
        if (typeof loadTrust === 'function') loadTrust();
      } else {
        status.textContent = '';
        result.textContent = (r && r.message) ? r.message : 'Could not run product verification.';
      }
      result.style.display = 'block';
    } catch (e) { result.textContent = 'Error: ' + e.message; result.style.display = 'block'; status.textContent = ''; }
    finally { verBtn.disabled = false; }
  });
})();

// ---- project switcher (multi-project) ----
// The home cockpit points at one active project at a time. This panel lists the
// registered projects, switches the active one (a full reload re-points every
// view + loads that project's own chats), and opens an existing PCC folder.
function closeProjPanel() { const p = document.getElementById('proj-panel'); if (p) p.classList.add('hidden'); }

const engineBadgeLabel = { current: 'current', old: 'upgrade available', unknown: 'engine: unknown', ahead: 'ahead' };

async function loadProjectSwitcher() {
  const nameEl = document.getElementById('proj-name');
  const panel = document.getElementById('proj-panel');
  if (!panel) return;
  let data = null;
  try { data = await window.pcc.listProjects(); } catch (e) { return; }
  const projects = data.projects || [];
  const active = data.active;
  const activeEntry = projects.find((p) => p.path === active) || projects[0];
  if (nameEl && activeEntry) nameEl.textContent = activeEntry.name;
  // Engine-kit status (DECISION-111 slice 2): tell at a glance which projects
  // carry an old engine, so the split-brain never needs manual tracking.
  const engineStatuses = await Promise.all(projects.map((p) =>
    window.pcc.engineStatus(p.path).catch(() => null)));
  panel.innerHTML = projects.map((p, i) => {
    const es = engineStatuses[i];
    const badge = (es && es.ok && engineBadgeLabel[es.status])
      ? '<span class="proj-engine ' + es.status + '" title="' + escapeHtml(es.detail || '') + '">'
        + engineBadgeLabel[es.status] + '</span>' : '';
    return '<div class="proj-row' + (p.path === active ? ' active' : '') + '" data-path="' + encodeURIComponent(p.path) + '">'
      + '<span class="proj-row-name">' + escapeHtml(p.name) + (p.isHome ? '<span class="proj-home">home</span>' : '') + badge + '</span>'
      + '<span class="proj-row-path">' + escapeHtml(p.path) + '</span></div>';
  }).join('') + '<div class="proj-open" data-act="open">＋ Open existing project…</div>';
}

function showProjError(msg) {
  const panel = document.getElementById('proj-panel');
  if (!panel) return;
  const old = panel.querySelector('.proj-status'); if (old) old.remove();
  const el = document.createElement('div'); el.className = 'proj-status'; el.textContent = msg;
  panel.insertBefore(el, panel.firstChild);
}

async function switchProject(pathEnc) {
  const target = decodeURIComponent(pathEnc);
  if (target === activeProjectPath) { closeProjPanel(); return; }
  const r = await window.pcc.setActiveProject(target);
  if (r && r.ok) { location.reload(); }
  else { showProjError((r && r.error) || 'Could not switch project.'); }
}

async function openExistingProject() {
  let pick = null;
  try { pick = await window.pcc.pickFolder(); } catch (e) { return; }
  if (!pick || !pick.path) return;
  const add = await window.pcc.addProject(pick.path);
  if (!add || !add.ok) { showProjError((add && add.error) || 'Could not add project.'); return; }
  const sw = await window.pcc.setActiveProject(pick.path);
  if (sw && sw.ok) location.reload();
  else showProjError((sw && sw.error) || 'Could not switch to the project.');
}

document.getElementById('proj-switch').addEventListener('click', (e) => {
  e.stopPropagation();
  const p = document.getElementById('proj-panel');
  p.classList.toggle('hidden');
  if (!p.classList.contains('hidden')) loadProjectSwitcher();
});
document.getElementById('proj-panel').addEventListener('click', (e) => {
  if (e.target.closest('[data-act="open"]')) { openExistingProject(); return; }
  const row = e.target.closest('.proj-row');
  if (row) switchProject(row.dataset.path);
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('proj-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (e.target.closest('#proj-panel') || e.target.closest('#proj-switch')) return;
  closeProjPanel();
});

// ---- boot ----
document.getElementById('lifecycle').addEventListener('click', () => document.querySelector('.nav[data-view="lifecycle"]').click());

async function boot() {
  // Resolve the active project first so chat history loads from its namespace.
  try { const a = await window.pcc.getActiveProject(); activeProjectPath = a && a.path; } catch (e) { /* default namespace */ }
  renderCorrections();
  initModels();
  loadProjectSwitcher();
  initHeader();
  loadLifecycle();
  loadTrust();
  loadChats();
}
boot();
