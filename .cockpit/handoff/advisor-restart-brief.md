# Advisor Restart Brief

Generated 2026-07-04T01:14:26-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-008
* Title: BRR Execution: Safe Next-Task Drafting Rules
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Implement BRR Phase 2's third deliverable (docs/BRR_PLAN.md Phase 2 item 3, Safe Next-Task Drafting Rules) as the canonical rule set that operationalizes DECISION-038's auto-promote-and-run target. Define, concretely and falsifiably: (1) what counts as an already-approved lane (owner-reviewed phase plan deliverables and/or owner-ranked backlog priority, not any unreviewed idea); (2) the all-must-be-true gate under which PCC may promote AND begin the next task without per-task owner approval; (3) the requirement that each auto-promotion record which approved lane, backlog priority, and phase-plan item justify it; (4) that any fork (more than one defensible next step, or any Owner Review Matrix case) is a hard trip to the Owner-Decision Capture Flow (DECISION-037), not a tie PCC breaks for itself. Bound this to the DRAFTING/PROMOTION rules only. Do NOT build automatic stop-trigger detection (item 4) or acceptance-boundary enforcement (item 5), and do NOT switch on unattended execution: those depend on items 4 and 5 existing first, per DECISION-038's safe-sequencing clause.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-008', verified at 2026-07-04T01:15:00-06:00
* Summary: Reviewed the Safe Next-Task Drafting Rules against the task's completion criteria and DECISION-038's intent, reading the actual docs/BRR_POLICY.md and schema diffs rather than relying on the worker narrative. The rules define an approved lane concretely (grounded in BRR_PLAN deliverables and IDEAS.md priority, excluding unreviewed ideas), state the eight-part gate tied to (not duplicating) the Owner Review Matrix and Stop-Instead-of-Guess Policy, require a falsifiable promotion_basis (schema-enforced, verified to reject a missing nested field after a corrected test), route forks to the Owner-Decision Capture Flow, and explicitly gate unattended execution behind items 4-5. git diff confirms all 14 changed files are within allowed scope with no unexpected scripts and no weakened stop conditions. Independent guardrails (validate-cockpit-state, check-schemas, doctor) are clean on the returned state. All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-008-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-008': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed at time of verification (pushed immediately after for GPT's remote review). This cycle concentrates all three roles in Claude Code - it drafted the task (advisor), built it (worker), and verified it (verifier) - on the highest-stakes governance content in this phase (an authority/autonomy grant). GPT secondary review is more strongly warranted here than on a routine task; flagged explicitly.
* Risk from last verification of 'pcc-brr2-008': The auto-promotion gate is a rule set, not yet mechanically enforced by any script - a bad self-promotion is caught by the verifier and the promotion_basis audit trail after the fact, not blocked automatically. This is intentional per DECISION-038's sequencing (enforcement is Phase 2 item 4), but means the safety currently rests on judgment + auditability, not a hard gate.
* Risk from last verification of 'pcc-brr2-008': promotion_basis records a justification but nothing cross-checks its truth; the verifier must actually check the cited lane/priority is real, not just that the field is populated.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-008' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-008' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
