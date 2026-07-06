# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-009
* Task Title: Tone/Behavior Controls (communication_prefs, First Request-Driven State Mutation)
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-009)
* Justification (continuation, not a fork): Final task in the owner-authorized Phase D3 scope (DECISION-097). Last task named in the current plan for Category D; completes the plan's currently-specified Phase D3.
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

Deliver docs/PATH_A_PLAN.md section 6 Phase D3's final named task: update project-state.json's communication_prefs via a request-file -> existing state-update path, never a direct edit from the UI. This is the first task where a request-file consumer actually mutates canonical .cockpit/state/project-state.json (pcc-pathD-008's consumer only ran the existing read-only safe-stop.ps1 check and never touched canonical state). Deliver scripts/request-communication-prefs-update.ps1 (producer: a CLI script the owner runs, accepting one optional named parameter per communication_prefs field, writing a communication_prefs_update request containing only the fields to change) and scripts/process-communication-prefs-requests.ps1 (consumer: detects pending requests, builds the proposed merged communication_prefs object, validates the FULL proposed project-state.json against schemas/project-state.schema.json BEFORE writing anything -- rejecting, not writing, if invalid -- then writes it, re-runs scripts/validate-cockpit-state.ps1 as a post-write cross-check, and marks the request processed/rejected accordingly). No direct UI edit of communication_prefs exists or is created; the dashboard only displays the command to run.

## Allowed Scope

The worker may:

* Create scripts/request-communication-prefs-update.ps1 (new producer script).
* Create scripts/process-communication-prefs-requests.ps1 (new consumer script, invoking only scripts/validate-cockpit-state.ps1 as a post-write cross-check).
* Edit scripts/generate-dashboard.ps1 to add one new display-only command-example line.
* Write, mutate (only communication_prefs and updated_at within project-state.json, via the consumer's own validated path), and move real files within .cockpit/request/ and .cockpit/state/project-state.json as part of normal functional testing and operation.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/PATH_A_PLAN.md to mark pcc-pathD-009 delivered and note Phase D3's current scope is complete.

## Forbidden Scope

The worker must not:

* Do not create any direct UI edit path for communication_prefs; the dashboard only displays an example command.
* Do not modify scripts/validate-cockpit-state.ps1, scripts/check-schemas.ps1, or any other existing script besides scripts/generate-dashboard.ps1 (one display-only line).
* Do not modify schemas/request.schema.json, schemas/project-state.schema.json, or any other schema.
* Do not let the consumer write project-state.json before validating the FULL proposed object against schemas/project-state.schema.json -- invalid input must never touch disk, even transiently.
* Do not update any project-state.json field other than communication_prefs and updated_at from this pathway.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/request-communication-prefs-update.ps1 (new): a CLI script with one optional parameter per communication_prefs field (Tone, LanguageLevel, Chattiness, NoCheerleading, ConciseByDefault, ExplicitUncertainty, SeparateFactsFromInference), writing a request file matching schemas/request.schema.json (request_type: 'communication_prefs_update', status: 'pending') whose payload.fields contains ONLY the parameters actually supplied (partial update, not a full communication_prefs object). Fails cleanly with a clear error if no field parameters are supplied at all (nothing to request). Writes nothing else; calls no other script.
* scripts/process-communication-prefs-requests.ps1 (new): scans .cockpit/request/ (top level only) for files with request_type 'communication_prefs_update' and status 'pending'; for each, reads the live .cockpit/state/project-state.json, builds a proposed communication_prefs object by merging payload.fields onto the current values (unrecognized field names in payload.fields cause the request to be rejected, not silently ignored), and validates the FULL proposed project-state.json object against schemas/project-state.schema.json (via Test-Json) BEFORE writing anything to disk. If invalid (e.g. an out-of-enum value, an unrecognized field), the request is rejected: no file on disk is changed, the request is marked 'rejected' with a clear reason recorded in its payload, and moved to .cockpit/request/rejected/. If valid, .cockpit/state/project-state.json is written with the updated communication_prefs and a bumped updated_at, scripts/validate-cockpit-state.ps1 is run as a post-write cross-check (Fail loudly if it does not pass -- this must never happen if the pre-write schema validation was done correctly, but is checked anyway per DECISION-015's discipline), and the request is marked 'processed' and moved to .cockpit/request/processed/.
* scripts/generate-dashboard.ps1's Session/Usage or Handoff/Rollover panel (whichever fits better on inspection) gains one new display-only line showing an example command to request a tone/behavior change (e.g. 'pwsh -File scripts/request-communication-prefs-update.ps1 -Chattiness concise'). Static text only: no new file read, no new subprocess call, no change to the dashboard's own read-only contract.
* Neither new script invokes any script other than scripts/validate-cockpit-state.ps1 (by the consumer, post-write only); no existing script is modified except the one display-only dashboard line; no schema is modified.
* Functionally tested (not read-through only), against the real project-state.json (with a full pre-task backup already taken by the mandatory gate, so this is safe): (a) a valid request changing one recognized field to a valid enum value -- confirm it is applied, validate-cockpit-state.ps1 passes afterward, and the request is moved to processed/ with the change reflected in .cockpit/state/project-state.json; (b) a request with an out-of-enum value (e.g. tone: 'aggressive') -- confirm it is rejected, project-state.json is NOT changed at all, and the request is moved to rejected/ with a clear reason; (c) a request naming an unrecognized field -- confirm it is also rejected without writing state; (d) the empty-inbox no-op case; (e) confirm project-state.json is restored to its pre-test values after testing (or that the test change itself is an acceptable, intentional, disclosed real update, decided explicitly, not left as an accidental side effect).
* A new decision is recorded in docs/DECISIONS.md documenting the delivery, explicitly naming this as the first request-consumer that mutates canonical state and how the pre-write schema validation prevents ever writing invalid state to disk. docs/PATH_A_PLAN.md is updated to mark pcc-pathD-009 as delivered and to note that Phase D3's currently-named scope (pcc-pathD-007/008/009) is now complete.
* No new log event type is added; neither new script calls scripts/log-event.ps1.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002 onward -- especially important this cycle since this is the first task that can mutate project-state.json through this new pathway.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the valid-update, invalid-enum-rejection, unrecognized-field-rejection, and empty-inbox test cases, and explicit confirmation of project-state.json's final state after testing.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that invalid input never touched project-state.json on disk and that only communication_prefs/updated_at were ever changed by this pathway.

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
