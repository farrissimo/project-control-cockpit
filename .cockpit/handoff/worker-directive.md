# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-004
* Task Title: Auto-Refresh / Watch Mode (Phase D2, Read-Only)
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-004)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle. Folds in the minor header-comment correction disclosed in pcc-pathD-003's verification (DECISION-093 / verification-result.json's next_action).
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

Deliver docs/PATH_A_PLAN.md section 6 Phase D2's first task: a new script scripts/watch-dashboard.ps1 that polls the .cockpit/ files scripts/generate-dashboard.ps1 already reads (project-state.json, task-state.json, verification-result.json, routing-log.jsonl) and re-invokes scripts/generate-dashboard.ps1 (as an explicit subprocess, the same composition pattern already used and verified for classify-routing.ps1 in pcc-pathD-003) whenever any of them changes, so the dashboard/index.html output stays current without the owner manually re-running the generator. Remains strictly read-only over the .cockpit/ bridge: watch-dashboard.ps1 itself never writes any file except by delegating the actual write to generate-dashboard.ps1's own existing, already-read-only render step. As minor housekeeping folded in per the pcc-pathD-003 verification's own next_action, also correct scripts/generate-dashboard.ps1's header comment block, which currently still states the older blanket 'calls no other script' claim alongside the newer, narrower pcc-pathD-003 exception language -- update it to state the current, accurate contract only (reads the four .cockpit/ inputs, invokes exactly one subprocess, classify-routing.ps1, writes only -OutputPath).

## Allowed Scope

The worker may:

* Create scripts/watch-dashboard.ps1 as a new, self-contained script that polls .cockpit/ file mtimes and invokes scripts/generate-dashboard.ps1 as its one permitted subprocess call.
* Edit scripts/generate-dashboard.ps1's header comment block only, to correct the stale 'calls no other script' contradiction flagged in pcc-pathD-003's verification -- comment-only, no logic change.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-004 as delivered, not to change its scope or spec.
* Regenerate dashboard/index.html as part of normal testing (it is a gitignored, generated artifact).

## Forbidden Scope

The worker must not:

* Do not change any of scripts/generate-dashboard.ps1's actual logic/behavior; only its header comment block may change.
* Do not invoke any script other than scripts/generate-dashboard.ps1 from scripts/watch-dashboard.ps1.
* Do not modify scripts/classify-routing.ps1, scripts/doctor.ps1, or any other existing script.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make scripts/watch-dashboard.ps1 write any file directly itself; the only output is dashboard/index.html via the delegated generate-dashboard.ps1 call.
* Do not modify any schema.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build Phase D3 functionality (any write-path/request-file controls) in this task.
* Do not build the Session/Usage or Handoff/Rollover panels (pcc-pathD-005/006) in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/watch-dashboard.ps1 exists: a new, self-contained script that polls the mtimes of .cockpit/state/project-state.json, .cockpit/state/task-state.json, .cockpit/result/verification-result.json, and .cockpit/logs/routing-log.jsonl (paths overridable by parameter, defaulting to the canonical paths) on a configurable interval (parameter, default a few seconds), and re-invokes scripts/generate-dashboard.ps1 (explicit subprocess call, same pattern as pcc-pathD-003's classify-routing.ps1 call) only when at least one tracked file's mtime has changed since the last render.
* watch-dashboard.ps1 itself writes no file directly; the only write that occurs is dashboard/index.html, produced by the delegated call to the already-read-only generate-dashboard.ps1. watch-dashboard.ps1 mutates no .cockpit/ file.
* The watch loop runs until interrupted (Ctrl+C / normal PowerShell termination) and exits cleanly with no partial/corrupt output file left behind; a single poll-and-render cycle must also be runnable non-interactively for testing (e.g. a -Once / -MaxIterations style parameter) so the behavior can be verified without a human sitting at a terminal indefinitely.
* If a single render cycle's call to generate-dashboard.ps1 fails (non-zero exit) for any reason, the watch loop logs/prints the failure clearly to its own stdout and continues polling on the next interval rather than crashing the whole watch process.
* scripts/generate-dashboard.ps1's header comment block is corrected to state its current, accurate contract only (reads project-state.json, task-state.json, verification-result.json, and routing-log.jsonl; invokes exactly one subprocess, classify-routing.ps1; writes only -OutputPath) with no leftover contradictory 'calls no other script' blanket statement -- this is a comment-only correction, no behavior change.
* Functionally tested (not read-through only): run the watch loop for a small fixed number of iterations (via the non-interactive test parameter) against the real .cockpit/ state, touching a tracked file mid-run and confirming a re-render is triggered only after that change (not on every poll); confirmed no re-render happens across iterations when nothing changed; confirmed a simulated generate-dashboard.ps1 failure (e.g. pointing at a bad path for one iteration) is logged and does not crash the watch loop, which continues polling.
* A new decision is recorded in docs/DECISIONS.md documenting the delivery. docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-004 as delivered, not to change its scope.
* No existing script other than scripts/generate-dashboard.ps1 (comment-only change) is modified; no schema is modified; no new log event type is added; watch-dashboard.ps1 calls no script other than scripts/generate-dashboard.ps1.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002/003.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including the non-interactive watch-loop tests (change-triggers-render, no-change-means-no-render, simulated render failure logged and non-fatal).
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that watch-dashboard.ps1 calls no script other than generate-dashboard.ps1 and that generate-dashboard.ps1's logic was not changed.

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
