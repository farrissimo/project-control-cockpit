# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-005
* Task Title: BRR Execution: Status-Change Refresh Invariant
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

Operationalize the generic invariant that any repo-native path which changes live task status must leave both live handoff artifacts regenerated from the post-write state, not just one of them. Build the lightest viable repo-native mechanism, guardrail, or shared helper that makes this two-artifact refresh rule explicit across the existing status-mutating workflow paths so the recurring stale-artifact defect becomes structurally harder to reintroduce.

## Allowed Scope

The worker may:

* Add or update narrowly scoped local script logic, guardrails, or a shared helper directly related to keeping both live handoff artifacts fresh after task-status changes.
* Update workflow docs or closely related repo-truth surfaces only as needed to make the invariant explicit and durable.
* Adjust live or archived artifacts, state, and logs only insofar as the active task flow needs to demonstrate the invariant honestly.
* Run the relevant local checks to prove the refreshed status-change path works on the active task flow.

## Forbidden Scope

The worker must not:

* Do not redesign doctor.ps1, check-schemas.ps1, validate-cockpit-state.ps1, or the broader PCC state model into generic orchestration unless a direct contradiction is found.
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy content unless a direct contradiction is found.
* Do not broaden into owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation.
* Do not rewrite archived history or retrofit old archived tasks outside what the active task's own honest demonstration requires.
* Do not use this task as a pretext to redesign unrelated scripts when a narrower invariant-focused fix would do.

## Completion Criteria

The task is complete only if:

* The repo gains one concrete, durable expression of the rule that a task-status change must leave both live handoff artifacts regenerated from the resulting state, preventing one-document refreshes from silently passing as complete.
* That mechanism is local-first and bounded: it improves status-change artifact freshness without redesigning the verdict model, BRR policy model, or broader workflow ownership rules.
* The existing repo-native status-changing paths that matter for live task flow are updated, checked, or routed so this two-artifact refresh invariant is explicit rather than memory-based.
* Verifier-facing and worker-facing workflow truth surfaces tell the roles exactly where this invariant is enforced and what to run, including any remaining manual edges if full centralization is not the lightest honest scope.
* The resulting path is demonstrated against the active task flow and leaves the repo healthy under the applicable local checks.
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
