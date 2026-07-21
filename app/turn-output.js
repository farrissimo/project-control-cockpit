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

  function parseTurnOutput(raw) {
    let o;
    try { o = JSON.parse(raw); } catch (e) { return { text: null, costUsd: null, isError: null, budgetExceeded: false }; }
    if (!o || typeof o !== 'object') return { text: null, costUsd: null, isError: null, budgetExceeded: false };
    return {
      text: typeof o.result === 'string' ? o.result : null,
      costUsd: typeof o.total_cost_usd === 'number' && Number.isFinite(o.total_cost_usd) && o.total_cost_usd >= 0 ? o.total_cost_usd : null,
      isError: typeof o.is_error === 'boolean' ? o.is_error : null,
      budgetExceeded: o.subtype === 'error_max_budget_usd',
    };
  }

  return { parseTurnOutput: parseTurnOutput };
});
