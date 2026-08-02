---
status: Proposed
date: 2026-07-30
deciders: owner
feature: true
---

# ADR-0030: Add governed parent-child dispatch for spawned projects

## Context and Problem

The ITM trust-proving campaign exposed a useful workflow that PCC does not yet support directly:
the owner needed to move work forward in a child project while away from the PCC app. We improvised a
remote governed send by restarting PCC with a temporary Chromium debug port, connecting to the live
renderer, using PCC's own `requestJob` / `approveJob` authority path, and then calling the renderer's
own `sendMessage(...)` into ITM's active chat.

That worked, and it preserved the important rules:

- the child project chat received a normal user message
- build authority stayed chat-bound and expiring
- PCC launched the worker itself with the right sandbox
- the child repo recorded its own ADR/proof receipts
- the parent did not run the child work directly

But it was a backdoor operation, not a first-class product capability. The owner should not depend on
a worker remembering a brittle debug-port recipe just to say "keep working" to a spawned project.

This is not only a convenience issue. During the same session, governed parent-to-child messages
created real value:

- started the ITM stress campaign without bypassing PCC
- clarified and corrected an overstated Fresh Setup finding
- restarted a stopped child worker several times
- forced "keep working" behavior when the child kept stopping after one status reply
- kept the trust window moving while the owner could not operate PCC directly

## Decision

We will explore a first-class **governed parent-child dispatch** capability.

PCC should be able to send an explicit owner-approved instruction from a parent project context into a
selected child project's existing PCC chat, while preserving the same trust rules as an in-app send.
The capability is dispatch, not hidden remote control.

Minimum shape:

- The owner selects a child project and target chat, or PCC uses the currently active child chat only
  when that selection is explicit and visible.
- PCC records a parent-side dispatch receipt: parent project, child project, child chat id, message
  summary, timestamp, requested mode, authority result, and spawned worker/process result.
- The child receives the instruction as a normal user message in its own canonical chat store.
- Build authority still uses PCC's owner-granted `requestJob` / `approveJob` model, bound to that
  child chat and expiring normally.
- Read-only status check-ins must not grant build authority.
- Build continuations must say they are build continuations, with the bounded job name visible.
- The child remains responsible for writing its own ADRs, proof receipts, and final status in its own
  repo.
- PCC can read child progress only from durable artifacts and chat replies, not from a worker's
  unrecorded internal state.
- A child project can never silently mutate PCC through this channel. Any parent change suggested by
  a child still goes through the existing proposal -> owner sign-off -> parent implements protocol.

Possible interaction names:

- "Send to child project"
- "Continue child task"
- "Check child progress"
- "Keep child working"

This ADR does not choose the final UI or implementation mechanism. It records that the capability is
worth designing as an official, governed feature rather than leaving it as an undocumented debug-port
workaround.

## Consequences

Gain:

- Reduces babysitting when spawned projects need nudges, status checks, or continuations.
- Lets the owner manage child project work while away from the PCC app.
- Turns a useful emergency backdoor into a visible, logged, auditable workflow.
- Keeps spawned-project work inside the child project's own chat, authority, sandbox, and proof
  trail.
- Makes "keep working, document blocker, continue next useful test" a repeatable workflow instead of
  a manual ritual.

Give up / risks:

- Adds a cross-project control surface, which is high-trust and easy to overbuild.
- If implemented loosely, it could become invisible automation or parent control of children, which
  would weaken PCC's trust model.
- It may encourage long-running unattended child work, so status, expiry, and stop conditions must be
  obvious.
- The dispatch receipt itself can prove that PCC sent a message and spawned a worker, but it cannot
  prove the child completed the work. Completion still requires child receipts and independent
  verification.

Honest boundary: this should not become arbitrary background orchestration, scheduled automation, or
multi-agent command-and-control. The first useful version should be small: explicit owner dispatch to
one child chat, with receipts.

## Expected-Behavior Map

