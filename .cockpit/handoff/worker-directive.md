# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-001
* Task Title: BRR Execution: Task Classification Fielding
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

Field the BRR task safety class into PCC's live task flow in the lightest viable way. Add one explicit Class A/B/C/D field to canonical task state, validate it in schema, and surface it in the worker/advisor handoff artifacts so every active task can carry a visible safety classification. Keep this bounded to lightweight fielding only: make the class visible and durable in state plus handoff surfaces, but do not yet implement automatic stop triggers, owner-decision capture flow, acceptance-boundary enforcement, or autonomous next-task drafting.

## Allowed Scope

The worker may:

* Update schemas/task-state.schema.json and the live .cockpit/state/task-state.json to add and use one BRR task safety class field.
* Update scripts/generate-worker-directive.ps1 and scripts/generate-advisor-restart-brief.ps1 so the active task's class appears in the generated handoff artifacts.
* Update docs/HANDOFF_PACKET_SPEC.md, docs/STATE_MODEL.md, docs/REPO_GOVERNANCE.md, README.md, and docs/DECISIONS.md only as needed to propagate this lightweight fielding cleanly.
* Regenerate the live handoff artifacts and run the relevant local validation/health scripts.

## Forbidden Scope

The worker must not:

* Do not implement automatic stop triggers, automatic blocking, or owner-decision capture mechanics yet.
* Do not add acceptance-boundary enforcement beyond surfacing the class in state and handoff artifacts.
* Do not redesign the BRR classes or reopen Phase 1 policy content unless a direct contradiction is found.
* Do not retrofit archived historical tasks with the new field; this task is about live flow going forward.
* Do not broaden into autonomous next-task drafting or any other Phase 2 deliverable beyond task classification fielding.
* Do not require the owner to restate BRR policy already recorded canonically.

## Completion Criteria

The task is complete only if:

* task-state schema and live task-state gain one explicit BRR task safety class field limited to the four canonical classes defined in docs/BRR_POLICY.md: A, B, C, and D.
* The live task for pcc-brr2-001 is classified explicitly using that field, and the chosen class is justified by the existing BRR policy rather than invented ad hoc.
* The generated worker directive and advisor restart brief both surface the active task's class clearly, so a fresh worker or advisor can see the safety classification without re-deriving it from policy prose.
* docs/HANDOFF_PACKET_SPEC.md, docs/STATE_MODEL.md, docs/REPO_GOVERNANCE.md, README.md, and docs/DECISIONS.md are updated only where this new live task-class field makes them stale.
* Local validation remains healthy: any touched generators, schemas, or state files work cleanly with scripts/check-schemas.ps1, scripts/validate-cockpit-state.ps1, and scripts/doctor.ps1.
* No automatic stop triggers, owner-decision capture flow, acceptance-boundary enforcement, or autonomous task-selection behavior is introduced.

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
