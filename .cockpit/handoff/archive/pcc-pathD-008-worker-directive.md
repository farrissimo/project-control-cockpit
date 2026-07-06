# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-008
* Task Title: Rollover/Handoff Controls (First Producer + Consumer, Command-to-Copy Design)
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-008)
* Justification (continuation, not a fork): Continuation of the owner-authorized Phase D3 (DECISION-097). Design fork (command-to-copy vs. local server) was explicitly re-confirmed with the owner before drafting; command-to-copy was chosen to preserve the existing static-file architecture, per the owner's own stated reasoning.
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

Deliver docs/PATH_A_PLAN.md section 6 Phase D3's second task: the first real producer and consumer for the .cockpit/request/ inbox contract defined in pcc-pathD-007. DESIGN DECISION (owner-confirmed): the dashboard remains a static HTML file with no server; a rollover 'control' cannot be a live clickable button that writes a file from the browser. Instead, this delivers (a) scripts/request-rollover.ps1, a small producer script the owner runs from a terminal that writes a properly-shaped rollover request file into .cockpit/request/; (b) scripts/process-rollover-requests.ps1, a consumer that detects pending rollover requests and runs the existing scripts/safe-stop.ps1 (unmodified, already read-only and always-exit-0) as its response, capturing the report into the request and moving it to .cockpit/request/processed/ or .cockpit/request/rejected/; (c) a small addition to the dashboard's Handoff/Rollover panel showing the exact command to run to request a rollover, matching the existing Local Tools Panel's command-preview pattern from the original scope. This does NOT invent any new automated rollover/reset behavior -- the 'existing safe-stop/handoff path' is exactly scripts/safe-stop.ps1's existing advisory check, run in response to the request, not a new irreversible action.

## Allowed Scope

The worker may:

* Create scripts/request-rollover.ps1 (new producer script).
* Create scripts/process-rollover-requests.ps1 (new consumer script, invoking only scripts/safe-stop.ps1 as a subprocess).
* Edit scripts/generate-dashboard.ps1 to add the one new display-only command line to the Handoff/Rollover panel.
* Write and move real files within .cockpit/request/ (including creating .cockpit/request/processed/ and/or .cockpit/request/rejected/ subdirectories as needed) as part of normal functional testing and operation -- this is the designed write surface for this exact purpose (DECISION-098).
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-008 as delivered, not to change its scope or spec.

## Forbidden Scope

The worker must not:

* Do not introduce a local web server, HTTP listener, or any live browser-to-filesystem bridge -- the owner explicitly rejected this design for this task.
* Do not modify scripts/safe-stop.ps1 or any other existing script besides scripts/generate-dashboard.ps1 (display-only addition).
* Do not modify schemas/request.schema.json or any other schema.
* Do not invent any new automated rollover/reset/rotation behavior beyond running the existing scripts/safe-stop.ps1 check.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not mutate any canonical .cockpit/ file (state/handoff/result) from either new script; all writes stay within .cockpit/request/.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build pcc-pathD-009's tone/behavior controls in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/request-rollover.ps1 (new): writes exactly one new file into .cockpit/request/ matching schemas/request.schema.json (request_type: 'rollover', status: 'pending', source identifying it as owner/CLI-initiated, a generated request_id, created_at timestamp, and an optional -Reason parameter stored in payload.reason, defaulting to a generic value if omitted). Writes nothing else; calls no other script.
* scripts/process-rollover-requests.ps1 (new): scans .cockpit/request/ (top level only, not its processed/rejected subdirectories) for files with request_type 'rollover' and status 'pending'; for each, performs a lightweight structural validation (required fields present, request_type/status as expected) and skips (leaves in place, does not crash the batch) any file that fails it; for each valid pending rollover request, invokes scripts/safe-stop.ps1 as an explicit subprocess (unmodified, already read-only, always-exit-0), captures its full stdout, records it into the request (e.g. payload.safe_stop_report), sets status to 'processed', and moves the file to .cockpit/request/processed/. Malformed or unreadable files are left in place with a clear console warning, not silently discarded and not crash-inducing for other valid requests in the same batch.
* scripts/generate-dashboard.ps1's Handoff/Rollover panel gains one new display-only line showing the exact copy-paste command to request a rollover (e.g. 'pwsh -File scripts/request-rollover.ps1'). This is static text: no new file read, no new subprocess call, no change to the dashboard's read-only contract.
* Neither new script invokes any script other than scripts/safe-stop.ps1 (by process-rollover-requests.ps1 only); no existing script is modified; no schema is modified.
* Functionally tested (not read-through only), against the real .cockpit/request/ inbox (this is the intended integration surface, unlike pcc-pathD-007's contract-only phase): run scripts/request-rollover.ps1 to create a real pending rollover request; run scripts/process-rollover-requests.ps1 and confirm it is detected, safe-stop.ps1's real report is captured into it, and the file is moved to .cockpit/request/processed/; run scripts/process-rollover-requests.ps1 again with the inbox empty and confirm a clean, graceful no-op; place one malformed JSON file directly in .cockpit/request/ and confirm it is skipped with a clear warning, not crashing the batch or being silently deleted.
* A new decision is recorded in docs/DECISIONS.md documenting the delivery, the command-to-copy design choice and why a local server was rejected (per the owner's confirmed reasoning), and the fact that no new automated rollover action was invented -- only the existing safe-stop.ps1 check is composed. docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-008 as delivered, not to change its scope.
* No new log event type is added; the two new scripts do not call scripts/log-event.ps1.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002 onward.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the real end-to-end producer->consumer test, the empty-inbox no-op test, and the malformed-file tolerance test.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that no server/live-bridge was introduced and no new automated rollover action was invented beyond composing scripts/safe-stop.ps1.

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
