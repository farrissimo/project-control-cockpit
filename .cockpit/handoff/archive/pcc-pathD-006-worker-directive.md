# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-006
* Task Title: Handoff / Rollover Panel (Read-Only) — Phase D2 Complete
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-006)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle.
## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* Favor modularity and extractability: every PCC capability must stay a clearly bounded unit over the .cockpit file bridge with no hidden shared state or undocumented cross-script assumptions.
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

Deliver docs/PATH_A_PLAN.md section 6 Phase D2's final task: a Handoff/Rollover panel in dashboard/index.html showing the latest clean/verified handoff (from project-state.json's already-loaded last_verified_handoff field) and current rollover-trigger warnings. CORRECTED MID-TASK: the original plan was to invoke scripts/check-stop-conditions.ps1 as a subprocess, mirroring the classify-routing.ps1 pattern. Testing during this task discovered that check-stop-conditions.ps1 is NOT side-effect-free: it writes a stop_condition_fired event to routing-log.jsonl whenever it detects a stop condition (BRR Phase 4/IDEA-008), which would break the dashboard's read-only contract and would be actively dangerous under scripts/watch-dashboard.ps1's polling loop (repeated writes every few seconds while a condition stays active). Testing this also surfaced a real, pre-existing, out-of-scope finding: check-stop-conditions.ps1's approved-lane-source list does not recognize docs/PATH_A_PLAN.md, so it mechanically false-flags every Path A task's promotion_basis -- not fixed here (would require modifying a different existing script, forbidden by this task's scope), disclosed for a future task instead. The corrected design reads the two most owner-relevant, side-effect-free signals (owner_decision_request pending; task_status in an attention-needed state) directly from task-state.json fields already loaded, with no subprocess call and no write risk. Completing this delivers all of Phase D2 (pcc-pathD-004 through pcc-pathD-006).

## Allowed Scope

The worker may:

* Edit scripts/generate-dashboard.ps1 to add the Handoff/Rollover panel (direct field reads only, no new subprocess call).
* Edit docs/DECISIONS.md to record the new decision, including noting Phase D2 completion and the mid-task discovery/correction.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-006 as delivered and Phase D2 complete, not to change its scope or spec.
* Regenerate dashboard/index.html as part of normal testing (it is a gitignored, generated artifact).

## Forbidden Scope

The worker must not:

* Do not invoke any script other than scripts/classify-routing.ps1 (already established) as a subprocess; do not invoke scripts/check-stop-conditions.ps1 from the dashboard at all, per the discovered log-write side effect.
* Do not modify scripts/check-stop-conditions.ps1, scripts/classify-routing.ps1, scripts/doctor.ps1, or any other existing script.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make scripts/generate-dashboard.ps1 write to, or otherwise mutate, any .cockpit/ file.
* Do not modify any schema.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build any Phase D3 functionality (write-path/request-file controls) in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/generate-dashboard.ps1 gains a Handoff/Rollover panel showing: (a) the latest clean/verified handoff, sourced from project-state.json's already-loaded last_verified_handoff field (no new file read); (b) current rollover-trigger warnings, computed directly from task-state.json's already-loaded owner_decision_request and task_status fields (mirroring only check-stop-conditions.ps1's first two, side-effect-free conditions) -- NOT via a subprocess call to check-stop-conditions.ps1, per the mid-task correction recorded in the task objective.
* The script still writes only -OutputPath and mutates no .cockpit/ file directly; no new subprocess call is introduced by this task at all.
* No script other than scripts/classify-routing.ps1 (already established) is invoked as a subprocess; no new engine-script call is introduced.
* Functionally tested (not read-through only): run against the real live state (confirms sane Handoff/Rollover output, including the rollover-warnings text); confirm zero .cockpit/ mutation (including routing-log.jsonl) from the render, by diffing the log file before and after.
* A new decision is recorded in docs/DECISIONS.md documenting the delivery, the mid-task discovery and correction (check-stop-conditions.ps1's log-write side effect), and the separately-disclosed out-of-scope finding (its stale approved-lane-source list not recognizing docs/PATH_A_PLAN.md), and explicitly noting that Phase D2 (pcc-pathD-004 through pcc-pathD-006) is now complete. docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-006 as delivered and Phase D2 as complete, not to change its scope.
* No existing script is modified; no schema is modified; no new log event type is added.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002 onward.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the real-state test and the routing-log.jsonl before/after diff confirming zero mutation.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that no script other than classify-routing.ps1 was invoked as a subprocess, and disclosure of the mid-task discovery (check-stop-conditions.ps1's log-write side effect and stale approved-lane-source list).

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
