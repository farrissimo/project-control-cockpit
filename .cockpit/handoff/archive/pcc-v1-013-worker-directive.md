# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-013
* Task Title: Honesty Checks: Activity Log
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

Add a local deterministic activity-log helper that appends factual, structured events to .cockpit/logs/routing-log.jsonl, so meaningful cycle events (task drafted, verified PASS/FAIL/etc., corrections applied) are recorded consistently instead of hand-typed free-form JSON prone to drift or omission (as happened this session, when several real entries were missed and had to be backfilled by hand). The helper must be strictly append-only, must validate event/result types against a small explicit set rather than accepting arbitrary free text there, and must be able to derive an entry directly from the current .cockpit/result/verification-result.json so the verifier does not have to hand-type JSON for the common case.

## Allowed Scope

The worker may:

* Update scripts/ to add the activity-log helper.
* Update .cockpit runtime files (specifically .cockpit/logs/routing-log.jsonl) only as needed for the helper or its demonstration.
* Update docs directly related to activity logging, routing-log.jsonl, or canonical state.
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts.
* Do not require the owner to manually restate or carry the worker instructions.
* Do not rewrite, reorder, or delete any existing line already in routing-log.jsonl; append-only means append-only.
* Do not gate, block, or fail any other script/cycle based on log contents; this is a recording tool, not an enforcement tool.

## Completion Criteria

The task is complete only if:

* A local deterministic script exists that appends one well-formed JSON line per event to .cockpit/logs/routing-log.jsonl.
* The script validates event/result type against a small explicit set (e.g. next_task_drafted, verified_pass, verified_fail, verified_insufficient, verified_blocked, verified_out_of_scope, correction_applied) rather than accepting arbitrary free text for that field.
* The script is strictly append-only: it never rewrites, reorders, or removes any existing line in routing-log.jsonl.
* The script can derive an entry directly from the current .cockpit/result/verification-result.json (task_id, verdict, summary) so a verifier does not have to hand-type the JSON for a verification event.
* Recorded detail is factual (what happened) rather than open-ended narrative justification.
* The change stays within the approved V1 scope, remains non-blocking, and does not gate or block any task cycle.
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
