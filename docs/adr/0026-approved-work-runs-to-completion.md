---
status: Proposed
date: 2026-07-26
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0026: Approved work runs to completion under real ceilings (removing the owner-as-relay)

## Context and Problem

ADR-0023 lets approved (build-authorized) work auto-continue **exactly once** past the native
`--max-turns` cap. That closed the single-message case, but the trust trial exposed the case it does
not cover: a **multi-step governed task** (reproduce → fix → prove → commit → verify) routinely needs
more than one continue. Today it uses its one auto-continue, hits the cap again, and **hard-stops
mid-task** — so the owner has to shuttle a "keep going" message in, catch the next cap-stop, and
repeat. That relaying *is* the babysitting PCC exists to kill (backlog item #6, the highest-priority
parent fix). It was observed live during the trial: an approved ITM task stalled at "31 agentic turns"
with the tests still unwritten, waiting on a human, while the visible meters looked healthy.

The turn cap firing on legitimate *approved* work is a **false stop** — the trial's own bar (ADR-0022:
"only the owner's real usage/cost may hard-stop approved work"). `--max-turns` remains a real runaway
backstop, but an arbitrary turn count is the wrong *binding* limit for approved work: the real limit is
**cost** (and, on a flat plan, real 5-hour usage). The owner is a non-coder product lead; being made
the manual relay for a machine loop is exactly the experience the trial must eliminate.

## Decision

