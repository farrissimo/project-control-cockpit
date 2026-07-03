# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-002
* Task Title: Prove the first live PCC control loop
* Task Status: drafted

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

Create one file at `.cockpit/handoff/first-proof-handoff.md` that a future worker could use to execute a bounded PCC task without owner restatement. Keep it practical and bounded. The file must identify the exact read path, write path, required evidence format, and blocked behavior for a live worker cycle, and the result must be returned in `.cockpit/result/worker-result.md`.

## Allowed Scope

The worker may:

* Update `.cockpit/` runtime files
* Create `.cockpit/handoff/first-proof-handoff.md`
* Update docs directly related to the worker proof task
* Clarify the return format for `.cockpit/result/worker-result.md`

## Forbidden Scope

The worker must not:

* Build application code yet
* Add dependencies
* Introduce broad orchestration
* Redesign V1 scope
* Change canonical verification verdicts
* Modify unrelated docs
* Require the owner to manually restate or carry the worker instructions

## Completion Criteria

The task is complete only if:

* `.cockpit/handoff/first-proof-handoff.md` exists
* the proof handoff clearly states what the worker reads first
* the worker return path is explicit
* required evidence is explicit
* blocked behavior is explicit
* the created artifact directly supports a live PCC control loop rather than only describing the system at a high level
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
