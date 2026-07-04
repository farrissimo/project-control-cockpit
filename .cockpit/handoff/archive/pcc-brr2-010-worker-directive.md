# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-010
* Task Title: BRR Execution: Acceptance Boundary Rules
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

Implement BRR Phase 2's fifth and final deliverable (docs/BRR_PLAN.md Phase 2 item 5, Acceptance Boundary Rules) as a canonical POLICY LAYER in docs/BRR_POLICY.md that defines, per task safety class, what PCC may self-complete/self-accept vs. what must wait for independent review. Ground it in the existing Task Safety Classification (Class A safe-unattended = self-acceptable; Class B safe-to-execute-but-review-before-acceptance = must NOT self-accept; Class C/D do not execute unattended so acceptance does not arise) rather than redefining classes. Honor the secondary reviewer's (GPT) explicit constraints: (a) do NOT build enforcement or wire the pcc-brr2-009 stop-detector as a gate - that is a deliberate later task; (b) do NOT switch on or broaden unattended execution; (c) acceptance boundaries constrain PCC's OWN self-acceptance only and must NOT block or add friction to owner-directed work; (d) describe explicitly the clean seam by which a LATER task could hard-gate PCC's self-promotion/autonomous-continuation path (using check-stop-conditions.ps1 CLEAR plus acceptance-boundary-permitted), and state that seam is NOT wired now; (e) reaffirm that a CLEAR stop-check means only 'no mechanically-detectable stop', not 'safe in every sense', with fork/north-star/new-owner-decision still outside automatic detection. Keep it docs-primarily.

## Allowed Scope

The worker may:

* Add an 'Acceptance Boundary Rules' section to docs/BRR_POLICY.md and cross-reference it from docs/REPO_GOVERNANCE.md as needed.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, and README.md only as needed to propagate cleanly.
* Regenerate the live handoff artifacts and run the relevant local validation/health scripts to demonstrate the change.

## Forbidden Scope

The worker must not:

* Do not build enforcement or wire the pcc-brr2-009 stop-detector (or any check) as a hard gate; the acceptance boundary is a policy layer, and wiring the gate is a deliberate later task.
* Do not switch on or broaden unattended execution / auto-run any task.
* Do not block, gate, or add friction to owner-directed work in any way.
* Do not redefine the task safety classes or weaken any existing stop condition; the Task Safety Classification is referenced, not rewritten.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually restate BRR policy already recorded canonically.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains an 'Acceptance Boundary Rules' section defining, per task safety class, what PCC may self-accept vs. what must wait for independent review, grounded in the existing Task Safety Classification (Class A self-acceptable; Class B execute-but-not-self-accept; Class C/D do not execute unattended) without redefining the classes.
* The section states explicitly that acceptance boundaries constrain PCC's OWN self-acceptance only, and never block or add friction to owner-directed work.
* The section states explicitly that it does NOT switch on or broaden unattended execution, and builds no enforcement/gate - the pcc-brr2-009 stop-detector stays advisory and is not wired as a gate here.
* The section describes the clean seam by which a LATER task could hard-gate PCC's self-promotion/autonomous-continuation path (require check-stop-conditions.ps1 CLEAR plus acceptance-boundary-permitted before PCC self-accepts/self-continues), and states that seam is deliberately NOT wired now.
* The section reaffirms that a CLEAR stop-check result means only 'no mechanically-detectable stop found', not 'safe in every sense' - fork, north-star alignment, and whether a new owner decision is required remain judgment (DECISION-008).
* The section reconciles with the current fallback: under DECISION-033/DECISION-036 every cycle is self-verified with disclosure, so the acceptance boundary describes the TARGET (restored two-role) state and how it interacts with the fallback, rather than pretending independent review is happening now.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, and README.md, updating only what this actually makes stale.
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
