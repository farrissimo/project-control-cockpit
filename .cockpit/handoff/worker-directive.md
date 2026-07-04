# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-002
* Task Title: BRR Execution: Deterministic Worker Handback
* Task Status: ready_for_worker
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

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

Reduce the sequencing gap surfaced during pcc-brr2-001 by giving the worker one deterministic local path for final handback ordering. Build the lightest viable worker-side helper or equivalent repo-native mechanism that performs the final returned-for-verification state update, regenerates the live handoff artifacts afterward, and runs the required local health checks last against that actual final state, so the worker is following a concrete repo workflow rather than relying on memory about what order to do those steps in.

## Allowed Scope

The worker may:

* Add or update a narrowly scoped local script or equivalent repo-native helper for the worker's final handback sequence.
* Update worker-facing docs or generator output only as needed to make the final handback sequence explicit and durable.
* Adjust the live handoff artifacts, task state, and closely related docs/scripts needed to demonstrate the new handback path.
* Run the relevant local validation and health scripts to prove the resulting sequence works on the active task flow.

## Forbidden Scope

The worker must not:

* Do not redesign doctor.ps1 into a broad gate for unrelated workflows.
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy content unless a direct contradiction is found.
* Do not broaden into owner-decision capture flow, automatic stop-trigger detection, or autonomous next-task drafting.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually restate the handback sequence once the repo can express it directly.

## Completion Criteria

The task is complete only if:

* The repo gains one concrete worker-facing mechanism for final handback ordering that makes the correct sequence explicit and repeatable: set the final returned-for-verification state, regenerate live handoff artifacts after that state change, then run the required health checks last.
* That mechanism is local-first and bounded: it does not invent new autonomy, change the verification verdict model, or broaden BRR scope beyond fixing the worker handback-ordering gap surfaced by pcc-brr2-001.
* The worker directive and any touched docs tell the worker exactly what to run and when, so the final handback sequence is no longer dependent on memory or chat explanation.
* The resulting final handback path is demonstrated for the active task flow and leaves the repo healthy under scripts/check-schemas.ps1, scripts/validate-cockpit-state.ps1, scripts/enforce-handoff-restart-safety.ps1, and scripts/doctor.ps1 as applicable to the task status being handed back.
* Truth-surface propagation is handled honestly across any touched scripts, docs, live state, and handoff artifacts.
* No automatic owner-decision capture flow, no new acceptance-boundary policy, and no unrelated workflow redesign is introduced.

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
