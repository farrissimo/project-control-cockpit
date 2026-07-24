// rollover-seed.js (ADR-0020 T1) — build the DETERMINISTIC, LOCAL continuation context carried into a
// rolled-over chat. NO LLM: same messages + handoff always produce the same seed. This is what makes the
// conversation still usable after PCC rolls a big chat over into a fresh session, without the hidden burn
// of an LLM summary. Pure + unit-testable (no DOM/electron). BOUNDED (compact): it carries the RECENT
// conversation verbatim up to a cap, never the full grown history — that is the whole point of compaction.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCRolloverSeed = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const MAX_SEED_CHARS = 12000;   // total cap on the verbatim recent-conversation slice (compact)
  const MAX_SEED_MESSAGES = 12;   // at most this many of the most-recent messages are carried

  function roleLabel(cls) {
    const c = String(cls == null ? '' : cls);
    if (c.indexOf('user') !== -1) return 'You';
    if (c.indexOf('assistant') !== -1) return 'Claude';
    return 'Note';
  }

  // The recent conversation as a bounded verbatim transcript (chronological, most-recent last). Walks
  // backward from the newest message, keeping whole messages until the char budget is spent, so the MOST
  // recent context is always retained; a single message longer than the whole budget is truncated with a
  // visible marker (never a silent cut). Pure; never throws on odd input.
  function recentTranscript(messages, opts) {
    const maxMsgs = (opts && opts.maxMessages) || MAX_SEED_MESSAGES;
    const maxChars = (opts && opts.maxChars) || MAX_SEED_CHARS;
    const arr = (Array.isArray(messages) ? messages : []).filter((m) => m && typeof m.text === 'string' && m.text.trim());
    const recent = arr.slice(-maxMsgs);
    const lines = [];
    let budget = maxChars;
    for (let i = recent.length - 1; i >= 0 && budget > 0; i--) {
      const m = recent[i];
      const full = roleLabel(m.cls) + ': ' + m.text.trim();
      if (full.length <= budget) { lines.unshift(full); budget -= full.length; }
      else if (lines.length === 0) { lines.unshift(full.slice(0, Math.max(0, budget)) + ' …[trimmed]'); budget = 0; } // keep at least the newest, truncated + marked
      else break; // budget spent — stop (older messages dropped)
    }
    return lines.join('\n\n');
  }

  // The full continuation seed prepended to the rolled-over chat's FIRST worker turn. Deterministic: the
  // recent verbatim transcript + the (already deterministic, no-LLM) handoff briefing. No summary is
  // generated. handoffText may be empty (the caller holds if it truly can't build one — see AC-5).
  function buildContinuationSeed(messages, handoffText, opts) {
    const transcript = recentTranscript(messages, opts);
    const handoff = String(handoffText == null ? '' : handoffText).trim();
    return 'You are continuing a previous chat that was rolled over because its context got large. '
      + 'Only what appears below carries forward — treat it as the ground truth for this conversation. '
      + 'This was assembled locally and deterministically; no summary was generated.\n\n'
      + '=== Recent conversation (verbatim, most recent last) ===\n' + (transcript || '(no prior messages)')
      + (handoff ? ('\n\n=== Project handoff briefing ===\n' + handoff) : '');
  }

  return { buildContinuationSeed, recentTranscript, roleLabel, MAX_SEED_CHARS, MAX_SEED_MESSAGES };
});
