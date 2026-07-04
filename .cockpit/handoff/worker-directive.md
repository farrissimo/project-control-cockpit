# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr1-004
* Task Title: BRR Policy: Operating Definitions
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

Define the BRR Phase 1 Operating Definitions in canonical repo truth, extending docs/BRR_POLICY.md so the key terms already used across the prior three BRR policy tasks are explicit, stable, and non-contradictory. At minimum define safe unattended, safe with review, owner decision, blocked, insufficient evidence, and escalation, reconciling them with the Owner Review Matrix, Task Safety Classification, and Stop-Instead-of-Guess Policy already recorded, without introducing runtime enforcement, new statuses, or Phase 2 fielding mechanics.

## Allowed Scope

The worker may:

* Create or update narrowly relevant canonical docs for BRR Phase 1 policy, primarily docs/BRR_POLICY.md and closely related cross-references.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, and README.md only as needed to propagate the new operating definitions cleanly.
* Adjust .cockpit state or handoff artifacts only insofar as the active task and next action need to stay accurate.
* Add brief examples, tables, or definitions directly supporting the operating definitions if they stay inside this task's bounded policy scope.

## Forbidden Scope

The worker must not:

* Do not implement Phase 2 behavior, runtime enforcement, automatic gating, or task-class execution logic yet.
* Do not edit scripts/, schemas/, or verification mechanics except for unavoidable truth-surface references that stay docs-only.
* Do not broaden the task beyond defining and reconciling the BRR operating terms this phase already named.
* Do not change canonical project goals, role assignments, or previously recorded verification verdicts.
* Do not require the owner to restate policy already present in canonical repo truth.
* Do not turn adjacent policy ambiguities into separate mini-projects or blockers for completing the operating definitions.

## Completion Criteria

The task is complete only if:

* The repo gains canonical policy text defining the BRR Operating Definitions named in docs/BRR_PLAN.md Phase 1: safe unattended, safe with review, owner decision, blocked, insufficient evidence, and escalation.
* Each definition is explicit enough to stabilize the terminology already used in the Owner Review Matrix, Task Safety Classification, and Stop-Instead-of-Guess Policy, rather than merely repeating those terms loosely.
* The definitions reconcile with, and do not contradict, the prior three BRR Phase 1 policy sections already recorded in docs/BRR_POLICY.md.
* The policy stays practical and docs-only: concise definitions plus brief notes/examples where needed, no runtime enforcement, no automatic gating logic, and no premature implementation of Phase 2 flow.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, README.md, and docs/BRR_POLICY.md, updating only what the new operating definitions actually make stale.
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
