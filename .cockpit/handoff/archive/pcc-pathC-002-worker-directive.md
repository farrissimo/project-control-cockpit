# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathC-002
* Task Title: Truth Surface: Repair Canonical State Drift For Checkpoint Prep
* Task Status: returned_for_verification
* Task Safety Class: C (see docs/BRR_POLICY.md "Task Safety Classification")

## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* Every PCC capability must use a documented .cockpit file-bridge contract with no hidden shared state or undocumented cross-script assumptions.
* State updates require verifier PASS or explicit owner override.
* Prefer local deterministic tools before model usage.
* Avoid fake intelligence scoring and fake truth detection.
* Worker claims are evidence, not truth.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.

## Communication Defaults

The owner's standing communication preferences (apply these without being asked; DECISION-009 / §7.16):

* Tone: direct
* Language level: mixed
* Chattiness: concise
* No cheerleading: True
* Concise by default: True
* Explicit uncertainty: True
* Separate facts from inference: True
## Exact Next Action

Repair the owner-approved canonical-state drift before checkpoint work proceeds: update .cockpit/state/project-state.json so its DECISION-020 summary reflects DECISION-065's supersession of the old per-push approval clause, add the modularity/extractability rule to active_constraints in worker-facing canonical form, regenerate the live handoff artifacts from the updated state, and re-run scripts/validate-cockpit-state.ps1, scripts/check-schemas.ps1, and scripts/doctor.ps1 against the resulting repo state. This is pre-checkpoint Task 1 from the owner-approved sequence, and it is held for independent Codex verification rather than self-close.

## Allowed Scope

The worker may:

* Edit .cockpit/state/project-state.json to repair the approved canonical-state drift.
* Regenerate the live handoff artifacts from canonical state using the existing repo scripts.
* Run scripts/validate-cockpit-state.ps1, scripts/check-schemas.ps1, and scripts/doctor.ps1 and report their results honestly in the worker handback.
* Write the worker handback to .cockpit/result/worker-result.md and finalize the handback through the normal repo path.

## Forbidden Scope

The worker must not:

* Do not edit docs/DECISIONS.md, docs/PROJECT_CHARTER.md, backlog/IDEAS.md, or any schema as part of this task.
* Do not change any script logic, verdict definitions, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not add any new log event type or change routing-log.jsonl semantics.
* Do not self-close the task, write a verification verdict, or manually invoke codex exec for this task's verification.
* Do not broaden this into the Category C accounting decision or the extractability audit; those are separate owner-approved tasks.

## Completion Criteria

The task is complete only if:

* .cockpit/state/project-state.json's DECISION-020 summary is corrected so it no longer claims per-push owner approval is still required, and instead reflects DECISION-065's supersession of that clause.
* project-state.json's active_constraints gains the modularity/extractability rule in concise worker-facing form, consistent with docs/PROJECT_CHARTER.md and DECISION-074/077.
* The live handoff artifacts are regenerated from the updated canonical state, and .cockpit/handoff/worker-directive.md reflects the corrected active_constraints.
* scripts/validate-cockpit-state.ps1 passes against the updated state.
* scripts/check-schemas.ps1 passes against the updated state and existing schemas.
* scripts/doctor.ps1 runs successfully against the updated state; any WARN output is disclosed honestly in the worker result rather than hidden.
* The task is handed back through the normal worker path for independent Codex verification; it is not self-closed.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results for validate-cockpit-state.ps1, check-schemas.ps1, and doctor.ps1.
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
