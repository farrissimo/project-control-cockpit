# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr5-005
* Task Title: Record Scheduled Watcher Deployment
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

Document that scripts/codex-verify-watcher.ps1 (pcc-brr5-004) is now deployed as a native Windows Scheduled Task ('PCC-CodexVerifyWatcher', 3-minute interval, running the script with -Once) rather than left as code the owner must run manually or in an open loop. This is a docs-only record of an operational deployment step, not a code change: no script's behavior changes as part of this task. This task is also the first real end-to-end test of the deployed watcher itself -- it is deliberately left in 'returned_for_verification' for the running scheduled task to pick up and invoke real Codex verification on its own, with no manual 'codex exec' invocation by the worker.

## Allowed Scope

The worker may:

* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/REPO_GOVERNANCE.md to reflect the watcher's actual deployment state.

## Forbidden Scope

The worker must not:

* Do not modify any existing script, including scripts/codex-verify-watcher.ps1 itself.
* Do not modify any schema.
* Do not manually invoke 'codex exec' for this task's verification -- that is the point of this test.
* Do not touch the Acceptance Boundary Rules, Task Safety Classification, or any existing verdict.

## Completion Criteria

The task is complete only if:

* A new decision is recorded in docs/DECISIONS.md describing the scheduled task: name (PCC-CodexVerifyWatcher), the command it runs (pwsh.exe -File scripts/codex-verify-watcher.ps1 -Once), the interval (3 minutes), and that it was manually triggered three times against live idle state (task_status: complete) confirming zero side effects (no lock file, no git changes) before being left running.
* docs/REPO_GOVERNANCE.md's description of the watcher is updated to note it is now actually deployed via a native OS scheduled task rather than purely available-but-unstarted.
* No existing script is modified. No schema is modified. No existing verdict, safety class, or Acceptance Boundary Rule is changed.
* This task's own verification is NOT performed by the worker invoking codex exec manually. The task is left in 'returned_for_verification' and the already-running 'PCC-CodexVerifyWatcher' scheduled task is expected to detect it and invoke Codex on its own within one poll interval (up to ~3 minutes).

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
