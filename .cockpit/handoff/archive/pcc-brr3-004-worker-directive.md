# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr3-004
* Task Title: BRR Policy: Inadequate-Work Return Path
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 4, 'Inadequate-Work Return Path' -- the fourth and final listed Phase 3 item, directly after pcc-brr3-003's item 3
* Justification (continuation, not a fork): Independently re-checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039): current task (pcc-brr3-003) complete/PASS; repo health/state checks clean (check-stop-conditions.ps1 CLEAR, check-autonomous-gate.ps1 PROCEED); already-approved lane (BRR_PLAN.md Phase 3, final item); scope kept deliberately definitional (no new script), matching the precedent of items 1-3 and the owner's own stop-condition against broadening into governance redesign; aligned with the babysitting-reduction north star (makes non-PASS outcomes routine rather than something that quietly gets avoided); bounded and classifiable (Class B, matching precedent); no Owner Review Matrix 'before execution' row applies since this names and clarifies already-existing mechanics rather than granting or changing authority; changes no project goal, architecture, authority model, or safety posture. The owner directly reviewed and pre-authorized self-promoting this specific item this cycle ('self-promote Phase 3 item 4 under the same gate... does not need fresh owner naming'), with two explicit stop-conditions (do not touch the fallback authority model/autonomous gate/acceptance boundary/class meanings/verdict definitions; do not broaden beyond return-path normalization into governance redesign) carried verbatim into this task's forbidden-scope list. The owner also gave explicit wording for a small, distinct fix to pcc-brr3-003's existing text (reframe the adjacent-scope check as a reviewer discipline, not a strong detector) -- that specific edit is owner-directed, not self-promoted, and is called out separately in boundaries/completion criteria so it is never conflated with item 4's own self-promoted content.
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

Add an 'Inadequate-Work Return Path' section to docs/BRR_POLICY.md (docs/BRR_PLAN.md Phase 3 item 4) making it explicit that FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE are normal, expected, safe outcomes of verification, not exceptional or failure states -- naming the mechanics that already make the path symmetric with PASS, the one real asymmetry (no dedicated close-out convenience script for non-PASS verdicts), and what happens after each verdict, without touching the fallback authority model, autonomous gate, acceptance boundary rules, task-class meanings, or the five verdict definitions. Also, per explicit owner instruction this cycle, reword the 'silent adjacent-scope edits' description added under pcc-brr3-003 to frame it as a required reviewer discipline rather than a precise deterministic detector -- a distinct, owner-directed micro-edit, not part of item 4's own content.

## Allowed Scope

The worker may:

* Edit docs/BRR_POLICY.md to add the new 'Inadequate-Work Return Path' section.
* Edit docs/DECISIONS.md to record the new decision.
* Per explicit owner instruction this cycle: reword the existing 'silent adjacent-scope edits' bullet and its matching procedure step (added under pcc-brr3-003) to frame it as a reviewer discipline rather than a precise detector. This is a distinct, owner-directed micro-edit, not self-promoted, not item-4 content, and not adjacent-scope drift.
* Cross-reference docs/BRR_PLAN.md Phase 3 item 4, docs/VERIFICATION_RESULT_SPEC.md, docs/BRR_POLICY.md's Stop-Instead-of-Guess Policy, and scripts/advance-cockpit-state.ps1's existing behavior (by description only, not by editing the script) without altering any of their existing content/behavior.

## Forbidden Scope

The worker must not:

* Do not alter the self-verification fallback (DECISION-033/036), the autonomous gate scripts, the Acceptance Boundary Rules, any Task Safety Class's core meaning, or the five verdict definitions themselves. If drafting surfaces a direct need to touch one of these, stop and surface via owner_decision_request rather than resolving it unilaterally.
* Do not broaden scope beyond making the inadequate-work return path routine and safe into a larger workflow/governance redesign.
* Do not implement any new script (including the recommended future return-path convenience script) -- name it as future work only.
* Do not modify any schema, task-state.json fields, or verification-result.json shape.
* Do not touch anything under scripts/.
* Do not edit any part of the Out-of-Scope Detection section other than the specific 'silent adjacent-scope edits' bullet and its matching procedure step named above.
* Do not mark BRR Phase 3 complete or advance current_phase.

## Completion Criteria

The task is complete only if:

* docs/BRR_POLICY.md gains an 'Inadequate-Work Return Path' section explicitly framing a non-PASS verdict as the verification system succeeding, not PCC failing.
* The section names that scripts/advance-cockpit-state.ps1 already maps every verdict (not just PASS) to a task_status and refreshes both live handoff artifacts unconditionally -- the return path already runs on the same mechanism as PASS, not a degraded fallback.
* The section names the one real asymmetry honestly: no dedicated close-out convenience script exists yet for non-PASS verdicts (unlike close-out-verified-task.ps1 for PASS), and recommends fielding one as future work without building it here.
* The section restates, for visibility only, what happens after each of the four non-PASS verdicts, pointing at the existing Stop-Instead-of-Guess Policy trigger table (pcc-brr1-003) rather than duplicating or changing it.
* The section does not alter the self-verification fallback (DECISION-033/036), the autonomous gate, the Acceptance Boundary Rules, any Task Safety Class's core meaning, or the five verdict definitions themselves.
* The section does not broaden beyond making the return path routine and safe into a larger workflow/governance redesign.
* The 'silent adjacent-scope edits' wording in the existing Out-of-Scope Detection section (pcc-brr3-003) is reworded, per explicit owner instruction this cycle, to describe it as a required reviewer discipline rather than a precise/strong detector -- recorded distinctly as an owner-directed micro-edit, not conflated with item 4's own content.
* A new decision is recorded in docs/DECISIONS.md documenting both the policy addition and the owner-directed wording fix.
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
