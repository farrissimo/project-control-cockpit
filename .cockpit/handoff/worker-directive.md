# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr4-001
* Task Title: Honesty Checks: Activity Log
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* State updates require verifier PASS or explicit owner override.
* Prefer local deterministic tools before model usage.
* Avoid fake intelligence scoring and fake truth detection.
* Worker claims are evidence, not truth.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.

## Exact Next Action

PILOT RUN #1 of the BRR Phase 4 Multi-Cycle Pilot (docs/BRR_PLAN.md Phase 4 item 1; owner-approved scope, this session). Deliver IDEA-008 (backlog/IDEAS.md, rank 4, 'NEXT UP'): extend the append-only event log with two new factual event types -- 'stop_condition_fired' (logged by scripts/check-stop-conditions.ps1 when it reports STOP) and 'gate_blocked' (logged by scripts/check-autonomous-gate.ps1 when it reports GATE: BLOCKED) -- so automatic stop-trigger and gate-block occurrences become measurable history instead of console-only output. Retry-event logging (the other half of IDEA-008's wording) is explicitly deferred as a separate future task; the task-state.json 'attempts' field is not currently incremented by any script, and wiring that up is a larger, separate change.

## Allowed Scope

The worker may:

* Edit scripts/log-event.ps1 to add the two new event types to its ValidateSet only.
* Edit scripts/check-stop-conditions.ps1 to add a logging call on STOP.
* Edit scripts/check-autonomous-gate.ps1 to add a logging call on GATE: BLOCKED.
* Edit docs/DECISIONS.md to record the new decision.
* Edit backlog/IDEAS.md to update IDEA-008's status.
* Create and use a temporary, isolated scratch copy of relevant repo files (outside the live .cockpit/ state) to functionally test the change without touching real task/project state; delete the scratch copy when done.

## Forbidden Scope

The worker must not:

* Do not touch the task-state.json 'attempts' field or add any retry-logging logic -- explicitly deferred, separate future work.
* Do not change what makes check-stop-conditions.ps1 report STOP vs CLEAR, or what makes check-autonomous-gate.ps1 report PROCEED vs BLOCKED -- only add logging around the existing, unchanged decision logic.
* Do not make check-stop-conditions.ps1 gate anything (it must remain advisory, always exit 0) or make check-autonomous-gate.ps1 non-fail-closed.
* Do not modify any schema.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- this is a Class B pilot task targeting review-before-acceptance; hand the self-verified result to the owner/GPT instead.
* Do not touch the self-verification fallback (DECISION-033/036), the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not run any test of this change against the live .cockpit/state/task-state.json, .cockpit/state/project-state.json, or .cockpit/result/verification-result.json -- all functional testing happens in an isolated scratch copy only.
* Do not start a second pilot cycle after this one -- pilot run #1 is exactly one cycle; chaining to a run #2 requires a separate review of this run's results first.

## Completion Criteria

The task is complete only if:

* PILOT NOTE (classified before execution, per owner instruction): Task Safety Class B (touches scripts/, a truth surface; judgment-heavy in deciding what is a 'factual, not narrative' event and where to log it) means self-close is NOT eligible under the existing Acceptance Boundary Rules (docs/BRR_POLICY.md, DECISION-041). This pilot deliberately targets review-before-acceptance: the cycle is self-verified as usual, but scripts/close-out-verified-task.ps1 is NOT run to finalize/commit it -- the completed, self-verified cycle is instead handed to the owner/GPT for actual review before being closed out. This is stricter than this session's usual DECISION-033 fallback pattern (self-verify-and-close-with-disclosure), chosen specifically because testing genuine review-before-acceptance is this pilot's whole point.
* PILOT FAILURE CRITERION (per owner instruction): the pilot is counted as FAILED if the task completes mechanically but later review (by the owner or GPT) shows the task should have stopped, should have been differently classified, or should not have self-closed -- regardless of the task's own PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE verdict. This is a judgment-quality check layered on top of, and separate from, that verdict.
* scripts/log-event.ps1's ValidateSet gains exactly two new event types: stop_condition_fired and gate_blocked. No existing event type or behavior is changed.
* scripts/check-stop-conditions.ps1 logs a stop_condition_fired event via log-event.ps1 when and only when it reports STOP, with a factual (not narrative) detail string drawn from the actual detected reasons. It remains otherwise unchanged: still always exits 0, still never gates anything.
* scripts/check-autonomous-gate.ps1 logs a gate_blocked event via log-event.ps1 when and only when it reports GATE: BLOCKED, with a factual detail string. It remains otherwise unchanged: still exits 0 on PROCEED, non-zero on BLOCKED.
* Neither script's new logging call can cause a false CLEAR/PROCEED result or silently swallow a real STOP/BLOCKED result; if logging itself fails, that failure surfaces visibly rather than being hidden, and this choice is documented in the worker result.
* Functionally tested (not read-through only) in an isolated scratch copy: both new event types are confirmed to actually append to routing-log.jsonl when the respective condition is real, and confirmed that NO new event is logged on a CLEAR/PROCEED result.
* A new decision is recorded in docs/DECISIONS.md.
* backlog/IDEAS.md's IDEA-008 entry status is updated to 'promoted-to-task', consistent with existing entries for delivered ideas.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or the advisory/fail-closed nature of either script being touched.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.
* Pilot-specific: whether any owner interruption was needed during execution, whether the claimed result matches the verified result, whether any stop-trigger fired, and an explicit self-assessment against the pilot failure criterion above.

## Expected Return Format

Return your result in this structure:

### Summary

### Files Changed

### Commands / Tests Run

### Results

### Evidence

### Known Risks

### Unresolved Assumptions

### Out-of-Scope Confirmation

Confirm whether anything outside the allowed scope was touched.

## Blocked / Failure Instructions

If blocked, do not improvise broad changes. Return:

* blocker
* what you tried
* what evidence you have
* recommended next action
