// warm-result.js — pure classification of ONE Claude `--output-format json`/stream `result` envelope
// (ADR-0020 T3, Task 2A correction). Deterministic, no I/O; main applies the attribution it returns.
// This is NOT a new measurement framework — it just makes the existing per-turn envelope handling
// (usage record + cost + owner classification) a single unit that can be exhaustively unit-tested.
//
// Fixes: Defect 3 (protective stops must each write EXACTLY ONE usage record and record real cost with
// deferred rollover) and Defect 4 (a structured `is_error:true` result — or a malformed/unknown shape —
// must NEVER be reported as success; it fails closed).
const { parseTurnOutput } = require('./turn-output');

// Disposition of one result envelope. Returns the parsed fields PLUS:
//   kind      : 'success' | 'max_turns' | 'budget' | 'error' | 'malformed'
//   trigger   : the usage-log trigger for this envelope (a KNOWN_TRIGGERS name), or null when there is
//               nothing to attribute (malformed shape).
//   deferRollover: true for unsuccessful/capped turns, so a cost-cap crossing is deferred (accumulated),
//               never silently discarded; false only for a successful turn (which may roll over now).
//   terminate : true when the warm worker must be torn down because continued reuse cannot be proven safe
//               (a generic execution error or an unrecognized result shape) — fail closed.
// Usage/cost are taken from the SAME envelope; main writes at most one usage record and records cost once.
function classifyResult(raw) {
  const p = parseTurnOutput(raw);
  if (p.maxTurnsReached) return Object.assign({}, p, { kind: 'max_turns', trigger: 'chat-turn-max-turns', deferRollover: true, terminate: false });
  if (p.budgetExceeded)  return Object.assign({}, p, { kind: 'budget',    trigger: 'chat-turn-budget',    deferRollover: true, terminate: false });
  if (p.isError === true) return Object.assign({}, p, { kind: 'error',     trigger: 'chat-turn-error',     deferRollover: true, terminate: true });
  if (p.text !== null)   return Object.assign({}, p, { kind: 'success',   trigger: 'chat-turn',           deferRollover: false, terminate: false });
  // Malformed / unknown shape: still a FAIL (never ok:true) and the worker is terminated — but a
  // JSON-but-unknown envelope can still carry a real usage/cost block, so it is attributed under
  // chat-turn-error with DEFERRED rollover (Task 2A micro-correction). Truly non-JSON output simply has
  // no usage/cost to log, so this is a no-op there. This ensures real usage/cost is never dropped and a
  // failed turn never immediately rolls over the chat cost.
  return Object.assign({}, p, { kind: 'malformed', trigger: 'chat-turn-error', deferRollover: true, terminate: true });
}

module.exports = { classifyResult };
