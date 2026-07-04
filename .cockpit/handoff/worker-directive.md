# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr1-002
* Task Title: BRR Policy: Task Safety Classification
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

Define the BRR Phase 1 Task Safety Classification in canonical repo truth, building directly on the new Owner Review Matrix in docs/BRR_POLICY.md. Record the Class A / B / C / D model there in a practical, bounded way: what each class means, when each class applies, and how the classes relate to owner review and acceptance boundaries, without implementing Phase 2 runtime flow or automatic gating. Reuse and extend docs/BRR_POLICY.md rather than creating another broad planning document unless a narrower truth-surface need clearly requires otherwise.

## Allowed Scope

The worker may:

* Create or update narrowly relevant canonical docs for BRR Phase 1 policy, primarily docs/BRR_POLICY.md and closely related cross-references.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, and README.md only as needed to propagate the new classification cleanly.
* Adjust .cockpit state or handoff artifacts only insofar as the active task and next action need to stay accurate.
* Add brief examples, tables, or definitions directly supporting Task Safety Classification if they stay inside this task's bounded policy scope.

## Forbidden Scope

The worker must not:

* Do not implement Phase 2 behavior, runtime enforcement, automatic gating, or task-class execution logic yet.
* Do not edit scripts/, schemas/, or verification mechanics except for unavoidable truth-surface references that stay docs-only.
* Do not broaden the task into Stop-Instead-of-Guess Policy or BRR Operating Definitions beyond what Task Safety Classification directly needs.
* Do not change canonical project goals, role assignments, or previously recorded verification verdicts.
* Do not require the owner to restate policy already present in canonical repo truth.
* Do not turn adjacent policy ambiguities into separate mini-projects or blockers for completing the classification.

## Completion Criteria

The task is complete only if:

* The repo gains canonical policy text defining Task Safety Classification with the four classes named in docs/BRR_PLAN.md Phase 1: Class A, Class B, Class C, and Class D.
* Each class is described concretely enough that a verifier or owner can tell the difference between safe unattended execution, execute-but-review-before-acceptance, owner approval required before execution, and blocked.
* The classification explicitly builds on and does not contradict the Owner Review Matrix added by pcc-brr1-001; the relationship between owner-required cases and Class C or D is stated rather than left implicit.
* The policy stays practical and docs-only: concise rules, brief examples or notes where helpful, no runtime enforcement, no automatic gating logic, and no premature implementation of Phase 2 flow.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, README.md, and docs/BRR_POLICY.md, updating only what the new classification actually makes stale.
* Claude returns evidence in .cockpit/result/worker-result.md using the required format and calls out any places where independent secondary review is still recommended.

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
