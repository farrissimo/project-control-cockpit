# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-004
* Task Title: Generate worker directives from canonical state
* Task Status: ready_for_worker

## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* The primary rule is reducing owner babysitting.
* V1 must stay lean and prove one bounded workflow first.
* Worker claims are evidence, not truth.
* State updates require verifier PASS or explicit owner override.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.

## Exact Next Action

Create one local deterministic helper under `scripts/` that drafts `.cockpit/handoff/worker-directive.md` from canonical repo truth, primarily `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`. Keep it bounded, local-first, and explicit. The helper must reduce manual handoff writing rather than introduce broad automation.

## Allowed Scope

The worker may:

* Update `scripts/` for the deterministic helper
* Update `.cockpit/` runtime files only as needed for the helper
* Update docs directly related to the helper or handoff-generation workflow
* Add or update a small validation or demonstration step if needed

## Forbidden Scope

The worker must not:

* Build UI or broader application code yet
* Add dependencies
* Introduce broad orchestration
* Redesign V1 scope
* Change canonical verification verdicts
* Modify unrelated docs
* Require the owner to manually restate or carry the worker instructions

## Completion Criteria

The task is complete only if:

* a local helper script exists under `scripts/`
* the helper reads canonical state from `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`
* the helper drafts `.cockpit/handoff/worker-directive.md` in a worker-ready format
* the generated directive includes the active task objective, boundaries, completion criteria, and required evidence
* the helper is local and deterministic rather than chat-driven
* required evidence is explicit
* no forbidden-scope work was performed

## Required Evidence

Return the following evidence:

* Files created or changed
* Summary of changes
* Commands run, if any
* Command/test results, if any
* Known risks
* Unresolved assumptions
* Confirmation that forbidden scope was not touched

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
