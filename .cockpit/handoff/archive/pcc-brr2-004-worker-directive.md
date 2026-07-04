# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-004
* Task Title: BRR Verification: Deterministic Close-Out
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

Operationalize verifier close-out and repo-sync duties in the same concrete way pcc-brr2-002 operationalized worker handback and pcc-brr2-003 operationalized verifier guardrails. Build the lightest viable verifier-side helper or equivalent repo-native mechanism that performs the normal post-PASS close-out sequence in a fixed, repeatable order: archive the cycle artifacts, advance state with the archived handoff path, run the post-close-out health check, log the event, and leave the repo in a clean commit-ready state so repo sync is an official duty expressed directly in the repo rather than a remembered checklist.

## Allowed Scope

The worker may:

* Add or update a narrowly scoped local script or equivalent repo-native helper for verifier-side post-PASS close-out.
* Update verifier-facing workflow docs or closely related repo-truth surfaces only as needed to make that close-out path explicit and durable.
* Adjust live or archived artifacts, state, and logs only insofar as the active task flow needs to demonstrate the new close-out path honestly.
* Run the relevant local checks to prove the close-out path works on the active task flow.

## Forbidden Scope

The worker must not:

* Do not redesign doctor.ps1, check-schemas.ps1, validate-cockpit-state.ps1, or advance-cockpit-state.ps1 into broad gates for unrelated workflows unless a direct contradiction is found.
* Do not change the five verification verdicts, task safety classes, worker handback script behavior, or BRR Phase 1 policy content unless a direct contradiction is found.
* Do not broaden into owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation.
* Do not rewrite archived history or retrofit old archived tasks outside what the active task's own honest demonstration requires.
* Do not pretend repo commit/push policy changed beyond what decisions already authorize.

## Completion Criteria

The task is complete only if:

* The repo gains one concrete verifier-facing mechanism for normal post-PASS close-out, making the usual archive, state-advance, post-close-out health check, and logging sequence explicit and repeatable rather than memory-based.
* That mechanism is local-first and bounded: it does not redesign the verification verdict model, replace independent verifier judgment, or broaden BRR scope beyond operationalizing already-recorded verifier duties.
* The mechanism preserves the archived handoff path correctly when state advances, and leaves the repo in a clean commit-ready state for the verifier's repo-sync duty.
* Verifier-facing docs and any touched workflow truth surfaces tell Codex exactly what to run and when for close-out, including what still remains a deliberate manual duty versus what the helper now performs.
* The resulting close-out path is demonstrated against the active task flow and leaves the repo healthy under the applicable local checks.
* No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign is introduced.

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
