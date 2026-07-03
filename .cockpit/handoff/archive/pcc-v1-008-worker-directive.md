# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-008
* Task Title: Run the dual-restart proof cycle
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

Create one bounded dual-restart proof that demonstrates both a fresh advisor session and a fresh Claude worker session can resume from canonical repo truth and complete one real PCC cycle without owner re-briefing. Use the existing advisor restart brief, worker directive, and verified artifact paths as the core inputs. Keep the work local, explicit, and bounded.

## Allowed Scope

The worker may:

* Update scripts/ for the dual-restart proof helper.
* Update .cockpit runtime files only as needed for the helper.
* Update docs directly related to the helper, restart proof, or canonical state.
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

* A bounded dual-restart proof artifact or helper exists.
* The proof uses the generated advisor restart brief, the generated worker directive, and canonical repo truth as its primary inputs.
* The result clearly shows how both a fresh advisor session and a fresh worker session can resume cold and complete one PCC cycle without owner re-briefing.
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
