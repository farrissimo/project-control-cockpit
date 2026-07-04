# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-012
* Task Title: Add safe-stop clean-rollover command
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

Create a local deterministic safe-stop command that confirms the repo is in a resumable state before ending a session: check state consistency and restart safety using existing checks, confirm canonical next_action is present and current, and print a short human-readable summary of what to read first and what to do next. It must not advance task status, write a verification verdict, or gate anything - it is a convenience wrap-up step, not enforcement.

## Allowed Scope

The worker may:

* Update scripts/ to add the safe-stop command.
* Update .cockpit runtime files only as needed for the command or its demonstration.
* Update docs directly related to safe-stop, rollover, restart safety, or canonical state.
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.
* Do not advance task_status or write a verification verdict from this command; that remains the verifier's exclusive action per DECISION-006.

## Completion Criteria

The task is complete only if:

* A local deterministic safe-stop command exists that composes existing checks (state consistency and restart safety) into one readable 'safe to stop' summary.
* The command surfaces the current canonical next_action from task-state.json/project-state.json without inventing new status or rewriting it.
* The command does not advance task status, write verification verdicts, or gate/block anything; it is read-only aside from any explicitly-scoped derived refresh it performs.
* The summary clearly tells a human what to read first and what the next action is, so a fresh session can resume cold.
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
