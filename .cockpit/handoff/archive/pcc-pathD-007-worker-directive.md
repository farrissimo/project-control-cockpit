# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-007
* Task Title: Request-File Inbox Contract + Schema (Phase D3 Foundation)
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-007)
* Justification (continuation, not a fork): Explicitly owner-authorized per DECISION-097 (direct yes/no confirmation obtained for Phase D3 specifically, not assumed from general continuation momentum). This is the first Phase D3 task, gated by its own owner decision as the plan itself requires; not an in-lane auto-promotion like the Phase D1/D2 tasks.
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

Deliver docs/PATH_A_PLAN.md section 6 Phase D3's first task, explicitly owner-authorized (DECISION-097): define the .cockpit/request/ inbox convention and its schema -- the one genuinely new bridge surface for Category D. This task defines the contract ONLY: a new schemas/request.schema.json, the .cockpit/request/ directory, and a short canonical documentation of the request lifecycle (who writes, who consumes, how a request moves from pending to processed/rejected). It does NOT build any dashboard UI control that writes a request file (that is pcc-pathD-008/009), and does NOT build any consumer/watcher script that reads and acts on request files (also later tasks). This keeps the contract-defining step cleanly separated from its first real producer and consumer.

## Allowed Scope

The worker may:

* Create schemas/request.schema.json, a new schema file.
* Create the .cockpit/request/ directory with a placeholder file so git tracks it.
* Edit docs/STATE_MODEL.md (or add a clearly-scoped section to docs/PATH_A_PLAN.md) to document the request-file lifecycle.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-007 as delivered, not to change its scope or spec.

## Forbidden Scope

The worker must not:

* Do not modify scripts/generate-dashboard.ps1 or scripts/watch-dashboard.ps1.
* Do not create any consumer/watcher script that reads or acts on request files.
* Do not modify scripts/check-schemas.ps1 or any other existing script.
* Do not write any real file into .cockpit/request/ other than the tracking placeholder; synthetic test examples must live outside .cockpit/ entirely.
* Do not modify any existing schema (project-state, task-state, verification-result, handoff-packet).
* Do not add any new log event type or write to routing-log.jsonl.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build pcc-pathD-008 or pcc-pathD-009's actual controls in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* schemas/request.schema.json exists, following the same JSON Schema conventions as the other schemas/*.schema.json files (draft/2020-12, $id, additionalProperties: false, required fields), defining a request file's shape: a stable identifier, a request_type (a closed enum, starting with the two concrete Phase D3 use cases already named in the plan -- 'rollover' for pcc-pathD-008 and 'communication_prefs_update' for pcc-pathD-009 -- plus room to add more via a future schema update, not an open string), a created_at timestamp, a source field (identifying what produced the request, e.g. 'dashboard'), a status enum (pending/processed/rejected), and a type-specific payload object.
* The .cockpit/request/ directory exists (with a placeholder file, e.g. .gitkeep, so git tracks the empty directory) as the canonical inbox location.
* A short, canonical lifecycle description is recorded (in docs/STATE_MODEL.md or a clearly-scoped addition to docs/PATH_A_PLAN.md) covering: a producer writes a new request file with status 'pending'; a consumer (a future script, not built in this task) is responsible for detecting new pending requests, acting on them, and then moving the file to .cockpit/request/processed/ or .cockpit/request/rejected/ (or updating its own status field and archiving it) -- the exact consumer mechanics are left to pcc-pathD-008/009, but the producer-side contract (what a valid request file looks like) is fixed here so those later tasks do not have to re-derive it.
* No dashboard script is changed by this task: scripts/generate-dashboard.ps1 and scripts/watch-dashboard.ps1 are untouched. No consumer/watcher script is created.
* scripts/check-schemas.ps1 is not modified to validate request files in this task (that is deferred to whichever later task actually produces real request files, since there is nothing to validate yet); this deferral is stated explicitly, not silently skipped.
* The new schema is confirmed structurally valid by successfully validating at least one synthetic example request file (for each of the two named request_type values) against it, in an isolated scratch location -- not written into .cockpit/request/ itself, since no producer exists yet to create real ones.
* A new decision is recorded in docs/DECISIONS.md documenting the delivery and the contract's shape/lifecycle. docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-007 as delivered, not to change its scope.
* No existing script is modified; no existing schema is modified; no new log event type is added; no verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule is changed.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002 onward.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the synthetic schema-validation test for both named request_type values.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that no dashboard script, consumer script, or existing schema was modified, and that no real file was written into .cockpit/request/.

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
