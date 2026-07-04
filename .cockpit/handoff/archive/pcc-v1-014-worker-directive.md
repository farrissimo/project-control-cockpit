# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-v1-014
* Task Title: Safety Net: Wrap-Up Fix
* Task Status: ready_for_worker

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

Fix scripts/advance-cockpit-state.ps1 so canonical next_action/next_expected_action and last_verified_handoff stay accurate after a verified PASS closes out a cycle, without needing manual correction each time (this has now happened twice: pcc-v1-011 and pcc-v1-012). Two confirmed root causes to fix: (1) advance-cockpit-state.ps1 copies verification.next_action verbatim, but that text is the verifier's own pre-close-out checklist (advance/doctor/archive/commit), so it describes already-completed steps as pending the moment they finish; (2) last_verified_handoff is set to task-state.json's current_directive_path (the live, soon-to-be-overwritten worker-directive.md), never the archived immutable copy created during close-out.

## Allowed Scope

The worker may:

* Update scripts/advance-cockpit-state.ps1.
* Update .cockpit runtime files only as needed for the fix or its demonstration.
* Update docs directly related to close-out order, next_action semantics, or verification-result next_action (docs/VERIFICATION_RESULT_SPEC.md, docs/HANDOFF_PACKET_SPEC.md, docs/STATE_MODEL.md).
* Add or update a small demonstration step if needed.

## Forbidden Scope

The worker must not:

* Do not build UI or broader application code yet.
* Do not add paid API dependencies.
* Do not introduce broad orchestration or automation.
* Do not change canonical project goals or verification verdicts (PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE must remain exactly these five values).
* Do not require the owner to manually restate or carry the worker instructions.
* Do not rewrite, reorder, or delete any existing archived file or routing-log.jsonl line; this task changes behavior going forward only.

## Completion Criteria

The task is complete only if:

* scripts/advance-cockpit-state.ps1 accepts an explicit archived-directive-path input (e.g. a parameter) and, when supplied, sets last_verified_handoff to that archived path rather than the live current_directive_path; when not supplied, existing behavior is preserved so nothing already depending on this script breaks.
* docs/VERIFICATION_RESULT_SPEC.md's next_action field definition is updated to state that for a PASS verdict, next_action must describe the durable state after the cycle closes (e.g. 'task complete; owner selects the next backlog item') rather than the verifier's own remaining close-out checklist, so it cannot describe already-completed steps as pending.
* The documented close-out order (docs/HANDOFF_PACKET_SPEC.md and/or DECISION-020's description) is updated to archive the cycle's directive/result/verification files before running advance-cockpit-state.ps1, passing the resulting archive path in.
* A demonstration shows a full cycle (draft -> verify PASS -> archive -> advance) leaves last_verified_handoff pointing at the archived copy and next_action describing the true post-close-out state, with no manual correction step needed afterward.
* The change stays within the approved V1 scope, remains local deterministic, and does not introduce broad orchestration or automation.
* Claude returns evidence in .cockpit/result/worker-result.md using the required format.

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
