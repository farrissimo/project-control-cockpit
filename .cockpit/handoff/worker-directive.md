# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-001
* Task Title: Set up the first Claude Code handoff procedure
* Task Status: drafted

## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, follow the bounded task instructions, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* The primary rule is reducing owner babysitting.
* V1 must stay lean and prove one bounded workflow first.
* Worker claims are evidence, not truth.
* State updates require verifier PASS or explicit owner override.
* Claude Code is the intended initial worker layer, but the workflow is just being set up now.

## Exact Next Action

Document the exact first-run procedure for using Claude Code as the worker in this repository. Keep it practical and bounded. The output should make it easy for the owner to hand Claude Code a directive file and receive a result file without repeated explanation.

## Allowed Scope

The worker may:

* Update `.cockpit/` runtime files
* Update docs directly related to the worker handoff procedure
* Clarify the return format for `.cockpit/result/worker-result.md`
* Clarify how the owner should give Claude Code the directive file path

## Forbidden Scope

The worker must not:

* Build application code yet
* Add dependencies
* Introduce broad orchestration
* Redesign V1 scope
* Change canonical verification verdicts
* Modify unrelated docs

## Completion Criteria

The task is complete only if:

* the first-run Claude Code handoff procedure is clearly written
* the worker return path is explicit
* required evidence is explicit
* blocked behavior is explicit
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
