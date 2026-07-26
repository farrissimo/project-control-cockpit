// Live turn-status line (ADR-0018 ext / Task 2.2). Pure, unit-testable, no DOM/electron. During a
// running turn the "Claude is working…" bubble already shows elapsed time; this adds one honest line
// naming the ONLY thing that can actually stop approved work — the real 5-hour Claude usage
// (ADR-0022: dollar caps are phantom on a flat plan and are NEVER presented here as a stopper).
//
// Honesty contract (no fake green): the reading is the SAME cached 5-hour sample the usage meter
// reads (usage-meter.js), which carries its own freshness. If it is unavailable we say "unknown";
// if it is too old we say "stale" and never dress a stale number as live; PCC never guesses a number.
// This does NOT invent a live agentic-turn count — num_turns only exists on the final envelope, so a
// "turns so far" field would be fabricated. Deliberately omitted (bounded slice; Codex-scoped).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCTurnStatus = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const DEFAULT_HOLD_PCT = 90; // the 5-hour usage-protection hold (usage-protection.js HOLD_PCT)

  function finitePct(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null; }

  // Build the honest live-limiter line from the cached usage reading.
  //   reading: lastUsageReading (usage-meter.js contract) or null/undefined.
  //   holdPct: the hold threshold (default 90).
  // Returns { text, kind } with kind ∈ 'unknown' | 'stale' | 'usage'. Never throws.
  function liveLimiterLine(reading, holdPct) {
    const hold = finitePct(holdPct) || DEFAULT_HOLD_PCT;

    // Unknown: no reading, an explicitly-unavailable reading, or no usable percent. Never a fake 0%.
    const pct = reading && typeof reading === 'object' ? finitePct(reading.sessionPercent) : null;
    if (!reading || typeof reading !== 'object' || reading.available === false || pct === null) {
      return { kind: 'unknown', text: '5-hour Claude usage: unknown — no live reading yet (PCC never guesses a number)' };
    }

    // Stale: shown, but honestly flagged too old to trust as current — never dressed as live.
    if (reading.stale === true) {
      return { kind: 'stale', text: '5-hour Claude usage: ~' + pct + '% (last known, too old to trust as live)' };
    }

    // Fresh: the real 5-hour usage is the ONLY thing that can stop approved work.
    if (pct >= hold) {
      return { kind: 'usage', text: '5-hour Claude usage: ' + pct + '% — at the ' + hold + '% stop (only work already running keeps going)' };
    }
    return { kind: 'usage', text: 'Nearest real stop: 5-hour Claude usage — ' + pct + '% of the ' + hold + '% limit' };
  }

  return { liveLimiterLine, DEFAULT_HOLD_PCT };
});
