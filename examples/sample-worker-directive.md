# Worker Directive

## Receiving Role

Worker

## Task ID

pc-v1-001

## Task Title

Create V1 stateful handoff proof

## Objective

Create the initial `.cockpit/` local file bridge structure and prove that Project Control Cockpit can manage a bounded worker handoff cycle using project state, task state, a worker directive, a worker result path, and a verification result path.

## Current Truth

* Project Control Cockpit is local-first.
* Reducing owner babysitting is the primary rule.
* Worker claims are evidence, not truth.
* State updates require verifier PASS or explicit owner override.
* V1 should prove the workflow before building a desktop UI.
* Claude Code is the initial worker execution layer.
* V1 uses predictable local files for handoff and results.

## Allowed Scope

You may:

* Create `.cockpit/state/`
* Create `.cockpit/handoff/`
* Create `.cockpit/result/`
* Create `.cockpit/logs/`
* Create `.cockpit/state/project-state.json`
* Create `.cockpit/state/task-state.json`
* Create `.cockpit/handoff/worker-directive.md`
* Create `.cockpit/result/worker-result.md` if useful
* Create `.cockpit/result/verification-result.json` if useful
* Create `.cockpit/logs/routing-log.jsonl` if useful

## Forbidden Scope

You must not:

* Build a desktop UI
* Add paid API dependencies
* Add broad multi-model orchestration
* Add CCB integration
* Redesign the project scope
* Modify project goals or owner decisions
* Add complex governance beyond the requested proof

## Completion Criteria

The task is complete only if:

* `.cockpit/state/project-state.json` exists
* `.cockpit/state/task-state.json` exists
* `.cockpit/handoff/worker-directive.md` exists
* `.cockpit/result/` exists
* `.cockpit/logs/` exists
* The worker directive is readable and includes objective, allowed scope, forbidden scope, completion criteria, required evidence, and blocked/failure instructions
* No forbidden-scope work was performed

## Required Evidence

Return:

* files created or changed
* summary of changes
* commands run, if any
* command/test results, if any
* known risks
* unresolved assumptions
* confirmation that forbidden scope was not touched

## Expected Return Format

### Summary

### Files Created or Changed

### Commands / Tests Run

### Results

### Known Risks

### Unresolved Assumptions

### Out-of-Scope Confirmation

## Blocked / Failure Instructions

If blocked:

* stop
* explain the blocker
* list what you tried
* list what evidence you have
* recommend the next action
