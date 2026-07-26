---
status: Proposed
date: 2026-07-21
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0018: Plain-language messages for external worker-failure conditions (usage limit, sign-in expiry)

## Context and Problem

Under the trust proving window (ADR-0016), the highest-probability *non-cost* shock during a week
of heavy Opus use is the owner **hitting their actual Claude plan usage limit** (the 5-hour /
weekly limit) mid-work — today (2026-07-20) proved that is realistic. Before this change, a worker
turn that failed for that reason fell through to the generic error path and showed the **raw CLI
error text** in a red "assistant error" bubble — reading like PCC broke, when in fact it is
Anthropic's plan limit and nothing is wrong. A scary, confusing message for an expected, harmless
condition is exactly the kind of surprise the proving window targets.

## Decision

Detect the plan-usage-limit failure and replace the raw error with a **calm, plain-language,
reassuring** message.

**Grounded in reality, not guessed:** the detection patterns were **extracted from the installed
`claude-code` binary (2.1.215)** — the real strings it emits: `"usage limit reached"`, `"You've
reached your <model> limit"`, `"out of usage credits"`, `"weekly limit"`. `isUsageLimitError(text)`
in `app/usage-limits.js` matches these and **deliberately excludes** two look-alikes that have their
own correct handling: transient `"overloaded (rate limited)"` (a momentary retry, not a block) and
the per-turn `"Exceeded USD budget"` cap (a PCC-set limit, ADR-0014). Ordering in `askClaude`'s
close handler puts the budget check first, so the two never collide.

The message: *"You've reached your Claude usage limit. This is Anthropic's limit on your plan (the
same one the 'Usage' chip tracks) — not a PCC problem, and nothing is broken. Your chat and full
history are safe. It resets automatically after a while; just send again once it does."* The
renderer styles it as a **neutral** bubble (same treatment as the owner-stop and budget-cap
messages), not the red error style, because it is an external condition, not a PCC failure.

**Honest boundary:** the message does **not** state the exact reset time. The reset timestamp is
only reliably available from the stream's `rate_limit_event` (attachment turns), not the plain
text/json error path, so rather than fabricate or guess a time, the message points to the "Usage"
chip and says it resets automatically. Better a true "resets after a while" than a wrong clock.

## Addendum (same day): sign-in expiry, same treatment

The second-most-likely external week-of-use failure is the owner's **Claude Code sign-in expiring
or signing out** — after which every turn fails until re-login. Same problem (a raw credentials
error reading like a PCC crash), same grounded fix: `isAuthError(text)` matches strings **extracted
from the same 2.1.215 binary** — every auth remedy points at `/login`, plus "not logged in",
"invalid credentials", "re-authenticate", "session/token expired". It is checked in the close
handler **after** `isUsageLimitError` on purpose, because one usage-overage message also mentions
`/login` but is a usage issue first. The message is honest that this one **needs an owner action**
(auth is a browser flow PCC cannot do for you): *"your Claude Code sign-in has expired… sign back
in (run `claude /login`, or reopen Claude Code and sign in)… your chat and history are safe."* —
rendered neutral, not red-error. The pre-existing `worker-auth.json` boundary test was updated: it
now asserts the plain reframed message and that the raw "Invalid credentials" string is **not**
shown. `isAuthError` unit tests include the critical no-false-positive cases (usage-limit, budget,
overload, ordinary output). This is the same decision as the usage-limit handler, so it lives here
rather than as a separate ADR.

## Addendum (2026-07-25): Task 2.1 — the "Nearest stop" reconciler

ADR-0018 made a *fired* limit legible. The LE trust trial exposed the other half: the owner could not
tell, proactively, **which of four limiters was about to stop him**, or reconcile a stop when the
visible meters looked fine (chat length ~21%, 5-hour ~14%, yet stopped by the per-turn spend cap). He
had to reverse-engineer it. Per [PARENT_TRUST_CONTINUITY_PLAN.md](../PARENT_TRUST_CONTINUITY_PLAN.md)
Task 2.1 and Codex advisory (2026-07-25), the fix is an **extension of this ADR, not a new one**.

**Decision:** add one honest "Nearest stop" reconciler over the four limiters — `max_turns`,
`max_turn_usd`, `max_chat_usd`, and the real 5-hour Claude usage — and reuse its label on the stop
bubble ("Stopped by: …"). The pure core is [app/renderer/nearest-limit.js](../../app/renderer/nearest-limit.js)
(`nearestStop`). Honesty rules it enforces:
- Each meter ranked WITHIN ITS OWN scale (fraction of its own cap / hold point) — never a fake
  dollars-vs-percent cross-unit ranking.
- Dollar caps labeled **spend guards** (partly phantom on a flat plan, ADR-0020), NOT Claude-plan
  exhaustion; only the 5-hour reading is real plan usage.
- The 5-hour meter is measured against the usage-protection HOLD point (90%, ADR-0020 T4), not 100%.
- A meter with no data (e.g. an unknown/stale 5-hour reading) is EXCLUDED, never inferred; no data at
  all yields `kind:'none'`, never a false answer.

