# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr1-001
* Task Title: BRR Policy: Owner Review Matrix
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

Write the first BRR Phase 1 policy task by defining the canonical Owner Review Matrix for unattended progress. Record, in durable repo truth, the concrete cases where PCC must stop and wait for owner review before execution or acceptance, keeping the policy practical and bounded per docs/BRR_PLAN.md and DECISION-022. Preferred landing zone is a new narrow-purpose canonical doc such as docs/BRR_POLICY.md, with linked updates to existing canonical docs only if needed for propagation. As a small adjacent housekeeping clarification only if naturally touched, make explicit whether project-state.json's owner_decisions array is a curated operational subset or a full mirror of docs/DECISIONS.md; do not let that sidetrack the matrix itself.

## Allowed Scope

The worker may:

* Create or update narrowly relevant canonical docs for BRR Phase 1 policy, such as docs/BRR_POLICY.md and closely related cross-references.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, and README.md only as needed to propagate the new policy cleanly.
* Adjust .cockpit state or handoff artifacts only insofar as the active task and next action need to stay accurate.
* Add brief examples, tables, or definitions directly supporting the Owner Review Matrix if they stay inside this task's bounded policy scope.

## Forbidden Scope

The worker must not:

* Do not implement Phase 2 behavior, runtime enforcement, automatic gating, or task-class execution logic yet.
* Do not edit scripts/, schemas/, or verification mechanics except for unavoidable truth-surface references that stay docs-only.
* Do not broaden the task into full Task Safety Classification, Stop-Instead-of-Guess Policy, or BRR Operating Definitions beyond what the Owner Review Matrix directly needs.
* Do not change canonical project goals, role assignments, or previously recorded verification verdicts.
* Do not require the owner to restate policy already present in canonical repo truth.
* Do not turn the owner_decisions curation-policy clarification into a separate mini-project or a blocker for completing the matrix.

## Completion Criteria

The task is complete only if:

* The repo gains canonical policy text for an Owner Review Matrix that states, concretely, when PCC must stop and wait for owner review before unattended progress continues.
* The matrix covers at least the owner-required cases named in BRR Plan Phase 1: project-goal changes, architecture or major design direction changes, ambiguous next-step selection with more than one valid path, new external dependencies with meaningful tradeoffs, destructive or irreversible operations, security or secrets or data-risk changes, truth-surface or verification-model or governance-rule changes, high-risk scope changes, repeated failure after bounded retries, insufficient evidence with non-trivial uncertainty, and self-verification on task types deemed too risky for self-acceptance.
* The policy stays practical rather than abstract: concise rule statements plus brief examples or notes where needed, with no new giant state machine, no runtime gating, and no Phase 2 execution logic.
* Truth-surface propagation is handled honestly: docs/DECISIONS.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, and README.md are reviewed and updated only where the new policy or its placement makes them stale.
* If the owner_decisions curation-policy ambiguity is touched, the clarification is small, explicit, and non-blocking, and it does not expand the task beyond the Owner Review Matrix itself.
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
