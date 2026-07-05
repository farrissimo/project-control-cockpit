# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathC-003
* Task Title: Checkpoint Truth: Record Category C Accounting Decision
* Task Status: complete
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
* When explaining repo state, workflow, or decisions, use plain language first and translate any necessary jargon immediately.

## Communication Defaults

The owner's standing communication preferences (apply these without being asked; DECISION-009 / §7.16):

* Tone: direct
* Language level: plain
* Chattiness: concise
* No cheerleading: True
* Concise by default: True
* Explicit uncertainty: True
* Separate facts from inference: True
## Exact Next Action

Record an explicit pre-checkpoint Category C accounting decision in canonical repo truth. Working only from the repo's own evidence, state whether Category C (Metrics & Evidence Depth) is now substantially complete for checkpoint purposes, and explain why IDEA-013 remains deferred absent a concrete evidence-review failure, OR conclude that Category C is not yet substantially complete and identify the one concrete additional Category C task that is still required before the checkpoint. This is the owner-approved pre-checkpoint Task 2, after the state-drift repair and before the final extractability audit gate.

## Allowed Scope

The worker may:

* Edit docs/DECISIONS.md to record the explicit Category C checkpoint-accounting decision.
* Read backlog/IDEAS.md, docs/CCB_PCC_RELATIONSHIP.md, and the relevant checkpoint-related decisions in docs/DECISIONS.md as evidence only.
* Regenerate the live handoff artifacts from canonical state using the existing repo scripts.
* Run scripts/validate-cockpit-state.ps1, scripts/check-schemas.ps1, and scripts/doctor.ps1 and report their results honestly in the worker handback.
* Write the worker handback to .cockpit/result/worker-result.md and finalize the handback through the normal repo path.

## Forbidden Scope

The worker must not:

* Do not edit backlog/IDEAS.md, docs/CCB_PCC_RELATIONSHIP.md, docs/PROJECT_CHARTER.md, or any schema as part of this task.
* Do not make this task perform the extractability audit itself; that remains the separate final pre-checkpoint gate.
* Do not change any script logic, product behavior, verdict definition, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not add any new log event type or change routing-log.jsonl semantics.
* Do not self-close the task, write a verification verdict, or manually invoke codex exec for this task's verification.

## Completion Criteria

The task is complete only if:

* docs/DECISIONS.md gains one new decision that explicitly records the Category C checkpoint-accounting judgment in repo truth.
* The decision plainly states one of two outcomes only: either Category C is substantially complete for checkpoint purposes and IDEA-013 stays deferred for the stated repo-grounded reason, or Category C is not yet substantially complete and exactly one concrete additional Category C task is named as still required.
* The decision's reasoning is grounded in existing repo truth about Category C deliverables and deferments, including IDEA-012, IDEA-013, and the checkpoint criteria in docs/CCB_PCC_RELATIONSHIP.md / DECISION-074.
* No new product behavior, script logic, schema, verdict definition, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule is changed.
* scripts/validate-cockpit-state.ps1 passes after the task's state/doc updates.
* scripts/check-schemas.ps1 passes after the task's state/doc updates.
* scripts/doctor.ps1 runs successfully after the task's state/doc updates; any WARN output is disclosed honestly in the worker result rather than hidden.
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
