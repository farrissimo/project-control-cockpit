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
  // ADR-0020 T2: cap the number of AGENTIC turns a single owner message can fan out into.
  // The 2026-07-20 forensics showed single messages ballooning to 300–1096 model turns; the
  // installed Claude CLI (2.1.186) has NO --max-turns flag (verified against the full flag list),
  // so PCC enforces this itself by counting the worker's streamed agentic turns and killing a
  // runaway. Generous enough for a genuinely heavy real message (many tool calls), tight enough
  // to stop a spiral. Owner-editable via .cockpit/state/usage-limits.json. A missing/malformed
  // value MUST fall back to this default — never to "no cap" (fail closed toward protection).
  const DEFAULT_MAX_TURNS = 60;

  // Pure: never throws, never returns a non-finite/non-positive cap for any field.
  function normalizeLimits(cfg) {
    const turn = cfg && typeof cfg.max_turn_usd === 'number' && Number.isFinite(cfg.max_turn_usd) && cfg.max_turn_usd > 0
      ? cfg.max_turn_usd : DEFAULT_MAX_TURN_USD;
    const chat = cfg && typeof cfg.max_chat_usd === 'number' && Number.isFinite(cfg.max_chat_usd) && cfg.max_chat_usd > 0
      ? cfg.max_chat_usd : DEFAULT_MAX_CHAT_USD;
    // A cap of at least 1 turn; anything non-finite/<1 falls back to the safe default (never "no cap").
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
    isUsageLimitError: isUsageLimitError, isAuthError: isAuthError,
    DEFAULT_MAX_TURN_USD: DEFAULT_MAX_TURN_USD, DEFAULT_MAX_CHAT_USD: DEFAULT_MAX_CHAT_USD,
    DEFAULT_MAX_TURNS: DEFAULT_MAX_TURNS,
  };
});
