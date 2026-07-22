// Chat-health gauge math (ADR-0019). Pure, unit-testable, no DOM/electron. GENERAL solution —
// not pinned to any one model or plan. Corrects the original bug (a hardcoded 200K window) and
// the design tension it exposed, per research + codex (2026-07-21):
//   • Context windows are PER-MODEL: Opus/Sonnet families can run a 1M window; Haiku is 200K.
//     Headless `claude -p` does NOT report the effective window, and the effective window also
//     depends on the plan (Max/Team/Enterprise auto-get 1M; a non-Max/Pro-without-credits account
//     is capped at 200K). So the window is ALWAYS an ESTIMATE, never asserted as fact.
//   • The owner's real pain on a FLAT plan is usage burn (a big context re-sent every turn), not
//     hitting the context wall — and Opus does NOT auto-compact early, so nothing protects him.
//   • Therefore rollover triggers on WHICHEVER COMES FIRST: an absolute token floor (catches
//     usage-burn on big-window plans) OR a fraction of the (estimated) window (protects a
//     small-window plan before it hits the wall). Safe on BOTH situations: under-estimating the
//     window only rolls over SOONER, never later.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCChatHealth = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Conservative default plan window: what a NON-Max plan caps Opus/Sonnet at. Used unless a larger
  // plan is explicitly configured. Safe by construction: under-estimating the window only makes the
  // meter read higher and roll over sooner, never later. Lift via planWindowCap when a larger-context
  // plan is confirmed.
  const ASSUMED_PLAN_WINDOW = 200000;
  const ABSOLUTE_ROLLOVER_TOKENS = 350000; // usage-burn floor: on a big (1M) window, roll over here
  const ROLLOVER_WINDOW_PCT = 0.75;        // ...else roll over at 75% of the (estimated) window
  const ROLLOVER_TURNS = 40;               // soft notice past this many of your messages
  const ROLLOVER_HOURS = 6;                // soft notice past this long on one chat

  function finiteNonNeg(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null; }

  // What context window the MODEL can run (not plan-adjusted). General across the Claude line; an
  // unrecognized model falls back to the conservative 200K. Matched by substring so new point
  // releases (opus 4.8/4.7/4.6, sonnet 5/4.6) all resolve without per-id maintenance.
  function modelDeclaredWindow(model) {
    const m = String(model || '').toLowerCase();
    if (!m) return ASSUMED_PLAN_WINDOW;         // unknown -> conservative
    if (m.indexOf('haiku') !== -1) return 200000;
    if (m.indexOf('opus') !== -1 || m.indexOf('sonnet') !== -1) return 1000000;
    return ASSUMED_PLAN_WINDOW;                  // unrecognized -> conservative
  }

  // The ESTIMATED effective window = the model's declared window, capped by the assumed plan window
  // (default conservative). `estimated` is ALWAYS true — headless can't confirm it.
  function contextWindowFor(model, opts) {
    const cap = (opts && finiteNonNeg(opts.planWindowCap)) || ASSUMED_PLAN_WINDOW;
    const declared = modelDeclaredWindow(model);
    return { window: Math.min(declared, cap), declared: declared, estimated: true };
  }

  // The token count at which THIS chat should roll over: whichever comes first — the absolute
  // usage-burn floor, or a fraction of the (estimated) window. Never above the window.
  function rolloverTokensFor(windowTokens) {
    const w = finiteNonNeg(windowTokens) || ASSUMED_PLAN_WINDOW;
    return Math.min(ABSOLUTE_ROLLOVER_TOKENS, Math.round(ROLLOVER_WINDOW_PCT * w));
  }

  // Pure gauge. Inputs: { turns, spanHours (null=unknown), contextTokens (null=UNMEASURED),
  // baselineTokens (null=none-yet), model, planWindowCap? }.
  //
  // GROWTH, not absolute size (2026-07-21 fix). Every turn PCC sends carries a large FIXED baseline —
  // the system prompt + all tool definitions + CLAUDE.md/AGENTS.md — that is re-sent unchanged each
  // turn and is NOT "chat length" (for the owner's setup it is ~252K tokens on turn one). Counting it
  // made a fresh chat read ~full immediately and, with auto-rollover on, loop forever. So the gauge
  // measures how much the CONVERSATION has GROWN past its own first-turn baseline:
  //     growth = max(0, contextTokens - baselineTokens)
  // The FIRST measured turn IS the baseline, so a fresh chat reads ~0% and climbs only as the real
  // back-and-forth accumulates. Because each new chat records its OWN baseline, a rolled-over chat
  // starts at ~0% too — the loop is structurally impossible. Growth is window-independent for the
  // trigger; raw total tokens and % of the (estimated) window stay as secondary hover detail only.
  // contextTokens null => context term dropped, never a false 0.
  function computeGauge(input) {
    const turns = finiteNonNeg(input && input.turns) || 0;
    const spanHours = (input && typeof input.spanHours === 'number' && Number.isFinite(input.spanHours) && input.spanHours >= 0) ? input.spanHours : null;
    const contextTokens = finiteNonNeg(input && input.contextTokens);
    const baselineTokens = finiteNonNeg(input && input.baselineTokens);
    const win = contextWindowFor(input && input.model, input);
    const rolloverTokens = rolloverTokensFor(win.window);

    // Conversation growth past the fixed baseline. No baseline recorded yet but a reading exists =>
    // this reading IS the baseline => growth 0 (a fresh chat, never a false-high). null only when
    // context is genuinely unmeasured.
    const growthTokens = contextTokens === null ? null : (baselineTokens === null ? 0 : Math.max(0, contextTokens - baselineTokens));

    const pctTurns = turns / ROLLOVER_TURNS;
    const pctSpan = spanHours !== null ? spanHours / ROLLOVER_HOURS : 0;
    const pctContext = growthTokens !== null ? growthTokens / rolloverTokens : null;  // proximity to rollover (GROWTH)
    const pctOfWindow = contextTokens !== null ? contextTokens / win.window : null;    // raw total vs window (hover only)

    let driver = 'messages', max = pctTurns;
    if (pctSpan > max) { max = pctSpan; driver = 'time'; }
    if (pctContext !== null && pctContext > max) { max = pctContext; driver = 'context'; }

    return {
      gaugePct: Math.min(100, Math.round(100 * Math.max(pctTurns, pctSpan, pctContext || 0))),
      pctTurns, pctSpan, pctContext, pctOfWindow,
      contextTokens: contextTokens,     // raw total for THIS turn (null when unmeasured)
      baselineTokens: baselineTokens,   // this chat's fixed first-turn overhead (null if not recorded)
      growthTokens: growthTokens,       // conversation growth past the baseline (what the gauge tracks)
      windowTokens: win.window,
      windowEstimated: win.estimated,
      rolloverTokens,
      contextMeasured: pctContext !== null,
      overWindowEstimate: contextTokens !== null && contextTokens > win.window, // raw total already exceeds the conservative window => real window is larger
      driver,
      overRollover: growthTokens !== null && growthTokens >= rolloverTokens,
    };
  }

  return {
    computeGauge, contextWindowFor, modelDeclaredWindow, rolloverTokensFor,
    ASSUMED_PLAN_WINDOW, ABSOLUTE_ROLLOVER_TOKENS, ROLLOVER_WINDOW_PCT, ROLLOVER_TURNS, ROLLOVER_HOURS,
  };
});
