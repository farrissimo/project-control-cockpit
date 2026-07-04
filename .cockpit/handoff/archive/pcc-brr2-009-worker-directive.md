# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-009
* Task Title: BRR Execution: Automatic Stop Triggers
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

Implement BRR Phase 2's fourth deliverable (docs/BRR_PLAN.md Phase 2 item 4, Automatic Stop Triggers) as a deterministic, advisory (non-gating) local check that DETECTS the deterministically-checkable stop conditions and SURFACES them, so PCC stops instead of guessing. Keep it firmly on the 'controlled forward motion, not friction' side the plan demands: it must NOT become automatic-blocking-everywhere and must NOT hard-gate owner-directed work. It must honestly NOT pretend to auto-detect judgment-based stop conditions (fork/multiple-valid-paths, north-star alignment, whether a new owner-level decision is needed) - those remain judgment plus the Owner-Decision Capture Flow, per DECISION-008 (no fake intelligence). Also fold the owner's two governing maxims ('owner approval is for direction changes, not routine continuation inside an already-approved lane' and 'the pre-task prep work is what justifies the automation') into a short shared Governing Principles note in docs/BRR_POLICY.md that governs both the Safe Next-Task Drafting Rules (item 3) and these stop triggers (item 4). Do NOT build acceptance-boundary enforcement (item 5) and do NOT switch on unattended execution.

## Allowed Scope

The worker may:

* Add a narrowly scoped, advisory, non-gating local script for automatic stop-condition detection, composing existing checks (e.g. doctor.ps1) and reading live state.
* Add an 'Automatic Stop Triggers' section and a shared 'Governing Principles' note (the two owner maxims) to docs/BRR_POLICY.md, and cross-reference from docs/REPO_GOVERNANCE.md and docs/HANDOFF_PACKET_SPEC.md as needed.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, and README.md only as needed to propagate cleanly.
* Regenerate the live handoff artifacts and run the relevant local validation/health scripts to demonstrate the change; use disposable scratch copies for any deliberately-tripped stop-condition test.

## Forbidden Scope

The worker must not:

* Do not make the stop-condition check a hard gate on any other script, on task execution, or on owner-directed work; it stays advisory/non-gating like doctor.ps1. scripts/enforce-handoff-restart-safety.ps1 remains the only script permitted to gate a handoff.
* Do not pretend to auto-detect judgment-based stop conditions (fork, north-star alignment, whether a new owner decision is required); name them as out-of-reach-for-automation, per DECISION-008.
* Do not build acceptance-boundary enforcement (Phase 2 item 5) or switch on unattended execution / auto-run any task.
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy meaning unless a direct contradiction is found; do not weaken any existing stop condition.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually restate BRR policy already recorded canonically.

## Completion Criteria

The task is complete only if:

* A deterministic local script (e.g. scripts/check-stop-conditions.ps1) detects the checkable stop conditions from live state and reports a clear 'CLEAR TO PROCEED' vs 'STOP: <reasons>' summary. At minimum it detects: an unresolved owner_decision_request on the active task; a repo-health [ISSUE] (via doctor.ps1); an active task not in a proceed-eligible status; and a self-promoted task (promotion_basis populated) whose recorded lane is not one of the approved-lane sources named in the Safe Next-Task Drafting Rules.
* The script is advisory and non-gating by default, consistent with doctor.ps1: it always exits 0 and never hard-blocks any other script, task, or owner-directed action. Any 'stop' it reports is a surfaced recommendation, not an automatic halt of the whole system (docs/BRR_PLAN.md Phase 2 special caution: controlled forward motion, not friction).
* The script and its BRR_POLICY section explicitly state which stop conditions it does NOT auto-detect (fork / more-than-one-defensible-path, north-star alignment, whether a new owner-level decision is required) and that those remain judgment surfaced via owner_decision_request - it must not fake detecting them (DECISION-008).
* docs/BRR_POLICY.md gains an 'Automatic Stop Triggers' section describing what is auto-detected vs. what stays judgment, tied to the Stop-Instead-of-Guess Policy, the Owner Review Matrix, and the Safe Next-Task Drafting Rules gate rather than duplicating or contradicting them.
* The owner's two governing maxims are recorded verbatim in a short shared 'Governing Principles' note in docs/BRR_POLICY.md, positioned to govern both the Safe Next-Task Drafting Rules and the Automatic Stop Triggers.
* The script is demonstrated on the live clear state (reports CLEAR) and on at least one deliberately-tripped stop condition in a disposable scratch copy (reports STOP with the reason), without touching the live repo for the failure case.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, and README.md, updating only what this actually makes stale.
* Local validation remains healthy on the actual returned-for-verification state (scripts/check-schemas.ps1, scripts/validate-cockpit-state.ps1, scripts/doctor.ps1).

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.

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
