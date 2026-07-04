# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr3-003
* Task Title: BRR Policy: Out-of-Scope Detection
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 3, 'Out-of-Scope Detection Hardening' -- the next listed item after pcc-brr3-002's item 2
* Justification (continuation, not a fork): Independently re-checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039): current task (pcc-brr3-002) complete/PASS; repo health/state checks clean; already-approved lane (BRR_PLAN.md Phase 3); scope kept deliberately definitional/procedural (not a new script) to stay bounded without new owner intent, per the owner's own caution against chasing perfect detection; aligned with the babysitting-reduction north star; bounded and classifiable (Class B, matching precedent); no Owner Review Matrix 'before execution' row applies since this defines detection criteria rather than granting or changing authority; changes no project goal, architecture, authority model, or safety posture. Distinct from pcc-brr3-002: this time the owner directly reviewed and pre-authorized self-promoting this specific item this cycle ('self-promote Phase 3 item 3 next... it does not need owner naming directly'), including two explicit stop-conditions (do not touch the self-verification fallback/autonomous gate/acceptance boundary/class meanings; do not broaden into governance redesign) that are carried into this task's forbidden-scope list verbatim. That owner sign-off is stronger corroborating context than GPT's prior recommendation, but the gate check above -- not the owner's blessing of the mechanism -- remains the recorded basis, consistent with treating self-promotion as a checkable claim rather than an assumed one.
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

Add an 'Out-of-Scope Detection' section to docs/BRR_POLICY.md (docs/BRR_PLAN.md Phase 3 item 3) giving concrete, checkable definitions for the three named failure modes (unauthorized file changes, unintended truth-surface edits, silent adjacent-scope edits) and a required, structural verification procedure covering them -- formalizing practice already used ad hoc in prior verification results (per-file diff review against boundaries.allowed/forbidden), without adding new scripts or touching the self-verification fallback, autonomous gate, acceptance boundary rules, or any Task Safety Class's core meaning.

## Allowed Scope

The worker may:

* Edit docs/BRR_POLICY.md to add the new 'Out-of-Scope Detection' section.
* Edit docs/DECISIONS.md to record the new decision.
* Cross-reference docs/BRR_PLAN.md Phase 3 item 3 and existing docs/BRR_POLICY.md sections (Owner Review Matrix row 7, Verification Depth Policy, Self-Verification Restrictions) without altering their existing content.

## Forbidden Scope

The worker must not:

* Do not alter the self-verification fallback (DECISION-033/036), the autonomous gate scripts, the Acceptance Boundary Rules, or any Task Safety Class's core meaning. If drafting this section surfaces a direct need to touch one of these, stop and surface via owner_decision_request rather than resolving it unilaterally.
* Do not broaden scope into a larger governance redesign -- stay confined to detection criteria and procedure.
* Do not implement any new script, automatic detection tooling, or enforcement/gating change.
* Do not modify any schema, task-state.json fields, or verification-result.json shape.
* Do not touch anything under scripts/.
* Do not mark BRR Phase 3 complete or advance current_phase.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains an 'Out-of-Scope Detection' section defining, concretely and checkably, all three named failure modes: unauthorized file changes; unintended truth-surface edits; silent adjacent-scope edits.
* The section defines an explicit, enumerated 'truth surface' list or a clear, checkable rule for identifying one, so 'unintended truth-surface edit' is checkable rather than left to intuition.
* The section requires a structural verification procedure (enumerate every changed file; check each against the task's boundaries.allowed/forbidden; check for unrelated/unclaimed changes within an allowed file) recorded using the existing out_of_scope_findings field -- no new schema field introduced.
* The section stays structural and measurable per docs/BRR_PLAN.md Phase 3's own special caution against chasing perfect hallucination/intent detection.
* The section does not alter the self-verification fallback (DECISION-033/036), the autonomous gate, the Acceptance Boundary Rules, or any Task Safety Class's core meaning.
* The section does not broaden into a larger governance redesign -- stays confined to detection criteria and procedure, introducing no new verdict or authority.
* A new decision is recorded in docs/DECISIONS.md documenting the policy addition.
* No runtime script, schema, or enforcement change is introduced.
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
