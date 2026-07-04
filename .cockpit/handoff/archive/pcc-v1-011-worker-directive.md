# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-011
* Task Title: Add advisory doctor health-check command
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

Create a local deterministic doctor command that composes the existing PCC checks and answers whether the repo is safe to trust and hand off right now. Keep it read-only, advisory, and non-gating. It may surface schema/state warnings, restart-safety status, handoff freshness, and similar structural signals, but it must not block or replace the separate enforce-handoff gate.

## Allowed Scope

The worker may:

* Update scripts/ to add the advisory doctor health-check command.
* Update .cockpit runtime files only as needed for the doctor report or its demonstration.
* Update docs directly related to repo health checks, warnings, handoff safety, or canonical state.
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.

## Completion Criteria

The task is complete only if:

* A local deterministic doctor command exists that summarizes PCC repo health in one readable report.
* The doctor command composes existing checks rather than inventing hidden script-only truth.
* The doctor command remains read-only, advisory, and non-gating; it does not halt or block a task cycle.
* The report clearly distinguishes warnings from pass/fail-style findings and does not replace the separate enforce-handoff gate.
* The change stays within the approved V1 scope and preserves local deterministic behavior.
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
