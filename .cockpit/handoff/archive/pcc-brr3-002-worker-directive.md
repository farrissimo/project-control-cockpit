# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr3-002
* Task Title: BRR Policy: Self-Verification Limits
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 2, 'Self-Verification Restrictions' -- the next listed item directly after pcc-brr3-001's item 1
* Justification (continuation, not a fork): Independently checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039), not accepted on say-so: current task (pcc-brr3-001) complete/PASS; repo health/state checks clean (validate-cockpit-state.ps1, check-schemas.ps1, doctor.ps1); already-approved lane (BRR_PLAN.md Phase 3); scope sufficiently fleshed out from the plan's own bullet list without new owner intent; aligned with the babysitting-reduction north star; bounded and classifiable (Class B, matching pcc-brr3-001's precedent); no Owner Review Matrix 'before execution' row applies because bounding an existing exception more tightly is a restriction, not an authority expansion -- the opposite of the disguised-fork pattern caught in pcc-brr2-013's candidate #2 (default-on unattended auto-run); and it changes no project goal, architecture, authority model, cost model, or safety posture, since it narrows rather than broadens the existing DECISION-033 exception. GPT, serving as today's advisor/secondary reviewer, independently recommended treating this as in-lane continuation; that recommendation is corroborating context per DECISION-036's scope for GPT (secondary review input, not independent authority), not the basis for this promotion -- the basis is the gate check recorded here.
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

Extend docs/BRR_POLICY.md with a 'Self-Verification Restrictions' section (docs/BRR_PLAN.md Phase 3 item 2) bounding the existing DECISION-033/DECISION-036 self-verification fallback: which task classes/types may be self-verified at all, which require a second reviewer or stronger deterministic checks, and what extra evidence is required when self-verification is allowed. This tightens the existing exception; it does not redefine or expand the DECISION-033/DECISION-036 authority grant itself.

## Allowed Scope

The worker may:

* Edit docs/BRR_POLICY.md to add the new 'Self-Verification Restrictions' section.
* Edit docs/DECISIONS.md to record the new decision.
* Cross-reference docs/BRR_PLAN.md Phase 3 item 2 and existing docs/BRR_POLICY.md sections (including the new Verification Depth Policy) without altering their existing content.
* Cross-reference DECISION-033/036 by citation only, without changing their text or their standing authorization.

## Forbidden Scope

The worker must not:

* Do not rewrite, expand, narrow-by-redefinition, or repeal the DECISION-033/036 fallback authority grant itself -- only add a bounding restriction layer on top of it.
* Do not reopen or re-decide any Phase 2 autonomy decision (DECISION-038 through DECISION-042, DECISION-045). If drafting this section surfaces a direct, genuine contradiction with one of them, stop and surface it via owner_decision_request rather than resolving it unilaterally.
* Do not implement any runtime enforcement, gating, or automatic depth/reviewer selection (no script changes).
* Do not modify any schema, task-state.json fields, or verification-result.json shape.
* Do not touch anything under scripts/.
* Do not mark BRR Phase 3 complete or advance current_phase.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains a 'Self-Verification Restrictions' section defining which task classes/types may be self-verified, which require a second reviewer or stronger deterministic checks, and what extra evidence is required when self-verification is permitted.
* The section is explicit that it bounds/tightens the existing DECISION-033/036 fallback rather than redefining, expanding, or replacing that authority grant.
* The section reconciles with, and does not contradict, Task Safety Classification, Acceptance Boundary Rules, and the Verification Depth Policy (pcc-brr3-001) -- ties naturally to the 'strict' depth requirement, since strict depth performed by the same self-verifying party is exactly where the restriction matters most.
* A new decision is recorded in docs/DECISIONS.md documenting the policy addition.
* No runtime script, schema, or enforcement change is introduced; DECISION-033/036's own wording is not altered; no Phase 2 autonomy decision (DECISION-038 through 042, 045) is reopened or re-decided.
* No existing verdict, task safety class, or stop condition is redefined or weakened.

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
