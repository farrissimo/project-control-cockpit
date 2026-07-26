// auto-continue.js — pure decision for ADR-0023 / Task 1.2: may a `--max-turns` stop of
// APPROVED work auto-continue ONCE past the cap, and with what lowered turn cap for the resumed
// segment? Deterministic, no I/O — main.js applies the decision (spawns the resumed segment).
//
// Why a pure module (mirrors warm-result.js classifyResult): the "should we auto-continue" policy
// is exactly the kind of fail-closed branching that must be exhaustively unit-tested away from the
// Electron/IPC/process machinery. main.js does the side effects; this file only decides.
//
// The rule (ADR-0023, settled with the owner): the native turn cap is a REAL runaway backstop, so
// it is NOT removed. Instead approved (build-authorized) work may continue exactly ONCE past it,
// under hard ceilings. Only max_turns qualifies; every other stop denies. There is NO dollar gate
// (the flat plan makes per-turn USD advisory — ADR-0020/0022).

// Ceilings. cumulativeTurnsFactor multiplies the per-message max_turns to bound the ORIGINAL +
// resumed segment together: at the default max_turns=30 this is 45, giving one finish segment of
// up to 15 extra turns — enough to finish near-done work, far short of a 60-turn spiral.
const DEFAULTS = Object.freeze({
  maxAutoContinues: 1,        // owner rule: continue AT MOST once; there is no silent second retry
  cumulativeTurnsFactor: 1.5, // cumulative cap = floor(perMessageMaxTurns * 1.5) (45 at the default 30)
  wallClockCapMs: 15 * 60 * 1000, // 15 min: long enough for one finish segment, still a real runaway ceiling
});

// decideAutoContinue(input) -> { allow, reason, resumeMaxTurns }
//   input.kind               : the warm-result kind of the stop ('max_turns' | 'budget' | 'error' | ...)
//   input.buildAuthorized    : is this chat currently build-authorized (approved work)?
//   input.hasAttachments     : did this turn carry attachments (out of the warm-only slice)?
//   input.autoContinuesSoFar : how many auto-continues this owner message has already used
//   input.cumulativeTurns    : agentic turns spent so far across original + prior resumed segment(s)
//   input.elapsedMs          : wall-clock ms since the ORIGINAL owner message began
//   input.perMessageMaxTurns : the configured per-message --max-turns (fail-closed default 30)
//   input.ceilings           : optional overrides for DEFAULTS (tests pin exact numbers)
// resumeMaxTurns is the lowered --max-turns for the resumed segment; 0 when denied.
function decideAutoContinue(input) {
  const i = input || {};
  const c = Object.assign({}, DEFAULTS, i.ceilings);
  const perMessageMaxTurns = (typeof i.perMessageMaxTurns === 'number' && i.perMessageMaxTurns >= 1)
    ? Math.floor(i.perMessageMaxTurns) : 30; // fail closed to the usage-limits default
  const cumulativeCap = Math.floor(perMessageMaxTurns * c.cumulativeTurnsFactor);
  const cumulativeTurns = (typeof i.cumulativeTurns === 'number' && i.cumulativeTurns >= 0) ? i.cumulativeTurns : 0;
  const autoContinuesSoFar = (typeof i.autoContinuesSoFar === 'number' && i.autoContinuesSoFar >= 0) ? i.autoContinuesSoFar : 0;
  const elapsedMs = (typeof i.elapsedMs === 'number' && i.elapsedMs >= 0) ? i.elapsedMs : 0;
  const deny = (reason) => ({ allow: false, reason, resumeMaxTurns: 0 });

  if (i.kind !== 'max_turns') return deny('not-max-turns');       // AC-5: only the turn cap qualifies
  if (!i.buildAuthorized) return deny('not-build-authorized');    // AC-6: approved work only
  if (i.hasAttachments) return deny('has-attachments');           // AC-6: warm text-only slice
  if (autoContinuesSoFar >= c.maxAutoContinues) return deny('auto-continue-limit-reached'); // AC-7
  if (elapsedMs > c.wallClockCapMs) return deny('wall-clock-cap-exceeded');                 // AC-7
  if (cumulativeTurns >= cumulativeCap) return deny('cumulative-turn-cap-reached');         // AC-7

  // AC-3: the resumed segment gets the SMALLER of a normal per-message cap and whatever cumulative
  // budget remains, so original + resumed can never exceed the cumulative ceiling. At least 1 turn.
  const resumeMaxTurns = Math.max(1, Math.min(perMessageMaxTurns, cumulativeCap - cumulativeTurns));
  return { allow: true, reason: 'ok', resumeMaxTurns };
}

module.exports = { decideAutoContinue, DEFAULTS };
