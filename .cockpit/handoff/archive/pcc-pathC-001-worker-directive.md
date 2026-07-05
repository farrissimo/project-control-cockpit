# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathC-001
* Task Title: Metrics & Evidence: Extend doctor.ps1 With Dirty-Tree, Branch-Hygiene, And File-Structure Checks
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

Deliver the original project scope's Stronger Repo Health Diagnostics (archive/PCC Original Project Scope.md §12.7) by extending scripts/doctor.ps1 with three additional read-only, advisory checks it does not currently perform: (1) dirty working tree (uncommitted changes present via 'git status --porcelain'), (2) branch hygiene (current branch matches project-state.json's active_branch, and whether the branch is ahead/behind its upstream if one is configured), and (3) file-structure check (the expected .cockpit/ subdirectories and canonical state files from docs/STATE_MODEL.md are present, and no unexpected top-level .cockpit/ entries exist). This is the first Category C (Metrics & Evidence Depth) task per DECISION-074's roadmap. Scoped and justified against the three-filter test recorded in backlog/IDEAS.md IDEA-012 and docs/PROJECT_CHARTER.md's Core Design Rule (Modularity/Extractability, DECISION-077): purely additive to an already-existing advisory-only script, reduces owner babysitting (these are currently only caught by the owner noticing manually), and introduces no new shared state (reads git plumbing and the filesystem directly, prints report lines, exactly the same shape as doctor.ps1's four existing composed checks). Task Safety Class A: bounded, low-risk, mechanically checkable by running doctor.ps1 and inspecting its output; touches no schema, no state file, no verdict, and no Owner Review Matrix truth surface.

## Allowed Scope

The worker may:

* Edit scripts/doctor.ps1 to add the three new checks (Working tree, Branch hygiene, File structure).
* Edit docs/DECISIONS.md to record the new decision.
* Edit backlog/IDEAS.md to update IDEA-012's status/notes to reflect delivery.
* Edit README.md only if needed to note the capability.

## Forbidden Scope

The worker must not:

* Do not modify any script other than scripts/doctor.ps1.
* Do not change doctor.ps1's always-exit-0 advisory-only contract, or make any new check a blocking/gating condition.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not change any schema, verdict, task status enum, Task Safety Class definition, the Owner Review Matrix, Stop-Instead-of-Guess triggers, or any Acceptance Boundary Rule.
* Do not commit or leave behind any scratch artifacts used to induce test cases (uncommitted changes, renamed directories, scratch branches) -- the real repo must be restored to its clean pre-task state before completion evidence is written.
* Do not manually invoke 'codex exec' for this task's own verification -- let the live PCC-CodexVerifyWatcher scheduled task handle it.

## Completion Criteria

The task is complete only if:

* scripts/doctor.ps1 gains a new 'Working tree' check: runs 'git status --porcelain' against the repo root; OK if empty output, WARN if uncommitted changes exist (never ISSUE -- an in-progress working tree is normal, not unsafe). Must not fail doctor.ps1 itself if git is unavailable or the directory is not a repo -- report WARN with a clear detail message in that case instead.
* scripts/doctor.ps1 gains a new 'Branch hygiene' check: compares the current git branch (via 'git rev-parse --abbrev-ref HEAD') against project-state.json's active_branch field; OK if they match, WARN if they differ (naming both). If an upstream is configured, additionally reports ahead/behind counts as informational detail on the same finding; if no upstream is configured, states that plainly rather than treating it as a problem.
* scripts/doctor.ps1 gains a new 'File structure' check: confirms the canonical .cockpit/ subdirectories (backups, handoff, logs, result, state) and canonical state files (.cockpit/state/project-state.json, .cockpit/state/task-state.json, .cockpit/state/handoff-gate.json) exist; OK if all present, ISSUE naming exactly which are missing if not. Additionally flags any top-level entry directly under .cockpit/ that is not one of the five expected subdirectories as a WARN (unexpected file/dir), without treating it as fatal.
* All three new checks are read-only: they must not create, delete, or modify any file, must not call any other script, and must not change doctor.ps1's existing 'always exits 0, advisory-only' contract.
* Functionally tested (not read-through only): doctor.ps1 run against the real repo in its current (clean) state to confirm the new checks report OK/expected results; and at least one deliberately induced case per new check (e.g. a scratch uncommitted change, a scratch branch mismatch, a temporarily renamed/removed .cockpit/ subdirectory) exercised in a way that does not leave the real repo altered, to confirm each check correctly reports WARN/ISSUE and that doctor.ps1 still exits 0 throughout.
* A new decision is recorded in docs/DECISIONS.md documenting the delivered checks and the three-filter scoping rationale from IDEA-012. backlog/IDEAS.md's IDEA-012 entry is updated to note delivery.
* No verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, Acceptance Boundary Rule, schema, or any other truth surface is changed. No new log event type is added. No script other than scripts/doctor.ps1 is modified (docs/DECISIONS.md and backlog/IDEAS.md edits are documentation, not code).

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any (including the induced-failure test cases and confirmation the repo was restored afterward).
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
