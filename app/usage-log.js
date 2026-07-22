// usage-log.js — records the REAL token usage of EVERY LLM call PCC makes: the visible chat turns
// AND the invisible background calls (auto-name, summary, chat-recall, create-flow interview). This
// exists because those background calls were previously unmeasured — invisible not just to the owner
// but to the app itself — so "what spent my tokens, how, and when" was unanswerable.
//
// LLM-AGNOSTIC by design: it records raw TOKEN counts (the one unit every model shares), never
// dollars. Best-effort and NEVER throws — a logging failure must never affect or slow a worker turn.
// Writes JSONL to a git-ignored evidence dir. Pure helpers (usageFrom/usageFromJson) are unit-tested.
const fs = require('fs');
const path = require('path');

// Normalize a Claude Code `usage` object (text-turn JSON, oneShotWorker JSON, and the stream-json
// `result` event all carry the same shape) into raw token counts. Returns null when no real usage is
// present — never a fabricated zero that would read as "this call was free".
function usageFrom(usage) {
  if (!usage || typeof usage !== 'object') return null;
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  const input = n(usage.input_tokens);
  const cacheCreate = n(usage.cache_creation_input_tokens);
  const cacheRead = n(usage.cache_read_input_tokens);
  const output = n(usage.output_tokens);
  const promptTokens = input + cacheCreate + cacheRead; // total context SENT this call
  if (promptTokens === 0 && output === 0) return null;   // nothing real to record
  return { input, cacheCreate, cacheRead, output, promptTokens, totalTokens: promptTokens + output };
}

// Parse a full `--output-format json` result blob (a single JSON object) -> usage record, or null.
// Never throws (a non-JSON body, e.g. the test fakebin's plain text, falls through to null).
function usageFromJson(raw) {
  try { const o = JSON.parse(raw); return usageFrom(o && o.usage); } catch { return null; }
}

let lastCallMs = null; // gap between ANY two LLM calls, app-wide — the real "when" of spend.

// Append one record (best-effort). `rec` should carry at least { trigger, model } plus a usage
// object; we stamp ts + gapSec (seconds since the previous LLM call of any kind). Swallows all
// errors by contract — the diagnostic must never be able to break a chat turn.
function logCall(dir, rec) {
  try {
    const now = Date.now();
    const gapSec = lastCallMs ? Math.round((now - lastCallMs) / 1000) : 0;
    lastCallMs = now;
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(
      path.join(dir, 'usage-log.jsonl'),
      JSON.stringify(Object.assign({ ts: new Date(now).toISOString(), gapSec }, rec)) + '\n'
    );
  } catch { /* best-effort; never affects a turn */ }
}

module.exports = { usageFrom, usageFromJson, logCall };
