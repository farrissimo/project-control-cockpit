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

// --- Stage 4: judge a CANDIDATE set against the ORIGINAL question and answer (back end).
// Takes an ordered list of chatIds (grep hits first, then a recall top-up). The judge is the
// precision stage: it must pick the ONE right chat or honestly say none, quoting verbatim.
async function judge(question, candidateIds, chatsById, ai) {
  const evidence = candidateIds.map((id) => 'CHAT ' + id + ' ("' + chatsById[id].name + '"):\n'
    + chatsById[id].messages.map((m) => (m.cls === 'user' ? 'USER: ' : 'AI: ') + m.text).join('\n')).join('\n\n---\n\n');
  const prompt = [
    'The user asked: "' + question + '"',
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
  const raw = await ai(prompt);
  const parsed = safeJson(raw) || {};
  const matches = Array.isArray(parsed.matches) ? parsed.matches
    : (Array.isArray(parsed) ? parsed : []);
  return { matches };
}

// Run the whole pipeline for one question over a set of chats.
// Retrieval is RECALL-safe: literal grep has vocabulary-gap holes, so we give the judge the
// grep hits FIRST (best ranked) then top up with other chats up to a cap — the judge (proven
// to reject noise and refuse to hallucinate) does the precision. Grep narrows/orders; it never
// gets to silently hide the right chat. (At very large scale the cap needs a stronger retrieval
// tier — semantic — but for dozens of chats reading a wide candidate set is cheap and robust.)
const CANDIDATE_CAP = 8;
async function recall(question, chats, ai, opts = {}) {
  const summarized = opts.summaries || (await Promise.all(chats.map((c) => summarize(c, ai))));
  const terms = await expandQuery(question, ai);
  const hits = grep(terms, summarized, chats);
  const chatsById = Object.fromEntries(chats.map((c) => [c.id, c]));
  const ordered = hits.map((h) => h.chatId);
  for (const c of chats) if (!ordered.includes(c.id) && ordered.length < CANDIDATE_CAP) ordered.push(c.id);
  const candidates = ordered.slice(0, CANDIDATE_CAP);
  const result = candidates.length ? await judge(question, candidates, chatsById, ai) : { matches: [] };
  return { question, terms, hits, candidates, matches: result.matches, summarized };
}

function safeJson(s) {
  if (!s) return null;
  try { return JSON.parse(s); } catch (e) { /* fall through */ }
  const m = String(s).match(/[[{][\s\S]*[\]}]/); // tolerate prose around the JSON
  if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
  return null;
}

module.exports = { summarize, expandQuery, grep, judge, recall, transcriptText, safeJson };
