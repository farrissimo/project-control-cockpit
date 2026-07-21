---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0015: Automatic cross-turn cost rollover — desktop-parity R3, slice 2

## Context and Problem

ADR-0014 (R3 slice 1) capped a single spiraling turn via Claude Code's built-in
`--max-budget-usd`. It explicitly did **not** cover the actual 2026-07-20 mechanism: **many
ordinary turns, in one long chat session, slowly accumulating context and cost over ~4 hours**,
none of which individually looked like a runaway. That is the gap this slice closes — the
automatic-protection floor R3 was named for, not observability (R1) or an owner-initiated stop
(R2).

## Decision

**Reuse two things PCC already has, build almost nothing new.**

1. **Real per-turn cost, not estimated.** `claude -p --output-format json` (confirmed live
   2026-07-20, same investigation as ADR-0014) returns a single JSON object —
   `{ type:"result", result:"<reply>", total_cost_usd:<real dollars>, is_error, subtype, ... }` —
   for the *ordinary, non-streaming* text path. This is a much smaller change than switching to
   streaming mode (ADR-0011's still-open "always streaming" slice): one blob at the end, not
   incremental parsing. `app/turn-output.js` parses it (`parseTurnOutput`), returning `text:null`
   on anything that isn't this exact shape — so the test fakebin's plain-text fake, or any future
   non-JSON edge case, falls straight through to today's plain-text handling, unchanged. This
   addition cannot break an existing plain-text path; it can only add data when the shape matches.
2. **Reuse the existing session-recovery mechanism for rollover.** PCC already has a manual
   "Recover this chat" action (Soak fix F4) that gives a chat a fresh underlying Claude session
   while keeping its visible history completely intact — `sessionIds.set(chatId, uuid())` +
   `turnsStarted.delete(chatId)`. That exact mechanism (extracted to a shared `remintSession()`
   helper) is now triggered **automatically** instead of only on a stale-lock error.

Implementation:
- `app/usage-limits.js` gains `max_chat_usd` (default $15, same fail-closed pattern as
  `max_turn_usd`: any bad/missing value degrades to the safe default per field, independently).
- `app/main.js`: a module-level `chatCostUsd` Map accumulates each chat's real cost from
  `parseTurnOutput`'s `total_cost_usd` (on both success and error paths — even an aborted turn can
  carry a real partial cost). When a chat's running total crosses `max_chat_usd`, the counter
  resets to 0 (the rollover "pays down" the total) and the successful turn's resolved object
  carries `costRollover: { totalUsd }`. An errored turn's own message is not overloaded with a
  second rollover notice — a crossed cap on that same turn surfaces on the next successful one.
- `app/renderer/renderer.js`: `runSend` detects `res.costRollover`, calls the shared
  `remintSession(chatId)`, and appends an honest, plain-language notice with the **real dollar
  figure** ("This chat has used about $18.00 so far — PCC automatically started a fresh worker
  session..."). Explicitly not overclaiming "nothing lost": the chat's visible history in PCC is
  untouched, but the *model's own context* genuinely resets with the new session — stated plainly,
  not glossed over.
- Honest, disclosed limitation: `chatCostUsd` is **in-memory, per app lifetime** — not persisted
  across a restart. The 2026-07-20 incident was one continuous session with no restart, so this
  still catches that exact pattern; a chat resumed after relaunching the app starts its counter at
  $0. Durable cross-restart tracking is a possible future hardening, not built here.

## Consequences

- **Gain:** the actual incident mechanism — slow, unnoticed cost growth across many turns in one
  long chat — now triggers automatic protection with **zero owner action**, using the real dollar
  figure Anthropic itself computes, not a token-based guess.
- **Cost:** one new module (`turn-output.js`), one new config field, a `chatCostUsd` Map in
  `main.js`, and the `--output-format json` flag added to the ordinary chat-turn spawn.
- **Honest residue:** in-memory only (not cross-restart); attachment turns (already on
  `stream-json`, a separate output path) are not yet cost-tracked by this slice — a disclosed gap,
  not silently dropped.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **Unit** (`app/tests/unit/turn-output.test.js`, 7; `app/tests/unit/usage-limits.test.js`
  extended to 6 for the new field): the real captured success/budget-exceeded JSON shapes parse
  correctly; every malformed/non-JSON/wrong-type input yields the safe all-null shape, never a
  fabricated cost or text; negative/non-finite costs are rejected; `max_chat_usd` follows the exact
  same per-field fail-closed pattern as `max_turn_usd`.
- **E2E** (`app/tests/e2e/cost-rollover.spec.js`, 2 new tests, real app + a fixed-cost fixture
  replaying the live-captured JSON shape): three turns at $6 each (no rollover at $6, none at $12,
  fires at $18 ≥ $15) — the notice appears as its own bubble with the **exact real total**, no
  `error` class, and all three original replies remain in the visible history (nothing lost); a
  second test proves the rollover is not cosmetic — the very next turn's actual spawn argv (via the
  fakebin's argv-capture instrumentation from ADR-0014) carries `--session-id`, not `--resume`,
  proving a genuinely fresh session was requested.
- **Regression, no fake confidence:** every spec touching the send/close path was re-run live —
  `boundary.spec.js`, `stop-worker.spec.js`, `robustness.spec.js`, `ipc.spec.js`,
  `chat-autoname.spec.js`, `chat-search.spec.js` — **49/49 green**, on this exact diff, not assumed
  from an earlier run.
- Full unit suite 175/175; lint clean.

## Engagement

- **Owner:** protected automatically, told plainly in dollars when it fires, never has to watch a
  meter or decide anything.
- **Claude worker:** implemented `turn-output.js`, the `usage-limits.js` extension, the `main.js`
  cost-tracking + rollover trigger, the renderer's `remintSession` extraction + notice, and the
  full test suite including the broad regression sweep above.
- **Codex verifier:** diff-reviews the change (static + lint + doctor; cannot launch Electron — the
  E2E/regression proof above is worker-attested, independently re-run live at review time).
- **Security-model note:** no new capability or IPC channel; a spend-triggered session remint uses
  the exact mechanism the existing manual recovery path already uses. Not flagged for the
  ADR-0009 GPT trigger.
- **Spawned projects:** `turn-output.js` and the `main.js`/`renderer.js` wiring are shared home-app
  logic (inherited automatically); the `max_chat_usd` field in `usage-limits.json` is per-project
  state the scaffolder seeds, same as the rest of that file (DECISION-113 parity).

## Supersedes / Related

Extends ADR-0014 (R3 slice 1, the per-turn cap). Related: `docs/proposals/desktop-parity.md` (R3),
ADR-0011 (the always-streaming slice a future cost-tracking upgrade for attachment turns would tie
into), the existing Soak-fix-F4 recovery mechanism this slice's rollover reuses.
