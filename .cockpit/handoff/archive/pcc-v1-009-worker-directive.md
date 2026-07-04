# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-009
* Task Title: Enforce restart-safety checks before handoff use
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

Add a local deterministic guard so fresh-session handoff artifacts are not treated as ready until restart-safety validation passes. Use the existing advisor restart brief, worker directive, and restart-safety proof helpers as the foundation. Keep the work local, explicit, bounded, and focused on enforcement rather than broader orchestration.

## Allowed Scope

The worker may:

* Update scripts/ to add or wire in restart-safety enforcement before handoff use.
* Update .cockpit runtime files only as needed to support the enforcement step or its demonstration.
* Update docs directly related to handoff enforcement, restart safety, or canonical state.
* Add or update a small validation or demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.

## Completion Criteria

The task is complete only if:

* A local deterministic enforcement step exists that checks restart safety before fresh-session handoff artifacts are treated as ready.
* The enforcement reuses the generated advisor restart brief, the generated worker directive, and canonical repo truth rather than introducing hidden script-only truth.
* The enforcement fails clearly on stale or incomplete handoff inputs and passes on valid inputs.
* The change stays within the approved V1 scope and preserves local deterministic behavior.
* The enforcement remains narrowly scoped and does not introduce broad orchestration or paid dependencies.
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
