# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr5-002
* Task Title: Safety Net: Archive Before Chaining
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

Field the Semi-Autonomy Ceiling's policy-only 'archive before you chain' rule (docs/BRR_POLICY.md, DECISION-060/061) as an actual script, closing the gap DECISION-059 found: chaining into a next unattended cycle currently overwrites the prior cycle's live evidence (worker directive, worker result, verification result) before it is archived, with git history as the only fallback. Add scripts/archive-held-cycle.ps1 that preserves a held (self-verified but not yet accepted/closed) cycle's evidence into the same archive/ locations close-out-verified-task.ps1 uses, without advancing task_status or otherwise treating the cycle as accepted.

## Allowed Scope

The worker may:

* Create scripts/archive-held-cycle.ps1.
* Edit docs/BRR_POLICY.md to add the narrow pointer update to the existing Semi-Autonomy Ceiling section.
* Edit docs/HANDOFF_PACKET_SPEC.md to name the new script.
* Edit docs/DECISIONS.md to record the new decision.
* Create and use a temporary, isolated scratch copy of relevant repo files (outside the live .cockpit/ state) to functionally test the change without touching real task/project state; delete the scratch copy when done.

## Forbidden Scope

The worker must not:

* Do not modify any existing script (close-out-verified-task.ps1, return-inadequate-work.ps1, advance-cockpit-state.ps1, finalize-worker-handback.ps1, log-event.ps1, doctor.ps1, check-stop-conditions.ps1, check-autonomous-gate.ps1).
* Do not modify any schema.
* Do not have the new script advance task_status, call advance-cockpit-state.ps1, or otherwise treat a held cycle as accepted/closed.
* Do not rewrite or delete pcc-brr4-004's original claim in docs/BRR_POLICY.md that fielding was 'not required by this task' / policy-only at the time -- only add a clearly-marked pointer noting later fielding.
* Do not touch the self-verification fallback (DECISION-033/036), the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* Do not run any test of the new script against the live .cockpit/state/task-state.json, .cockpit/state/project-state.json, or .cockpit/result/verification-result.json -- all functional testing happens in an isolated scratch copy only.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- Class B, hold the self-verified result for owner/GPT review.

## Completion Criteria

The task is complete only if:

* scripts/archive-held-cycle.ps1 exists. It copies the live .cockpit/handoff/worker-directive.md, .cockpit/result/worker-result.md, and .cockpit/result/verification-result.json to their archive/ counterparts (<task_id>-worker-directive.md, etc.), using the exact same paths/naming convention as scripts/close-out-verified-task.ps1.
* The script does NOT advance task_status, does NOT call scripts/advance-cockpit-state.ps1, and does NOT change verification_verdict or any other task-state.json/project-state.json field -- it is a pure evidence-preservation step for a cycle still being held pending review, not a close-out or acceptance action.
* The script refuses to run if any of the three archive paths already exists (never overwrites archived history) or if verification-result.json's task_id does not match task-state.json's task_id -- matching close-out-verified-task.ps1's existing safety properties.
* The script works regardless of the verdict in verification-result.json (PASS or non-PASS) -- a held cycle's evidence should be preservable no matter what verdict it carries, since the point is preventing loss before a decision is made, not judging the decision itself.
* An optional -Commit switch stages and commits the newly-archived files (git add -A; git commit), mirroring close-out-verified-task.ps1's -Commit exactly, and never pushes.
* Functionally tested (not read-through only) in an isolated scratch copy: archiving a held cycle succeeds and task_status/verification_verdict remain unchanged in the live task-state.json; re-running against the same cycle refuses (archive path already exists); a task_id mismatch refuses.
* docs/BRR_POLICY.md's Semi-Autonomy Ceiling section is updated with a narrow, disclosed pointer (per DECISION-051's Post-Close Canonical Amendment Rule, since pcc-brr4-004 is already closed) naming this new script as the fielded version of the archive-before-chaining rule, without rewriting pcc-brr4-004's original 'policy only... future fielding work' claim, which was accurate when made.
* docs/HANDOFF_PACKET_SPEC.md is updated to name the new script alongside close-out-verified-task.ps1 and return-inadequate-work.ps1 as part of the recognized close-out/preservation family.
* A new decision is recorded in docs/DECISIONS.md.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or any other existing script's behavior.

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
