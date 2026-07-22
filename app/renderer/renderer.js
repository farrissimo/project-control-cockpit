// PCC Cockpit - renderer. Chat + Project + Rules + Memory views, plus
// one-click corrections. Conversation persists in localStorage; Claude keeps
// its own side via --continue (main.js), so context survives restarts.

const log = document.getElementById('log');
const input = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('send');
const stopBtn = document.getElementById('stop');
const correctionsBar = document.getElementById('corrections');
const recoveryBanner = document.getElementById('chat-recovery');

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
let inFlightChatId = null; // R2: which chat's turn Stop should target — set only while one is actually running
let attachments = []; // composer attachments for the NEXT send: {kind:'image',mediaType,dataBase64,name} | {kind:'text',name,content}
let sendQueue = []; // steering: messages composed while a turn is running, sent in order when it finishes
// Canonical chat store (Phase 2A S5): chats.json (main-owned) is the AUTHORITY.
// localStorage is a disposable cache only. These track the identity + revision the
// renderer must present on every mutation (optimistic concurrency + project binding).
let storeRevision = null;
let storeProjectId = null;
let chatLoadError = null;           // non-null => the canonical store could not be loaded (fail visibly)
let servedGeneration = 'current';   // 'current' | 'prev' — 'prev' means we are showing the last good generation (recovery); mutations are blocked
const namedAtLen = new Map();       // renderer-local: last auto-named message count, by chatId (not persisted)
const sessionIds = new Map();       // renderer-local: re-minted worker session id, by chatId (not persisted)
const turnsStarted = new Set();     // renderer-local: chatIds that have had a worker turn (drives isFirstTurn)

function uuid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'c-' + Date.now() + '-' + Math.random().toString(16).slice(2); }
function activeChat() { return chats.find((c) => c.id === activeId) || null; }
function newChatObj() { return { id: uuid(), name: 'New chat', started: false, messages: [], createdAt: Date.now(), updatedAt: Date.now() }; }
// localStorage is now a DISPOSABLE CACHE, never authority — the canonical
// main-owned store (chats.json) is the source of truth. We mirror the last read
// here only so a redraw is instant; boot captures the untouched legacy snapshot
// ONCE (to seed the store) and after that we never read localStorage as authority.
function cacheChats() {
  try {
    localStorage.setItem(chatsKey(), JSON.stringify(chats));
    localStorage.setItem(activeChatKey(), activeId || '');
  } catch (e) { /* cache is best-effort */ }
}

// Adopt a canonical store snapshot as the in-memory view.
function applyStore(store) {
  chats = Array.isArray(store.chats) ? store.chats : [];
  storeRevision = store.revision;
  storeProjectId = store.projectId;
  const want = store.activeChatId;
  activeId = (want && chats.some((c) => c.id === want)) ? want : ((chats[0] && chats[0].id) || null);
  history = activeChat() ? activeChat().messages : [];
  cacheChats();
}

// Re-read the canonical store and adopt it. Returns { ok, served } | { ok:false, error }.
async function refreshCanonical() {
  let r;
  try { r = await window.pcc.chatsRead(); } catch (e) { r = { ok: false, error: e.message }; }
  if (r && r.ok && r.store) {
    // Defense in depth: main is the schema authority and no longer serves a
    // structurally-invalid store, but if a non-array chats ever reached here we
    // must fail VISIBLY — never silently adopt it as an empty chat list (the
    // false-empty hazard this recovery exists to eliminate).
    if (!Array.isArray(r.store.chats)) return { ok: false, error: 'store_shape_invalid' };
    applyStore(r.store);
    // served:'prev' => the current generation is damaged and this is the last good
    // one (recovery). Surface it visibly and block mutations; never pass recovered
    // data off as ordinary current state.
    setRecoveryState(r.served);
    return { ok: true, served: r.served };
  }
  return { ok: false, error: (r && r.error) || 'read_failed' };
}

// Reflect the served generation in the UI. A 'prev' read is a RECOVERY view: show a
// persistent banner and disable the composer so nothing is edited from a recovered
// (previous-generation) view; mutations are also hard-blocked in chatCmd. 'current'
// clears the banner and restores the composer (unless a turn is in flight).
function setRecoveryState(served) {
  servedGeneration = (served === 'prev') ? 'prev' : 'current';
  const inRecovery = servedGeneration === 'prev';
  if (recoveryBanner) {
    recoveryBanner.textContent = inRecovery
      ? '⚠ Recovered view — the current chat file is damaged, so this is your last good saved history. Editing is disabled until it is recovered; nothing shown here will be changed.'
      : '';
    recoveryBanner.classList.toggle('hidden', !inRecovery);
  }
  if (input) input.disabled = inRecovery;
  if (sendBtn) sendBtn.disabled = inRecovery || busy;
}

// Run a command-shaped mutation through the canonical IPC, then resync from the
// store. Carries identity + revision so a stale or cross-project command is
// rejected by main. On conflict we resync to the latest and report it.
async function chatCmd(method, args) {
  // Serving the prior generation (recovery) means the CURRENT store is damaged.
  // Block EVERY mutation so the store is never advanced from a recovered view —
  // it stays read-only until the damaged current generation is deliberately recovered.
  if (servedGeneration === 'prev') return { ok: false, error: 'recovery_mode' };
  if (storeProjectId == null || !Number.isInteger(storeRevision)) return { ok: false, error: 'not_ready' };
  let r;
  try { r = await window.pcc[method](storeProjectId, storeRevision, args); }
  catch (e) { r = { ok: false, error: e.message }; }
  if (r && r.ok) { await refreshCanonical(); return r; }
  if (r && r.conflict) { await refreshCanonical(); }
  return r || { ok: false, error: 'cmd_failed' };
}

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
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

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

// Work-packet sections (docs/specs/work-packet-messages.md). The worker already emits
// its final reply in the reporting shape AGENTS.md requires; when it does, split that
// text into separately collapsible sections so the owner expands only what matters and
// sees short summaries otherwise. This parses the worker's OWN text — it does not depend
// on live tool events (that is the separate action-timeline spec). No recognised header
// => returns null, so the caller renders exactly as before (no regression).
const WORK_PACKET_SECTIONS = [
  'What I understood', 'What I inspected', 'What I changed', 'Tests run',
  'Problems found', 'Decisions needed', 'Proof', 'Next legal action',
];
const WORK_PACKET_BY_KEY = new Map(WORK_PACKET_SECTIONS.map((n) => [n.toLowerCase(), n]));

