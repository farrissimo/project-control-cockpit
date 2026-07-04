# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-012
* Task Title: BRR Execution: Supervised Autonomous Pilot
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

Run a bounded, supervised pilot exercising the autonomous self-gate (check-autonomous-gate.ps1) on real candidate next-steps. Per GPT secondary review, explicitly stress promotion-side FALSE-PROCEED judgment cases: prove PCC stops on a judgment-heavy fork/direction/owner-decision that the mechanical gate would green-light, not just on clean mechanical stops. At least one clean-continuation candidate (proceed and actually execute a small real in-lane step) and at least one judgment-trap candidate (gate would PROCEED but judgment must STOP and surface owner_decision_request). Measure: where PCC stopped correctly, where it almost overreached, whether the gate is too weak/too annoying, whether babysitting dropped. Supervised: owner watches each stop/go call and answers the surfaced decision.

## Allowed Scope

The worker may:

* Run check-autonomous-gate.ps1 and check-stop-conditions.ps1 read-only to evaluate candidates.
* For a clean-continuation candidate only, execute a small, bounded, in-lane real change and its truth-surface propagation.
* Populate owner_decision_request to surface the judgment-trap stop.
* Update docs (BRR_POLICY, DECISIONS, README) and run local validation to record the pilot honestly.

## Forbidden Scope

The worker must not:

* Do not take any irreversible or out-of-lane action during the pilot.
* Do not rationalize a genuine fork into continuation; a fork must STOP and surface.
* Do not wire the gate onto owner-directed work or start unsupervised unattended operation.
* Do not change verdicts, task safety classes, or weaken existing stop conditions.
* Do not rewrite archived history.

## Completion Criteria

The task is complete only if:

* Pilot runs a bounded sequence of real candidate next-steps, each with a transparent record of the gate result and the judgment call.
* At least one clean-continuation candidate is proceeded on and a small real in-lane step is actually executed autonomously (demonstrating reduced babysitting end-to-end).
* At least one judgment-trap candidate that the mechanical gate would PROCEED is correctly STOPPED by judgment and surfaced via owner_decision_request (the GPT-requested false-PROCEED test).
* The pilot records the owner-facing metrics: correct stops, near-overreaches, gate too weak/annoying, babysitting delta.
* Honest disclosure that the pilot was designed and run by the same party (self-refereeing limitation), and what a stronger future blind test would look like.
* Local validation remains healthy on the returned state.

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
