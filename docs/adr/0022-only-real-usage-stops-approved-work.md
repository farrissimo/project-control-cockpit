---
status: Proposed
date: 2026-07-25
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0022: Only the owner's real Claude usage may hard-stop approved work

## Context and Problem

The trust trial's whole bar is that PCC must not interrupt the owner's real work in a way he can't
predict from the screen. Incident TRIAL-LE-01 (`docs/incidents/2026-07-25-land-evaluator-trial-blocker.md`)
was exactly that failure: approved work hard-stopped while the two on-screen meters looked healthy.

A code + Codex audit of the measurement layer (2026-07-25) reframed the problem. The owner's real
requirement is not "make every meter perfect" — it is **"approved work must never be stopped by a
fake or misset limit; only my real Claude usage should stop it."** Judged against that rule, the
issue is the **stop policy**, not the displays. Today PCC can stop or reroute approved work on four
controls, and only ONE of them is the owner's real usage:

| Control | Effect on approved work | Real Claude usage? |
|---|---|---|
| `--max-budget-usd` (per-turn $, default $3) | hard-stops the turn | No — a **phantom** dollar figure on a flat plan |
| per-chat cumulative $ (default $15) | auto-reroutes to a fresh session | No — same phantom dollars |
| `--max-turns` (default 30) | hard-stops the message | No — an agentic-step count |
| 5-hour usage hold (≥90%) | intercepts, owner chooses | **Yes** — the real plan % |

On a flat subscription, Claude's `total_cost_usd` is the *metered-API-equivalent* cost, not money
leaving the owner's account (ADR-0020 already notes "dollars are partly phantom on a flat plan").
So the two dollar caps stop/reroute approved work on a number that is not the owner's real spend —
the definition of a false stop.

## Decision

**Only the owner's real 5-hour Claude usage may HARD-STOP or reroute approved work.** Every other
control is re-classified:

1. **Per-turn dollar cap (`max_turn_usd` / `--max-budget-usd`)** → **demoted to advisory.** PCC no
   longer passes `--max-budget-usd` on chat turns, so the per-turn dollar cap can never abort a
   turn. The value stays in `usage-limits.json` and the real `total_cost_usd` is still parsed and
   logged — as **telemetry**, never a gate.
2. **Per-chat cumulative dollar cap (`max_chat_usd`)** → **demoted to advisory.** `recordChatCost`
   accumulates each chat's real cost for display but **never triggers a rollover and never resets the
   counter.** Crossing $15 no longer reroutes the worker or starts a fresh session.
3. **`max_turns`** → stays a *runaway backstop* for now, but its bare-stop behavior is a KNOWN
   residual false-stop, fixed in a SEPARATE later slice (ADR-0023: approved work auto-continues past
   the turn cap under a visible hard ceiling — Task 1.2). This ADR does not change `max_turns` yet;
   it names it as the remaining non-real stopper.
4. **Payload caps** (`app/payload-caps.js`) → kept as explicit, visible **input safety rails** (they
   trim an over-large single send with a visible marker; they do not stop a turn). Their ceilings are
   validated as high enough not to clip normal work; not redesigned here.
5. **5-hour usage hold (≥90%)** → **kept as the one legitimate hard stop**, unchanged. It acts only
   on a fresh, available real reading and fails honest (stale/unknown never holds).

This **supersedes the hard-stop intent** of ADR-0014 (per-turn budget cap) and ADR-0015 (cross-turn
cost rollover): their *mechanisms* remain as measurement/telemetry, but their authority to stop or
reroute approved work is withdrawn. Nearest-limit ranking (ADR-0018 ext) is corrected so a demoted
spend guard is never named as "the nearest stop."

Scope discipline: this ADR changes **stop authority only**, not the accuracy work on the meters and
not the `max_turns` continuation redesign.

## Consequences

- Approved work can no longer be halted or silently rerouted by a phantom-dollar number. The only
  thing that stops it is the owner's real plan usage (or his own Stop, a context change, a launch
  failure, or Anthropic's own limit) — matching the owner's stated rule.
- Dollar figures become honest advisory telemetry (still logged for "what spent my tokens").
- One residual non-real stopper remains by design: `max_turns` bare-stop, tracked to ADR-0023.
- A malformed/hostile `usage-limits.json` can no longer *disable* a stopper that no longer exists —
  the fail-closed-to-a-cap concern for the dollar caps is moot once they don't gate.

## Confirmation

- `app/tests/e2e/boundary.spec.js` — the send path **no longer** passes `--max-budget-usd`
  (assertion inverted from the ADR-0014 test); the `--max-turns` cap is untouched.
- `app/tests/e2e/cost-rollover.spec.js` — rewritten: crossing the old $15 point produces **no
  rollover notice and no fresh session** (still `--resume`), while the accumulated cost is still
  tracked (read back via `pcc:nearestLimitData` `chatUsd`) — proving demoted-to-advisory, not
  deleted.
- `app/tests/unit/nearest-limit.test.js` — a spend guard at 100% is **never** returned as the
  nearest stop; only real usage / turn cap can be.
- The 5-hour hold proofs (`app/tests/e2e/usage-protection.spec.js`, `usage-protection.test.js`)
  still pass unchanged — the one legitimate stop is not weakened.
- Full suite + lint green on the exact commit (CI, windows-latest); Codex independent verification.

## Engagement

- **Owner:** approved work stops only on his real usage; the dollar meters become advisory and never
  interrupt him. No action required; the change is automatic.
- **Claude worker:** implemented the flag removal, `recordChatCost` accumulate-only, the dead
  reroute-notice removal, the nearest-limit stop-ranking fix, and all test changes.
- **Codex verifier:** advised the stop-policy reframing and the slice order; independently verifies
  the diff (static + the real checks it can run; cannot launch Electron — the E2E is worker-attested).
- **Future chats:** the stop policy lives here; `max_turns` auto-continue is the next slice (ADR-0023).
  Spec: `docs/specs/stop-policy-real-usage-only.md`.

## Supersedes / Related

Supersedes the hard-stop authority of ADR-0014 (per-turn budget cap) and ADR-0015 (cross-turn cost
rollover) — their measurement code remains as advisory telemetry. Related: ADR-0017 (durable chat
cost — now advisory), ADR-0018 + ext (usage-limit message / nearest-limit), ADR-0020 (usage
governance; "phantom dollars on a flat plan"), ADR-0012 (the real 5-hour usage meter — the one
legitimate stop's data source). Follow-on: ADR-0023 (max_turns auto-continue, Task 1.2).
