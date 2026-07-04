# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-015
* Task Title: Honesty Checks: Format Check
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

Add a light, non-blocking JSON-schema format check for the three canonical runtime JSON files (project-state.json, task-state.json, verification-result.json) against schemas/*.schema.json, using pwsh's Test-Json (confirmed via a spike to correctly handle our schemas' required fields, additionalProperties: false, enum values, and nullable ["string","null"] union types). Fold this into doctor.ps1 as one additional advisory finding rather than a separate gate; it must never block, halt, or fail any task cycle. This is the last open V1 backlog item before wrap-up.

## Allowed Scope

The worker may:

* Update scripts/ to add the schema-check helper and wire it into doctor.ps1.
* Update .cockpit runtime files only as needed for demonstration.
* Update docs directly related to schema checks, doctor.ps1, or canonical state (docs/HANDOFF_PACKET_SPEC.md, docs/STATE_MODEL.md, docs/REPO_GOVERNANCE.md).
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.
* Do not make the schema check a hard gate or blocking step; it must remain advisory only, consistent with doctor.ps1's existing non-gating design.
* Do not modify schemas/*.schema.json themselves; only add validation against the existing schema definitions.

## Completion Criteria

The task is complete only if:

* A local deterministic script exists (e.g. scripts/check-schemas.ps1) that validates project-state.json, task-state.json, and verification-result.json against their corresponding schemas/*.schema.json files, reporting pass/fail per file with a human-readable reason on failure.
* doctor.ps1 composes this check as one additional advisory finding (OK/ISSUE), consistent with its existing OK/WARN/ISSUE reporting; doctor.ps1 continues to always exit 0 regardless of the result.
* The schema-check script itself never gates, blocks, or fails any other script or cycle; it is invoked the same way as doctor's other composed checks (informational only).
* The check correctly passes on the current live canonical files and correctly fails when a file is made to violate its schema (missing required field, invalid enum value, or a disallowed additional property) - demonstrated with tests.
* The change stays within the approved V1 scope, remains local deterministic, and does not introduce broad orchestration, automation, or a hard gate.
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
