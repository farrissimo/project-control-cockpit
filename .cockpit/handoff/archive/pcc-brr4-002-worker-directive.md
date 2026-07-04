# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr4-002
* Task Title: Honesty Checks: Retry Log
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

PILOT RUN #2, CYCLE 1 of 2 (docs/BRR_PLAN.md Phase 4 item 1; scope finalized in DECISION-056). Deliver IDEA-008's remaining 'retry' half: increment task-state.json's currently-unused 'attempts' field on every worker handback, and log a factual 'retry_attempted' event via scripts/log-event.ps1 specifically when a handback follows a prior non-PASS verdict on the same task_id (not on a task's first-ever handback). No new script; the change lives in scripts/finalize-worker-handback.ps1 (attempts/logging) and scripts/log-event.ps1 (new event type).

## Allowed Scope

The worker may:

* Edit scripts/finalize-worker-handback.ps1 to add attempts-incrementing and conditional retry_attempted logging.
* Edit scripts/log-event.ps1 to add the one new event type to its ValidateSet only.
* Edit docs/DECISIONS.md to record the new decision.
* Edit backlog/IDEAS.md to update IDEA-008's note.
* Create and use a temporary, isolated scratch copy of relevant repo files (outside the live .cockpit/ state) to functionally test the change without touching real task/project state; delete the scratch copy when done.

## Forbidden Scope

The worker must not:

* Do not change finalize-worker-handback.ps1's existing refusal conditions, its four-step order, or any of its other existing behavior beyond the attempts/logging addition.
* Do not modify any other script (advance-cockpit-state.ps1, close-out-verified-task.ps1, check-stop-conditions.ps1, check-autonomous-gate.ps1, doctor.ps1, return-inadequate-work.ps1).
* Do not modify any schema.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- per DECISION-056, hold the self-verified result for owner/GPT review regardless of class.
* Do not touch the self-verification fallback (DECISION-033/036), the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not run any test of this change against the live .cockpit/state/task-state.json, .cockpit/state/project-state.json, or .cockpit/result/verification-result.json -- all functional testing happens in an isolated scratch copy only.
* Do not draft or start cycle 2 (pcc-brr4-003) unless this cycle resolves cleanly per DECISION-056's chaining rule (a clean self-verified PASS candidate, no stop-trigger fired, no forbidden-scope issue).

## Completion Criteria

The task is complete only if:

* PRE-RUN RECORD (per DECISION-056, recorded before execution): Class B (touches scripts/; judgment-heavy in defining what mechanically counts as a 'retry'). Self-close NOT attempted this pilot run regardless of class -- held for owner/GPT review-before-acceptance, per DECISION-056 revision 1. In-lane basis: IDEA-008 (backlog/IDEAS.md, rank 4), completing the half explicitly deferred from pcc-brr4-001.
* scripts/finalize-worker-handback.ps1 increments task-state.json's 'attempts' field by 1 on every successful handback (first handback -> 1, next -> 2, etc.).
* scripts/finalize-worker-handback.ps1 logs a 'retry_attempted' event via log-event.ps1 if and only if, at the time of handback, 'attempts' was already greater than 0 AND 'verification_verdict' was already non-null and not 'PASS' (i.e., this handback follows a prior non-PASS verdict on this exact task_id) -- not on a task's first-ever handback.
* scripts/log-event.ps1's ValidateSet gains exactly one new event type: retry_attempted. No existing event type or behavior changed.
* A logging failure in the new retry_attempted call surfaces visibly (a printed [LOGGING WARNING]) but never aborts or changes the outcome of the handback itself -- same safe-logging pattern as pcc-brr4-001.
* No change to finalize-worker-handback.ps1's existing four-step order, its refusal conditions (task_status must be ready_for_worker or in_progress), or any of its other existing behavior.
* Functionally tested (not read-through only) in an isolated scratch copy: a first handback increments attempts to 1 and logs nothing; a simulated second handback (attempts already 1, verification_verdict already set to a non-PASS value) increments attempts to 2 and logs retry_attempted; a simulated handback where the prior verdict was PASS (should not happen in practice, since a PASS-verdict task would be complete, but tested anyway as a boundary case) does not log retry_attempted.
* A new decision is recorded in docs/DECISIONS.md.
* backlog/IDEAS.md's IDEA-008 note is updated to reflect that both the quality-gate half and the retry half are now delivered.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or any other existing script's behavior.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.
* Pilot-specific: whether any owner interruption was needed, whether the claimed result matches the verified result, whether any stop-trigger fired, and an explicit statement of whether this cycle resolved cleanly enough to chain into cycle 2 per DECISION-056.

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
