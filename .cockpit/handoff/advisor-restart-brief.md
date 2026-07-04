# Advisor Restart Brief

Generated 2026-07-04T09:19:18-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-3

## Active Task

* Task ID: pcc-brr3-002
* Title: BRR Policy: Self-Verification Limits
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Extend docs/BRR_POLICY.md with a 'Self-Verification Restrictions' section (docs/BRR_PLAN.md Phase 3 item 2) bounding the existing DECISION-033/DECISION-036 self-verification fallback: which task classes/types may be self-verified at all, which require a second reviewer or stronger deterministic checks, and what extra evidence is required when self-verification is allowed. This tightens the existing exception; it does not redefine or expand the DECISION-033/DECISION-036 authority grant itself.

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 2, 'Self-Verification Restrictions' -- the next listed item directly after pcc-brr3-001's item 1
* Justification (continuation, not a fork): Independently checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039), not accepted on say-so: current task (pcc-brr3-001) complete/PASS; repo health/state checks clean (validate-cockpit-state.ps1, check-schemas.ps1, doctor.ps1); already-approved lane (BRR_PLAN.md Phase 3); scope sufficiently fleshed out from the plan's own bullet list without new owner intent; aligned with the babysitting-reduction north star; bounded and classifiable (Class B, matching pcc-brr3-001's precedent); no Owner Review Matrix 'before execution' row applies because bounding an existing exception more tightly is a restriction, not an authority expansion -- the opposite of the disguised-fork pattern caught in pcc-brr2-013's candidate #2 (default-on unattended auto-run); and it changes no project goal, architecture, authority model, cost model, or safety posture, since it narrows rather than broadens the existing DECISION-033 exception. GPT, serving as today's advisor/secondary reviewer, independently recommended treating this as in-lane continuation; that recommendation is corroborating context per DECISION-036's scope for GPT (secondary review input, not independent authority), not the basis for this promotion -- the basis is the gate check recorded here.
## Last Verified

* Verdict: PASS for task 'pcc-brr3-002', verified at 2026-07-04T09:22:00-06:00
* Summary: Verified pcc-brr3-002 (BRR Policy: Self-Verification Limits) at 'strict' depth, as this task's own predecessor policy (pcc-brr3-001's Verification Depth Policy) requires for a Class B, truth-surface-affecting change. Read the full added 'Self-Verification Restrictions' section directly, cross-checked it against Task Safety Classification, Acceptance Boundary Rules, and the Verification Depth Policy, and confirmed via git diff that DECISION-033/036's own text is unaltered and no scripts/schemas were touched. All six completion criteria are met with direct evidence. Independent local guardrails clean. This is the first self-promoted task since Phase 2: PCC independently re-walked the full 8-part Safe Next-Task Drafting Rules gate rather than accepting GPT's (today's advisor/secondary-reviewer) recommendation as authority, per DECISION-036's own limit on GPT's role -- the recorded promotion_basis reflects that independent check. The new section's circularity restriction was also applied to this task itself and correctly found not to trigger self-closure ineligibility, since the task adds an adjacent policy section rather than modifying the self-verification/gate/classification mechanisms it restricts.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr3-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr3-002': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: GPT provided the recommendation that prompted this task's self-promotion, but did not review the completed result itself this cycle -- that is a distinct, narrower role than the review disclosure this line normally covers, and is named explicitly rather than conflated with a completed-result review.
* Risk from last verification of 'pcc-brr3-002': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Strict depth was applied (full read of the added section plus line-by-line cross-check against Task Safety Classification, Acceptance Boundary Rules, and Verification Depth Policy, performed and recorded here, not merely asserted).
* Risk from last verification of 'pcc-brr3-002': Circularity-restriction self-check: this task does NOT fall into the new circularity case it defines (it does not modify DECISION-033/036's text, the autonomous gate scripts, or a Task Safety Class's core definition -- it adds a new adjacent policy section, the same shape as pcc-brr3-001). It was therefore correctly eligible for self-verification under this cycle's own new rule, not an exception to it.
* Risk from last verification of 'pcc-brr3-002': This is the first self-promoted task since BRR Phase 2 (promotion_basis populated). The promotion reasoning was independently re-derived against the actual 8-part gate rather than accepted on GPT's recommendation, but it remains PCC's own self-assessment of its own self-promotion -- exactly the kind of call a future independent reviewer (Codex, or a more adversarial GPT pass with the actual diff) should re-check rather than assume correct because it is thoroughly documented.
* Risk from last verification of 'pcc-brr3-002': The new circularity restriction is definitional and judgment-applied only; nothing currently detects automatically whether a future diff touches the gate scripts or a class definition -- a verifier has to notice this by reading the diff, same limitation disclosed for Verification Depth Policy's own enforcement gap.
* Risk from last verification of 'pcc-brr3-002': DECISION-036's commit-and-push-every-PASS authorization remains lapsed in BRR Phase 3 (per DECISION-036's own text, time-boxed to 'the remainder of BRR Phase 2'). This cycle's changes are committed locally per the standing DECISION-020 default; pushing to any remote requires a fresh, explicit owner approval this cycle.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr3-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr3-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