| behavior | control / interaction (button/action) | expected visible / observable result | source | status | test / evidence |
|---|---|---|---|---|---|
| Send a status check to a child project | Owner chooses child project + chat and sends a read-only message | Child chat receives a normal user message; no build authority is granted | STATED 2026-07-30 chat: check progress without sending work messages unless intended | D | Proposed; future e2e should inspect child `chats.json` and authority store |
| Continue an approved child task | Owner chooses child project + chat and approves a bounded continuation | PCC grants authority only for that child chat, sends the message, and launches the child worker with build sandbox | STATED 2026-07-30 ITM campaign: governed continuation was useful | D | Proposed; future e2e should verify `requestJob`/`approveJob`, child chat append, and spawned argv |
| Record parent-side dispatch receipt | Dispatch completes or fails | Parent repo records target project/chat, authority result, timestamp, and worker spawn/result summary | INFERRED from trust model; dispatch must be auditable | D | Proposed; future test should validate receipt schema and failure cases |
| Preserve child-side proof ownership | Child worker acts after dispatch | Child repo records ADR/proof/status in its own files; parent does not claim completion from dispatch alone | STATED 2026-07-30 ITM campaign receipts | D | Proposed; future verifier checks parent receipt + child receipt linkage |
| Prevent silent parent mutation by child | Child suggests a PCC-side improvement | PCC does not accept or apply parent changes through the child channel; parent-change protocol remains required | REFERENCE ADR-0002/ADR-0003 in ITM; PCC trust model | D | Proposed; future test should assert dispatch cannot target parent mutation endpoints |
| Make blockers visible and actionable | Child reports blocked work | Parent view shows blocked/partial/not-proven status from durable child artifacts, not a fake green | STATED 2026-07-30 stress-window discussion | D | Proposed; future e2e with synthetic child receipts |
| Avoid hidden automation loops | Owner sends one dispatch | PCC sends one bounded instruction and waits for child evidence; it does not keep auto-sending forever | INFERRED from anti-babysitting without invisible control | D | Proposed; future test should assert no implicit repeat dispatch |
| Support "keep working" without questions | Owner dispatches a continuation instruction | Child receives explicit continuation wording; any later stop must cite a real blocker or completion receipt | STATED 2026-07-30 ITM check-ins | D | Proposed; future proof via child chat transcript and receipt |

## Confirmation

Not built yet.

Before this ADR can become Accepted:

- Write a one-screen feature spec for the first slice.
- Implement only the smallest explicit-dispatch path.
- Add tests for child selection, read-only status dispatch, build continuation dispatch, authority
  binding, receipt writing, and failure states.
- Prove the send lands in the child canonical chat store.
- Prove build authority is never granted for read-only check-ins.
- Prove a child cannot mutate the parent through the dispatch channel.
- Run the normal PCC checks for the changed slice.
- Get independent verification against the Expected-Behavior Map.

Today's manual evidence is useful prior art, not acceptance proof:
`docs/GOVERNED_REMOTE_SEND_RUNBOOK.md` records the temporary debug-port procedure used during the ITM
trust-proving campaign.

## Engagement

- Owner: gets an explicit way to check, continue, or nudge a child project without operating the child
  app directly, while still seeing what was sent and what proof came back.
- Worker: must use dispatch only for owner-approved parent-child communication; do not run child work
  directly from the parent chat when governed dispatch is available.
- Verifier: reviews both parent dispatch receipt and child-side proof before accepting any completion
  claim.
- Future chats: use this ADR plus `docs/GOVERNED_REMOTE_SEND_RUNBOOK.md` as the starting point for
  the feature design; do not re-invent the debug-port workaround as the product.
- Spawned projects: remain independent; they receive instructions and write receipts, but they do not
  gain authority to change PCC.

## Supersedes / Related

Related: `docs/GOVERNED_REMOTE_SEND_RUNBOOK.md`, `docs/adr/0026-approved-work-runs-to-completion.md`,
`docs/adr/0027-expected-behavior-map-traceability.md`, `docs/adr/0029-worker-provider-selection.md`,
ITM ADR-0002 and ITM ADR-0003.
