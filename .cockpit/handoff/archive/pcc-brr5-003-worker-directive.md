# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr5-003
* Task Title: Safety Net: Automatic Push On Commit
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

Per explicit, direct owner instruction (not self-promoted), make push-to-remote automatic whenever a verified cycle is committed, removing the standing per-time push approval requirement (DECISION-020's push clause). Update scripts/close-out-verified-task.ps1, scripts/return-inadequate-work.ps1, and scripts/archive-held-cycle.ps1 so that, when -Commit is passed and the commit succeeds, the script also pushes the current branch to origin automatically. Record the policy change explicitly, since it supersedes a standing decision.

## Allowed Scope

The worker may:

* Edit scripts/close-out-verified-task.ps1, scripts/return-inadequate-work.ps1, and scripts/archive-held-cycle.ps1 to add an automatic push step after a successful -Commit.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md to reflect the new auto-push behavior.
* Create and use a temporary, isolated scratch copy (including a scratch git repo with a local-only test remote if needed) to test the push logic without risking the real repo's remote.

## Forbidden Scope

The worker must not:

* Do not modify any other script.
* Do not modify any schema.
* Do not add force-push, push to any branch other than the current one, or push to any remote other than 'origin'.
* Do not make -Commit itself automatic/default in any script that doesn't already have it -- only change what happens after -Commit is explicitly passed and succeeds.
* Do not touch the self-verification fallback (DECISION-033/036), the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not run any real push test against the live PCC repo's actual remote in a way that could push broken or unintended state -- if testing against the real repo, only do so at a point where the repo is already clean/pushed/complete, and document this honestly.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- Class B, hold the self-verified result for owner/GPT review; the owner has already given direct approval for this change, but that approval covers the policy, not a self-issued final verdict on this specific implementation.

## Completion Criteria

The task is complete only if:

* scripts/close-out-verified-task.ps1, scripts/return-inadequate-work.ps1, and scripts/archive-held-cycle.ps1 each push the current branch to origin automatically immediately after a successful -Commit, using the actual current branch name (not a hardcoded 'main'), rather than requiring a separate manual git push.
* -Commit's existing behavior (git add -A; git commit) is unchanged; only a push step is appended after a successful commit.
* If the push fails (e.g. network issue, remote rejects), the script reports this clearly but does not fail the whole run destructively -- the commit already succeeded locally and is not undone; the failure is surfaced so it can be retried manually.
* Push is only ever attempted after -Commit is explicitly passed and the commit succeeds -- a script run without -Commit still never pushes (no auto-commit-and-push forced on a caller who only wanted to inspect/hold).
* No push is ever attempted to any branch or remote other than the current branch and 'origin' -- no new remote, no force-push, no history rewriting.
* A new decision is recorded in docs/DECISIONS.md explicitly superseding DECISION-020's per-time push approval clause with a standing, explicit owner authorization for automatic push on every -Commit-ed cycle, effective immediately (not time-boxed like DECISION-036's earlier exception) until the owner says otherwise.
* Functionally tested (not read-through only): tested in the real repo's own git history is not required, but the push-triggering logic must be demonstrated correctly -- either via a safe scratch git repo with a real (test-only) remote, or by direct, careful reasoning plus a live dry run against the real repo's own already-pushed-and-clean state, documented honestly either way.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or any other existing script behavior beyond the push addition.
* docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md's Task Process are updated to reflect that -Commit now also pushes automatically, so the workflow description stays accurate.

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
