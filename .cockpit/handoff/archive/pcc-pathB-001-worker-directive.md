# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathB-001
* Task Title: Behavior Controls: Communication Preferences Stored And Surfaced In Worker Directive
* Task Status: returned_for_verification
* Task Safety Class: C (see docs/BRR_POLICY.md "Task Safety Classification")

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

Deliver the original project scope's Tone / Chattiness / Language Controls (archive/PCC Original Project Scope.md §7.16; DECISION-009) as fielded state rather than an unenforced principle: add a communication_prefs object to .cockpit/state/project-state.json (and its schema) holding the owner's standing communication defaults, and edit scripts/generate-worker-directive.ps1 to render a 'Communication Defaults' section from it, so a fresh worker session auto-applies the owner's tone/language/behavior preferences without the owner restating them each session. This is a direct babysitting reduction (DECISION-001): repeated owner corrections about communication style are exactly what §7.16 exists to prevent. It is the sole honestly-buildable pre-checkpoint task in Category B; §7.19 (suggested tools) is declined for now as low-value and overlapping with scripts/classify-routing.ps1 / DECISION-002. This is Task Safety Class C because it edits a schema (a truth surface, Owner Review Matrix row 7); the owner approved it before execution.

## Allowed Scope

The worker may:

* Edit schemas/project-state.schema.json to add the communication_prefs object property (additive only).
* Edit .cockpit/state/project-state.json to add the communication_prefs values.
* Edit scripts/generate-worker-directive.ps1 to render the Communication Defaults section from communication_prefs.
* Edit docs/DECISIONS.md to record the new decision.
* Edit README.md only if needed to note the capability.
* Edit backlog/IDEAS.md only if an existing IDEA entry needs a delivered-status note (check first; do not edit if none applies).

## Forbidden Scope

The worker must not:

* Do not change any schema other than the additive communication_prefs addition to project-state.schema.json.
* Do not modify any script other than scripts/generate-worker-directive.ps1.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make communication_prefs gate, block, or halt anything — it is worker-facing guidance rendered into the directive, not an enforcement mechanism.
* Do not change any verdict, task status enum, Task Safety Class definition, the Owner Review Matrix, Stop-Instead-of-Guess triggers, or any Acceptance Boundary Rule.
* Do not manually invoke 'codex exec' for this task's own verification — let the live PCC-CodexVerifyWatcher scheduled task handle it.

## Completion Criteria

The task is complete only if:

* schemas/project-state.schema.json gains a communication_prefs object property with additionalProperties:false and its own required fields: tone (enum: direct, balanced, chatty), language_level (enum: plain, mixed, technical), chattiness (enum: concise, balanced, verbose), and four boolean toggles (no_cheerleading, concise_by_default, explicit_uncertainty, separate_facts_from_inference). communication_prefs is added to the top-level required list so it is always present going forward.
* .cockpit/state/project-state.json gains a communication_prefs object matching the schema, seeded with the owner's documented defaults: tone=direct, language_level=mixed, chattiness=concise, no_cheerleading=true, concise_by_default=true, explicit_uncertainty=true, separate_facts_from_inference=true.
* scripts/generate-worker-directive.ps1 renders a 'Communication Defaults' section from project-state.json's communication_prefs (guarded so it is simply omitted if the field is absent, rather than erroring), listing each preference so a fresh worker applies them without being asked, and tying the section to DECISION-009.
* Functionally tested (not read-through only): scripts/check-schemas.ps1 passes against the updated project-state.json and schema; scripts/generate-worker-directive.ps1 runs and the generated .cockpit/handoff/worker-directive.md contains the Communication Defaults section with the seeded values; scripts/validate-cockpit-state.ps1 passes.
* A new decision is recorded in docs/DECISIONS.md, and README.md is updated only as needed to note the capability. DECISION-009's status/relationship is referenced (it is now fielded, not just recorded).
* No verdict, task status, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, Acceptance Boundary Rule, or any other truth surface beyond project-state.schema.json's additive communication_prefs field is changed. No new log event type is added.

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