// Reduce a single line to a bare header key if it IS a recognised header, else ''.
// Tolerant of leading `#` heading markup, surrounding `**bold**`, and a trailing colon.
function workPacketHeaderKey(line) {
  let s = String(line).trim();
  s = s.replace(/^#{1,6}\s*/, '');            // markdown heading hashes
  s = s.replace(/^\*\*(.*)\*\*$/, '$1').trim(); // fully-bold line
  s = s.replace(/:\s*$/, '').trim();           // trailing colon
  s = s.replace(/^\*\*(.*)\*\*$/, '$1').trim(); // bold again (in case colon sat outside **)
  const key = s.toLowerCase();
  return WORK_PACKET_BY_KEY.has(key) ? key : '';
}

// Split an assistant reply into { lead, sections:[{name, body}] } when it contains one
// or more recognised work-packet headers; otherwise null. Partial packets keep only the
// sections that exist; pre-header text stays as a visible lead-in.
function splitWorkPacket(text) {
  const lines = String(text).split('\n');
  const heads = [];
  for (let i = 0; i < lines.length; i++) {
    const key = workPacketHeaderKey(lines[i]);
    if (key) heads.push({ i, name: WORK_PACKET_BY_KEY.get(key) });
  }
  if (heads.length === 0) return null;
  const lead = lines.slice(0, heads[0].i).join('\n').trim();
  const sections = [];
  for (let h = 0; h < heads.length; h++) {
    const start = heads[h].i + 1;
    const end = h + 1 < heads.length ? heads[h + 1].i : lines.length;
    sections.push({ name: heads[h].name, body: lines.slice(start, end).join('\n').trim() });
  }
  return { lead, sections };
}

// Render a parsed work packet: an optional visible lead-in, then one collapsed <details>
// per section with its name as the summary. Each part is rendered through renderAssistant
// so fenced code still becomes a working copy block (the copy handler is delegated on #log,
// so it fires inside <details> too).
function renderWorkPacket(packet) {
  let html = '';
  if (packet.lead) html += '<div class="wp-lead">' + renderAssistant(packet.lead) + '</div>';
  for (const s of packet.sections) {
    html += '<details class="wp-section"><summary>' + escapeHtml(s.name) + '</summary>'
      + '<div class="wp-body">' + renderAssistant(s.body) + '</div></details>';
  }
  return html;
}

// A build session turning on is LIVE status, not conversation. It must never be persisted
// into the transcript: a saved copy reloads on open and falsely claims build is active long
// after the bounded session expired (metric-honesty fix, 2026-07-14). Kept as one constant so
// the transient writer and the historical-cleanup filter below can never drift apart.
const BUILD_ENABLED_NOTICE = 'Build session enabled for this chat — it can now run commands and write files. Send your next message.';

// Create + show a bubble in the log (NO persistence).
// A live elapsed-time counter on the "Claude is working…" bubble, so a long turn reads as
// "alive and progressing (40s)" rather than an ambiguous frozen line — the exact confusion of
// 2026-07-20 ("it doesn't respond once it says Claude is thinking"). Pairs with the Stop button:
// the owner can see how long it's taken and decide to stop. Cleared when the bubble is removed.
function fmtElapsed(ms) {
  const s = Math.floor(ms / 1000);
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + String(s % 60).padStart(2, '0') + 's';
}
function startThinkingTimer(el) {
  if (!el) return;
  const t0 = Date.now();
  const tick = () => { if (el.isConnected) el.textContent = 'Claude is working… (' + fmtElapsed(Date.now() - t0) + ')'; };
  tick();
  el._pccTimer = setInterval(tick, 1000);
}
function stopThinkingTimer(el) { if (el && el._pccTimer) { clearInterval(el._pccTimer); el._pccTimer = null; } }

function addBubbleUI(cls, text) {
  const el = document.createElement('div');
  el.className = 'bubble ' + cls;
  const isAssistant = cls.indexOf('assistant') !== -1 && cls.indexOf('thinking') === -1;
  const packet = isAssistant ? splitWorkPacket(text) : null;
  if (packet) { el.innerHTML = renderWorkPacket(packet); }
  else if (isAssistant && String(text).indexOf('```') !== -1) { el.innerHTML = renderAssistant(text); }
  else { el.textContent = text; }
  // Keep the ORIGINAL text (fences and all) so the handoff packet can reproduce a
  // message verbatim rather than scraping rendered DOM (which would include the
  // code blocks' "Copy" button text). See docs/specs/conversation-handoff-packet.md.
  el.dataset.raw = String(text);
  log.appendChild(el);
  scrollDown();
  return el;
}

// Show a message AND persist it to the canonical store via the append command.
// The UI bubble shows immediately; a persistence failure is surfaced honestly —
// the message is never silently dropped or written to a competing authority.
// Show a message AND persist it to a SPECIFIC chat (targetChatId is captured by the
// caller; it must NOT re-read activeChat() here — the active chat can change during
// an awaited worker turn, which would otherwise append to the wrong chat). Returns
// { ok, el }: callers that must not proceed on an unsaved message check `ok`.
async function appendMessage(cls, text, targetChatId) {
  const el = addBubbleUI(cls, text);
  const chatId = targetChatId || (activeChat() && activeChat().id);
  if (!chatId) return { ok: false, el };
  // Fixed message id => the append is IDEMPOTENT (chat-store no-ops a duplicate id).
  // So on a revision CONFLICT (two appends raced the same revision) we can safely
  // re-read + retry the SAME message: it is never duplicated and never lost.
  const message = { id: uuid(), cls, text, ts: Date.now() };
  let r;
  for (let attempt = 0; attempt < 6; attempt++) {
    r = await chatCmd('chatsAppend', { chatId, message });
    if (r && r.ok) return { ok: true, el };   // persisted (or idempotent no-op)
    if (!r || !r.conflict) break;             // a non-conflict error -> stop and surface
    // conflict: chatCmd already refreshed storeRevision; loop retries with the same id
  }
  addBubbleUI('assistant error', '(could not save that message: ' + ((r && r.error) || 'unknown') + ')');
  return { ok: false, el };
}

// Back-compat shim used only by incidental notices during the S5 conversion:
// persist=false -> UI only; persist=true -> canonical append. Callers on the hot
// send path await appendMessage() directly so appends serialize cleanly.
function addBubble(cls, text, persist) {
  if (persist) { appendMessage(cls, text); return log.lastChild; }
  return addBubbleUI(cls, text);
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
// Compose + show a message, then either send it now or QUEUE it if a turn is already running.
// STEERING (owner request): the composer never locks mid-turn — you can keep sending / redirecting,
// and queued messages are sent in order as each turn finishes, instead of being dropped.
async function sendMessage(text, displayText) {
  const msg = (text || '').trim();
  const outbound = attachments.slice(); // snapshot the composer's attachments for THIS send
  if (!msg && outbound.length === 0) return;
  // In recovery (showing the prior generation), the store is read-only. Refuse the
  // send with a clear reason rather than optimistically show a bubble that then
  // fails to persist.
  if (servedGeneration === 'prev') { addBubbleUI('assistant error', 'Editing is disabled while showing recovered history — the current chat file must be recovered first.'); return; }
  const shown = (displayText || msg).trim();
  const chat = activeChat();
  if (!chat) return;
  const chatId = chat.id;
  // Snapshot (pre-append) whether this is a fresh unnamed chat — used to decide the
  // provisional name AFTER the prompt is safely persisted.
  const wasFreshNewChat = !!shown && chat.name === 'New chat' && (chat.messages || []).filter((m) => m.cls === 'user').length === 0;
  const welcome = log.querySelector('.welcome');
  if (welcome) welcome.remove();
  // Persist the prompt FIRST. If it cannot be saved to the canonical store, DO NOT
  // run the worker AND DO NOT advance the store in any other way (no rename) — that
  // would mutate history from a prompt that isn't in it. Fail visibly; owner retries.
  const attachNote = outbound.length ? (shown ? '\n\n' : '') + '📎 ' + outbound.length + ' attachment' + (outbound.length > 1 ? 's' : '') + ': ' + outbound.map((a) => a.name || a.kind).join(', ') : '';
  const saved = await appendMessage('user', shown + attachNote, chatId);
  if (!saved.ok) return; // appendMessage already surfaced the error; nothing else advances
  // Provisional name for a fresh chat (refined later by AI auto-name). Persisted
  // UNLOCKED, and ONLY now that the prompt is safely in the canonical store.
  if (wasFreshNewChat) {
    await chatCmd('chatsRename', { chatId, name: shown.replace(/\s+/g, ' ').slice(0, 40) + (shown.length > 40 ? '…' : ''), lock: false });
    renderChatList();
  }
  attachments = []; renderAttachments();
  const item = { msg, outbound, chatId }; // by ID: refresh-after-mutation replaces chat objects
  if (busy) { sendQueue.push(item); return; } // a turn is running — send this one when it finishes
  runSend(item);
}

// Run one turn against the worker, then drain the next queued message (if any).
async function runSend(item) {
  const chatId = item.chatId;
  if (!chats.find((c) => c.id === chatId)) { return; }
  busy = true; input.focus();
  inFlightChatId = chatId; // R2: Stop targets exactly this turn
  if (stopBtn) stopBtn.disabled = false; // Stop is always visible; ENABLE it while a turn runs
  const steerHint = document.getElementById('steer-hint');
  if (steerHint) steerHint.classList.remove('hidden'); // show the steer cue while working
  const thinking = addBubbleUI('assistant thinking', 'Claude is working…');
  startThinkingTimer(thinking); // live elapsed time so a long turn reads as progressing, not frozen
  try {
    // Two IDs, kept separate on purpose: the WORKER session id is the re-minted id
    // from sessionIds (after a recovery re-mint) else the stable chatId — so a
    // stale-locked session can be replaced without losing history. The stable
    // chatId is the AUTHORITY key so build permission tracks the chat itself.
    // isFirstTurn comes from turnsStarted (renderer-local) — the canonical store's
    // `started` means "has messages", which is not the same as "had a worker turn".
    const isFirstTurn = !turnsStarted.has(chatId);
    const workerSession = sessionIds.get(chatId) || chatId;
    // ADR-0019: a rolled-over chat's FIRST turn carries the handoff+summary seed to the WORKER
    // (it's also shown as a bubble). Prepended to the prompt so Claude has the context; the owner's
    // visible bubble is still just their own message.
    let sendText = item.msg;
    const seededFirstTurn = isFirstTurn && pendingSeed.has(chatId);
    if (seededFirstTurn) {
      // codex-caught: do NOT delete the seed here — if this send fails, the carried context would be
      // lost on retry. It is dropped below only AFTER the turn actually succeeds (AC-10).
      sendText = pendingSeed.get(chatId) + '\n\n=== The person you are helping now says: ===\n' + item.msg;
    }
    const res = await window.pcc.send(sendText, getSelectedModel(), workerSession, isFirstTurn, chatId, item.outbound);
    stopThinkingTimer(thinking); thinking.remove();
    if (res.ok) turnsStarted.add(chatId);
    if (res.ok && seededFirstTurn) pendingSeed.delete(chatId); // AC-10: drop the carried seed ONLY once it's actually delivered
    // ADR-0019: record this turn's REAL context size for the chat-health meter; track staleness when a
    // turn reports no tokens after a prior reading (AC-5); flag an auto-rollover if this chat crossed the
    // threshold (fired below once the send burst settles, so it never races a queued steer).
    if (res.ok) {
      if (typeof res.contextTokens === 'number') {
        recordContextBaseline(chatId, res.contextTokens); // freeze this chat's fixed overhead on its FIRST reading
        recordContextTokens(chatId, res.contextTokens);
        staleContextChats.delete(chatId); // a fresh real reading — no longer stale
        const rg = PCCChatHealth.computeGauge({ contextTokens: res.contextTokens, baselineTokens: chatContextBaseline.get(chatId), model: getSelectedModel() });
        // codex-caught: do NOT mark rolledOverChats here — that would fail-STUCK a chat whose rollover
        // then errors. It is marked only on a SUCCESSFUL rollover (in autoRolloverToNewChat).
        if (AUTO_ROLLOVER_ENABLED && rg.overRollover && !rolledOverChats.has(chatId) && !rolloverInFlight) { rolloverAfterTurn = { chatId: chatId, tokens: res.contextTokens }; }
      } else if (chatContextTokens.has(chatId)) {
        staleContextChats.add(chatId); // a measured chat had an UNMEASURED turn — the reading may now understate (AC-5)
      }
    }
    // R2/R3: an owner-initiated stop, an automatic budget-cap stop, the native per-message turn-cap
    // stop (ADR-0020 T2), or hitting the Claude PLAN usage limit are not PCC failures — a neutral
    // 'assistant' bubble (its own text explains what happened), never the red error style a real bug gets.
    const isProtectiveStop = res.stoppedByOwner || res.budgetExceeded || res.maxTurnsReached || res.usageLimit || res.authError;
    await appendMessage(res.ok || isProtectiveStop ? 'assistant' : 'assistant error', res.text || '(no output)', chatId);
    if (res.ok) { const cc = chats.find((c) => c.id === chatId); if (cc) persistTranscript(cc); }
    // A stale worker is holding this chat's session — offer a one-click way out.
    if (!res.ok && res.sessionInUse) addRecoveryAction();
    // R3 slice 2 (desktop-parity, ADR-0015): this chat's cumulative cost crossed its cap — roll it
    // over AUTOMATICALLY, zero owner action. Reuses the exact same mechanism manual "Recover this
    // chat" already uses (a fresh underlying session, full visible history kept) — just triggered
    // by real spend instead of a stale-lock error. Honest, not overclaiming: the model's own
    // context resets with the new session; the chat's history in PCC does not.
    if (res.costRollover) {
      remintSession(chatId);
      await appendMessage('assistant',
        'This chat has used about $' + res.costRollover.totalUsd.toFixed(2) + ' so far — PCC automatically started a fresh worker ' +
        'session to protect your Claude usage from growing unnoticed over a long chat. Your full history stays right here; the new ' +
        'session starts with a clean context. Nothing more to do — just keep chatting.',
        chatId);
    }
  } catch (err) {
    stopThinkingTimer(thinking); thinking.remove();
    await appendMessage('assistant error', 'Something went wrong: ' + err.message, chatId);
  } finally {
    stopThinkingTimer(thinking); // belt-and-suspenders: never leak the interval
    busy = false; input.focus();
    inFlightChatId = null;
    if (stopBtn) stopBtn.disabled = true; // turn done — Stop stays visible but goes dim/disabled
    { const sh = document.getElementById('steer-hint'); if (sh) sh.classList.add('hidden'); }
    // Finding C fix: a mid-turn resync (appendMessage's assistant-reply persist, above,
    // runs a refreshCanonical -> setRecoveryState while busy was still true) can leave
    // sendBtn.disabled=true as a stale snapshot -- nothing re-derived it after busy
    // cleared. Re-run the SAME function that owns this state so it reflects the CURRENT
    // busy/recovery state, not a snapshot from mid-turn. Idempotent / cheap; matches
    // whatever refreshCanonical last observed for servedGeneration.
    setRecoveryState(servedGeneration);
    if (sendQueue.length) {
      runSend(sendQueue.shift()); // steering: send the next queued message
    } else {
      // The send burst is done. A worker turn (esp. a build turn) can commit, push,
      // or edit files, which moves the git-derived trust chips (Verified / backup /
      // CI). Refresh the trust strip so it never shows a stale snapshot as current
      // after a turn (I4 audit: boot/action snapshot, no post-turn invalidation).
      loadTrust();
      // ADR-0019: the burst is done (no queued steers) — if this chat crossed the context
      // threshold, carry it over into a fresh chat now. Fire-and-forget: it owns its own UI + errors.
      if (rolloverAfterTurn) { const r = rolloverAfterTurn; rolloverAfterTurn = null; autoRolloverToNewChat(r.chatId, r.tokens).catch(() => {}); }
    }
  }
}

// ---- First-class chat history: AI auto-name + summary card (docs/CHAT_RECALL_SPEC.md) ----
// The instant first-message name (in sendMessage) is only a PROVISIONAL label. The real AI name
// is generated when you're DONE with a chat — when you leave it (switch away / start a new one)
// or generate its summary — NOT after turn one, because the actual subject usually emerges near
// the END of a chat (owner: "I usually ask the question at or near the end"). It re-names each
// time you leave, so the title always reflects the latest state. Skips a hand-locked name; only
// spends a worker call when the chat has GROWN since it was last named (revisiting is free).
// Always mirror a chat's full transcript to disk (no AI) so recall has a greppable corpus even
// for chats never summarized. Fire-and-forget, best-effort. Called on leave and after each turn.
function persistTranscript(chat) {
  if (chat && chat.messages && chat.messages.length) { try { window.pcc.persistChat(chat.id, chat.messages); } catch (e) { /* best effort */ } }
}

async function reconsiderChatName(chat) {
  if (!chat || chat.nameLocked) return;
  const msgs = chat.messages || [];
  const users = msgs.filter((m) => m.cls === 'user').length;
  const bots = msgs.filter((m) => m.cls !== 'user').length;
  if (users < 1 || bots < 1) return;                 // need a real exchange to name from
  const chatId = chat.id;
  if (msgs.length < (namedAtLen.get(chatId) || 0) + 2) return; // nothing meaningful added since last name
  namedAtLen.set(chatId, msgs.length);               // claim (renderer-local) so we don't double-fire
  try {
    const r = await window.pcc.autoNameChat(msgs);
    const cur = chats.find((c) => c.id === chatId);
    if (r && r.ok && r.title && cur && !cur.nameLocked) {
      await chatCmd('chatsRename', { chatId, name: r.title, lock: false }); // unlocked auto-name
      renderChatList();
    }
  } catch (e) { /* keep the current name */ }
}

// The summary card slide-over. Opens on the 📋 button next to a chat's name; shows the last
// generated card instantly (cached on the chat) with a ↻ to regenerate, else builds one now.
let summaryChatId = null;
const chatSummaries = new Map(); // renderer-local cache: survives canonical refreshes during this app session
function openSummaryDrawer() {
  document.getElementById('summary-backdrop').classList.remove('hidden');
  document.getElementById('summary-drawer').classList.remove('hidden');
}
function closeSummaryDrawer() {
  document.getElementById('summary-backdrop').classList.add('hidden');
  document.getElementById('summary-drawer').classList.add('hidden');
}
function summarySection(title, items) {
  const body = (Array.isArray(items) && items.length)
    ? '<ul>' + items.map((x) => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>'
    : '<p class="empty">(none)</p>';
  return '<div class="sum-sec"><h4>' + escapeHtml(title) + '</h4>' + body + '</div>';
}
function renderSummaryCard(chat, s, at) {
  document.getElementById('summary-title').textContent = chat.name || 'Summary';
  const gist = (s && s.gist) ? '<div class="sum-sec"><h4>Gist</h4><p>' + escapeHtml(s.gist) + '</p></div>'
    : '<div class="sum-sec"><h4>Gist</h4><p class="empty">(none)</p></div>';
  document.getElementById('summary-body').innerHTML =
    '<div class="sum-meta">Generated ' + relTime(at) + ' — quotes the chat, invents nothing.</div>'
    + gist
    + summarySection('Decided', s && s.decided)
    + summarySection('Went right', s && s.wentRight)
    + summarySection('Went wrong', s && s.wentWrong)
    + summarySection('Open ideas', s && s.openIdeas)
    + summarySection('Important events', s && s.importantEvents);
}
async function generateSummary(chat) {
  document.getElementById('summary-title').textContent = chat.name || 'Summary';
  document.getElementById('summary-body').innerHTML = '<div class="sum-loading">Reading this chat and writing a summary…</div>';
  try {
    const r = await window.pcc.summarizeChat(chat.id, chat.messages);
    if (r && r.ok) {
      chat.summary = r.summary; chat.summaryAt = r.at; // in-memory drawer cache (disk copy is authoritative)
      chatSummaries.set(chat.id, { summary: r.summary, at: r.at });
      // A summary is a full read of the chat — adopt its title as the name (unless locked).
      if (r.summary && r.summary.title && !chat.nameLocked) {
        await chatCmd('chatsRename', { chatId: chat.id, name: String(r.summary.title).slice(0, 60), lock: false });
        namedAtLen.set(chat.id, (chat.messages || []).length);
        renderChatList();
      }
      if (summaryChatId === chat.id) renderSummaryCard(chat, r.summary, r.at);
    } else if (summaryChatId === chat.id) {
      document.getElementById('summary-body').innerHTML = '<div class="sum-error">' + escapeHtml((r && r.text) || 'Could not build a summary.') + '</div>';
    }
  } catch (e) {
    if (summaryChatId === chat.id) document.getElementById('summary-body').innerHTML = '<div class="sum-error">Something went wrong building the summary.</div>';
  }
}
function showSummary(id) {
  const chat = chats.find((c) => c.id === id);
  if (!chat) return;
  summaryChatId = id;
  openSummaryDrawer();
  if (!chat.messages || chat.messages.length === 0) {
    document.getElementById('summary-title').textContent = chat.name || 'Summary';
    document.getElementById('summary-body').innerHTML = '<div class="sum-loading">This chat has no messages yet.</div>';
    return;
  }
  const cached = chatSummaries.get(chat.id);
  if (chat.summary) renderSummaryCard(chat, chat.summary, chat.summaryAt); // show cached instantly
  else if (cached) renderSummaryCard(chat, cached.summary, cached.at);
  else generateSummary(chat);                                             // first time: build it
}
{
  const close = document.getElementById('summary-close');
  const back = document.getElementById('summary-backdrop');
  const refresh = document.getElementById('summary-refresh');
  if (close) close.addEventListener('click', closeSummaryDrawer);
  if (back) back.addEventListener('click', closeSummaryDrawer);
  if (refresh) refresh.addEventListener('click', () => { const c = chats.find((x) => x.id === summaryChatId); if (c) generateSummary(c); });
}

// ---- attachments: images (paste/drop/pick) + files (pick) ----
// Images ride to the worker as base64 content blocks (main spawns stream-json); text files are
// inlined as text. Everything the owner attaches is shown as a removable chip above the composer.
const IMG_RE = /^image\//;
const MAX_ATTACH_BYTES = 8 * 1024 * 1024; // 8 MB per file guard (keeps the IPC payload sane)

function renderAttachments() {
  const el = document.getElementById('attachments');
  if (!el) return;
  el.classList.toggle('hidden', attachments.length === 0);
  el.innerHTML = attachments.map((a, i) =>
    '<span class="attach-chip">'
    + (a.kind === 'image' ? '<img src="data:' + a.mediaType + ';base64,' + a.dataBase64 + '" alt="">' : '')
    + '<span class="attach-name">' + escapeHtml(a.name || (a.kind === 'image' ? 'image' : 'file')) + '</span>'
    + '<span class="ax" data-remove="' + i + '" title="Remove">✕</span></span>'
  ).join('');
  el.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    attachments.splice(parseInt(b.getAttribute('data-remove'), 10), 1); renderAttachments();
  }));
}

