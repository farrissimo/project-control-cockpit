// The recall pipeline (prototype of CHAT_RECALL_SPEC's "smart grep").
//
// Four stages. The AI ones take an injectable `ai(prompt)` so the runner can use
// the real worker (worker.js) OR a deterministic stub (--dry) to test the
// plumbing with zero tokens.
//
//   summarize(chat)         AI    transcript -> structured summary (the "summary tier")
//   expandQuery(question)   AI    plain English -> grep terms (front end)
//   grep(terms, summaries)  local keyword net over summaries, transcript fallback (free)
//   judge(question, hits)   AI    read the few hits, answer w/ chat link + quote (back end)
//
// The grep is the only always-local, zero-token stage. The AI only ever touches
// the short question and the handful of hits - never the whole archive.

'use strict';

function transcriptText(chat) {
  return chat.messages.map((m) => (m.cls === 'user' ? 'USER: ' : 'AI: ') + m.text).join('\n');
}

// --- Stage 1: summarize a chat into the structured card (CHAT_RECALL_SPEC schema).
async function summarize(chat, ai) {
  const prompt = [
    'Summarize the following chat transcript into a STRICT JSON object with keys:',
    '"title" (<=6 words), "gist" (1-2 sentences), "decided" (array of short strings,',
    'each a concrete decision), "wentWrong" (array), "openIdeas" (array),',
    '"importantEvents" (array of short strings flagging key moments).',
    'Quote/paraphrase only what is in the transcript - invent nothing. Output ONLY the JSON.',
    '',
    'TRANSCRIPT:',
    transcriptText(chat),
  ].join('\n');
  const raw = await ai(prompt);
  return { chatId: chat.id, chatName: chat.name, summary: safeJson(raw), raw };
}

// --- Stage 2: expand the question into grep terms + synonyms (front end).
async function expandQuery(question, ai) {
  const prompt = [
    'A user is searching their chat history. Turn this question into a compact list',
    'of 4-8 lowercase keywords/synonyms likely to appear in the relevant chat.',
    'Output ONLY a JSON array of strings. Question: "' + question + '"',
  ].join('\n');
  const raw = await ai(prompt);
  const terms = safeJson(raw);
  return Array.isArray(terms) ? terms.map((t) => String(t).toLowerCase()) : [];
}

// --- Stage 3: local keyword grep (free). Score each chat by term hits over its
// summary (fast lane); if NOTHING scores, fall back to the raw transcript.
function grep(terms, summarized, chats) {
  const score = (hay) => {
    const h = hay.toLowerCase();
    return terms.reduce((n, t) => n + (t && h.includes(t) ? 1 : 0), 0);
  };
  let hits = summarized
    .map((s) => ({ chatId: s.chatId, chatName: s.chatName, score: score(JSON.stringify(s.summary || s.raw)), tier: 'summary' }))
    .filter((h) => h.score > 0);
  if (hits.length === 0) {
    // Safety net: grep the full transcripts.
    hits = chats
      .map((c) => ({ chatId: c.id, chatName: c.name, score: score(transcriptText(c)), tier: 'transcript' }))
      .filter((h) => h.score > 0);
  }
  return hits.sort((a, b) => b.score - a.score);
}

// --- Stage 4: judge the top hits against the ORIGINAL question and answer (back end).
async function judge(question, hits, chatsById, ai) {
  const top = hits.slice(0, 4);
  const evidence = top.map((h) => 'CHAT ' + h.chatId + ' ("' + h.chatName + '"):\n'
    + chatsById[h.chatId].messages.map((m) => (m.cls === 'user' ? 'USER: ' : 'AI: ') + m.text).join('\n')).join('\n\n---\n\n');
  const prompt = [
    'The user asked: "' + question + '"',
    'Below are candidate chats from a keyword search. Some may be irrelevant noise.',
    'Pick the ONE chat that actually answers the question (or say none do). Reply as',
    'STRICT JSON: { "chatId": "<id or null>", "answer": "<plain-English answer>",',
    '"quote": "<a short verbatim quote from that chat that proves it>" }.',
    'Do not invent - the quote must appear verbatim in the chosen chat.',
    '',
    evidence,
  ].join('\n');
  const raw = await ai(prompt);
  return safeJson(raw);
}

// Run the whole pipeline for one question over a set of chats.
async function recall(question, chats, ai, opts = {}) {
  const summarized = opts.summaries || (await Promise.all(chats.map((c) => summarize(c, ai))));
  const terms = await expandQuery(question, ai);
  const hits = grep(terms, summarized, chats);
  const chatsById = Object.fromEntries(chats.map((c) => [c.id, c]));
  const result = hits.length ? await judge(question, hits, chatsById, ai) : { chatId: null, answer: 'No matching chat found.', quote: '' };
  return { question, terms, hits, result, summarized };
}

function safeJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = String(s).match(/[[{][\s\S]*[\]}]/); // tolerate prose around the JSON
  if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
  return null;
}

module.exports = { summarize, expandQuery, grep, judge, recall, transcriptText, safeJson };
