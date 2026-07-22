// Per-turn hard cost cap (desktop-parity R3, docs/proposals/desktop-parity.md) — the automatic-
// protection floor for a SINGLE runaway turn.
//
// Per CLAUDE.md's standing rule (research before building): Claude Code's own `claude -p` CLI
// already ships a real, Anthropic-enforced circuit breaker — `--max-budget-usd <amount>` —
// confirmed live 2026-07-20: it aborts the turn cleanly (exit 1, "Error: Exceeded USD budget
// (X)") once that single invocation's spend crosses the cap. This module does NOT reinvent
// token/cost tracking; it only supplies the cap value PCC passes to that existing flag.
//
// Honest scope: this caps ONE turn (one `claude -p` invocation), not a whole chat session's
// cumulative spend across many turns — that is the SEPARATE, still-open piece of R3 (tied to
// the real usage signal already captured in app/usage-meter.js / app/stream-parser.js).
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.PCCUsageLimits = api; }
})(typeof self !== 'undefined' ? self : this, function () {

  // Starting default, not empirically derived from a spend model — generous enough for a normal
  // heavy turn (many tool calls), tight enough to stop a single-turn spiral. Owner-editable via
  // .cockpit/state/usage-limits.json, same pattern as models.json. A missing/malformed config
  // MUST fall back to this safe default, never to "no cap" — a broken config file can never
  // silently disable the safety net (fail closed toward protection, not away from it).
  const DEFAULT_MAX_TURN_USD = 3;
  // R3 slice 2: a whole CHAT's cumulative cost cap (many turns, one session, growing over
  // hours — the actual 2026-07-20 mechanism, which the per-turn cap above does not cover).
  // Starting default, not empirically derived; generous for a real working session.
  const DEFAULT_MAX_CHAT_USD = 15;

  // ADR-0020 T2: cap the number of AGENTIC turns (assistant<->tool iterations) a SINGLE owner
  // message may fan out into, passed to Claude Code's own native `--max-turns` flag (verified
  // against the installed binary 2.1.186: `--max-turns N` aborts with subtype "error_max_turns",
  // is_error:true, num_turns~N+1). This does NOT reinvent turn tracking; it only supplies the cap
  // value PCC passes to that existing flag — the turn-count sibling of --max-budget-usd above.
  //
  // Value evidence (not an arbitrary round number): the 2026-07-20 forensic report measured the
  // PCC chat at ~7 model turns per owner message (262 turns / 38 messages), while the burn to stop
  // is explosive fan-out into hundreds of hidden turns. 30 is ~4x the measured average — enough
  // headroom for a legitimately heavy build/scaffold turn (many reads/greps/edits) without clipping
  // it, yet it fail-closes well before a runaway reaches burn territory. Independently concurred by
  // Codex (2026-07-22: sound single default; not below 20, not above 40 without evidence). One value
  // covers both read-only and build turns (build turns are the heaviest, so 30 protects those).
  // Owner-editable via .cockpit/state/usage-limits.json; a missing/malformed/hostile config MUST
  // fall back to this default (fail closed toward protection), never to "no cap".
  const DEFAULT_MAX_TURNS = 30;

  // Pure: never throws, never returns a non-finite/non-positive cap for any field.
  function normalizeLimits(cfg) {
    const turn = cfg && typeof cfg.max_turn_usd === 'number' && Number.isFinite(cfg.max_turn_usd) && cfg.max_turn_usd > 0
      ? cfg.max_turn_usd : DEFAULT_MAX_TURN_USD;
    const chat = cfg && typeof cfg.max_chat_usd === 'number' && Number.isFinite(cfg.max_chat_usd) && cfg.max_chat_usd > 0
      ? cfg.max_chat_usd : DEFAULT_MAX_CHAT_USD;
    // max_turns must be a positive INTEGER (a turn count) — floor a valid fractional value, reject
    // zero/negative/non-finite/non-numeric to the safe default so a broken config can never disable
    // the cap (fail closed), mirroring the cost caps above.
    const turns = cfg && typeof cfg.max_turns === 'number' && Number.isFinite(cfg.max_turns) && cfg.max_turns >= 1
      ? Math.floor(cfg.max_turns) : DEFAULT_MAX_TURNS;
    return { maxTurnUsd: turn, maxChatUsd: chat, maxTurns: turns };
  }

  // Impure: read the owner-editable config from the ACTIVE project's .cockpit/state (mirrors
  // readModels()'s own inline pattern in main.js). Any read/parse failure degrades to the safe
  // default via normalizeLimits(null) — never an unbounded cap.
  function readUsageLimits(cockpitStateDir) {
    const fs = require('fs');
    const path = require('path');
    try {
      return normalizeLimits(JSON.parse(fs.readFileSync(path.join(cockpitStateDir, 'usage-limits.json'), 'utf8')));
    } catch (e) {
      return normalizeLimits(null);
    }
  }

  // A budget-aborted turn's plain-text stdout, verified live against the real CLI.
  function isBudgetExceeded(text) { return /exceeded usd budget/i.test(String(text || '')); }

  // ADR-0020 T2: a turn stopped by the native --max-turns cap. Signature EXTRACTED from a real
  // captured envelope (installed binary 2.1.186): subtype "error_max_turns" and the message
  // "Reached maximum number of turns (N)". Text-level detector (mirrors isBudgetExceeded) so it
  // catches the cap on BOTH the --output-format json path and the stream-json (attachments) path,
  // where the structured subtype isn't singly-JSON-parseable. Deliberately does NOT match the
  // per-turn "Exceeded USD budget" cap or "maximum budget" (a different, separately-handled limit).
  function isMaxTurnsError(text) {
    const s = String(text || '');
    if (/exceeded usd budget|maximum budget/i.test(s)) return false; // the budget cap, not the turn cap
    return /error_max_turns/i.test(s) || /maximum number of turns/i.test(s);
  }

  // The owner hitting their actual Claude plan usage limit (the 5-hour/weekly limit) — the single
  // most likely shock during a week of heavy use. Patterns EXTRACTED from the installed claude-code
  // binary (2.1.215), not guessed: "usage limit reached", "You've reached your <model> limit", "out
  // of usage credits", "weekly limit". Deliberately does NOT match transient "overloaded (rate
  // limited)" (a momentary retry, not a block) or the per-turn "Exceeded USD budget" cap (a
  // different, PCC-set limit handled separately) — so those keep their own honest messaging.
  function isUsageLimitError(text) {
    const s = String(text || '');
    if (/exceeded usd budget|overloaded/i.test(s)) return false; // not the plan usage limit
    return /usage limit reached/i.test(s)
      || /out of usage credits/i.test(s)
      || /you'?ve reached your\b[^.\n]*\blimit/i.test(s)   // "You've reached your Fable 5 limit"
      || /reached your (weekly|usage|5-hour|five[- ]hour) limit/i.test(s);
  }

  // The owner's Claude Code sign-in has expired / signed out — every turn fails until re-login,
  // another expected week-of-use condition that should read as "sign back in", not a PCC crash.
  // Patterns EXTRACTED from the installed claude-code binary (2.1.215): every auth remedy points at
  // "/login", plus "not logged in" / "invalid credentials" / "re-authenticate" / "session expired".
  // NOTE: this is checked in the close handler AFTER isUsageLimitError, because one usage-overage
  // message ("out of usage credits. Run /login ...") also mentions /login but is a usage issue first.
  function isAuthError(text) {
    const s = String(text || '');
    return /not logged in/i.test(s)
      || /invalid credentials/i.test(s)
      || /\/login\b/i.test(s)                       // the CLI's own remedy pointer, auth-specific
      || /re-?authenticate/i.test(s)
      || /(session|token) expired/i.test(s)
      || /sign in again/i.test(s);
  }

  return {
    normalizeLimits: normalizeLimits, readUsageLimits: readUsageLimits, isBudgetExceeded: isBudgetExceeded,
    isMaxTurnsError: isMaxTurnsError, isUsageLimitError: isUsageLimitError, isAuthError: isAuthError,
    DEFAULT_MAX_TURN_USD: DEFAULT_MAX_TURN_USD, DEFAULT_MAX_CHAT_USD: DEFAULT_MAX_CHAT_USD,
    DEFAULT_MAX_TURNS: DEFAULT_MAX_TURNS,
  };
});
