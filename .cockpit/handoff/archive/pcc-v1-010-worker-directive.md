# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-010
* Task Title: Add protected-file backup and restore helper
* Task Status: ready_for_worker

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

Create a local deterministic helper that makes a restore point of PCC's protected control files before risky cycles and can restore a chosen snapshot later without relying on git. Keep the protected file set explicit and small, keep the backup path non-canonical, and keep the helper passive and non-gating.

## Allowed Scope

The worker may:

* Update scripts/ to add the protected-file backup and restore helper.
* Add or update a non-canonical backup location under .cockpit/ only as needed for the helper or its demonstration.
* Update docs directly related to backup/restore handling, protected files, or canonical state.
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.

## Completion Criteria

The task is complete only if:

* A local deterministic backup/restore helper exists for an explicit protected PCC file set.
* The helper can create a timestamped restore point in a non-canonical backup location without depending on git.
* The helper can restore a chosen snapshot of the protected files back into place.
* The change stays within the approved V1 scope and preserves local deterministic behavior.
* The helper remains passive and non-gating; it does not block task completion or become workflow enforcement.
* Claude returns evidence in .cockpit/result/worker-result.md using the required format.

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