**Bounded slice order:** (1) pure reconciler + unit tests [DONE — 6 tests, suite 338/338];
(2) render one "Nearest stop" line beside the Usage/Chat-length surfaces + reuse the label on stop
bubbles, with an e2e proof; no live per-second progress, no predictive math beyond threshold
comparisons (that is Task 2.2). Confirmation for slice 2: e2e asserts the line names the nearest cap
and the stop bubble names the one that fired; CI green on the exact commit; Codex primary verifier.

## Addendum (2026-07-26): Task 2.2 — live turn-status limiter line

Task 2.1 made the nearest stop legible **between** turns. The remaining LE pain: the owner watches
"Claude is working…" for 7–8+ minutes **during** a turn with no view of progress or which cap is near.
Per [PARENT_TRUST_CONTINUITY_PLAN.md](../PARENT_TRUST_CONTINUITY_PLAN.md) Task 2.2 and Codex advisory
(2026-07-26), this is again an **extension of this ADR, not a new one**.

**Decision:** on the working bubble, keep the existing live elapsed counter and add ONE honest line
naming the only thing that can actually stop approved work — the real 5-hour Claude usage. Pure core:
[app/renderer/turn-status.js](../../app/renderer/turn-status.js) (`liveLimiterLine`). Honesty rules:
- **No dollars** (ADR-0022: `total_cost_usd` is phantom on a flat plan; a dollar cap is never a live
  stopper). The line shows the 5-hour usage vs the 90% hold, or `unknown`/`stale` — never money.
- The reading is the SAME cached 5-hour sample the usage meter reads (usage-meter.js), carrying its own
  freshness. A stale reading is shown but flagged "too old to trust as live"; unavailable → `unknown`;
  PCC never guesses a number (no fake 0%).
- **No fabricated turn count.** `num_turns` exists only on the final envelope, so a "turns so far" field
  would be invented — deliberately omitted (Codex-scoped bounded slice; deferred, not faked).

**Codex rabbit-hole ruling (2026-07-26):** a genuinely live per-turn action/turn stream would mean
refactoring the safety-critical spawn path or inventing data — OUT of scope. Bounded slice = elapsed +
live real-limiter visibility only.

**Acceptance (EARS):**
- WHEN a turn is running THE SYSTEM SHALL show, live, the elapsed time AND a limiter line naming the
  real 5-hour usage vs the 90% hold.
- WHERE the 5-hour reading is stale or unavailable THE SYSTEM SHALL say so plainly and SHALL NOT present
  a stale value as live or fabricate a number.
- THE SYSTEM SHALL NOT present any dollar figure as a live stopper.

**Confirmation:** unit `app/tests/unit/turn-status.test.js` (adversarial: fresh/at-hold/stale/unknown,
no-$, no fake 0%, configurable hold); e2e `app/tests/e2e/turn-status.spec.js` (module wired in the real
renderer + honest across readings; the working bubble shows both lines during a slow turn); the existing
`thinking-elapsed.spec.js` still green (no elapsed-counter regression); CI green on the exact commit;
Codex primary verifier (static + lint; cannot launch Electron — the e2e is worker-attested).

**Engagement:** owner sees, during a long turn, that the only real stopper (5-hour usage) is X% of the
hold — informed, not flying blind. Shared home-app logic → inherited by spawned projects automatically.

## Consequences

- **Gain:** the two most likely heavy-use external shocks (plan-limit hit, sign-in expiry) become
  calm, understood, non-alarming moments — the owner knows it's an external condition, not PCC
  breaking, and that nothing was lost.
- **Cost:** one small detector + a branch in the close handler + a renderer flag.
- **Honest residue:** no exact reset time shown (not reliably available on this path); if Anthropic
  changes the CLI's error wording, the detector could miss it and fall back to the raw text (no
  worse than before, and the patterns are pinned to the real binary so they match today).

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **Unit** (`app/tests/unit/usage-limits.test.js`): `isUsageLimitError` matches the four real
  extracted plan-limit strings; **does NOT** misclassify transient overload or the per-turn budget
  cap (the critical no-false-positive cases); false for ordinary/empty/nullish input.
- **E2E** (`app/tests/e2e/boundary.spec.js`, new fixture `worker-usage-limit.json` replaying the
  real error string): the bubble shows the plain "reached your Claude usage limit … not a PCC
  problem" message, carries **no** `error` class, does **not** leak the raw CLI string, and the chat
  stays usable.
- Full unit suite green; boundary e2e 9/9 (no regression on the 8 pre-existing); lint clean.

## Engagement

- **Owner:** sees a calm explanation instead of a scary raw error when his plan limit is reached.
- **Claude worker:** implemented the detector (from extracted binary strings), the handler branch,
  the renderer styling, and all tests.
- **Codex verifier:** diff-reviews the change (static + lint; cannot launch Electron — the e2e is
  worker-attested).
- **Security-model note:** no capability/IPC change; pure error-message reframing. Not flagged for
  the ADR-0009 GPT trigger.
- **Spawned projects:** shared home-app logic, inherited automatically.

## Supersedes / Related

New surface. Related: ADR-0012 (the "Usage" chip this message points to), ADR-0014 (the per-turn
budget cap this is deliberately distinct from), ADR-0016 (the proving-window rule that prioritized
this), `docs/proposals/desktop-parity.md` (R1).
