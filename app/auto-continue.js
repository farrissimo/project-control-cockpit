// auto-continue.js — pure decision for ADR-0026: may a `--max-turns` stop of APPROVED work
// auto-continue AGAIN (run to completion), and with what turn cap for the resumed segment?
// Deterministic, no I/O — main.js applies the decision (spawns the resumed segment, computes the
// progress fingerprint it feeds back in).
//
// Why a pure module (mirrors warm-result.js classifyResult): the "should we keep going" policy is
// exactly the kind of fail-closed branching that must be exhaustively unit-tested away from the
// Electron/IPC/process machinery. main.js does the side effects; this file only decides.
//
// The rule (ADR-0026, supersedes ADR-0023's "once"): the native turn cap is a REAL runaway backstop,
// but a bare stop on it is a FALSE stop of approved work (ADR-0022 — only the owner's real 5-hour
// usage may hard-stop approved work). So approved (build-authorized) warm text work keeps continuing
// past the cap until it FINISHES on its own or a real ceiling is hit. Only max_turns qualifies; every
// other stop denies. There is NO dollar gate — the flat plan makes per-turn USD advisory (ADR-0020/0022).
//
// What ends the run (dollars are NOT a hard stop):
//   1. The work completes — the worker stops on its own (a non-max_turns end). Decided in main.js.
//   2. The owner's real 5-hour usage hold — the only RESOURCE hard stop (ADR-0012). Decided in main.js.
//   3. Runaway backstops decided HERE: an absolute cumulative-turn cap across all segments
//      (maxChatTurns) and a whole-run wall-clock cap (wallClockCapMs).
//   4. No-substantive-progress guard decided HERE: N consecutive resumed segments that show no advance
//      in a completion fingerprint (main.js computes the fingerprint from git; noProgressStreak counts
//      the consecutive no-advance segments). A stuck worker that only keeps talking is caught, not
//      relayed forever.

// Ceilings. Conservative starting defaults (ADR-0026 owner decision #3): catch a true spiral without
// clipping a long honest build. All are owner-tunable via .cockpit/state/usage-limits.json (maxChatTurns)
// or config injection (tests pin exact numbers); a resumed segment NEVER raises a limit.
const DEFAULTS = Object.freeze({
  maxChatTurns: 200,               // absolute cumulative agentic-turn cap across original + ALL resumed segments
  wallClockCapMs: 30 * 60 * 1000,  // 30 min whole-run wall clock (covers every segment together)
  noProgressLimit: 2,              // stop after N consecutive resumed segments with no substantive progress
});

// decideAutoContinue(input) -> { allow, reason, resumeMaxTurns }
//   input.kind               : the warm-result kind of the stop ('max_turns' | 'budget' | 'error' | ...)
//   input.buildAuthorized    : is this chat currently build-authorized (approved work)?
//   input.hasAttachments     : did this turn carry attachments (out of the warm text-only slice)?
//   input.cumulativeTurns    : agentic turns spent so far across original + prior resumed segment(s)
//   input.elapsedMs          : wall-clock ms since the ORIGINAL owner message began (all segments)
//   input.noProgressStreak   : consecutive resumed segments (incl. the one that just stopped) with no
//                              advance in the completion fingerprint (0 when progress was just made or
//                              cannot be measured — main.js fails this OPEN so a git-less project is
//                              still bounded by the turn/clock caps, never falsely halted)
//   input.perMessageMaxTurns : the configured per-message --max-turns (fail-closed default 30)
//   input.ceilings           : optional overrides for DEFAULTS (incl. maxChatTurns from usage-limits.json)
// resumeMaxTurns is the --max-turns for the resumed segment (a normal per-message chunk, clamped so the
// cumulative total can never exceed maxChatTurns); 0 when denied.
function decideAutoContinue(input) {
  const i = input || {};
  const c = Object.assign({}, DEFAULTS, i.ceilings);
  const perMessageMaxTurns = (typeof i.perMessageMaxTurns === 'number' && i.perMessageMaxTurns >= 1)
    ? Math.floor(i.perMessageMaxTurns) : 30; // fail closed to the usage-limits default
  const maxChatTurns = (typeof c.maxChatTurns === 'number' && c.maxChatTurns >= 1)
    ? Math.floor(c.maxChatTurns) : DEFAULTS.maxChatTurns; // fail closed to the safe backstop, never "no cap"
  const cumulativeTurns = (typeof i.cumulativeTurns === 'number' && i.cumulativeTurns >= 0) ? i.cumulativeTurns : 0;
  const elapsedMs = (typeof i.elapsedMs === 'number' && i.elapsedMs >= 0) ? i.elapsedMs : 0;
  const noProgressStreak = (typeof i.noProgressStreak === 'number' && i.noProgressStreak >= 0) ? i.noProgressStreak : 0;
  const deny = (reason) => ({ allow: false, reason, resumeMaxTurns: 0 });

  if (i.kind !== 'max_turns') return deny('not-max-turns');       // only the turn cap qualifies
  if (!i.buildAuthorized) return deny('not-build-authorized');    // approved work only (read-only hard-stops)
  if (i.hasAttachments) return deny('has-attachments');           // warm text-only slice
  if (elapsedMs > c.wallClockCapMs) return deny('wall-clock-cap-exceeded');   // runaway backstop: whole-run clock
  if (cumulativeTurns >= maxChatTurns) return deny('cumulative-turn-cap-reached'); // runaway backstop: absolute turns
  if (noProgressStreak >= c.noProgressLimit) return deny('no-substantive-progress'); // stuck worker, not honest work

  // The resumed segment gets a normal per-message chunk, clamped by whatever cumulative budget remains
  // so original + all resumed can never exceed maxChatTurns. At least 1 turn.
  const resumeMaxTurns = Math.max(1, Math.min(perMessageMaxTurns, maxChatTurns - cumulativeTurns));
  return { allow: true, reason: 'ok', resumeMaxTurns };
}

module.exports = { decideAutoContinue, DEFAULTS };