function fileToAttachment(file) {
  return new Promise((resolve) => {
    if (!file || file.size > MAX_ATTACH_BYTES) { resolve(null); return; }
    const reader = new FileReader();
    if (IMG_RE.test(file.type)) {
      reader.onload = () => { const s = String(reader.result); resolve({ kind: 'image', mediaType: file.type, dataBase64: s.slice(s.indexOf(',') + 1), name: file.name || 'image' }); };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    } else {
      reader.onload = () => resolve({ kind: 'text', name: file.name || 'file', content: String(reader.result) });
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    }
  });
}

async function addFiles(fileList) {
  for (const f of Array.from(fileList || [])) { const a = await fileToAttachment(f); if (a) attachments.push(a); }
  renderAttachments();
}

{
  const btn = document.getElementById('attach-btn');
  const inp = document.getElementById('attach-input');
  if (btn && inp) {
    btn.addEventListener('click', () => inp.click());
    inp.addEventListener('change', async () => { await addFiles(inp.files); inp.value = ''; });
  }
  // Paste an image straight into the message box (Ctrl/Cmd+V of a screenshot, etc.).
  if (input) input.addEventListener('paste', async (e) => {
    const items = (e.clipboardData && e.clipboardData.items) || [];
    const imgs = [];
    for (const it of items) if (it.kind === 'file' && IMG_RE.test(it.type)) { const f = it.getAsFile(); if (f) imgs.push(f); }
    if (imgs.length) { e.preventDefault(); await addFiles(imgs); }
  });
  // Drag & drop files/images onto the composer.
  const composerEl = document.getElementById('composer');
  if (composerEl) {
    composerEl.addEventListener('dragover', (e) => { e.preventDefault(); });
    composerEl.addEventListener('drop', async (e) => { e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) await addFiles(e.dataTransfer.files); });
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
// Shared by manual recovery (above) and R3 slice 2's automatic cost-cap rollover below: give a
// chat a brand-new underlying Claude session (decoupled from the chat's own stable id) while its
// VISIBLE history is completely untouched — the chat object and its messages are never touched.
function remintSession(chatId) {
  sessionIds.set(chatId, uuid());
  turnsStarted.delete(chatId); // next send opens the new session cleanly (isFirstTurn=true)
}
async function recoverThisChat() {
  const chat = activeChat();
  if (!chat) return;
  remintSession(chat.id);
  await appendMessage('assistant', 'Fresh worker session started for this chat — your history is kept. Send your message again.', chat.id);
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

async function startNewChat(opts) {
  if (busy) return;
  opts = opts || {};
  const leaving = activeChat();            // name the chat you're leaving behind, from its full arc
  const newId = uuid();
  const cr = await chatCmd('chatsCreate', { id: newId, name: opts.name || 'New chat' });
  if (!cr.ok) { addBubbleUI('assistant error', 'Could not start a new chat: ' + (cr.error || 'unknown')); return; }
  await chatCmd('chatsSetActive', { chatId: newId }); // refresh adopts the new active chat
  renderActiveChat();
  renderChatList();
  loadTrust();
  input.value = opts.prefill || '';
  growComposer();
  input.focus();
  if (leaving && leaving.id !== newId) { persistTranscript(leaving); reconsiderChatName(leaving); } // fire-and-forget
  return newId;
}
document.getElementById('new-chat').addEventListener('click', startNewChat);

// ADR-0019 Slice C: automatic context-rollover into a NEW chat. When a completed turn shows the
// chat is over the context threshold, PCC carries a handoff + summary forward into a fresh chat and
// switches to it — the old chat is kept, nothing deleted. State:
const pendingSeed = new Map();      // newChatId -> carried context, prepended to that chat's FIRST worker turn
const rolledOverChats = new Set();  // source chats already SUCCESSFULLY rolled over (AC-11: at most once per chat)
const staleContextChats = new Set();// chats whose LATEST turn reported no tokens after a prior reading (AC-5)
let rolloverAfterTurn = null;        // { chatId, pct } set by runSend when a turn crosses the threshold
let rolloverInFlight = false;        // guard: never start a second rollover while one is running

// SURVIVAL-TRIAL RULE (2026-07-21, owner + Codex directive during the ADR-0016 trust proving window):
// PCC must NOT take control. No automatic behavior may interrupt, loop, switch chats, or surprise the
// owner while he uses PCC in normal life. So forced auto-rollover stays OFF for the window — even though
// the growth-based meter (below) makes the turn-one loop structurally impossible. The meter now WARNS
// only; switching to a fresh chat is an OWNER-controlled action, never automatic. Re-enable only after
// the owner explicitly approves a one-click "continue in a fresh chat with handoff" flow he controls.
const AUTO_ROLLOVER_ENABLED = false;

// Flatten the structured summary into short seed text (best-effort; empty if no summary).
function summaryToSeedText(s) {
  if (!s || typeof s !== 'object') return '';
  const out = [];
  if (s.title) out.push('Title: ' + s.title);
  if (s.gist) out.push('Gist: ' + s.gist);
  const list = (label, arr) => { if (Array.isArray(arr) && arr.length) out.push(label + ':\n' + arr.map((x) => '- ' + x).join('\n')); };
  list('Decided', s.decided); list('Open ideas', s.openIdeas); list('Important events', s.importantEvents);
  return out.join('\n');
}

// Owner-controlled "continue in a fresh chat." This is the useful version of the pattern:
// a fresh chat that ACTUALLY carries the thread forward. Fail-safe ORDER: build the carried
// context FIRST, while the source chat is still active. The handoff is REQUIRED — without it a
// "continued" chat is just an empty room — so if it can't be built we HOLD in the source chat and
// never open an empty one. On success the carried context is dropped VISIBLY into the composer of
// the new chat (editable, no hidden seed), and NOTHING is sent until the owner presses Send.
async function continueInFreshChat() {
  if (busy) return;
  const source = activeChat();
  const btn = document.getElementById('continue-fresh-chat');
  const restoreBtn = () => { if (btn) { btn.disabled = false; btn.textContent = 'Continue in fresh chat'; } };
  if (btn) { btn.disabled = true; btn.textContent = 'Carrying context…'; } // assembling the handoff can take a moment

  let handoff = '';
  try { const h = await window.pcc.handoff(); handoff = (h && h.ok && h.text) ? h.text : ''; } catch (e) { handoff = ''; }
  if (!handoff) {
    restoreBtn();
    await appendMessage('assistant',
      'PCC could not build the handoff to carry your context forward, so it is staying in THIS chat rather than opening an empty one. Nothing was lost — try again, or keep going here.',
      source && source.id);
    return;
  }

  // Best-effort summary ON TOP of the required handoff — only if one is already available, so this
  // never blocks or hangs the button. The handoff itself is the continuity payload; the summary is bonus.
  let summaryText = '';
  try {
    const cached = source && chatSummaries.get(source.id);
    summaryText = summaryToSeedText((source && source.summary) || (cached && cached.summary));
  } catch (e) { summaryText = ''; }

  const carried = '=== Carried context from your previous chat ===\n'
    + '(This is visible and editable. Nothing is sent until you press Send.)\n\n'
    + handoff
    + (summaryText ? ('\n\n=== Conversation summary ===\n' + summaryText) : '')
    + '\n\n=== Continue from here ===\n';

  // startNewChat drops `carried` into the composer (input.value) and focuses it — visible, not sent.
  // If it fails to create the chat it surfaces its own error and the owner stays in the source chat.
  await startNewChat({ name: 'Continued chat', prefill: carried });
}

// Carry a too-full chat forward into a fresh chat. Fail-safe ORDER (AC-10): build the carried
// context FIRST while the source is still active; only on success create + seed + switch. If the
// handoff can't be built, HOLD in the source chat with a plain warning — never open an empty chat,
// never continue silently.
async function autoRolloverToNewChat(sourceChatId, contextTokens) {
  rolloverInFlight = true;
  try {
  const sizeTxt = (typeof contextTokens === 'number' && contextTokens > 0) ? ('~' + Math.round(contextTokens / 1000) + 'K tokens') : 'a large size';
  const source = chats.find((c) => c.id === sourceChatId);
  const messages = (source && source.messages) || history;

  let handoff = '';
  try { const h = await window.pcc.handoff(); handoff = (h && (h.text || h.brief)) || (typeof h === 'string' ? h : ''); } catch (e) { handoff = ''; }
  if (!handoff) {
    await appendMessage('assistant',
      'This chat has grown to ' + sizeTxt + ' and should roll over, but PCC could not build the handoff to carry forward — so it is HOLDING here rather than starting an empty chat. Hit “New chat” to start fresh, or keep going.',
      sourceChatId);
    return;
  }
  let summaryText = '';
  try { const s = await window.pcc.summarizeChat(sourceChatId, messages); if (s && s.ok) summaryText = summaryToSeedText(s.summary); } catch (e) { summaryText = ''; }

  const seed = 'You are continuing a previous chat that was rolled over because its context got large. '
    + 'Only what appears below carries forward — treat it as the ground truth for this conversation.\n\n'
    + '=== Handoff briefing ===\n' + handoff
    + (summaryText ? ('\n\n=== Conversation summary ===\n' + summaryText) : '');

  const newId = uuid();
  const cr = await chatCmd('chatsCreate', { id: newId, name: 'Continued chat' });
  if (!cr.ok) {
    await appendMessage('assistant',
      'This chat has grown to ' + sizeTxt + ' and should roll over, but PCC could not create the new chat (' + (cr.error || 'unknown') + ') — holding here. Try “New chat”.',
      sourceChatId);
    return;
  }
  pendingSeed.set(newId, seed);                                   // prepended to the new chat's first worker turn
  if (source) { persistTranscript(source); reconsiderChatName(source); } // preserve the old chat's arc
  // codex-caught: the SWITCH is the material step — if it fails, the owner is still in the over-full
  // source chat, so treat it as a hold (don't mark rolled-over) rather than a stuck success.
  const sa = await chatCmd('chatsSetActive', { chatId: newId });
  if (!sa || !sa.ok) {
    pendingSeed.delete(newId);
    try { await chatCmd('chatsDelete', { chatId: newId }); } catch (e) { /* codex-caught: best-effort remove the orphan "Continued chat" the failed switch left behind */ }
    await appendMessage('assistant',
      'This chat has grown to ' + sizeTxt + ' and should roll over, but PCC could not switch to the new chat (' + ((sa && sa.error) || 'unknown') + ') — holding here. Try “New chat”.',
      sourceChatId);
    return; // unmarked → retries on a later turn
  }
  renderActiveChat(); renderChatList(); loadTrust();
  // The notice is best-effort: the rollover already materially happened (new chat created, active,
  // and seeded), so a failed notice-append does not undo it or block the mark.
  await appendMessage('assistant',
    'Your previous chat grew to ' + sizeTxt + ', so PCC automatically continued it here in a fresh chat to protect your Claude usage from a big context re-sent every turn. Your old chat is safe in the list on the left — nothing was deleted. A handoff' + (summaryText ? ' + summary' : ' (a conversation summary could not be generated this time, so only the handoff carried forward)') + ' is carried forward and attached to your next message, so Claude picks up where you left off.',
    newId);
  rolledOverChats.add(sourceChatId); // SUCCESS (switch confirmed): hold-paths above return early unmarked, so a transient failure retries next turn
  } finally {
    rolloverInFlight = false;
  }
}

// New project (DECISION-114): "New Project" is a NEW DOCUMENT. Clicking it takes you OUT of the
// cockpit into a distinct "Creating a project" surface — a full chat, but NOT this cockpit chat,
// and its worker runs in an isolated SCRATCH folder that will become the project (never PCC). You
// are "in" the unsaved project immediately; "Save Project" materializes it (name + location →
// scaffold → register → land you inside it). There is no in-PCC intake and no per-chat build grant
// anymore — the isolated create-flow IS the gate, so the cockpit chat can stay purely read-only.
//
// ---- create-flow surface state (its own transcript; nothing here touches the cockpit chats) ----
const cfLog = document.getElementById('cf-log');
const cfInput = document.getElementById('cf-input');
let cfBusy = false;
let cfSaving = false;         // true while Save is materializing — blocks sends and Cancel (Save/Cancel race)
const cfQueue = [];           // steering parity: keep the composer usable; queue sends in order

function cfAddBubble(cls, text) {
  const el = document.createElement('div');
  el.className = 'bubble ' + cls;
  const isAssistant = cls.indexOf('assistant') !== -1 && cls.indexOf('thinking') === -1;
  const packet = isAssistant ? splitWorkPacket(text) : null;
  if (packet) { el.innerHTML = renderWorkPacket(packet); }
  else if (isAssistant && String(text).indexOf('```') !== -1) { el.innerHTML = renderAssistant(text); }
  else { el.textContent = text; }
  cfLog.appendChild(el);
  cfLog.scrollTop = cfLog.scrollHeight;
  return el;
}
// Copy buttons inside create-flow code blocks (same behavior as the cockpit chat).
cfLog.addEventListener('click', (e) => {
  const btn = e.target.closest && e.target.closest('.cb-copy');
  if (!btn) return;
  const pre = btn.parentElement.querySelector('.cb-code');
  if (!pre) return;
  navigator.clipboard.writeText(pre.textContent).then(() => {
    const prev = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = prev; }, 1500);
  }).catch(() => { btn.textContent = 'Copy failed'; });
});

