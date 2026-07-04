# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr4-003
* Task Title: Honesty Checks: Metrics Summary
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

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

PILOT RUN #2, CYCLE 2 of 2 (docs/BRR_PLAN.md Phase 4 item 2; scope finalized in DECISION-056). Add a read-only script that summarizes .cockpit/logs/routing-log.jsonl into: a count of each existing event type, and the one ratio docs/BRR_PLAN.md Phase 4 item 2 names explicitly ('claimed-vs-verified completion rate' = verified_pass count divided by total verified_* event count). Explicitly report, rather than approximate, which of item 2's named metrics are not currently derivable from existing log data (owner interruptions per task, repeated instruction frequency, owner-review triggers by category). No new event types, no state mutation, no scoring, no invented categories -- strictly mechanical counting over already-structured, already-labeled data.

## Allowed Scope

The worker may:

* Create one new read-only script (e.g. scripts/summarize-routing-log.ps1).
* Edit docs/DECISIONS.md to record the new decision.
* Create and use a temporary, isolated scratch copy of relevant repo files (outside the live .cockpit/ state) to functionally test the change without touching real task/project state; delete the scratch copy when done.

## Forbidden Scope

The worker must not:

* Do not modify any existing script.
* Do not modify any schema.
* Do not add any new event type or call scripts/log-event.ps1 from the new script.
* Do not have the new script write to any file other than its own stdout (no state mutation, no log mutation).
* Do not invent proxy metrics for owner interruptions, repeated instruction frequency, or owner-review triggers by category -- report them as not currently measurable instead.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- per DECISION-056, hold the self-verified result for owner/GPT review regardless of class.
* Do not touch the self-verification fallback (DECISION-033/036), the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not run any test of this change against the live .cockpit/state/task-state.json, .cockpit/state/project-state.json, or .cockpit/result/verification-result.json -- functional testing happens against a copied routing-log.jsonl in an isolated scratch copy only.
* Do not draft or start a pilot run #3 -- this is the last cycle of run #2; a further run requires a separate review and proposal first.

## Completion Criteria

The task is complete only if:

* PRE-RUN RECORD (per DECISION-056, recorded before execution): proposed Class A (purely mechanical counting over already-structured, already-labeled data; no judgment about what counts as what). Self-close NOT attempted this pilot run regardless of class, per DECISION-056 revision 1 (this run deliberately defers testing self-close to a later run) -- held for owner/GPT review-before-acceptance. In-lane basis: docs/BRR_PLAN.md Phase 4 item 2, an already-approved phase-plan deliverable.
* A new script (e.g. scripts/summarize-routing-log.ps1) reads .cockpit/logs/routing-log.jsonl only, read-only, and reports a count of each existing event type present in the log: next_task_drafted, verified_pass, verified_fail, verified_insufficient, verified_blocked, verified_out_of_scope, correction_applied, stop_condition_fired, gate_blocked, retry_attempted.
* The script computes exactly one ratio: 'claimed-vs-verified completion rate' = verified_pass count / (verified_pass + verified_fail + verified_insufficient + verified_blocked + verified_out_of_scope count). No other ratio, score, or derived judgment is computed.
* The script explicitly reports, by name, which of docs/BRR_PLAN.md Phase 4 item 2's named metrics it does NOT compute because they are not currently derivable from existing log data (owner interruptions per task; repeated instruction frequency; owner-review triggers by category) -- rather than silently omitting them or inventing a proxy for them.
* The script performs no state mutation: it does not write to task-state.json, project-state.json, verification-result.json, or routing-log.jsonl itself. It is a read-only reporting tool.
* The script introduces no new event type, no new schema field, and does not call log-event.ps1.
* Functionally tested (not read-through only) in an isolated scratch copy against the real (copied) routing-log.jsonl content, confirming the reported counts and ratio are arithmetically correct against a manual count of the same file.
* A new decision is recorded in docs/DECISIONS.md.
* docs/BRR_PLAN.md Phase 4 item 2 is not rewritten or marked fully complete -- this delivers a first, narrow, read-only slice of it (counts + one named ratio), not the full metrics deliverable.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or any existing script's behavior.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.
* Pilot-specific: whether any owner interruption was needed, whether the claimed result matches the verified result, whether any stop-trigger fired, and confirmation that the output stayed strictly mechanical (no invented categories or scoring).

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
