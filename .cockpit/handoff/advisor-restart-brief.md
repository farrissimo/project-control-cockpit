# Advisor Restart Brief

Generated 2026-07-04T00:45:40-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-007
* Title: BRR Execution: Owner-Decision Capture Flow
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field BRR Phase 2's second deliverable (docs/BRR_PLAN.md Phase 2, item 2: Owner-Decision Capture Flow) into live task state in the lightest viable way. When a task or cycle needs an owner decision (Class C per docs/BRR_POLICY.md, or an Owner Review Matrix row is hit), the repo should be able to record, structurally: what decision is needed, why it is needed, what options exist, and what remains blocked until the decision is made - instead of that living only as free-form prose in current_blocker or in chat. Keep this bounded to capturing and surfacing the request; do not build any automatic stop-trigger detection, owner-decision routing/notification, or acceptance-boundary enforcement - those remain separate, later Phase 2 deliverables (items 3-5).

## Last Verified

* Verdict: PASS for task 'pcc-brr2-007', verified at 2026-07-04T00:46:00-06:00
* Summary: Independently re-ran scripts/verify-handback-guardrails.ps1 against the actual returned-for-verification state (clean; one expected, non-fatal WARN about the handoff gate referencing the prior task). Verified via git status that only the claimed files changed - no BRR_PLAN.md edit (correctly, matching established precedent that it carries no per-item completion annotations), no unrelated scripts or schemas touched. Independently reviewed the schema addition, both generator changes, and all five touched docs, confirming the owner_decision_request field's null/populated behavior, its distinction from current_blocker, and consistent propagation across all touched truth surfaces. All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-007-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-007': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed this cycle (not yet pushed at time of verification).
* Risk from last verification of 'pcc-brr2-007': The demonstration used a disposable scratch copy with a synthetic (though genuinely open) owner-decision example, not a live-populated one, since this task's own drafting had no ambiguity requiring a real owner-decision request. This is disclosed directly in the worker evidence rather than hidden.
* Risk from last verification of 'pcc-brr2-007': owner_decision_request and current_blocker can be populated independently with no cross-validation between them; a future cycle could set them inconsistently without any check catching it.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-007' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-007' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