async function cfRunSend(item) {
  cfBusy = true; cfInput.focus();
  const thinking = cfAddBubble('assistant thinking', 'Claude is working…');
  try {
    const res = await window.pcc.createFlowSend(item.msg, getSelectedModel());
    thinking.remove();
    cfAddBubble(res && res.ok ? 'assistant' : 'assistant error', (res && res.text) || '(no output)');
  } catch (err) {
    thinking.remove();
    cfAddBubble('assistant error', 'Something went wrong: ' + err.message);
  } finally {
    cfBusy = false; cfInput.focus();
    // Don't drain the queue once Save has started materializing (cfSaving) — those pre-Save
    // messages are moot and would only draw a spurious "no project" error during the save.
    if (!cfSaving && cfQueue.length) cfRunSend(cfQueue.shift());
  }
}
// `hidden` = don't show a user bubble (used for the invisible kickoff that starts the interview).
function cfSend(text, hidden) {
  if (cfSaving) return;        // no new interview turns once Save has started materializing
  const msg = (text || '').trim();
  if (!msg) return;
  if (!hidden) cfAddBubble('user', msg);
  const item = { msg };
  if (cfBusy) { cfQueue.push(item); return; }
  cfRunSend(item);
}

function cfClose() {
  document.getElementById('create-flow').classList.remove('open');
  cfLog.innerHTML = ''; cfInput.value = ''; cfBusy = false; cfSaving = false; cfQueue.length = 0;
  // Land back on the cockpit's primary surface (Chat), not wherever New Project was clicked from.
  const chatNav = document.querySelector('.nav[data-view="chat"]');
  if (chatNav) chatNav.click();
}

// Returns true if the create-flow overlay opened, false if it could not start. Callers on the empty
// state use the return value to surface a start failure (the underlying chat bubble below is hidden
// beneath the #no-project overlay, so it would otherwise be invisible there).
async function cfOpen() {
  const start = await window.pcc.createFlowStart();
  if (!start || !start.ok) { addBubble('assistant error', (start && start.error) || 'Could not start a new project.', false); return false; }
  cfLog.innerHTML = ''; cfInput.value = '';
  document.getElementById('create-flow').classList.add('open');
  cfInput.focus();
  // Kick off the plain-language interview. The worker runs in the scratch folder (its own seeded
  // intake protocol) and must NOT scaffold — the owner's "Save Project" click does that.
  const kickoff = 'You are helping me create a BRAND-NEW project. You are running inside a fresh scratch '
    + 'folder that will BECOME this project — everything you create belongs to the new project. Never read '
    + 'from, write to, or reference the PCC cockpit folder. Run `pwsh -File scripts/new-project-intake.ps1` '
    + 'to load the interview protocol, then interview me in plain language following it, one or two questions '
    + 'at a time. Do NOT scaffold or try to "finish" the project — when I am ready I will click "Save Project", '
    + 'which creates the real project folder. When you have enough from the interview, write a `blueprint.json` '
    + 'in this folder capturing the project (name, problem, target user, desired outcome, scope). '
    + 'Ask me the first question now.';
  cfSend(kickoff, true);
  return true;
}

async function cfSave() {
  if (cfBusy) { const wait = await pccConfirm('Claude is still replying. Save the project now anyway?', 'Save now'); if (!wait) return; }
  const name = await pccPrompt('Name this project:');
  if (!name || !name.trim()) return;
  const loc = await window.pcc.createFlowPickLocation();
  if (!loc || !loc.path) return;
  // Commit to materializing: block sends + Cancel so nothing races the Save (Save/Cancel race).
  cfSaving = true; cfQueue.length = 0;   // drop any pre-Save queued turns; they're moot now
  const saveBtn = document.getElementById('cf-save');
  const cancelBtn = document.getElementById('cf-cancel');
  saveBtn.disabled = true; cancelBtn.disabled = true;
  const prev = saveBtn.textContent; saveBtn.textContent = 'Saving…';
  const res = await window.pcc.createFlowSave(name.trim(), loc.path);
  if (res && res.ok) {
    // Land INSIDE the new project: the active project is now it, so a reload boots the cockpit
    // onto it (its first checkpoint is already committed by the scaffolder).
    location.reload();
  } else {
    cfSaving = false;
    saveBtn.disabled = false; cancelBtn.disabled = false; saveBtn.textContent = prev;
    cfAddBubble('assistant error', 'Could not save the project: ' + ((res && res.error) || 'unknown error'));
  }
}

async function cfCancel() {
  if (cfSaving) return;        // a Save is materializing — cannot cancel now
  const ok = await pccConfirm('Discard this new project? Nothing has been saved yet.', 'Discard');
  if (!ok) return;
  try { await window.pcc.createFlowCancel(); } catch (e) { /* scratch cleanup is best-effort */ }
  cfClose();
}

document.getElementById('new-project').addEventListener('click', () => { if (!busy) cfOpen(); });
document.getElementById('cf-save').addEventListener('click', cfSave);
document.getElementById('cf-cancel').addEventListener('click', cfCancel);
{
  const cfForm = document.getElementById('cf-composer');
  cfForm.addEventListener('submit', (e) => { e.preventDefault(); const v = cfInput.value; cfInput.value = ''; cfInput.style.height = 'auto'; cfSend(v); });
  cfInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); cfForm.requestSubmit(); } });
  cfInput.addEventListener('input', () => { cfInput.style.height = 'auto'; cfInput.style.height = Math.min(cfInput.scrollHeight, 180) + 'px'; });
}

