// Chat-recall LOGIC — pure, no Electron / no `claude` / no fs — so it can be unit-tested in
// isolation (same split as chat-summary.js). This is the proven prototype pipeline
// (app/prototypes/chat-recall) turned into shippable code: expand -> grep -> judge.
//
//   buildExpandPrompt / parseTerms   plain question -> keyword+synonym list (front end, AI)
//   grep / selectCandidates          local keyword net over each chat's summary-or-transcript,
//                                     then a RECALL-safe candidate set (free, no tokens)
//   buildJudgePrompt / parseMatches  the finisher reads the candidates and returns ALL genuine
//                                     matches by MEANING, or nothing — never inventing (AI)
//
// main.js supplies the two AI calls (oneShotWorker) and the live chats; this owns everything
// mechanical + the prompts. The retrieval tier is deliberately simple (substring grep) and
// SWAPPABLE — a hybrid BM25+vector library (e.g. Orama) drops in here when scale warrants
// (docs/CHAT_RECALL_SPEC.md).

'use strict';

const payloadCaps = require('./payload-caps'); // ADR-0020 T7: bound per-candidate judge evidence (pure, no fs/electron)
const CANDIDATE_CAP = 8;
const STOP = new Set(['when', 'did', 'we', 'the', 'into', 'what', 'say', 'went', 'with', 'before', 'a', 'an',
  'to', 'is', 'of', 'on', 'do', 'does', 'how', 'are', 'for', 'not', 'that', 'this', 'it', 'at', 'was', 'our', 'my']);

function words(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
}

function transcriptText(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => (m && m.cls === 'user' ? 'USER: ' : 'AI: ') + String((m && m.text) || '')).join('\n');
}

// The greppable text for a chat: prefer the dense structured summary if present (fast lane),
// else the full transcript (safety net). Includes the chat name either way.
function docText(chat) {
  const s = chat && chat.summary;
  if (s && typeof s === 'object') {
    const arr = (a) => (Array.isArray(a) ? a.join(' ') : '');
    return [chat.name, s.gist, arr(s.decided), arr(s.wentRight), arr(s.wentWrong), arr(s.openIdeas), arr(s.importantEvents)]
      .filter(Boolean).join('\n');
  }
  return (chat && chat.name ? chat.name + '\n' : '') + transcriptText(chat && chat.messages);
}

// ADR-0020 T7: bound the owner's search QUESTION with the SAME deterministic cap in every stage
// (expand prompt, local term-fold, judge prompt) — so a giant paste into the search box can't create
// oversized one-shot Claude calls, and the AI and local stages can never disagree about what was searched.
function capQuestion(question) {
  return payloadCaps.headTail(question, payloadCaps.MAX_RECALL_EVIDENCE_CHARS);
}

function buildExpandPrompt(question) {
  return [
    'A user is searching their chat history. Turn this question into a compact list of 4-8',
    'lowercase keywords/synonyms likely to appear in the relevant chat (include obvious synonyms',
    'so results are not limited to the user\'s exact words). Output ONLY a JSON array of strings.',
    'Question: "' + capQuestion(question) + '"',
  ].join('\n');
}

function parseTerms(raw, question) {
  const parsed = safeJson(raw);
  const terms = Array.isArray(parsed) ? parsed.map((t) => String(t).toLowerCase()).filter(Boolean) : [];
  // Always fold in the question's own significant words, so a weak expansion still greps — from the
  // SAME capped question the AI stages see (T7), so local grep and the model never diverge.
  return [...new Set(terms.concat(words(capQuestion(question))))];
}

// Local keyword net. Returns chats ranked by how many terms hit their doc text (score > 0 only).
function grep(terms, chats) {
  const score = (hay) => { const h = String(hay).toLowerCase(); return terms.reduce((n, t) => n + (t && h.includes(t) ? 1 : 0), 0); };
  return chats
    .map((c) => ({ id: c.id, score: score(docText(c)) }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score);
}

// Recall-safe candidate set: grep hits first (best ranked), then top up from the rest up to the
// cap. Grep narrows/orders; it can never silently hide the right chat from the judge.
function selectCandidates(chats, hits, cap) {
  const limit = cap || CANDIDATE_CAP;
  const ordered = hits.map((h) => h.id);
  for (const c of chats) if (!ordered.includes(c.id) && ordered.length < limit) ordered.push(c.id);
  return ordered.slice(0, limit);
}

function buildJudgePrompt(question, candidateChats) {
  // ADR-0020 T7: bound the evidence per candidate — prefer the dense summary (docText), else the
  // transcript, then head+tail cap so up-to-8 candidates can't push an unbounded prompt at the judge.
  const evidence = candidateChats.map((c) => 'CHAT ' + c.id + ' ("' + (c.name || 'chat') + '"):\n' + payloadCaps.headTail(docText(c), payloadCaps.MAX_RECALL_EVIDENCE_CHARS)).join('\n\n---\n\n');
  return [
    'The user asked: "' + capQuestion(question) + '"',
    'Below are candidate chats. Many are irrelevant noise; a keyword shortlist is imperfect,',
    'so judge by MEANING, not word overlap. Rules for what counts as a match:',
    '- A chat matches ONLY if it genuinely answers the question AS ASKED. A chat that merely',
    '  touches the topic but does not contain the answer is NOT a match — e.g. if asked when a',
    '  decision was made, a chat that only CONSIDERED or DEFERRED it (no decision) does not match.',
    '- If SEVERAL chats genuinely answer it, return them ALL, most recent first. In particular,',
    '  an approval AND a later chat that REVERSES that same approval are BOTH matches — do not',
    '  collapse to one and do not drop the older one just because it was later superseded.',
    '- If none genuinely answer it, return an empty list. Never invent.',
    'Reply as STRICT JSON: { "matches": [ { "chatId": "<id>", "answer": "<plain-English answer>",',
    '"quote": "<short verbatim quote from that chat that proves it>" } ] }.',
    'Every quote must appear verbatim in its chat.',
    '',
    evidence,
  ].join('\n');
}

function parseMatches(raw) {
  const parsed = safeJson(raw) || {};
  const matches = Array.isArray(parsed.matches) ? parsed.matches : (Array.isArray(parsed) ? parsed : []);
  return matches
    .filter((m) => m && m.chatId)
    .map((m) => ({ chatId: String(m.chatId), answer: String(m.answer || ''), quote: String(m.quote || '') }));
}

function safeJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = String(s).match(/[[{][\s\S]*[\]}]/);
  if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
  return null;
}

module.exports = {
  CANDIDATE_CAP, words, transcriptText, docText,
  buildExpandPrompt, parseTerms, grep, selectCandidates, buildJudgePrompt, parseMatches, safeJson,
};
