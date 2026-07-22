// Parse Claude Code's non-streaming --output-format json envelope (desktop-parity R3 slice 2).
//
// Verified live 2026-07-20: a single JSON object at the end of stdout —
// { type:"result", subtype:"success"|"error_max_budget_usd"|..., is_error, result, total_cost_usd,
//   session_id, usage:{...} }. This is a MUCH smaller change than switching to streaming mode: one
// blob, not incremental parsing — and it gives the real, Anthropic-computed dollar cost of the
// turn directly (`total_cost_usd`), so PCC does not have to derive cost from token counts itself.
//
// Safe by construction for every non-JSON caller (the test fakebin's plain-text fake, any raw-text
// edge case): a parse failure returns text:null, and callers fall back to treating `raw` as plain
// text exactly as before this slice — this shape addition never breaks an existing plain-text path.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCTurnOutput = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // A finite, non-negative number, else null (never coerce garbage into a real count).
  function nonNegNum(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
  }

  // The turn's CURRENT context size = the total input-side (prompt) tokens Claude processed:
  // uncached input + cache-read + cache-write. This is a per-turn CURRENT reading (the whole
  // accumulated conversation sent this turn), NOT a running sum — summing across turns would
  // massively overstate fullness (codex-caught, ADR-0019). If the usage block is absent or has no
  // usable input_tokens, returns null (unknown) — never a fabricated 0 that would read as "empty".
  function contextTokensFrom(usage) {
    if (!usage || typeof usage !== 'object') return null;
    const inp = nonNegNum(usage.input_tokens);
    if (inp === null) return null;
    return inp + (nonNegNum(usage.cache_read_input_tokens) || 0) + (nonNegNum(usage.cache_creation_input_tokens) || 0);
  }

  function parseTurnOutput(raw) {
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { text: null, costUsd: null, isError: null, budgetExceeded: false, contextTokens: null }; }
    if (!o || typeof o !== 'object') return { text: null, costUsd: null, isError: null, budgetExceeded: false, contextTokens: null };
    return {
      text: typeof o.result === 'string' ? o.result : null,
      costUsd: typeof o.total_cost_usd === 'number' && Number.isFinite(o.total_cost_usd) && o.total_cost_usd >= 0 ? o.total_cost_usd : null,
      isError: typeof o.is_error === 'boolean' ? o.is_error : null,
      budgetExceeded: o.subtype === 'error_max_budget_usd',
      contextTokens: contextTokensFrom(o.usage),
    };
  }

  return { parseTurnOutput: parseTurnOutput };
});
