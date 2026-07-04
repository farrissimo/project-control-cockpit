# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr3-001
* Task Title: BRR Policy: Verification Depth
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

Define a Verification Depth Policy in docs/BRR_POLICY.md establishing three verification rigor levels (light/normal/strict) and a concrete, checkable mapping from Task Safety Class (A/B/C/D) and task type (deterministic/mechanical vs. judgment-heavy/prose vs. truth-surface-or-governance-affecting) to the level required, per docs/BRR_PLAN.md Phase 3 deliverable 1.

## Allowed Scope

The worker may:

* Edit docs/BRR_POLICY.md to add the new 'Verification Depth Policy' section.
* Edit docs/DECISIONS.md to record the new decision.
* Cross-reference docs/BRR_PLAN.md Phase 3 item 1 and existing docs/BRR_POLICY.md sections without altering their existing content.
* Update docs/HANDOFF_PACKET_SPEC.md or docs/REPO_GOVERNANCE.md only for a brief discoverability cross-reference, with no behavior change.

## Forbidden Scope

The worker must not:

* Do not implement any runtime enforcement, gating, or automatic verification-level selection (no script changes).
* Do not modify any schema, task-state.json fields, or verification-result.json shape.
* Do not change or redefine any existing verdict, task safety class, or stop-condition trigger.
* Do not touch anything under scripts/.
* Do not mark BRR Phase 3 complete or advance current_phase.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains a 'Verification Depth Policy' section defining light/normal/strict rigor levels with concrete, distinguishing criteria for each (what evidence/checks each level actually requires).
* The section ties each level to Task Safety Class (A/B/C/D) and to task type via an explicit mapping, not left to case-by-case judgment.
* The mapping is reconciled against existing canonical policy (Task Safety Classification, Acceptance Boundary Rules, Stop-Instead-of-Guess Policy) with no contradiction introduced.
* A new decision is recorded in docs/DECISIONS.md documenting the policy addition.
* No runtime script, schema, enforcement, or gating change is introduced.
* No existing verdict, task safety class, or stop condition is redefined or weakened.

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
