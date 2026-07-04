# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr3-005
* Task Title: Safety Net: Non-PASS Close-Out Script
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

Add scripts/return-inadequate-work.ps1, mirroring scripts/close-out-verified-task.ps1's shape (archive, advance state, health-check, log, optional local-only commit) for the four non-PASS verdicts (FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE), fielding the asymmetry named as future work in pcc-brr3-004/DECISION-049. Update docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md's Task Process to name the new script, and make a narrow, disclosed update to docs/BRR_POLICY.md's 'Inadequate-Work Return Path' section noting the script now exists, per DECISION-051's Post-Close Canonical Amendment Rule.

## Allowed Scope

The worker may:

* Create scripts/return-inadequate-work.ps1.
* Edit docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md to name the new script.
* Make the narrow, disclosed pointer update to docs/BRR_POLICY.md's existing 'Inadequate-Work Return Path' section noting the script now exists.
* Edit docs/DECISIONS.md to record the new decision.
* Create and use a temporary, isolated scratch copy of relevant repo files (outside the live .cockpit/ state) to functionally test the new script without touching real task/project state; delete the scratch copy when done.

## Forbidden Scope

The worker must not:

* Do not run scripts/return-inadequate-work.ps1 (or any test of it) against the live .cockpit/state/task-state.json, .cockpit/state/project-state.json, or .cockpit/result/verification-result.json -- all functional testing happens in an isolated scratch copy only.
* Do not wire the new script to be called automatically by any other script (finalize-worker-handback.ps1, verify-handback-guardrails.ps1, advance-cockpit-state.ps1, close-out-verified-task.ps1, check-stop-conditions.ps1, check-autonomous-gate.ps1, enforce-handoff-restart-safety.ps1) -- it stays a manually-invoked convenience tool.
* Do not alter close-out-verified-task.ps1, advance-cockpit-state.ps1, log-event.ps1, doctor.ps1, or any other existing script's behavior.
* Do not modify any schema.
* Do not rewrite or delete pcc-brr3-004's original claim in docs/BRR_POLICY.md that fielding was 'not built here' at the time -- only add a clearly-marked pointer noting later fielding.
* Do not touch the self-verification fallback (DECISION-033/036), the autonomous gate's own logic, the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not mark BRR Phase 3 complete (already recorded, DECISION-050) or advance current_phase.

## Completion Criteria

The task is complete only if:

* scripts/return-inadequate-work.ps1 exists and mirrors close-out-verified-task.ps1's shape (archive-then-advance-then-healthcheck-then-log, optional -Commit that never pushes) for the four non-PASS verdicts.
* The script refuses to run if the verdict is PASS (pointing to close-out-verified-task.ps1 instead), if verification-result.json's task_id does not match task-state.json's, or if an archive path already exists -- matching close-out-verified-task.ps1's existing safety properties.
* The script is actually tested against a synthetic non-PASS cycle in an isolated scratch copy of the repo (not the live repo), demonstrating correct archiving, state advancement, doctor/schema health, and event logging for at least one non-PASS verdict, plus at least one negative test (e.g. refusing on a PASS verdict or a task_id mismatch) -- a real functional test, not a code read-through only, since this is new executable behavior rather than policy prose.
* docs/HANDOFF_PACKET_SPEC.md's 'Recommended Close-Out Order' and docs/REPO_GOVERNANCE.md's Task Process name the new script for the non-PASS path.
* docs/BRR_POLICY.md's 'Inadequate-Work Return Path' section (pcc-brr3-004) receives a narrow, disclosed pointer update noting the script now exists and naming this task -- not a rewrite of pcc-brr3-004's original claim, which was accurate when made, per DECISION-051's Post-Close Canonical Amendment Rule.
* A new decision is recorded in docs/DECISIONS.md.
* No existing verdict, task safety class, the autonomous gate, the Acceptance Boundary Rules, or DECISION-033/036's fallback authority is changed.
* The new script is not made self-invoking, automatic, or gating anywhere -- it remains a manual convenience tool the verifier chooses to run, exactly like close-out-verified-task.ps1; no other script is edited to call it automatically.

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