// End an approved build session on demand -> authority returns to read_only.
{
  const authorityEndBtn = document.getElementById('authority-end');
  if (authorityEndBtn) authorityEndBtn.addEventListener('click', async () => { const c = activeChat(); if (c) await window.pcc.endJob(c.id); loadTrust(); });
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
  if (!c) return;
  const chatId = c.id; // stable authority key (NOT the worker session id)
  const name = c.buildName || (c.name || '').replace(/^New project:\s*/, '') || 'this chat';
  const req = await window.pcc.requestJob('new_project', name, chatId);
  if (!req || !req.ok) return;
  loadTrust();
  const ok = await pccConfirm(
    'Enable a build session for "' + name + '"?\n\nThis lets THIS chat run commands and write files for a bounded build session, then returns to read-only when it ends.',
    'Enable build');
  if (!ok) { await window.pcc.cancelJob(); loadTrust(); return; }
  const appr = await window.pcc.approveJob();
  if (!appr || !appr.ok) { await window.pcc.cancelJob(); loadTrust(); return; }
  await chatCmd('chatsUpdateMeta', { chatId: c.id, fields: { buildChat: true, buildName: name } });
  loadTrust();
  // LIVE status, shown transiently and NEVER persisted: the authority chip is the source of
  // truth. A saved banner would reload as a present-tense "build is on" claim after expiry.
  addBubbleUI('assistant notice', BUILD_ENABLED_NOTICE);
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
    const chatId = activeChat() && activeChat().id; // capture: persist the review to THIS chat
    const assistants = history.filter((m) => m.cls === 'assistant');
    const lastA = assistants.length ? assistants[assistants.length - 1] : null;
    if (!lastA || !(lastA.text || '').trim()) { await appendMessage('assistant error', 'No answer to review yet — ask something first.', chatId); return; }
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
      await appendMessage(res.ok ? 'assistant codex' : 'assistant error', (res.ok ? 'Codex second opinion:\n\n' : '') + (res.text || '(no output)'), chatId);
    } catch (e) {
      thinking.remove();
      await appendMessage('assistant error', 'Second opinion failed: ' + e.message, chatId);
    } finally {
      busy = false; sendBtn.disabled = false;
      if (sendQueue.length) runSend(sendQueue.shift()); // drain anything queued during the review
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
  b.addEventListener('click', async () => {
    if (busy) return;
    const { text, truncated, count } = buildChatTranscript();
    if (!count) { await appendMessage('assistant error', 'Nothing to scan yet - this chat has no messages.'); return; }
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
  // Skip any historically-persisted build-enabled banner (a live-status line mistakenly saved
  // as a message): rendering it reads as a present-tense "build is on" claim even after the
  // session expired. The authority chip is the honest live source of truth.
  c.messages.forEach((m) => { if (m.text === BUILD_ENABLED_NOTICE) return; addBubble(m.cls, m.text, false); });
  scrollDown();
}

// READ-ONLY gather of this project's chats from localStorage — the UNTOUCHED
// legacy snapshot that seeds the one-time migration into the canonical store.
// Includes the formatting-drift self-heal and the pre-multi-project / pre-history
// keys so nothing is missed. NEVER mutates localStorage (the snapshot must be
// untouched, and localStorage is now only a disposable cache).
function captureLegacySnapshot() {
  const parse = (raw) => { try { const v = JSON.parse(raw); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const norm = (p) => String(p || '').toLowerCase().replace(/[\\/]+/g, '/').replace(/\/+$/, '');
  const blank = (arr) => arr.length === 0 || (arr.length === 1 && !arr[0].started && (arr[0].messages || []).length === 0);
  let snap = parse(localStorage.getItem(chatsKey()));
  if (blank(snap)) {                       // formatting-drift self-heal (same project, different path spelling)
    const want = norm(activeProjectPath);
    for (const k of Object.keys(localStorage).filter((k) => k.indexOf(LEGACY_CHATS_KEY + '::') === 0)) {
      const kPath = k.slice((LEGACY_CHATS_KEY + '::').length);
      if (norm(kPath) !== want) continue;  // ONLY a formatting-equivalent path — never another project
      const found = parse(localStorage.getItem(k));
      if (found.length) { snap = found; break; }
    }
  }
  if (blank(snap)) { const g = parse(localStorage.getItem(LEGACY_CHATS_KEY)); if (g.length) snap = g; } // pre-multi-project global
  if (blank(snap)) {                       // pre-history single conversation -> one chat
    const old = parse(localStorage.getItem(OLD_HISTORY_KEY));
    if (old.length) {
      const first = old.find((m) => m.cls === 'user');
      const nm = first ? String(first.text).replace(/\s+/g, ' ').slice(0, 40) : 'Imported chat';
      snap = [{ id: uuid(), name: nm, started: true, messages: old, createdAt: Date.now(), updatedAt: Date.now() }];
    }
  }
  return Array.isArray(snap) ? snap : [];
}

function showChatLoadError(msg) {
  chatLoadError = msg;
  chats = []; activeId = null; history = []; storeRevision = null; storeProjectId = null;
  try { log.innerHTML = ''; } catch (e) { /* ignore */ }
  addBubbleUI('assistant error', msg);
  try { renderChatList(); } catch (e) { /* ignore */ }
}

async function loadChats() {
  chatLoadError = null;
  // 1. Capture the untouched legacy localStorage snapshot (read-only).
  const legacy = captureLegacySnapshot();
  // 2. Bootstrap the canonical store ONCE from the snapshot + on-disk backup. A
  //    conflict/malformation means localStorage and backup disagree or are malformed
  //    — fail visibly rather than guess; both sources are preserved on disk.
  let boot;
  try { boot = await window.pcc.chatsBootstrap(legacy); } catch (e) { boot = { ok: false, error: e.message }; }
  if (!boot || !boot.ok) {
    return showChatLoadError('Your chat history could not be safely migrated (' + ((boot && boot.error) || 'unknown') + '). Nothing was changed and both copies are preserved — please have the owner reconcile before continuing.');
  }
  // 3. Read the canonical store (the authority).
  const r = await refreshCanonical();
  if (!r.ok) return showChatLoadError('Could not load your chats: ' + r.error);
  // 4. Genuinely-empty project: seed a first chat via the command IPC and make it
  //    active. NEVER while in recovery (servedGeneration==='prev'): the current
  //    generation is damaged and the store is read-only, so we must not attempt any
  //    mutation — not even this seed, which would otherwise bypass the chatCmd gate.
  if (servedGeneration !== 'prev' && chats.length === 0 && storeProjectId != null && Number.isInteger(storeRevision)) {
    const nid = uuid();
    const cr = await window.pcc.chatsCreate(storeProjectId, storeRevision, { id: nid, name: 'New chat' });
    if (cr && cr.ok) { await refreshCanonical(); await chatCmd('chatsSetActive', { chatId: nid }); }
  }
  renderActiveChat();
  renderChatList();
}

async function switchChat(id) {
  if (busy || id === activeId) { closeChatsPanel(); return; }
  if (!chats.find((x) => x.id === id)) return;
  const leaving = activeChat();            // name the chat you're done with, from its full arc
  const r = await chatCmd('chatsSetActive', { chatId: id }); // refresh adopts the new active chat
  if (!r.ok) { addBubbleUI('assistant error', 'Could not switch chats: ' + (r.error || 'unknown')); return; }
  renderActiveChat();
  renderChatList();
  loadTrust();
  closeChatsPanel();
  if (leaving && leaving.id !== id) { persistTranscript(leaving); reconsiderChatName(leaving); } // fire-and-forget; switch stays instant
}

async function renameChat(id) {
  const cur = chats.find((x) => x.id === id);
  if (!cur) return;
  const name = await pccPrompt('Rename this chat:', cur.name);
  // A hand-set name LOCKS the title: auto-naming will never overwrite it (prior-art request).
  if (name && name.trim()) {
    await chatCmd('chatsRename', { chatId: id, name: name.trim().slice(0, 60) }); // default lock:true
    renderChatList();
  }
}

async function deleteChat(id) {
  const c = chats.find((x) => x.id === id);
  if (!c) return;
  if (!confirm('Delete "' + c.name + '"? This removes it from the list (Claude may still have the session on disk).')) return;
  try { window.pcc.deleteChatFiles(id); } catch (e) { /* best effort — remove the on-disk record too */ }
  const r = await chatCmd('chatsDelete', { chatId: id });
  if (!r.ok) { addBubbleUI('assistant error', 'Could not delete chat: ' + (r.error || 'unknown')); return; }
  // Keep the UI non-empty: if that was the last chat, seed a fresh one canonically.
  if (chats.length === 0) {
    const nid = uuid();
    if ((await chatCmd('chatsCreate', { id: nid, name: 'New chat' })).ok) await chatCmd('chatsSetActive', { chatId: nid });
  }
  renderActiveChat();
  renderChatList();
  loadTrust();
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
  const panel = document.getElementById('chats-list');
  const btn = document.getElementById('chats-btn');
  if (btn) btn.textContent = 'Chats (' + chats.length + ')';
  if (!panel) return;
  const ordered = chats.slice().sort((a, b) => b.updatedAt - a.updatedAt);
  panel.innerHTML = ordered.map((c) =>
    '<div class="chat-row' + (c.id === activeId ? ' active' : '') + '" data-id="' + c.id + '">'
    + '<div class="chat-row-main" data-act="switch" data-id="' + c.id + '">'
    + '<div class="chat-name">' + escapeHtml(c.name) + '</div>'
    + '<div class="chat-when">' + relTime(c.updatedAt) + '</div></div>'
    + '<button class="chat-mini" data-act="summary" data-id="' + c.id + '" title="High-level summary of this chat">📋</button>'
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
  if (!p.classList.contains('hidden')) { renderChatList(); showChatList(); }
});
document.getElementById('chats-panel').addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const id = el.dataset.id, act = el.dataset.act;
  if (act === 'switch') switchChat(id);
  else if (act === 'summary') showSummary(id);
  else if (act === 'rename') renameChat(id);
  else if (act === 'delete') deleteChat(id);
});
document.addEventListener('click', (e) => {
  const panel = document.getElementById('chats-panel');
  if (!panel || panel.classList.contains('hidden')) return;
  if (e.target.closest('#chats-panel') || e.target.closest('#chats-btn')) return;
  closeChatsPanel();
});

// ---- Search all chats (docs/CHAT_RECALL_SPEC.md): plain-English recall ----
// Not a keyword box. Hands the question to the worker's expand->grep->judge pipeline over the
// LIVE chats (always fresh) and shows the genuine matches, each clickable to open that chat.
let searchSeq = 0; // guards against a slow earlier search overwriting a newer one
function showChatList() {
  document.getElementById('chats-search-results').classList.add('hidden');
  document.getElementById('chats-list').classList.remove('hidden');
}
function setSearchStatus(html, isErr) {
  const box = document.getElementById('chats-search-results');
  document.getElementById('chats-list').classList.add('hidden');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="sr-status' + (isErr ? ' err' : '') + '">' + html + '</div>';
}
function renderSearchResults(query, matches) {
  const box = document.getElementById('chats-search-results');
  const back = '<div class="sr-back" data-act="clear-search">← back to all chats</div>';
  if (!matches.length) {
    box.innerHTML = back + '<div class="sr-status">No chats match “' + escapeHtml(query) + '”.</div>';
    return;
  }
  box.innerHTML = back + '<div class="sr-status">' + matches.length + ' match' + (matches.length > 1 ? 'es' : '')
    + ' for “' + escapeHtml(query) + '”</div>'
    + matches.map((m) => '<div class="sr-hit" data-act="open" data-id="' + escapeHtml(m.chatId) + '">'
      + '<div class="sr-hit-name">' + escapeHtml(m.chatName || 'chat') + '</div>'
      + (m.answer ? '<div class="sr-hit-answer">' + escapeHtml(m.answer) + '</div>' : '')
      + (m.quote ? '<div class="sr-hit-quote">“' + escapeHtml(m.quote) + '”</div>' : '')
      + '</div>').join('');
}
async function runChatSearch() {
  const q = (document.getElementById('chats-search-input').value || '').trim();
  if (!q) { showChatList(); return; }
  const seq = ++searchSeq;
  setSearchStatus('Searching your chats for “' + escapeHtml(q) + '”…');
  try {
    // Pass the live chats (id/name/messages + any cached summary) as the corpus.
    const corpus = chats.map((c) => ({ id: c.id, name: c.name, messages: c.messages, summary: c.summary }));
    const res = await window.pcc.searchChats(q, corpus);
    if (seq !== searchSeq) return; // a newer search superseded this one
    if (res && res.ok) renderSearchResults(q, res.matches || []);
    else setSearchStatus(escapeHtml((res && res.text) || 'Search failed.'), true);
  } catch (e) {
    if (seq === searchSeq) setSearchStatus('Something went wrong searching.', true);
  }
}
{
  const sb = document.getElementById('chats-search-btn');
  const si = document.getElementById('chats-search-input');
  const results = document.getElementById('chats-search-results');
  if (sb) sb.addEventListener('click', runChatSearch);
  if (si) si.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runChatSearch(); } });
  if (si) si.addEventListener('input', () => { if (!si.value.trim()) showChatList(); });
  if (results) results.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'clear-search') { si.value = ''; showChatList(); }
    else if (el.dataset.act === 'open') { switchChat(el.dataset.id); }
  });
}

form.addEventListener('submit', (e) => { e.preventDefault(); const t = input.value; input.value = ''; growComposer(); sendMessage(t); });
// R2 (desktop-parity, ADR-0013): stop the running turn. Disabled immediately on click so a
// slow-to-die process can't be "stopped" twice; chat-scoped so it can never kill a different
// chat's turn than the one actually shown as "Claude is working…". Do NOT re-enable here:
// the button's enabled state means "a turn is running", and runSend owns that (enables at turn
// start, disables in its finally). Re-enabling in this handler would briefly show Stop as active
// with no turn once the kill lands (Codex-caught). The killed turn ends -> runSend's finally
// leaves Stop disabled, which is correct.
if (stopBtn) stopBtn.addEventListener('click', async () => {
  if (!inFlightChatId || stopBtn.disabled) return;
  stopBtn.disabled = true; // prevent a double-stop; runSend's lifecycle owns re-enabling
  try { await window.pcc.stopWorker(inFlightChatId); } catch (e) { /* the close handler still resolves the turn either way */ }
});
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

// Composer sizing (owner ask 2026-07-20). The chat box was a single fixed line —
// painful for pasting. Now it defaults to ~3 lines, auto-grows with content up to a
// cap, and the owner can drag it taller via the resize grip; the dragged height is
// remembered across sessions (localStorage) and used as the floor, so clearing the
// text never shrinks a box the owner deliberately enlarged.
const COMPOSER_H_KEY = 'pcc.composer.height';
const COMPOSER_MIN = 66; // ~3 lines
let composerFloor = COMPOSER_MIN;
function composerCap() { return Math.max(Math.round(window.innerHeight * 0.45), composerFloor); }
function growComposer() {
  input.style.height = 'auto';
  input.style.height = Math.min(Math.max(input.scrollHeight, composerFloor), composerCap()) + 'px';
}
(function initComposerHeight() {
  const saved = parseInt(localStorage.getItem(COMPOSER_H_KEY), 10);
  if (saved && saved >= COMPOSER_MIN) composerFloor = saved;
  growComposer();
})();
input.addEventListener('input', growComposer);
// A manual drag of the resize grip ends with mouseup on the textarea; persist that
// height as the new floor so it sticks across turns and restarts.
input.addEventListener('mouseup', () => {
  const h = input.offsetHeight;
  if (Math.abs(h - composerFloor) > 2) { composerFloor = h; localStorage.setItem(COMPOSER_H_KEY, String(h)); }
});

// Handoff packet (docs/specs/conversation-handoff-packet.md). Select a slice of the
// conversation and copy a self-contained packet — source boundaries (chat id, repo SHA,
// time) + the selected messages by role + a PROOF footer — so handing a slice to another
// agent never needs hand-editing. Renderer-only; no worker, nothing sent anywhere.
const HANDOFF_PROOF = [
  '--- PROOF REQUIRED (do not skip) ---',
  'Before claiming anything is done, run the exact command below and paste its FULL',
  'output here, then STOP. Do not summarize; do not claim success without the output.',
  '',
  '    <put the exact command here>',
].join('\n');

function handoffFlash(btn, label) {
  if (!btn) return;
  btn.textContent = label;
  clearTimeout(btn._hoTimer);
  btn._hoTimer = setTimeout(() => { btn.textContent = 'Handoff packet'; }, 1800);
}

