# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathA-001
* Task Title: Local-First Routing: Advisory Task Routing Classifier
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

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

Deliver the original project scope's Local-First Routing capability (archive/PCC Original Project Scope.md §7.12) as a lean, read-only, self-contained advisory: a new script scripts/classify-routing.ps1 that reads the active task from .cockpit/state/task-state.json and mechanically classifies its routing-suitability (local_deterministic / model_judgment / mixed / unknown) using only fixed, observable signals already present in task state (task_safety_class and literal keyword matches against the task title/objective), then prints an advisory, explicitly non-authoritative recommendation to prefer local deterministic tools for the local-suitable portions (DECISION-002). It surfaces the local-first principle as a checkable per-task signal instead of an unmeasured convention. It is advisory only: it never gates, never redirects or executes work, never mutates state, and calls no other script. This is the first Path-A (post-BRR original-scope) task per DECISION-074's roadmap re-cut; §7.17 (session/usage pressure) is deferred and §7.18 (premium escalation) is already covered by the existing Owner Review Matrix, so this task is the entirety of Category A's honestly-buildable pre-checkpoint scope.

## Allowed Scope

The worker may:

* Create scripts/classify-routing.ps1 as a new, self-contained, read-only advisory script over the .cockpit/ file-bridge contract (DECISION-074 extractability rule).
* Edit docs/DECISIONS.md to record the new decision.
* Edit README.md only if needed to note this first Path-A deliverable in the doc index or status section.
* Edit backlog/IDEAS.md only if an existing IDEA entry needs a delivered-status note for this exact change (check first; do not edit if none applies).

## Forbidden Scope

The worker must not:

* Do not modify any existing script (including scripts/log-event.ps1, scripts/summarize-routing-log.ps1, scripts/check-stop-conditions.ps1, scripts/doctor.ps1, and every other script).
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make the classifier gate, block, redirect, or execute any work — it is advisory-only. A router that autonomously redirects work is new authority requiring its own owner decision and is explicitly out of scope.
* Do not modify any schema.
* Do not change any verdict, task status, Task Safety Class, the Owner Review Matrix, Stop-Instead-of-Guess triggers, or any Acceptance Boundary Rule.
* Do not manually invoke 'codex exec' for this task's own verification — let the live PCC-CodexVerifyWatcher scheduled task handle it.

## Completion Criteria

The task is complete only if:

* A new script scripts/classify-routing.ps1 exists and is strictly read-only: it reads .cockpit/state/task-state.json (path overridable by a parameter), writes/mutates no file or state, and invokes no other script. It exits 0 on a well-formed task-state and prints a clear error and non-zero exit only if the task-state file is missing or malformed JSON.
* The classifier assigns exactly one routing class from a fixed closed set {local_deterministic, model_judgment, mixed, unknown} using only mechanical signals: (a) the task's task_safety_class, and (b) literal, case-insensitive keyword matches against task_title and task_objective from two fixed keyword lists (a deterministic/local-suitable list e.g. rename, move, list, search, grep, diff, count, validate, schema, json, path, whitespace; and a judgment/model-suitable list e.g. policy, decide, design, review, wording, prose, document, decision, tradeoff, architecture). No free-text interpretation beyond fixed keyword membership is performed, consistent with DECISION-008 (no fake intelligence): the output is explicitly labeled a mechanical keyword heuristic and an advisory hint, never a claim to know the task's true nature.
* The script prints, in plain readable output: the detected routing class, which signals fired (the matched keywords and the safety class used), and an advisory recommendation tied to DECISION-002 (prefer local deterministic tools for local-suitable work; use the model for judgment-heavy work). The output explicitly states it is advisory and non-gating and does not redirect or execute any work.
* Functionally tested (not read-through only): run against the real .cockpit/state/task-state.json and against at least two synthetic task shapes (one clearly deterministic, one clearly judgment-heavy) in an isolated scratch copy, confirming sane, correct-looking classifications and that malformed/missing input fails cleanly with a non-zero exit and no state mutation.
* A new decision is recorded in docs/DECISIONS.md, and README.md's doc/status text is updated only as needed to note the first Path-A task is delivered.
* No existing script, schema, verdict, task status, Owner Review Matrix row, Task Safety Class, or any other truth surface is modified. No new log event type is added. The routing classifier does not call scripts/log-event.ps1 or any other script.

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
