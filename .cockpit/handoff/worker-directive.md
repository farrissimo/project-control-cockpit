# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-003
* Task Title: Routing / Local Tools Read-Only Panel
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-003)
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

Extend scripts/generate-dashboard.ps1 (pcc-pathD-001/002) per docs/PATH_A_PLAN.md section 6, Phase D1, with the Local Tools Panel and a routing-history summary: the Local Tools Panel shows classify-routing.ps1's advisory output as display-only text (the panel never executes anything); the routing-history summary is a read-only tail of .cockpit/logs/routing-log.jsonl. This is a deliberate, disclosed, narrow exception to pcc-pathD-001/002's stricter 'calls no other script' rule: scripts/classify-routing.ps1 is invoked as an explicit subprocess and its stdout captured as display text, mirroring scripts/doctor.ps1's already-audited composition pattern (explicit subprocess + stdout consumption, no hidden shared state) rather than introducing a new hidden coupling. Still zero LLM dependency, zero external runtime (DECISION-088); still writes only the dashboard output file and mutates no .cockpit/ file itself.

## Allowed Scope

The worker may:

* Edit scripts/generate-dashboard.ps1 to add the Local Tools Panel (invoking scripts/classify-routing.ps1 as an explicit subprocess and capturing its stdout as display text) and the Routing History panel (reading .cockpit/logs/routing-log.jsonl directly).
* Edit docs/DECISIONS.md to record the new decision, including the explicit justification for the narrow 'calls another script' exception.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-003 as delivered, not to change its scope or spec.
* Regenerate dashboard/index.html as part of normal testing (it is a gitignored, generated artifact).

## Forbidden Scope

The worker must not:

* Do not invoke any script as a subprocess other than scripts/classify-routing.ps1.
* Do not modify scripts/classify-routing.ps1, scripts/doctor.ps1, or any other existing script besides scripts/generate-dashboard.ps1 itself.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make scripts/generate-dashboard.ps1 write to, or otherwise mutate, any .cockpit/ file; it remains read-only over the file bridge (the one permitted subprocess call is itself read-only per its own existing contract).
* Do not modify any schema.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build Phase D2 or D3 functionality (auto-refresh/watch mode, or any write-path/request-file controls) in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/generate-dashboard.ps1 gains a Local Tools Panel showing scripts/classify-routing.ps1's full advisory stdout output as display-only text (verbatim, HTML-escaped), invoked as an explicit subprocess call ('& pwsh -File scripts/classify-routing.ps1' or equivalent), with the panel never executing, gating, or redirecting anything -- it only displays the advisory that already exists.
* If the classify-routing.ps1 subprocess call itself fails (non-zero exit) for any reason, the dashboard does not crash: the panel shows a clear inline message that the routing advisory was unavailable, and the rest of the dashboard (Owner Control Board, Directive, Verification panels) still renders normally.
* scripts/generate-dashboard.ps1 gains a Routing History panel: a read-only tail (most recent N, e.g. 10) of .cockpit/logs/routing-log.jsonl, tolerant of the two existing entry shapes in that file (older {timestamp, task_id, route, reason, result} and newer {timestamp, task_id, event_type, detail} entries), skipping any malformed individual line rather than crashing, and rendering gracefully (an empty/none state, not an error) if the log file is missing or empty.
* The script remains otherwise read-only over the .cockpit/ bridge: it writes only the existing -OutputPath, and does not itself mutate any .cockpit/ file (the one explicit subprocess call, to scripts/classify-routing.ps1, is itself a read-only, non-mutating, already-audited advisory per its own contract -- DECISION-075).
* No script other than scripts/classify-routing.ps1 is invoked as a subprocess; no other new engine-script call is introduced.
* Regeneration remains manual; no auto-refresh/watch mode is built in this task (still Phase D2, pcc-pathD-004).
* Functionally tested (not read-through only): run against the real .cockpit/ state and real routing-log.jsonl (confirms sane Local Tools and Routing History output), against a synthetic missing/empty routing-log.jsonl (renders a graceful none-state, no crash), against a synthetic routing-log.jsonl containing one malformed line among valid ones (malformed line skipped, valid lines still rendered), and against a simulated classify-routing.ps1 failure (dashboard still renders with a clear inline unavailable-message for that one panel, no crash, no .cockpit/ mutation from any of these tests).
* A new decision is recorded in docs/DECISIONS.md documenting the delivery, explicitly naming and justifying the narrow exception to the 'calls no other script' rule (precedent: scripts/doctor.ps1's audited composition pattern). docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-003 as delivered, not to change its scope.
* The mandatory pre-task handoff/backup gate (scripts/enforce-handoff-restart-safety.ps1) is run correctly before any code change, exactly as corrected on pcc-pathD-002 -- this is now the standing expectation for every task, not a one-off fix.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the functional tests against real and synthetic routing-log.jsonl and a simulated classify-routing.ps1 failure.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that no script other than classify-routing.ps1 was invoked as a subprocess.

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