// The messages whose bubbles the current text selection touches, in transcript order,
// labelled by role. Ephemeral "thinking" bubbles and non-role notices are skipped.
function collectSelectedMessages() {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return [];
  const out = [];
  log.querySelectorAll('.bubble').forEach((b) => {
    if (!sel.containsNode(b, true)) return;
    const cls = b.className;
    if (cls.indexOf('thinking') !== -1) return;
    let role = null;
    if (cls.indexOf('user') !== -1) role = 'You';
    else if (cls.indexOf('codex') !== -1) role = 'Codex';
    else if (cls.indexOf('assistant') !== -1) role = 'Claude';
    if (!role) return;
    out.push({ role, text: b.dataset.raw != null ? b.dataset.raw : b.textContent });
  });
  return out;
}

function formatHandoffPacket(items, meta) {
  const header = [
    '=== PCC handoff packet ===',
    'Chat: ' + (meta.chatName || 'untitled') + '  (id ' + (meta.chatId || 'unknown') + ')',
    'Repo: ' + meta.sha + (meta.dirty ? '  (working tree DIRTY — uncommitted changes)' : ''),
    'Generated: ' + new Date().toISOString(),
    '==========================',
  ].join('\n');
  const body = items.map((m) => m.role + ':\n' + m.text).join('\n\n');
  return header + '\n\n' + body + '\n\n' + HANDOFF_PROOF + '\n';
}

async function copyHandoffPacket(preselected) {
  const btn = document.getElementById('handoff-packet-btn');
  // Prefer the snapshot taken on mousedown (before the click collapses the selection);
  // fall back to the live selection for non-mouse activation.
  const items = (preselected && preselected.length) ? preselected : collectSelectedMessages();
  if (!items.length) { handoffFlash(btn, 'Select text first'); return; }
  // Real repo SHA at generation time, so the receiving agent knows the source state.
  let sha = 'unknown', dirty = false;
  try { const rh = await window.pcc.repoHead(); if (rh && rh.ok && rh.sha) { sha = rh.sha; dirty = !!rh.dirty; } }
  catch (e) { /* SHA stays 'unknown' — never block the copy on a git hiccup */ }
  const chat = activeChat();
  const packet = formatHandoffPacket(items, { chatName: chat && chat.name, chatId: chat && chat.id, sha, dirty });
  // Native clipboard via IPC — focus-independent, unlike navigator.clipboard.
  try { const r = await window.pcc.copyText(packet); handoffFlash(btn, r && r.ok ? 'Copied ✓' : 'Copy failed'); }
  catch (e) { handoffFlash(btn, 'Copy failed'); }
}

const handoffBtn = document.getElementById('handoff-packet-btn');
if (handoffBtn) {
  // mousedown fires before the click collapses the selection: preventDefault keeps focus
  // off the button, and we snapshot the selected messages right then so the async click
  // handler works from a stable copy.
  handoffBtn.addEventListener('mousedown', (e) => { e.preventDefault(); handoffBtn._sel = collectSelectedMessages(); });
  handoffBtn.addEventListener('click', () => { const s = handoffBtn._sel; handoffBtn._sel = null; copyHandoffPacket(s); });
}

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
const ROLLOVER_TURNS = PCCChatHealth.ROLLOVER_TURNS;   // soft notice past this many of your messages
const ROLLOVER_HOURS = PCCChatHealth.ROLLOVER_HOURS;   // soft notice past this long on one chat

// ADR-0019: the latest REAL context-token reading per chat (from res.contextTokens). Persisted to
// localStorage so a restart cannot falsely drop the meter to green (AC-12, cache tier — same tier as
// the chat-history mirror). Never fabricated: only finite, non-negative readings are stored.
const CTX_LS_KEY = 'pcc.chatContextTokens';
const chatContextTokens = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(CTX_LS_KEY) || '{}');
    return new Map(Object.entries(o).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0));
  } catch (e) { return new Map(); }
})();
function recordContextTokens(chatId, tokens) {
  if (!chatId || typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0) return;
  chatContextTokens.set(chatId, tokens);
  try { localStorage.setItem(CTX_LS_KEY, JSON.stringify(Object.fromEntries(chatContextTokens))); } catch (e) { /* cache best-effort */ }
}

// ADR-0019 (growth revision, 2026-07-21): each chat's FIRST measured turn = its fixed baseline (the
// large per-turn overhead Claude Code re-sends unchanged: system prompt + tool defs + CLAUDE.md/
// AGENTS.md). The chat-health meter tracks growth PAST this baseline, so a fresh chat reads ~0% and
// the auto-rollover can't loop. First reading wins and is frozen; persisted (same cache tier as the
// token map) so a restart keeps a chat's baseline instead of re-baselining higher and reading falsely low.
const CTX_BASE_LS_KEY = 'pcc.chatContextBaseline';
const chatContextBaseline = (() => {
  try {
    const o = JSON.parse(localStorage.getItem(CTX_BASE_LS_KEY) || '{}');
    return new Map(Object.entries(o).filter(([, v]) => typeof v === 'number' && Number.isFinite(v) && v >= 0));
  } catch (e) { return new Map(); }
})();
function recordContextBaseline(chatId, tokens) {
  if (!chatId || typeof tokens !== 'number' || !Number.isFinite(tokens) || tokens < 0) return;
  if (chatContextBaseline.has(chatId)) return; // first reading wins — the baseline is frozen for this chat
  chatContextBaseline.set(chatId, tokens);
  try { localStorage.setItem(CTX_BASE_LS_KEY, JSON.stringify(Object.fromEntries(chatContextBaseline))); } catch (e) { /* cache best-effort */ }
}

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

  // ADR-0019: REAL context size for THIS chat's latest turn, metered against the model's (estimated)
  // window with a general, plan-safe rollover threshold (absolute floor OR % of window — computed in
  // chat-health.js from the CURRENT model). The gauge reads "how close to rollover", so it hits 100%
  // exactly when protection fires, not a calm-looking % of a huge window.
  const ctxTokens = activeId ? chatContextTokens.get(activeId) : null;
  const ctxBaseline = activeId ? chatContextBaseline.get(activeId) : null;
  const g = PCCChatHealth.computeGauge({
    turns, spanHours,
    contextTokens: (typeof ctxTokens === 'number' ? ctxTokens : null),
    baselineTokens: (typeof ctxBaseline === 'number' ? ctxBaseline : null),
    model: getSelectedModel(),
  });

  // AC-5: the reading is STALE if the latest turn reported no tokens (e.g. an attachment turn) after
  // a prior measured reading — the real context has likely grown past what we last saw. Disclosed,
  // never silently shown as current.
  const contextStale = activeId ? staleContextChats.has(activeId) : false;

  const notice = (turns >= ROLLOVER_TURNS) || (repeats.length > 0) || (spanHours !== null && spanHours >= ROLLOVER_HOURS) || g.overRollover;

  const kTok = (n) => Math.round(n / 1000) + 'K';
  let observed = turns + ' message(s) sent in this chat';
  if (spanHours !== null) observed += ', spanning ~' + (spanHours < 1 ? '<1' : spanHours.toFixed(1)) + ' hour(s)';
  // GROWTH, not raw size: report how much the conversation has added past its fixed first-turn baseline.
  if (g.contextMeasured) observed += ', conversation grown ~' + kTok(g.growthTokens) + ' tokens past its ~' + kTok(g.baselineTokens || 0) + ' startup baseline' + (contextStale ? ' as of an earlier turn' : '');
  observed += '.';
  if (repeats.length) observed += ' ' + repeats.length + ' message(s) were sent more than once.';

  // Hover breakdown (AC-4): plain-language "how this number is calculated" + which input drives it.
  const staleNote = (g.contextMeasured && contextStale) ? ' — from an earlier turn (the last turn reported no tokens, so real growth may be higher)' : '';
  // Secondary "approaching the hard wall" detail — kept, but honest that the window is an estimate and
  // may be too small (raw total already over it => the real window is larger).
  const wallNote = g.contextMeasured
    ? (g.overWindowEstimate
      ? ' Raw total ~' + kTok(g.contextTokens) + ' tokens already exceeds PCC’s conservative ~' + kTok(g.windowTokens) + ' window estimate, so your plan’s real window is larger — growth (above) is what the meter tracks, and it doesn’t depend on the window.'
      : ' Raw total ~' + kTok(g.contextTokens) + ' tokens is ~' + Math.round(g.pctOfWindow * 100) + '% of the estimated ~' + kTok(g.windowTokens) + ' window.')
    : '';
  const ctxLine = g.contextMeasured
    ? ('Conversation growth: ~' + kTok(g.growthTokens) + ' / ~' + kTok(g.rolloverTokens) + ' tokens before this warns (measured past this chat’s fixed startup baseline, so the constant per-turn overhead never counts as chat length)' + staleNote)
    : 'Conversation growth: not measured yet this session — shown when available, never guessed';
  const hover = 'Chat health = the highest (worst) of these three, so nothing hides a problem:\n'
    + '• Messages: ' + turns + ' / ' + ROLLOVER_TURNS + '\n'
    + '• Time: ' + (spanHours !== null ? (spanHours < 1 ? '<1' : spanHours.toFixed(1)) : '—') + ' / ' + ROLLOVER_HOURS + ' hr\n'
    + '• ' + ctxLine + '\n'
    + 'Now driven by: ' + g.driver + '. This WARNS (it never switches chats on you) once the conversation GROWS ~' + kTok(g.rolloverTokens) + ' tokens past its startup baseline (whichever comes first: a usage-burn floor, or 75% of the estimated window).' + wallNote + ' Your plan-usage limit is the separate "Usage" chip up top.';

  return {
    detector: 'chat-rollover',
    signal: notice ? 'notice' : 'clear',
    checked_at: new Date().toISOString(),
    gauge: { value: g.gaugePct, label: 'Chat length', hover },
    items: repeatItems,
    observed,
    might_mean: notice
      ? 'This chat is getting heavy (by messages, time, or real conversation growth). Long chats drift, lose the earlier thread, and burn your Claude usage faster. This is a WARNING only — PCC will NOT switch chats on you. When you are ready, start a fresh chat to keep things light; your current chat stays right here.'
      : 'This chat is still comfortably within limits on messages, time, and conversation growth — nothing to do.',
    not_proven: g.contextMeasured
      ? 'The token counts are REAL (each turn’s actual prompt tokens). The gauge tracks GROWTH past this chat’s first measured turn (its fixed startup overhead — system prompt + tools + rules — which is re-sent every turn and is NOT chat length), so a fresh chat starts near 0 and only real back-and-forth moves it. The rollover threshold’s WINDOW half is ESTIMATED — headless Claude doesn’t report the window and it depends on your model + plan; PCC assumes the smaller one unless a bigger plan is confirmed (that only rolls over sooner, never later). Readings are taken at each turn’s END, so one very large turn can overshoot before it registers (Stop and the per-turn cap are the backstops). Attachment-only turns are not yet token-measured. Pre-update messages have no timestamp, so the time span may undercount.'
      : 'Conversation growth is not yet measured for this chat this session (an attachment-only turn, or no completed text turn), so this gauge currently reflects messages/time only — it is honest about that rather than showing a fake reading. Pre-update messages have no timestamp, so the time span may undercount.',
    what_to_do: notice
      ? 'Nothing is forced on you. When this chat feels heavy, hit “New chat” to start fresh — PCC will never switch on its own.'
      : 'Nothing needed.',
  };
}