*(PROPOSED — this ADR is the owner's decision to make before any implementation.)*

**For approved (build-authorized) warm work, replace "auto-continue ONCE" with "auto-continue until the
work completes OR a real ceiling is hit," keeping every ADR-0023 safety intact and making the binding
limit COST, not an arbitrary turn count.**

- **Trigger scope unchanged:** only a `kind:'max_turns'` stop on a build-authorized warm chat qualifies.
  Every other stop (budget, usageLimit, authError, stoppedByOwner, error, malformed) denies and surfaces
  its normal stop. Read-only chats still hard-stop on `max_turns` — no autonomous fan-out without approval.
- **Continue until done, not once:** PCC keeps sending the guarded continuation segment (same chat, same
  `--resume` session, same authority — never escalated) each time the worker stops *only* on `max_turns`,
  until the worker finishes on its own (a non-`max_turns` end) or a ceiling below is reached.
- **The guarded prompt is unchanged and is what makes N continues safe** (ADR-0023): each segment must
  re-orient against real state, may only *finish* near-done approved work, and is forbidden to restart,
  widen scope, or raise limits, and must stop on uncertainty.
- **What ends the run (dollars are NOT a hard stop — ADR-0022):**
  1. **The work completes** — the worker stops on its own (any non-`max_turns` end). The intended finish.
  2. **The owner's real 5-hour usage hold** (ADR-0012/0022) — the ONLY *resource* hard stop, unchanged.
     Dollars are phantom on a flat plan, so no dollar cap ever hard-stops the run; `max_chat_usd` stays
     **advisory** (shown in the running notice, never enforced) unless the owner explicitly opts into a
     separate per-task spend cap. This keeps ADR-0022's spine intact rather than reintroducing a dollar stop.
  3. **Runaway backstops (catch a spiral, not a limit on honest work):** an absolute cumulative-turn cap
     (`max_chat_turns`, new config, conservative default — e.g. 200) and a whole-run wall-clock cap
     (e.g. 30 min) covering all segments.
  4. **No-substantive-progress guard:** if **N consecutive resumed segments** show no advance in a
     **completion fingerprint** — changed files, tests run, a new commit, a verification verdict, or
     evidence written — stop. (Mere new output or more turns does NOT count as progress, so a stuck
     worker that only keeps talking is caught, not relayed forever.)
  When a backstop or the progress guard ends the run, that is a plain, honest stop naming which one fired
  and how to raise it (`.cockpit/state/usage-limits.json`) or resume — never a silent give-up.
- **Never silent, always stoppable:** every auto-continued segment shows a running notice with the
  **cumulative turns and cost so far** and "you can Stop anytime"; the Stop button ends the run
  immediately. This is the "live visibility of progress and cost" item #6 asked for.
- **Slice scope:** warm text turns only (attachment/cold paths still hard-stop, as in ADR-0023).

The policy stays a pure, unit-tested decision (`app/auto-continue.js`); `main.js` only applies it.

## Consequences

- The owner-as-relay treadmill is removed: an approved multi-step task runs to completion untouched. It
  ends when the work is done or the owner's real 5-hour usage holds — the item #6 fix, for every child too.
- Runaway is still bounded — by a cumulative-turn cap, a wall-clock cap, and a substantive-progress guard —
  instead of a single per-message turn count. **No phantom dollar stop is added** (ADR-0022 preserved): the
  only resource hard stop remains real 5-hour usage; `max_chat_usd` is advisory unless opted in.
- **This is a mid-trial change to automatic stop/continue behavior.** It reduces interruption (the trial
  goal) but increases how long approved work runs unattended. The cost ceiling + live notices + Stop are
  what keep that from shocking the owner; the owner must accept those defaults. If the defaults clip
  honest work or feel too loose, they are config, tunable without code.
- Fixed in PCC source, so scaffolded children (ITM, LE) inherit it — no per-child hand-patching.

## Confirmation

*Plan — executed on acceptance; nothing here is built yet.*

- Extend `app/tests/unit/auto-continue.test.js`: the gate allows repeated continues while under all
  backstops; denies at each backstop independently (cumulative turns, wall-clock, and the
  no-substantive-progress guard across N segments); a real 5-hour usage hold stops the run; **no dollar
  value ever forces a stop** (advisory only); still denies every non-`max_turns` kind and every read-only
  chat; fails closed on missing config.
- Extend `app/tests/e2e/boundary.spec.js` with a multi-`max_turns` fixture: an approved send that hits
  the cap twice continues twice on the same `--resume` session, then a third stop at the cumulative-turn
  backstop surfaces a plain "hit the N-turn safety ceiling" stop — never a raw envelope; read-only still
  hard-stops on the first `max_turns`.
- A spec at `docs/specs/approved-work-runs-to-completion.md` (EARS acceptance criteria) with every
  criterion mapped to a test; full suite + lint green on the exact commit (CI); Codex verifies the diff.

## Engagement

*Plan — where this wires in once accepted.*

- **Owner:** an approved multi-step task finishes on its own; he watches cumulative turns/cost climb in a
  notice and can Stop; a stop now means a real ceiling was hit, with how to raise it. No more relaying.
- **Claude worker:** implements the extended `decideAutoContinue` (loop-until-ceiling), the cost/turn/
  wall-clock/no-progress accounting, the running notice, and the `max_chat_turns` config + defaults.
- **Codex verifier:** co-designs the ceilings (esp. the no-progress guard and cost accounting) and
  verifies the diff (static + runnable checks; the E2E is worker-attested — it cannot launch Electron).
- **Future chats / children:** the policy + ceilings live here and in the spec; inherited by every scaffold.

## Owner decisions (recorded 2026-07-26; status stays Proposed pending implementation + proof)

1. **Run mode — DECIDED: automatic for all approved work.** Owner: *"work continues safely. less
   babysitting always."* Any build-authorized chat runs its task to completion without the owner relaying;
   Stop is always available; a running notice shows cumulative turns/cost.
2. **Opt-in per-task spend cap — DEFERRED (owner undecided; a long-standing open question).** Baseline for
   the initial build: dollars stay advisory (ADR-0022), no hard dollar stop. An opt-in per-task $ ceiling
   can be added later as a separate, additive switch — it does not block or change the core fix, so the
   undecided debate does not hold up item #6.
3. **Backstop starting defaults (tunable, not a hard decision):** cumulative-turn cap 200, whole-run
   wall-clock 30 min, and N = 2 consecutive no-substantive-progress segments. Conservative starting points
   to catch a true spiral without clipping a long honest build; revisit after real use.

## Supersedes / Related

Extends **ADR-0023** (auto-continue once → run-to-completion) without changing its trigger scope, guarded
prompt, or no-escalation rule. Continues the trial spine of **ADR-0022** (only real usage/cost stops
approved work) and **ADR-0020** (phantom dollars on a flat plan). Related: ADR-0021 (build-authority the
continue reuses), ADR-0012 (the real 5-hour usage meter — the one legitimate hard stop). Origin: backlog
item #6; observed live in the 2026-07-25 LE trial and the 2026-07-26 ITM session.
