// nearest-limit.js (ADR-0018 extension, Task 2.1) — reconcile the FOUR limiters into one honest
// "Nearest stop" answer: which cap is closest to stopping the next turn, and (reused) which one just
// did. PURE + unit-testable (no DOM/electron/IPC).
//
// Honesty rules (Codex-advised 2026-07-25):
//   • Each meter is ranked by proximity WITHIN ITS OWN SCALE (fraction of its own cap / hold point) —
//     never a fake cross-unit dollars-vs-percent comparison. The label always says which meter.
//   • Dollar caps are PCC SPEND GUARDS, not Claude-plan exhaustion (dollars are partly phantom on a
//     flat plan, ADR-0020). Only the 5-hour reading is real Claude-plan usage.
//   • A meter with no data (e.g. the 5-hour reading is unknown/stale) is EXCLUDED from ranking and
//     never inferred — better "unknown" than a guess.
//   • The 5-hour meter's effective stop is the usage-protection HOLD point (default 90%, ADR-0020 T4),
//     not 100% — so proximity is measured against the hold point.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCNearestLimit = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  const USAGE_HOLD_PCT = 90; // ADR-0020 T4: the 5-hour usage-protection hold fires here by default

  function finiteNonNeg(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null; }
  // fraction of a cap, clamped to [0,1]; null when either side is missing/invalid so the meter is skipped
  function frac(value, cap) {
    const v = finiteNonNeg(value); const c = finiteNonNeg(cap);
    if (v === null || c === null || c === 0) return null;
    return Math.min(1, v / c);
  }
  function money(n) { return '$' + (Math.round(n * 100) / 100).toFixed(2); }

  // Build the candidate meters (only those with usable data). Each: { kind, label, proximity, detail, isSpendGuard }.
  function meters(input) {
    const i = input || {};
    const out = [];
    const pTurns = frac(i.turns, i.maxTurns);
    if (pTurns !== null) out.push({ kind: 'turns', label: 'per-message turn cap', proximity: pTurns,
      detail: finiteNonNeg(i.turns) + '/' + finiteNonNeg(i.maxTurns) + ' turns this message', isSpendGuard: false });
    // ADR-0022: the dollar caps are DEMOTED to advisory — they no longer stop or reroute approved work
    // (phantom dollars on a flat plan). They are still built here for advisory DISPLAY, but nearestStop
    // excludes anything with isSpendGuard so a spend figure is never named as a stopper.
    const pTurnUsd = frac(i.turnUsd, i.maxTurnUsd);
    if (pTurnUsd !== null) out.push({ kind: 'turn_usd', label: 'per-turn spend (advisory)', proximity: pTurnUsd,
      detail: money(i.turnUsd) + ' / ' + money(i.maxTurnUsd) + ' this turn', isSpendGuard: true });
    const pChatUsd = frac(i.chatUsd, i.maxChatUsd);
    if (pChatUsd !== null) out.push({ kind: 'chat_usd', label: 'chat spend (advisory)', proximity: pChatUsd,
      detail: money(i.chatUsd) + ' / ' + money(i.maxChatUsd) + ' this chat', isSpendGuard: true });
    const holdPct = finiteNonNeg(i.usageHoldPercent) || USAGE_HOLD_PCT;
    const pUsage = frac(i.sessionPercent, holdPct);
    if (pUsage !== null) out.push({ kind: 'usage', label: '5-hour Claude usage', proximity: pUsage,
      detail: finiteNonNeg(i.sessionPercent) + '% (holds at ' + holdPct + '%)', isSpendGuard: false });
    return out;
  }

  // The single nearest stop. Returns { kind:'none' } when NO meter can actually stop work (never a
  // false answer). ADR-0022: only controls that HARD-STOP approved work are eligible — the real
  // 5-hour usage hold and the per-message turn cap. The dollar caps are advisory (isSpendGuard) and
  // are excluded here, even at 100%, so a spend figure is never presented as "what will stop you".
  // Ties broken deterministically by a fixed severity order (real usage first, then the turn cap).
  function nearestStop(input) {
    const ms = meters(input).filter((m) => !m.isSpendGuard);
    if (ms.length === 0) return { kind: 'none', label: null, proximity: null, detail: 'no limit data yet', isSpendGuard: false };
    const order = { usage: 0, turns: 1 };
    ms.sort((a, b) => (b.proximity - a.proximity) || (order[a.kind] - order[b.kind]));
    return ms[0];
  }

  return { nearestStop, meters, USAGE_HOLD_PCT };
});