// Reusable gauge (roadmap #23). A semicircle "speedometer/tank" for a single,
// bounded metric approaching a limit (chat length, bloat). Color reinforces but
// never carries meaning alone: the fill LEVEL and the numeric readout convey the
// value even without color (WCAG + colorblind-safe). Zones: green under 60%,
// amber 60-85%, red 85%+. pathLength=100 lets the fill be a simple percentage.
function zoneForPct(p) { return p < 60 ? 'success' : (p < 85 ? 'warning' : 'danger'); }
function gaugeSVG(pct, label, hover) {
  const p = Math.max(0, Math.min(100, Math.round(pct)));
  const arc = 'M 12 60 A 40 40 0 0 1 108 60';
  const titleAttr = hover ? ' title="' + escapeHtml(hover) + '"' : ''; // ADR-0019 AC-4: explain the number on hover
  return '<div class="gauge-wrap" role="img"' + titleAttr + ' aria-label="' + escapeHtml(label + ': ' + p + ' percent') + '">'
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
  if (d.gauge) html += gaugeSVG(d.gauge.value, d.gauge.label || '', d.gauge.hover);
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

// Governor "Surface" (ADR-0006): the current change's stakes tier, shown live and never
// blocking. Rendering only — the RULES live in the unit-tested view-model
// (PCCStakes.stakesView). Tier color communicates WEIGHT (how much proof a change deserves),
// not alarm. Escalations and touched files are shown so the tier is never a bare verdict.
function stakesCard(view) {
  const zone = view.zone || 'unknown';
  const card = document.createElement('div');
  card.className = 'signal-card ' + zone;
  const badge = view.state === 'classified' ? view.tier
    : view.state === 'empty' ? 'none'
    : view.state === 'unknown' ? 'UNKNOWN' : 'error';
  let html = '<div class="signal-head"><span class="signal-title">Change stakes (governor)</span>'
    + '<span class="signal-badge ' + zone + '">' + escapeHtml(badge) + '</span></div>';
  if (view.state === 'classified') {
    html += '<div class="signal-row"><span class="k">Tier</span>' + escapeHtml(view.tier + ' — ' + view.tierName) + '</div>';
    html += '<div class="signal-row"><span class="k">Recommended proof</span>' + escapeHtml(view.proof) + '</div>';
    if (view.reasons.length) {
      html += '<div class="signal-row"><span class="k">Why this tier</span></div><ul class="signal-items">'
        + view.reasons.map((r) => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>';
    }
    if (view.escalations.length) {
      html += '<div class="signal-row"><span class="k">Escalations</span></div><ul class="signal-items">'
        + view.escalations.map((e) => '<li>' + escapeHtml(e.id + '  →  ≥ ' + e.min_tier) + '</li>').join('') + '</ul>';
    }
    const shown = view.files.slice(0, 20);
    html += '<div class="signal-row"><span class="k">Files (' + view.fileCount + ')</span></div><ul class="signal-items">'
      + shown.map((f) => '<li>' + escapeHtml((f.tier || '?') + '   ' + f.path) + '</li>').join('')
      + (view.fileCount > shown.length ? '<li>… +' + (view.fileCount - shown.length) + ' more</li>' : '') + '</ul>';
  } else {
    html += '<div class="signal-row"><span class="k">' + (view.state === 'empty' ? 'Status' : 'Observed') + '</span>'
      + escapeHtml(view.detail || view.headline) + '</div>';
    if (view.state !== 'empty' && view.reasons && view.reasons.length) {
      html += '<ul class="signal-items">' + view.reasons.map((r) => '<li>' + escapeHtml(r) + '</li>').join('') + '</ul>';
    }
    if (view.proof) html += '<div class="signal-row"><span class="k">Recommended proof</span>' + escapeHtml(view.proof) + '</div>';
  }
  html += '<div class="signal-row"><span class="k">What is NOT proven</span>' + escapeHtml(view.notProven || '—') + '</div>';
  html += '<div class="signal-row"><span class="k">Does this block?</span>No — this is advisory. The commit gate is a later slice.</div>';
  card.innerHTML = html;
  return card;
}

async function loadSignals() {
  const list = document.getElementById('signals-list');
  const status = document.getElementById('signals-status');
  status.innerHTML = '<span class="spinner"></span>Checking…';
  list.innerHTML = '';
  // Kick BOTH the governor stakes verdict and the detectors off CONCURRENTLY, so a slow (or
  // hung-to-its-timeout) classifier can never serialize in front of — and delay — the existing
  // detector signals. The stakes surface is strictly additive and non-blocking.
  const stakesP = window.pcc.stakes().then(
    (r) => PCCStakes.stakesView(r),
    () => PCCStakes.stakesView(null), // fail closed to UNKNOWN, never suppress the detectors
  );
  const detP = window.pcc.detections().then((r) => ({ det: r }), (e) => ({ err: e }));

  // Render the detectors as soon as THEY resolve — as one batch, independent of stakes (so
  // "first card visible" implies the whole detector set is present, no partial-render race).
  const d = await detP;
  if (d.err) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = 'Could not run signals: ' + d.err.message;
    list.appendChild(p);
  } else {
    const cards = Object.values(d.det || {});
    cards.push(computeSycophancySignal()); // app-side: never-says-no nudge
    cards.push(computeChatSignal()); // app-side signal from this chat's own history
    cards.forEach((c) => list.appendChild(signalCard(c)));
  }
  status.textContent = '';

  // The governor stakes card goes at the TOP once it resolves; because the detectors are
  // already rendered above, it can never hold them up — it just fills in when ready.
  const view = await stakesP;
  list.insertBefore(stakesCard(view), list.firstChild);
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

// Build-session countdown (DECISION-112 refinement). The authority badge shows the LIVE
// time left in an approved build session so it never expires silently. See docs/adr/0010.
let authorityCountdownTimer = null;
function stopAuthorityCountdown() {
  if (authorityCountdownTimer) { clearInterval(authorityCountdownTimer); authorityCountdownTimer = null; }
}
// Human-friendly remaining time: coarse when there's lots left, second-by-second near the end.
function fmtRemaining(ms) {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (m >= 60) return Math.floor(m / 60) + 'h ' + (m % 60) + 'm';
  if (m >= 10) return m + 'm';
  return m + 'm ' + String(sec).padStart(2, '0') + 's';
}
// Tick a live countdown for an authorized session. While a worker turn is in flight (busy)
// we heartbeat touchActivity so the idle window keeps sliding — the session then really ends
// at the fixed 2h hard cap, so the countdown tracks that; otherwise it tracks the sooner of
// idle/hard. At zero we stop and re-derive the badge (buttons + read-only styling) rather than
// letting command access vanish with no signal.
function startAuthorityCountdown(idleAt, hardAt, jobName, chatId) {
  stopAuthorityCountdown();
  let hb = 0;
  const tick = () => {
    const now = Date.now();
    if (busy && chatId && (hb % 15 === 0)) { try { window.pcc.touchActivity(chatId); } catch (e) { /* best effort */ } }
    hb++;
    const expiresAt = Math.min(busy ? Infinity : idleAt, hardAt); // idle is kept alive during active work
    const remaining = expiresAt - now;
    if (remaining <= 0) {
      stopAuthorityCountdown();
      setChip('trust-authority', 'bad', 'Build session expired — re-enable to continue',
        'Your bounded build session hit its limit. Re-enable it to run commands again; reading and planning still work.');
      loadAuthorityBadge();
      return;
    }
    const low = remaining <= 5 * 60 * 1000;
    let label = 'Build session — ' + fmtRemaining(remaining) + ' left';
    if (jobName) label += ' · ' + jobName;
    setChip('trust-authority', low ? 'bad' : 'warn', label,
      'Time left in this bounded build session — the sooner of a 30-min idle window and a fixed 2-hour hard cap. It renews while the worker is actively working; the 2-hour ceiling never extends.');
  };
  tick();
  authorityCountdownTimer = setInterval(tick, 1000);
}

// Authority badge (DECISION-112): show the main-process authority state in the chat
// header. Read-only source of truth — the renderer only displays it, never sets it.
// When authorized, drives a live countdown (startAuthorityCountdown renders the chip);
// otherwise renders the static label. Falls back to the safe read_only label on error.
async function loadAuthorityBadge() {
  const clsFor = { read_only: 'readonly', approval_needed: 'warn', authorized_running: 'warn', completed_needs_review: 'good', blocked: 'bad' };
  let s = null;
  const activeForBadge = activeChat();
  try { s = await window.pcc.authorityState(activeForBadge && activeForBadge.id); } catch (e) { /* keep the safe default */ }
  const mode = (s && s.mode) || 'read_only';
  const endBtn = document.getElementById('authority-end');
  if (endBtn) endBtn.classList.toggle('hidden', mode !== 'authorized_running');
  // Offer "Resume build session" when the active chat is a New Project build chat but the
  // app is NOT currently in an authorized build (dropped to read-only after a restart or
  // expiry). This is the escape hatch from a stranded, un-writable New Project chat.
  const resumeBtn = document.getElementById('authority-resume');
  if (resumeBtn) resumeBtn.classList.toggle('hidden', mode === 'authorized_running' || !activeChat());
  // Authorized with real deadlines: hand off to the live countdown (it sets the chip + ticks).
  if (mode === 'authorized_running' && s && Number.isFinite(s.idleExpiresAt) && Number.isFinite(s.hardExpiresAt)) {
    startAuthorityCountdown(s.idleExpiresAt, s.hardExpiresAt, s.job && s.job.name, activeForBadge && activeForBadge.id);
    return;
  }
  // Not authorized (or no deadlines): stop any countdown and show the static label.
  stopAuthorityCountdown();
  const label = (s && s.label) || 'Read-only — safe to paste context';
  setChip('trust-authority', clsFor[mode] || 'readonly', label,
    'PCC chat authority. Read-only means it can read, explain, and plan — it cannot run commands, change files, or launch anything. Reading context is never authorization to act.');
}

// Owner's real Claude usage stat (desktop-parity R1). Compact, single-number chip mirroring the
// SAME measure as the Claude desktop app's own "Plan usage limits" panel — no token math, no
// jargon. `stale` (the local cache hasn't refreshed recently) always shows as 'unknown' rather
// than a reassuring color, because a color we can't currently vouch for is worse than none.
function usageSeverity(pct) { return pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : 'good'; }
function fmtAge(ms) {
  const min = Math.round(ms / 60000);
  return min < 1 ? 'just now' : min === 1 ? '1 minute ago' : min + ' minutes ago';
}
function setUsageMeter(cls, fillPct, pctText, subText, title) {
  const m = document.getElementById('usage-meter');
  const fill = document.getElementById('um-fill');
  const pct = document.getElementById('um-pct');
  const sub = document.getElementById('um-sub');
  if (!m || !fill || !pct) return;
  m.className = cls;
  fill.style.width = Math.max(0, Math.min(100, fillPct)) + '%';
  pct.textContent = pctText;
  if (sub) sub.textContent = subText || '';
  m.title = title || '';
}
// Plain-language, self-explaining copy for the truly-unreadable state — so a future break (e.g. a
// Claude desktop-app update moving/renaming its internal usage file) reads as an understandable
// message, not a mysterious blank. Always makes clear PCC never shows a guessed number.
function usageUnavailableCopy(reason) {
  switch (reason) {
    case 'no_file':
      return { sub: 'source not found', title: 'PCC can’t find Claude’s usage data. A Claude desktop-app update most likely moved or renamed it — or the Claude app hasn’t run yet. PCC never shows a guessed number.' };
    case 'malformed':
      return { sub: 'unreadable format', title: 'Claude’s usage data is in a format PCC doesn’t recognize — most likely changed by a Claude app update. PCC never shows a guessed number.' };
    case 'empty':
      return { sub: 'no readings yet', title: 'Claude’s usage data has no readings yet (the Claude app may have just started). PCC never shows a guessed number.' };
    default:
      return { sub: 'not readable', title: 'Your real Claude usage isn’t readable right now' + (reason ? ' (' + reason + ')' : '') + '. PCC never shows a guessed number.' };
  }
}
async function loadUsage() {
  let u = null;
  try { u = await window.pcc.usage(); } catch (e) { /* leave unknown */ }
  if (!u || !u.available) {
    const c = usageUnavailableCopy(u && u.reason);
    setUsageMeter('unavailable', 0, 'unknown', c.sub, c.title);
    return;
  }
  const ageTxt = fmtAge(u.ageMs);
  if (u.stale) {
    setUsageMeter('unknown', u.sessionPercent, '~' + u.sessionPercent + '%', 'stale · ' + ageTxt,
      'Last known reading, ' + ageTxt + ' — too old to trust as current. Weekly: ' + u.weeklyPercent + '%.');
    return;
  }
  setUsageMeter(usageSeverity(u.sessionPercent), u.sessionPercent, u.sessionPercent + '%', 'of 5-hr limit · wk ' + u.weeklyPercent + '%',
    'Current session: ' + u.sessionPercent + '% of your 5-hour usage limit · Weekly: ' + u.weeklyPercent + '% · as of ' +
    ageTxt + '. Source: the same local usage data the Claude desktop app’s Plan-usage panel reads.');
}

async function loadTrust() {
  loadAuthorityBadge();
  loadUsage();
  let d = null, x = null, ci = null;
  try { d = await window.pcc.detections(); } catch (e) { /* leave unknown */ }
  try { x = await window.pcc.trustExtras(); } catch (e) { /* leave unknown */ }
  try { ci = await window.pcc.ciStatus(); } catch (e) { /* leave unknown — falls back to local status */ }

  // On the rails: no drift, no stale docs.
  const rails = railsFrom(d);
  setChip('trust-rails',
    rails === 'good' ? 'good' : rails === 'warn' ? 'warn' : 'unknown',
    'On the rails',
    rails === 'good' ? 'No drift and no stale docs detected.'
      : rails === 'warn' ? 'A drift or stale-docs signal is raised — see the Signals tab.'
      : 'Could not read the drift/stale-docs signals.');

  // Backup tier (owner policy 2026-07-09): label + color come from the repo-sync detector,
  // which distinguishes "Local checkpointed" (local-only by decision, clean) from "Backed up"
  // (remote, pushed), "Committed, not pushed", "Uncheckpointed", and "No backup tier set".
  // A clean local-only project is GOOD, not amber — no nagging for a chosen tier.
  const repo = d && d.repoSync;
  const rs = repo && repo.signal;
  setChip('trust-backup',
    rs === 'clear' ? 'good' : rs === 'notice' ? 'warn' : 'unknown',
    (repo && repo.chip_label) || 'Backup',
    (repo && repo.observed) || 'Could not read the repo-sync signal.');

  // Verified: honest freshness against HEAD AND honest about the KIND of proof
  // (DECISION-105 proof taxonomy). A code review that ran nothing must never wear
  // the same green as a real execution — otherwise PCC recreates fake-green with
  // nicer wording. Executed proof (ci_execution / live_boundary / local_execution)
  // earns green; a fresh review_only PASS is amber "Reviewed, not run". Uses the ONE
  // shared isExecutedType so this can never diverge from the Overview again.
  // Live CI is the STRONGEST, un-forgeable proof: a real clean-room run of the CURRENT commit
  // (the API is queried by HEAD sha, so a pass is inherently fresh). It can't be faked by editing a
  // local file, so when CI is definitive it takes precedence over the local record. When CI is
  // unavailable (no remote / local-only / offline / private / rate-limited / test mode) or still
  // running, we fall straight through to the existing local-record logic — unchanged.
  const v = x && x.verification;
  // Origin seam: a hand-editable record can only be TRUSTED to claim local_execution. Clean-room/CI
  // proof (green) comes from the LIVE CI check above (ci.state), never from a file's TYPE: line — so
  // a forged "TYPE: ci_execution" can no longer light this chip green.
  const executed = v && PCCVerification.isTrustedLocalProof(v.type);
  if (ci && ci.available && ci.state === 'passed' && x && x.gitKnown && !x.dirty) {
    setChip('trust-verified', 'good', 'Verified (ran in CI)',
      'The full test suite ran and passed in CI for the current commit — clean-room execution proof, not just a code read.');
  } else if (ci && ci.available && ci.state === 'passed') {
    // CI passed the committed HEAD, but the working tree has uncommitted changes CI
    // never saw (or git state is unknown) — do NOT paint that as fully verified.
    setChip('trust-verified', 'warn', 'CI passed — uncommitted changes',
      'CI ran and passed the latest COMMIT, but there are uncommitted local changes it did not see (or git state could not be read). Commit and push to get them covered.');
  } else if (ci && ci.available && ci.state === 'failed') {
    setChip('trust-verified', 'bad', 'CI failing',
      'CI ran the current commit and it did NOT pass. Do not trust this state until CI is green again.');
  } else if (!x) {
    setChip('trust-verified', 'unknown', 'Verified', 'Could not read verification status.');
  } else if (!v || !v.present) {
    setChip('trust-verified', 'warn', 'Not verified yet', 'No independent verification recorded for the current work yet.');
  } else if (v.verdict === 'PASS' && v.matchesCurrent && executed) {
    // local_execution is real execution but on THIS machine — label it honestly, never
    // as a clean-room CI run.
    // Only local_execution reaches here now (isTrustedLocalProof), so this is always the app's own
    // local run — labeled honestly as local, never as a clean-room CI run (that green comes from CI above).
    setChip('trust-verified', 'good', 'Verified (ran locally)',
      'The product’s own checks ran and passed on THIS machine (local execution) — real execution, but not a clean-room CI run. Clean-room proof shows as “Verified (ran in CI)”.');
  } else if (v.verdict === 'PASS' && v.matchesCurrent) {
    setChip('trust-verified', 'warn', 'Reviewed, not run', 'A reviewer read the code and found no problems, but nothing was executed — that is not proof it runs. Execution proof comes from CI/tests.');
  } else if (v.verdict === 'PASS') {
    setChip('trust-verified', 'warn', 'Verified (stale)', 'Last verdict was PASS but it does not match the current code — a newer commit or uncommitted changes since the check. Re-verify.');
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
    + gaugeSVG(withGauge.gauge.value, withGauge.gauge.label || '', withGauge.gauge.hover) + '</div>';

  const chatSignal = signals.find((s) => s && s.detector === 'chat-rollover');
  const tiles = signals.map((s) => {
    const sig = (s && s.signal) || 'unknown';
    const cls = (sig === 'clear' || sig === 'notice') ? sig : 'unknown';
    const label = (s && s.chip_label) || CH_LABELS[s && s.detector] || (s && s.detector) || 'Signal';
    return '<span class="ch-tile ' + cls + '" data-open="1">'
      + '<span class="ch-dot"></span>' + escapeHtml(label)
      + '<span class="ch-status">' + escapeHtml(sig) + '</span></span>';
  }).join('');

  const actionHtml = chatSignal
    ? '<button class="ch-action ' + (chatSignal.signal === 'notice' ? 'notice' : 'clear') + '" id="continue-fresh-chat" type="button" title="Owner-controlled: open a fresh chat with your context carried forward into the composer. Nothing is sent to Claude until you press Send.">Continue in fresh chat</button>'
    : '';
  el.innerHTML = gaugeHtml + '<div class="ch-tiles">' + tiles + '</div>' + actionHtml;
  el.querySelectorAll('[data-open], .ch-gauge').forEach((t) => t.addEventListener('click', openSignals));
  const cont = document.getElementById('continue-fresh-chat');
  if (cont) cont.addEventListener('click', (e) => { e.stopPropagation(); continueInFreshChat(); });
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
      const label = (s && s.chip_label) || CH_LABELS[s && s.detector] || (s && s.detector) || 'Signal';
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
  const [lc, det, x, sync, state, vp, ci] = await Promise.all([
    window.pcc.lifecycle().catch(() => null),
    window.pcc.detections().catch(() => null),
    window.pcc.trustExtras().catch(() => null),
    window.pcc.syncStatus().catch(() => null),
    window.pcc.getState().catch(() => null),
    window.pcc.visionPromises().catch(() => null),
    window.pcc.ciStatus().catch(() => null), // live CI = clean-room execution proof (same source as the trust strip)
  ]);
  const data = { lc, det, x, sync, state, vp, ci };

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
    + '<div class="ov-card-sub">CI: runs on GitHub every push; the live pass/fail for the current commit is surfaced in the "Verified" chip at the top of the window (green only on a real CI pass, never a stale or forged one).</div>'
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
        const fresh = !!v.matchesCurrent; // commit-bound: VERIFIED_SHA == HEAD and clean tree (parity with the trust strip)
        // Origin seam: only a locally-run proof is trusted as "executed" from this record; a forged
        // ci_execution/live_boundary claim no longer reads as executed here (CI proof lives on the trust light).
        const executed = PCCVerification.isTrustedLocalProof(v.type);
        if (!fresh) verified = 'PASS (stale — code changed since)';
        else if (executed) verified = 'PASS (ran locally — matches current code)';
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
  // Fail closed: git could not read the tree -> backup state is UNKNOWN. Never fall
  // through to "everything is backed up" over a state git never read (CRIT-2).
  if (!s || s._error) {
    statusEl.className = 'sync-status warn';
    statusEl.textContent = 'Could not read git status — backup state unknown. Check that git is available in this project.';
    return;
  }
  let cls = 'good', msg;
  if (s.clean && s.behind === 0) {
    // Honest per backup tier (owner policy): only a pushed remote is "backed up off-machine".
    // A clean local-only repo is a saved checkpoint, NOT off-machine backup — never claim it is.
    if (s.hasUpstream) {
      msg = 'On ' + s.branch + ' — everything is backed up.';
    } else if (s.mode === 'local-only') {
      msg = 'On ' + s.branch + ' — local checkpoint saved (local-only by decision; not backed up off-machine).';
    } else if (s.mode === 'remote-backed') {
      msg = 'On ' + s.branch + ' — committed locally, but no remote is configured despite the remote-backed setting.'; cls = 'warn';
    } else {
      msg = 'On ' + s.branch + ' — local checkpoint saved; no remote or backup tier set yet.'; cls = 'warn';
    }
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

// First-run / no-project empty state. A packaged install has no HOME project, so on first launch
// getActiveProject() returns a clean {path:null}. Rather than load project panes against nothing (and
// throw on the chat path), we show a "create or open your first project" surface. Both actions end in
// location.reload() once a project is active (cfSave / openExistingProject already reload), so the next
// boot() runs the normal flow. NOT reached in dev, where HOME_DIR is a valid project.
function showNoProjectState() {
  const el = document.getElementById('no-project');
  const err = document.getElementById('np-err');
  const showErr = (m) => { if (err) err.textContent = m || ''; };
  const nn = document.getElementById('np-new');
  const no = document.getElementById('np-open');
  // Both actions must report failures into #np-err. Reusing openExistingProject()/cfOpen()'s own error
  // surfaces would be INVISIBLE here — showProjError writes to the hidden #proj-panel, and cfOpen's start
  // failure writes a chat bubble UNDER this overlay. So: cfOpen returns false on a start failure (shown
  // here), and open-existing is run inline with every non-throw failure surfaced into #np-err.
  if (nn) nn.onclick = async () => {
    showErr('');
    try { const ok = await cfOpen(); if (!ok) showErr('Could not start a new project.'); }
    catch (e) { showErr('Could not start a new project.'); }
  };
  if (no) no.onclick = async () => {
    showErr('');
    try {
      const pick = await window.pcc.pickFolder();
      if (!pick || !pick.path) return;                       // user cancelled the picker
      const add = await window.pcc.addProject(pick.path);
      if (!add || !add.ok) { showErr((add && add.error) || 'That folder is not a PCC project.'); return; }
      const sw = await window.pcc.setActiveProject(pick.path);
      if (sw && sw.ok) location.reload();                    // re-boot into the now-active project
      else showErr((sw && sw.error) || 'Could not open the project.');
    } catch (e) { showErr('Could not open a project.'); }
  };
  if (el) el.classList.add('show');
}

// External-tool preflight banner. If a command-line tool PCC drives (pwsh/git/claude/codex) is missing
// from PATH, say so up front instead of letting features fail silently or with a cryptic ENOENT. This is
// especially for a PACKAGED install on a machine that lacks one of these. Best-effort; never blocks boot.
async function renderToolWarning() {
  try {
    const st = await window.pcc.toolStatus();
    const bar = document.getElementById('tool-warning');
    if (!bar || !st || !Array.isArray(st.missing) || st.missing.length === 0) return;
    const items = st.missing.map((m) => '<b>' + m.label + '</b> (' + m.why + ')').join(', ');
    bar.innerHTML = '⚠ Some tools PCC needs are not on your PATH: ' + items
      + '. Install them and restart PCC — until then those features will not work.';
    bar.classList.add('show');
  } catch (e) { /* preflight is advisory; a failure here must never block the app */ }
}

async function boot() {
  // Resolve the active project first so chat history loads from its namespace. RETRY on a THROWN error
  // (a transient IPC hiccup once left activeProjectPath null -> the 'home' namespace -> an empty list ->
  // a fresh "New chat" masking the real project's chats, owner report 2026-07-10). A clean result with
  // path:null is NOT an error — it is the genuine "no project open" state (packaged first run), so we
  // stop retrying and fall through to the empty state below.
  let resolved = false;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const a = await window.pcc.getActiveProject();
      resolved = true;
      if (a && a.path) { activeProjectPath = a.path; }
      break;                              // succeeded (with or without a project) — don't retry
    } catch (e) { /* transient failure: retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  renderCorrections();
  renderToolWarning();   // fire-and-forget; shows in BOTH the empty state and the normal cockpit (z-index 46)
  initModels();
  loadProjectSwitcher();
  initHeader();
  // No active project (packaged first run): show the empty state and DON'T load project panes (which
  // would run against a null project — the chat path in particular would throw and block the pane).
  if (resolved && !activeProjectPath) { showNoProjectState(); return; }
  loadLifecycle();
  loadTrust();
  await loadChats();
}
// Signal when the initial async render has settled. boot() clears and repaints #log
// (loadChats), so anything that seeds #log before this resolves gets wiped — E2E tests
// wait on this flag instead of racing startup. Inert in production; nothing reads it there.
// .finally covers every exit (early no-project return and thrown errors alike).
boot().finally(() => { window.__pccBooted = true; });
// The usage stat changes on the desktop app's own ~5-min cadence, independent of whether this
// chat is active — a light standalone poll keeps it honestly current without waiting on a turn.
setInterval(() => { try { loadUsage(); } catch (e) { /* best effort */ } }, 60000);

// ADR-0016: the two-week trust proving window (owner-locked 2026-07-21 -> 2026-08-04). Pure date
// math (app/renderer/proving-window.js), zero LLM, zero guessing — real days from the real clock.
// Day-granularity only, so a coarse refresh is plenty; still live, never a static one-time note.
function renderProvingWindow() {
  const el = document.getElementById('pw-day');
  const bar = document.getElementById('pw-bar');
  if (!el || !bar) return;
  const s = PCCProvingWindow.provingWindowStatus();
  el.textContent = s.ended
    ? 'Trust proving window ended (' + s.endDate + ')'
    : 'Trust proving window — Day ' + s.dayNumber + ' of ' + s.windowDays + ' (' + s.remainingDays + ' day' + (s.remainingDays === 1 ? '' : 's') + ' left, ends ' + s.endDate + ')';
  bar.textContent = s.bar;
}
renderProvingWindow();
setInterval(renderProvingWindow, 10 * 60 * 1000);
