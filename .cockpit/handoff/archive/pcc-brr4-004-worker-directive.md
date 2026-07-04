# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr4-004
* Task Title: BRR Policy: Semi-Autonomy Ceiling
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

Deliver docs/BRR_PLAN.md Phase 4 item 4 ('Semi-Autonomy Ceiling'): record, in docs/BRR_POLICY.md, an explicit, plain statement of what PCC may do unattended in this phase, per Task Safety Class, consolidating what has already been established (Task Safety Classification, Acceptance Boundary Rules, Safe Next-Task Drafting Rules) into one place a reader can check without re-deriving it from four documents. Also close the one concrete gap DECISION-059 found during pilot run #2: nothing currently requires archiving a cycle's evidence before chaining into the next one. Add that as an explicit ceiling rule.

## Allowed Scope

The worker may:

* Edit docs/BRR_POLICY.md to add the new 'Semi-Autonomy Ceiling' section.
* Edit docs/DECISIONS.md to record the new decision.
* Cross-reference docs/BRR_PLAN.md Phase 4 item 4, Task Safety Classification, Acceptance Boundary Rules, Safe Next-Task Drafting Rules, and DECISION-059 without altering their existing content.

## Forbidden Scope

The worker must not:

* Do not modify any existing script or schema.
* Do not redefine Task Safety Classification, the Acceptance Boundary Rules, or the Safe Next-Task Drafting Rules -- consolidate and cross-reference them, do not restate them with different meaning.
* Do not change any existing verdict or the autonomous gate's own decision logic.
* Do not claim Class A self-accept has been demonstrated in practice -- it has not; state this honestly.
* Do not set a chaining ceiling higher than what has actually been piloted (2 cycles) without disclosing that higher numbers are unproven.
* Do not mark BRR Phase 4 complete or advance current_phase.
* Do not build or modify a script enforcing the archive-before-chaining rule -- record it as policy only, consistent with how other BRR policy sections were defined before being fielded.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains a 'Semi-Autonomy Ceiling' section stating, per Task Safety Class, exactly what PCC may do unattended: Class A may be drafted, executed, and self-accepted only when check-stop-conditions.ps1 is CLEAR and check-autonomous-gate.ps1 -Action self_accept reports PROCEED; Class B may be drafted and executed unattended but must never be self-accepted; Class C must never execute without prior explicit owner approval; Class D must never proceed.
* The section honestly distinguishes supported-by-policy from actually-demonstrated: Class B unattended execution + held-for-review has been repeatedly demonstrated this session; Class A self-accept is policy-supported but has not yet been exercised in any real pilot cycle (both pilot runs deliberately held even Class A work for review).
* The section adds one new rule closing DECISION-059's gap: before chaining into a next unattended cycle, the current cycle's evidence (worker directive, worker result, verification result) must be archived first -- not merely committed to git -- so recovery-from-git-history is never the only way to find a prior cycle's record.
* The section states the current chaining ceiling honestly: only 2 chained cycles have actually been piloted (pilot run #2); chaining beyond what has been piloted is not yet trusted and should be treated as new evidence to gather, not assumed safe by extrapolation.
* The section reaffirms, rather than changes, that pushing to any remote always requires a fresh explicit owner instruction regardless of class, and that self-promotion (picking the next task) remains governed entirely by the existing Safe Next-Task Drafting Rules gate -- this section does not redefine either.
* The section explicitly states it grants no new authority and loosens nothing in Task Safety Classification, the Acceptance Boundary Rules, or the Safe Next-Task Drafting Rules -- it consolidates them into one ceiling statement and adds exactly one new discipline (the archive-before-chaining rule).
* A new decision is recorded in docs/DECISIONS.md.
* No change to any of the five verdicts, the autonomous gate's own decision logic, or DECISION-033/036's fallback text.
* No runtime script or schema change is introduced -- the archive-before-chaining rule is recorded as policy; actually enforcing it in a script is not required by this task.

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
