# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-008
* Task Title: BRR Execution: Safe Next-Task Drafting Rules
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

Implement BRR Phase 2's third deliverable (docs/BRR_PLAN.md Phase 2 item 3, Safe Next-Task Drafting Rules) as the canonical rule set that operationalizes DECISION-038's auto-promote-and-run target. Define, concretely and falsifiably: (1) what counts as an already-approved lane (owner-reviewed phase plan deliverables and/or owner-ranked backlog priority, not any unreviewed idea); (2) the all-must-be-true gate under which PCC may promote AND begin the next task without per-task owner approval; (3) the requirement that each auto-promotion record which approved lane, backlog priority, and phase-plan item justify it; (4) that any fork (more than one defensible next step, or any Owner Review Matrix case) is a hard trip to the Owner-Decision Capture Flow (DECISION-037), not a tie PCC breaks for itself. Bound this to the DRAFTING/PROMOTION rules only. Do NOT build automatic stop-trigger detection (item 4) or acceptance-boundary enforcement (item 5), and do NOT switch on unattended execution: those depend on items 4 and 5 existing first, per DECISION-038's safe-sequencing clause.

## Allowed Scope

The worker may:

* Add the Safe Next-Task Drafting Rules to docs/BRR_POLICY.md and cross-reference them from docs/REPO_GOVERNANCE.md's Task Process.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, and README.md only as needed to propagate the rules cleanly.
* If needed to make the auto-promotion justification falsifiable, add one optional/nullable structured field to schemas/task-state.schema.json and the generators, following the pattern of task_safety_class and owner_decision_request; keep it capture-only.
* Regenerate the live handoff artifacts and run the relevant local validation/health scripts to demonstrate the change.

## Forbidden Scope

The worker must not:

* Do not build automatic stop-trigger detection (Phase 2 item 4) or acceptance-boundary enforcement (Phase 2 item 5) - those are separate later tasks.
* Do not switch on unattended execution or auto-run any task; this deliverable defines when promotion is allowed, it does not enable running-without-review yet (DECISION-038 safe-sequencing).
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy meaning unless a direct contradiction is found (the Owner Review Matrix and Stop-Instead-of-Guess Policy are referenced, not rewritten).
* Do not weaken any existing stop condition; auto-promotion is additive within already-approved lanes, it must not shrink what stops for the owner.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually restate BRR policy already recorded canonically.

## Completion Criteria

The task is complete only if:

* Canonical policy text (in docs/BRR_POLICY.md, the established home for BRR policy) defines 'approved lane' concretely enough that a reviewer can tell an auto-promotable lane from a not-yet-reviewed idea, grounded in existing repo truth (docs/BRR_PLAN.md phase deliverables and/or backlog/IDEAS.md owner-ranked priority) rather than invented anew.
* The policy states the all-must-be-true gate for auto-promotion-and-start (current task complete/PASS; repo health/state clean; next task inside an approved lane; scope/purpose already sufficiently fleshed out; solves a real project problem aligned with the north star; bounded and classifiable; no new owner-level decision required; no change to project goal/architecture/authority/cost-model/safety-posture), tied explicitly to the Owner Review Matrix and Stop-Instead-of-Guess Policy rather than duplicating or contradicting them.
* The policy requires every auto-promotion to record a falsifiable justification (which approved lane, which backlog priority / phase-plan item), and names where that justification is recorded, so a bad call is catchable after the fact rather than resting on PCC's word.
* The policy states that any fork (more than one defensible next step, or any Owner Review Matrix case) trips the Owner-Decision Capture Flow (owner_decision_request, DECISION-037) instead of PCC choosing unilaterally.
* The policy states plainly that these are drafting/promotion rules only, and that full unattended draft-and-run is not yet live because it also requires Phase 2 items 4 (Automatic Stop Triggers) and 5 (Acceptance Boundary Rules), per DECISION-038's safe-sequencing clause.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, and README.md, updating only what this rule set actually makes stale; any state/schema field added to record the auto-promotion justification is optional/nullable and leaves ordinary tasks unaffected.
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
