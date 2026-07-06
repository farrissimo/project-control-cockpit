// PCC Cockpit - chat renderer.
// Keeps the conversation on screen and in localStorage so closing and
// reopening the app does not lose it. Claude keeps its own side of the
// conversation via --continue (handled in main.js), so context survives too.

const log = document.getElementById('log');
const input = document.getElementById('input');
const form = document.getElementById('composer');
const sendBtn = document.getElementById('send');

const HISTORY_KEY = 'pcc.chat.history';
let history = [];

function scrollDown() { log.scrollTop = log.scrollHeight; }
function save() { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }

function addBubble(cls, text, persist) {
  const el = document.createElement('div');
  el.className = 'bubble ' + cls;
  el.textContent = text;
  log.appendChild(el);
  scrollDown();
  if (persist) { history.push({ cls, text }); save(); }
  return el;
}

function loadHistory() {
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch (e) { history = []; }
  if (history.length === 0) {
    const wrap = document.createElement('div');
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
    [
      'What project am I in and what is its current status?',
      'What are my standing rules?',
      'List the main folders in this project.'
    ].forEach((s) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = s;
      b.style.cssText = 'background:#1a1d23;border:1px solid #2b2f37;color:#cdd2d9;border-radius:10px;padding:10px 12px;font-size:13px;cursor:pointer;text-align:left;font-weight:400;';
      b.addEventListener('click', () => { input.value = s; form.requestSubmit(); });
      chips.appendChild(b);
    });
    wrap.appendChild(chips);

    log.appendChild(wrap);
    return;
  }
  history.forEach((m) => addBubble(m.cls, m.text, false));
  scrollDown();
}

async function initHeader() {
  try {
    const s = await window.pcc.getState();
    const p = s.project || {};
    if (p.project_name) document.getElementById('project').textContent = '— ' + p.project_name;
  } catch (e) { /* header is cosmetic; ignore */ }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const empty = log.querySelector('.empty');
  if (empty) empty.remove();
  input.value = '';
  addBubble('user', text, true);
  sendBtn.disabled = true;
  const thinking = addBubble('assistant thinking', 'Claude is working…', false);
  try {
    const res = await window.pcc.send(text);
    thinking.remove();
    addBubble(res.ok ? 'assistant' : 'assistant error', res.text || '(no output)', true);
  } catch (err) {
    thinking.remove();
    addBubble('assistant error', 'Something went wrong: ' + err.message, true);
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); }
});

initHeader();
loadHistory();
