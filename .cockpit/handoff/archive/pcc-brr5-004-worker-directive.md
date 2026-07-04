# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr5-004
* Task Title: Fresh Start: Codex Verification Watcher
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

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

Field DECISION-066's restored two-role split (Claude Code worker, Codex advisor/verifier) as a real, low-cost mechanism instead of a manually-run, manually-relayed Codex session. Add scripts/codex-verify-watcher.ps1, a plain (non-AI) polling script that watches task-state.json's task_status and invokes 'codex exec' exactly once per task needing verification -- never polling Codex itself, never invoking it just to check for work, so idle time costs zero session usage and real invocations happen at the same rate as today's manual process (once per cycle), not more.

## Allowed Scope

The worker may:

* Create scripts/codex-verify-watcher.ps1.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/HANDOFF_PACKET_SPEC.md and/or docs/REPO_GOVERNANCE.md to describe the new watcher as an available mechanism for the Codex verification step.
* Create and use a temporary, isolated scratch copy (including a stub 'codex' command) to test the watcher's polling/lock/detection logic without invoking the real Codex CLI or spending real session usage.
* Run exactly one real, deliberate 'codex exec' invocation against the live repo to obtain this task's own verification verdict.

## Forbidden Scope

The worker must not:

* Do not modify any existing script.
* Do not modify any schema.
* Do not have the watcher invoke 'codex exec' more than once per task_id needing verification, or on any poll that finds no new work.
* Do not run the watcher's automated tests against the real Codex CLI -- use a stub for all repeated/looped testing; the one real invocation permitted is the single, deliberate verification call for this task's own result.
* Do not have this task self-verify under the old DECISION-033 fallback -- that fallback ended per DECISION-066; use the real Codex invocation described above instead.
* Do not wire the watcher to be started automatically by any other script -- it remains something the owner starts (or schedules) deliberately.
* Do not touch the Acceptance Boundary Rules, Task Safety Classification, or any existing verdict.

## Completion Criteria

The task is complete only if:

* scripts/codex-verify-watcher.ps1 exists. On each poll cycle it reads .cockpit/state/task-state.json and .cockpit/result/verification-result.json only (cheap file reads, no AI call) to decide whether there is new verification work.
* The script invokes 'codex exec' (via a parameterized -CodexCommand, defaulting to the real 'codex' binary, so it can be pointed at a stub for testing) only when task_status is 'returned_for_verification' AND verification-result.json's task_id does not yet match the current task_id -- i.e., exactly once per task needing verification, never on a poll that finds no new work.
* A lock file (e.g. .cockpit/state/codex-watcher.lock) records which task_id Codex has already been invoked for, preventing a second invocation for the same task while waiting for Codex's response, even if the poll interval is shorter than Codex's response time. The lock clears once verification-result.json's task_id matches again.
* The script supports a configurable poll interval (e.g. -PollIntervalSeconds, a sane default) and a -Once switch that performs exactly one check-and-act cycle and exits, for testing and for use under an external scheduler instead of an internal loop.
* The actual codex invocation points Codex at .cockpit/handoff/advisor-restart-brief.md for context (already generated with full current-task truth) and instructs it, per docs/VERIFICATION_RESULT_SPEC.md and docs/REPO_GOVERNANCE.md's Task Process step 11, to independently re-run scripts/verify-handback-guardrails.ps1, review the evidence, and write its verdict to .cockpit/result/verification-result.json in the required JSON shape -- and explicitly NOT to advance state or run any close-out script itself.
* Functionally tested (not read-through only) in an isolated scratch copy using a stub -CodexCommand (a small script that mimics codex by writing a fixed verification-result.json) rather than the real Codex binary, so testing the polling/lock/detection logic burns zero real Codex session usage: confirmed the script does nothing when there is no new work; confirmed it invokes the stub exactly once when new work appears; confirmed it does NOT re-invoke on a second poll before the stub 'responds'; confirmed the lock clears once the verdict file updates.
* Separately, this task's OWN verification is performed via one real, deliberate, manual 'codex exec' invocation against the live repo (not through the not-yet-proven watcher loop, and not self-verified, since DECISION-066 ended the self-verification fallback) -- this doubles as the first genuine end-to-end proof that the real invocation (prompt, working directory, sandbox flag) actually works, distinct from the stub-based automated tests above.
* A new decision is recorded in docs/DECISIONS.md.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, or any existing script's behavior -- this is a new, additive script only.

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
