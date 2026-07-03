# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-006
* Task Title: Generate a fresh-advisor restart brief from canonical truth
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

Create one local deterministic helper that generates a concise advisor restart brief from canonical repo truth and verified artifacts so a brand-new Codex advisor/verifier session can resume the project without owner re-briefing. Keep it local, bounded, and explicit.

## Allowed Scope

The worker may:

* Update scripts/ for the advisor-restart helper.
* Update .cockpit runtime files only as needed for the helper.
* Update docs directly related to the helper, restart-brief generation, or canonical state.
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

* A local helper exists that drafts an advisor restart brief from canonical repo truth.
* The helper uses current project/task state plus verified artifact paths as its primary inputs.
* The generated brief clearly tells a fresh advisor what the project is, what task is active, what was last verified, what to read first, and what happens next.
* The change stays within the approved V1 scope and preserves local deterministic behavior.
* The helper stays within the approved V1 scope and uses local deterministic logic.
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
