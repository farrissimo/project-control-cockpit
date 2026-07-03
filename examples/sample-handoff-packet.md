# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pc-v1-001
* Task Title: Create V1 stateful handoff proof
* Task Status: drafted

## Objective

Prove that Project Control Cockpit can create a bounded worker directive, hand it to Claude Code through a local file bridge, receive a worker result, verify the result, and update or reject state based on the verifier verdict.

## Current Truth

* Project Control Cockpit is a local-first AI project control cockpit.
* The primary goal is reducing owner babysitting.
* V1 must stay lean.
* Worker claims are evidence, not truth.
* State updates require verifier PASS or explicit owner override.
* Claude Code is the initial worker layer.
* V1 uses a local file bridge.

## Exact Next Action

Create the initial V1 proof folder structure and files needed for the file-based worker handoff cycle.

## Allowed Scope

The worker may:

* Create `.cockpit/state/`
* Create `.cockpit/handoff/`
* Create `.cockpit/result/`
* Create `.cockpit/logs/`
* Copy or adapt the sample state files into `.cockpit/state/`
* Create `.cockpit/handoff/worker-directive.md`
* Create placeholder result files if useful for the proof

## Forbidden Scope

The worker must not:

* Build a full desktop UI
* Add paid API dependencies
* Add broad model orchestration
* Add CCB integration
* Redesign the project scope
* Modify project goals or owner decisions

## Completion Criteria

The task is complete only if:

* `.cockpit/state/project-state.json` exists
* `.cockpit/state/task-state.json` exists
* `.cockpit/handoff/worker-directive.md` exists
* `.cockpit/result/` exists
* `.cockpit/logs/` exists
* The worker directive includes objective, allowed scope, forbidden scope, completion criteria, and required evidence
* No forbidden-scope work was performed

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
