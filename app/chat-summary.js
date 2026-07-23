// Chat-history summary/name LOGIC — pure, no Electron, no `claude`, no fs — so it
// can be unit-tested in isolation (same split as authority-logic.js). main.js owns
// the worker spawn + file writes; this owns prompt-building, output-cleaning, and
// the rendered card. First-class chat history (docs/CHAT_RECALL_SPEC.md).

'use strict';

// Chat ids come from the renderer (UUIDs). Never trust one straight into a path.
function sanitizeChatId(id) {
  return String(id == null ? '' : id).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

// Transcript -> flat text for the worker. Capped so a giant chat can't blow the
// prompt (mirrors askClaude's attachment cap).
function transcriptToText(messages, cap) {
  const max = cap || 200000;
  return (Array.isArray(messages) ? messages : [])
    .map((m) => (m && m.cls === 'user' ? 'USER: ' : 'AI: ') + String((m && m.text) || ''))
    .join('\n')
    .slice(0, max);
}

// Prompt: name the chat by its MOST PROMINENT topic, from the transcript only.
function buildNamePrompt(messages) {
  return [
    'Give this chat a concise title of AT MOST 6 words naming the most prominent',
    'thing it is about. Use ONLY the transcript below. Reply with ONLY the title —',
    'no quotes, no leading "Title:", no trailing period.',
    '',
    'TRANSCRIPT:',
    transcriptToText(messages),
  ].join('\n');
}

// The structured summary schema (CHAT_RECALL_SPEC). Quote, don't invent.
function buildSummaryPrompt(messages) {
  return [
    'Summarize the following chat transcript as a high-level historical record.',
    'Output ONLY a strict JSON object with exactly these keys:',
    '{ "title": string (<=6 words), "gist": string (1-2 sentences), "decided": string[],',
    '  "wentRight": string[], "wentWrong": string[], "openIdeas": string[], "importantEvents": string[] }',
    'Rules: base every item on the transcript and quote/paraphrase faithfully — invent',
    'nothing. Keep arrays concise (0-6 short items); use [] when a category truly has',
    'nothing. "decided" = concrete decisions reached. "openIdeas" = ideas/TODOs raised',
    'but not resolved. "importantEvents" = pivotal moments (a decision, a reversal, a bug',
    'found, a scope change). Output JSON only — no prose, no code fences.',
    '',
    'TRANSCRIPT:',
    transcriptToText(messages),
  ].join('\n');
}

// ADR-0020 T6: derive a chat title LOCALLY and deterministically from the chat's own text —
// ZERO tokens, NO background LLM call (auto-naming must never fire a worker on chat leave/switch).
// The first user message is the chat's subject anchor; we quote it (whitespace-collapsed, then
// cleaned + capped by cleanTitle), inventing nothing. Returns '' when there is no real user
// message yet (the caller treats '' as "no usable title", never fabricating one).
function localTitle(messages) {
  if (!Array.isArray(messages)) return '';
  const firstUser = messages.find((m) => m && m.cls === 'user' && m.text);
  if (!firstUser) return '';
  return cleanTitle(String(firstUser.text).replace(/\s+/g, ' '));
}

// The worker sometimes wraps a title in quotes, prefixes "Title:", or adds a line
// of preamble. Take the first real line and strip the cruft. (Shared by localTitle.)
function cleanTitle(raw) {
  const lines = String(raw || '').split('\n').map((l) => l.trim()).filter(Boolean);
  // A real <=6-word title never ends in a colon, so drop lead-in lines like
  // "Here is a title:" and take the first genuine title line (fall back to first).
  const line = lines.find((l) => !l.endsWith(':')) || lines[0] || '';
  return line
    .replace(/^title:\s*/i, '')
    .replace(/^["'`*]+|["'`*]+$/g, '')
    .replace(/[.\s]+$/, '')
    .slice(0, 60)
    .trim();
}

// Tolerant JSON parse: accept clean JSON, or dig the first {...} object out of any
// prose/code-fence wrapping the worker added.
function safeJsonParse(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = String(s).match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
  return null;
}

// Normalize whatever the model returned into the full schema so the UI/file never
// hit a missing field.
function normalizeSummary(obj) {
  const o = (obj && typeof obj === 'object') ? obj : {};
  const arr = (v) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
  return {
    title: typeof o.title === 'string' ? o.title : '',
    gist: typeof o.gist === 'string' ? o.gist : '',
    decided: arr(o.decided),
    wentRight: arr(o.wentRight),
    wentWrong: arr(o.wentWrong),
    openIdeas: arr(o.openIdeas),
    importantEvents: arr(o.importantEvents),
  };
}

// Human-readable, greppable durable record (the summary.md tier).
function renderSummaryMd(summary, at) {
  const s = normalizeSummary(summary);
  const list = (a) => (a.length ? a.map((x) => '- ' + x).join('\n') : '- (none)');
  const when = new Date(at || Date.now()).toISOString();
  return [
    '# ' + (s.title || 'Chat summary'),
    '',
    '_Generated ' + when + ' — regenerable; quotes the chat, invents nothing._',
    '',
    '## Gist',
    s.gist || '(none)',
    '',
    '## Decided',
    list(s.decided),
    '',
    '## Went right',
    list(s.wentRight),
    '',
    '## Went wrong',
    list(s.wentWrong),
    '',
    '## Open ideas',
    list(s.openIdeas),
    '',
    '## Important events',
    list(s.importantEvents),
    '',
  ].join('\n');
}

module.exports = {
  sanitizeChatId,
  transcriptToText,
  buildNamePrompt,
  buildSummaryPrompt,
  cleanTitle,
  localTitle,
  safeJsonParse,
  normalizeSummary,
  renderSummaryMd,
};
