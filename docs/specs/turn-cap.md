# Spec: per-message turn cap (ADR-0020 T2)

## Objective
Stop a single owner message from fanning out into an unbounded run of hidden model turns (the
2026-07-20 burn: "one typed message = hundreds of agentic turns"). Do it with Claude Code's OWN
native `--max-turns` flag — no custom event counter, no forced process kill, no stream-transport
change. This is the turn-count sibling of the existing per-turn cost cap (`--max-budget-usd`).

## Non-goals (explicitly out of scope for T2)
- The warm persistent worker session (the actual cold-process/cache-rebuild fix) — that is **T3**.
- Capping the invisible background calls (`oneShotWorker`: auto-name / summary / recall) — that is
  **T6**. T2 covers only the normal owner-message worker path (`askClaude`).
- Any change to the ordinary text transport, cost handling, usage metering, attachments, or Stop.

## Mechanism
- `--max-turns <N>` is appended to the normal `askClaude` worker invocation, right beside the
  existing `--max-budget-usd`. `N` comes from the same fail-closed config as the cost caps
  (`.cockpit/state/usage-limits.json`, owner-editable), read once per turn.
- Verified against the installed binary (Claude Code 2.1.186): `--max-turns N` aborts a capped turn
  with exit code 1 and a result envelope `{ subtype:"error_max_turns", is_error:true, num_turns:~N+1,
  errors:["Reached maximum number of turns (N)"] }` — no `result` field, but real `usage`/`total_cost_usd`.
- `N` default = **30**. Evidence: the forensic report measured ~7 model turns per owner message
  (262 / 38); the burn to stop is fan-out into the hundreds. 30 is ~4× the measured average —
  headroom for a heavy legitimate build/scaffold turn, yet it fail-closes well before burn territory.
  Independently concurred by Codex (2026-07-22: sound single default; not below 20, not above 40
  without evidence). One value covers both read-only and build turns (build turns are heaviest).

## Acceptance criteria (EARS) — each has a passing test
1. WHEN a normal chat message is sent THE SYSTEM SHALL pass exactly one native `--max-turns <N>` pair
   to the worker, with `N` = the configured value. *(boundary.spec.js: "passes exactly ONE native --max-turns")*
2. WHEN the usage-limits config is missing, malformed, hostile, zero, negative, non-finite, or
   non-integer THE SYSTEM SHALL fall back to the safe default turn cap, never to "no cap".
   *(usage-limits.test.js: "max_turns fails closed …")*
3. WHILE adding the turn cap THE SYSTEM SHALL leave the existing worker args intact (`-p`, `--model`,
   `--max-budget-usd`, `--session-id`/`--resume`, `--allowedTools`). *(boundary.spec.js: same arg test)*
4. WHEN the worker returns an `error_max_turns` envelope THE SYSTEM SHALL recognize it by its
   structured subtype and retain the reported `num_turns`. *(turn-output.test.js: "a REAL error_max_turns envelope …")*
5. WHEN a message is stopped by the turn cap THE SYSTEM SHALL show the owner a plain-language message
   (what happened, the real turn count, that partial work may already have run, how to raise the cap)
   and SHALL NOT show the raw JSON envelope. *(boundary.spec.js: "surfaces as a PLAIN, neutral message …")*
6. WHEN a message is stopped by the turn cap THE SYSTEM SHALL render it as a neutral protective stop,
   not a red error, and SHALL retain the turn's real usage in the ledger. *(renderer isProtectiveStop; usage-log logCall in the max-turns branch)*
7. WHEN a normal turn completes under the cap THE SYSTEM SHALL behave exactly as before (no regression).
   *(existing boundary + turn-output success tests stay green)*

## Honest boundary
T2 bounds one message's agentic fan-out. It is NOT the root-cause fix for the usage burn — that is
T3 (the warm persistent worker session that stops the per-message cold-process cache rebuild). The
overall usage trust blocker (ADR-0016) stays open after T2.
