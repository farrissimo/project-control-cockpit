---
status: Proposed
date: 2026-07-25
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0023: Approved work auto-continues once past the --max-turns cap

## Context and Problem

ADR-0022 established the trial's rule — **only the owner's real 5-hour Claude usage may hard-stop
approved work** — and demoted the two dollar caps to advisory. It named one residual non-real
stopper left by design: the native `--max-turns` cap (default 30). When that cap fires, PCC today
bare-stops the owner's message with a "hit its per-message turn limit" notice.

That bare stop is the last false stop of approved work. `--max-turns` is genuinely useful — it is a
real runaway backstop: a single message that fans out into hundreds of hidden agentic turns burns
real usage, which is the 2026-07-20 failure mode the cap was added to prevent. So we cannot simply
delete it. But when *approved* work is legitimately mid-task and merely ran long, stopping it on the
30th agentic step is exactly the "stopped by a limit that isn't my real usage" experience the trial
must eliminate. The owner is a non-coder product lead; being told to "send a smaller next step"
mid-build is precisely the babysitting PCC exists to remove.

## Decision

**On the specific `--max-turns` stop only, approved (build-authorized) warm text work auto-continues
exactly ONCE past the cap, under hard ceilings, keeping the runaway backstop intact.**

- **Trigger scope:** only a `kind:'max_turns'` stop qualifies. Every other stop reason
  (budget, usageLimit, authError, stoppedByOwner, cancelled, sessionInUse, generic error, malformed)
  denies auto-continue and surfaces its normal stop — unchanged.
- **One guarded segment:** PCC sends exactly one resumed segment on the **same chat and same Claude
  session** (`--resume`), driven by a constant **guarded continuation prompt** that forces the worker
  to re-orient against real state, forbids repeating completed or destructive work, forbids scope
  expansion or raising limits, and STOPS on any uncertainty. So an auto-continue can only *finish*
  near-done approved work, never restart or widen it.
- **Hard ceilings (all must hold):** at most one auto-continue per owner message
  (`max_auto_continues = 1`); a cumulative-turn cap across original + resumed segment
  (`floor(perMessageMaxTurns × 1.5)` = 45 at the default 30); and a 15-minute wall-clock cap covering
  both segments. The resumed segment's `--max-turns` is **lowered** to the remaining cumulative
  budget (`min(perMessageMaxTurns, cumulativeCap − turnsSpent)`), and can never be raised above the
  configured cap. **There is no dollar gate** — per-turn USD is advisory on a flat plan (ADR-0020/0022).
- **No escalation:** the resumed segment runs at the SAME authority/tool profile already in force;
  auto-continue never grants build tools a read-only chat didn't already have, and only ever applies
  to already-build-authorized chats.
- **Never silent:** every auto-continued turn carries a visible notice ("continued automatically past
  the per-message turn limit… you can Stop anytime"); the owner's Stop button ends the resumed segment.
- **Slice scope:** warm text turns only. Attachment turns and the cold/create-flow paths still
  hard-stop on `max_turns` (out of scope here); if the resumed segment itself stops for any reason,
  PCC does not auto-send a further segment.

The policy decision lives in a pure, unit-tested module (`app/auto-continue.js` `decideAutoContinue`),
mirroring `warm-result.js`; `main.js` only applies the verdict (spawns the resumed segment).

## Consequences

- The last non-real stopper of approved work is demoted: a long-but-legitimate approved message
  finishes instead of stopping on the turn cap, with no owner intervention — trial finish-line item (4).
- The runaway guard is preserved: a true spiral still stops, now at the cumulative ceiling
  (≤45 turns / 15 min) instead of unbounded, and only once — there is no silent retry loop.
- The owner always sees that an auto-continue happened and can stop it; behavior is honest, not hidden.
- Residual, by design: attachment and cold paths still bare-stop on `max_turns` (a later slice may
  extend this); the wall-clock/cumulative numbers are conservative defaults, tunable if real use shows
  they clip honest work.

## Confirmation

- `app/tests/unit/auto-continue.test.js` (10 cases) pins the pure gate: only `max_turns` allows; every
  other kind, a non-build chat, an attachment turn, a used-up continue, the cumulative cap, and the
  wall-clock cap each deny; the allowed case returns the lowered `resumeMaxTurns` (15 for 30→45, and 1
  when only one turn of budget remains); fails closed to a 30 default on a missing config.
- `app/tests/e2e/boundary.spec.js` (real Electron) proves the end-to-end path with the
  `worker-max-turns-then-success.json` `sequence` fixture: an approved send that hits `max_turns`
  auto-continues once on the **same session** (`--resume`, not a new `--session-id`), with the resumed
  `--max-turns` lowered to **14** (31 turns spent, cap 45), the tool profile intact, no
  `--max-budget-usd` reintroduced, and the visible notice present with the resumed reply behind it.
- The same suite pins the deny side: a READ-ONLY chat hitting `max_turns` does **not** auto-continue
  (`r.autoContinued` falsy) and still shows the normal plain stop.
- Full suite + lint green on the exact commit (CI, windows-latest); Codex independent verification of
  the diff. Every acceptance criterion in `docs/specs/max-turns-auto-continue.md` maps to a test above.

## Engagement

- **Owner:** approved work that merely runs long now finishes on its own; he sees a short notice that
  it continued and can Stop anytime. No action, no "send a smaller step" babysitting.
- **Claude worker:** implemented the pure `decideAutoContinue`, the guarded continuation prompt, the
  `main.js` re-entry (shutdown → `--resume` same session, lowered cap, incremented counters, prepended
  notice), the `--max-turns` override, and all tests/fixtures.
- **Codex verifier:** designed the ceilings, the guarded prompt, and the function split; independently
  verifies the diff (static + the checks it can run; cannot launch Electron — the E2E is worker-attested).
- **Future chats:** the auto-continue policy and its ceilings live here and in
  `docs/specs/max-turns-auto-continue.md`; extending it to attachment/cold paths is a separate slice.

## Supersedes / Related

Completes the residual named in ADR-0022 (`max_turns` bare-stop → auto-continue-once). Related:
ADR-0020 (usage governance; "phantom dollars on a flat plan"), ADR-0021 (build-authority continuity —
the authority this reuses without escalation), ADR-0012 (the real 5-hour usage meter — the one
legitimate hard stop). Recurrence-prevention for the merge hazard found while shipping this is
recorded separately in ADR-0024.
