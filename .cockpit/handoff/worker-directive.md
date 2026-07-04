# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr5-001
* Task Title: BRR Readiness Review
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

Deliver docs/BRR_PLAN.md Phase 5's sole deliverable: an honest BRR Readiness Review, added as a new section to docs/BRR_PLAN.md (mirroring how docs/V1_Scope.md's 'V1 Closure' section handled V1's own honest close-out). Must list, plainly: what PCC can safely do unattended today (with evidence); what still requires owner review; what remains unsafe or immature (explicitly including the gaps named in DECISION-060/061 -- Class A self-accept never exercised, archive-before-chaining policy-only, fuller Metrics and Failure Review Loop undelivered, and the standing single-party self-verification risk); and a recommendation for the next lane (continue BRR hardening / begin post-V1 expansion / keep both narrowly active), stated as a recommendation for the owner to decide, not a self-executed choice.

## Allowed Scope

The worker may:

* Add a new section to docs/BRR_PLAN.md containing the readiness review.
* Edit docs/DECISIONS.md to record the new decision.
* Read (not modify) any canonical doc, decision, or archived task record needed to cite evidence accurately (docs/DECISIONS.md, docs/BRR_POLICY.md, docs/BRR_PLAN.md, .cockpit/result/archive/*, .cockpit/handoff/archive/*).

## Forbidden Scope

The worker must not:

* Do not modify any existing script or schema.
* Do not modify any existing section of docs/BRR_PLAN.md, docs/BRR_POLICY.md, or any other canonical doc -- this task only adds the new readiness-review section and the new decision.
* Do not choose or execute a next-lane decision (do not advance current_phase, do not begin post-V1 expansion work, do not start a new BRR hardening task) -- recommend only.
* Do not overstate confidence in the walk-away model beyond DECISION-045/DECISION-055's own 'meaningful evidence, not absolute proof' framing.
* Do not omit or soften any of the specific immature/unsafe items named in this task's own completion criteria.
* Do not self-close this task via scripts/close-out-verified-task.ps1 -- Class B, hold the self-verified result for owner/GPT review.

## Completion Criteria

The task is complete only if:

* docs/BRR_PLAN.md gains a 'Phase 5: BRR Readiness Review (Completed)' section (or equivalent heading) containing the four required lists/statements below.
* List 1, 'What PCC can safely do unattended': each claim backed by a specific citation to actual session history (a task ID, DECISION number, or pilot run), not asserted generically.
* List 2, 'What still requires owner review': stated per Task Safety Class and per the Owner Review Matrix's 'before execution' rows, consistent with the Semi-Autonomy Ceiling (docs/BRR_POLICY.md).
* List 3, 'What remains unsafe or immature': must explicitly include, at minimum: Class A self-accept is policy-supported but has never been exercised in a real cycle; the archive-before-chaining rule (DECISION-060) is policy-only, not enforced by any script (GPT's explicit caveat, DECISION-061); chaining beyond 2 cycles is untested; the fuller BRR Metrics deliverable and a formalized Failure Review Loop remain undelivered; and the standing risk that every verification this entire BRR program (Phases 2 through 5) has been self-verified by the same party who did the work, with Codex unavailable throughout and GPT's review being additive/remote-only, not independent local guardrail re-execution.
* A recommendation for the next lane (continue BRR hardening; begin post-V1 expansion; keep both narrowly active) is given with explicit reasoning, framed as a recommendation for the owner's decision -- the task does not choose the lane or take any action implementing a lane choice.
* The review does not overstate: no claim is made that BRR is 'proven' or the walk-away model is settled beyond what DECISION-045 and DECISION-055 already established (meaningful evidence, not absolute proof).
* A new decision is recorded in docs/DECISIONS.md summarizing the review and explicitly deferring the actual next-lane choice to the owner.
* No change to any of the five verdicts, any Task Safety Class's meaning, the Acceptance Boundary Rules, the self-verification fallback, or any existing script/schema.
* This task does not itself advance current_phase past brr-phase-5 or begin any next-lane work -- it only produces the review and the recommendation.

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
