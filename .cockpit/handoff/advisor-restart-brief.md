# Advisor Restart Brief

Generated 2026-07-04T01:32:42-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-009
* Title: BRR Execution: Automatic Stop Triggers
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Implement BRR Phase 2's fourth deliverable (docs/BRR_PLAN.md Phase 2 item 4, Automatic Stop Triggers) as a deterministic, advisory (non-gating) local check that DETECTS the deterministically-checkable stop conditions and SURFACES them, so PCC stops instead of guessing. Keep it firmly on the 'controlled forward motion, not friction' side the plan demands: it must NOT become automatic-blocking-everywhere and must NOT hard-gate owner-directed work. It must honestly NOT pretend to auto-detect judgment-based stop conditions (fork/multiple-valid-paths, north-star alignment, whether a new owner-level decision is needed) - those remain judgment plus the Owner-Decision Capture Flow, per DECISION-008 (no fake intelligence). Also fold the owner's two governing maxims ('owner approval is for direction changes, not routine continuation inside an already-approved lane' and 'the pre-task prep work is what justifies the automation') into a short shared Governing Principles note in docs/BRR_POLICY.md that governs both the Safe Next-Task Drafting Rules (item 3) and these stop triggers (item 4). Do NOT build acceptance-boundary enforcement (item 5) and do NOT switch on unattended execution.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-009', verified at 2026-07-04T01:33:00-06:00
* Summary: Reviewed scripts/check-stop-conditions.ps1 and the BRR_POLICY additions against the completion criteria, reading the script and policy directly. The detector correctly reports CLEAR on live state and STOP (exit 0 in all cases) on deliberately-tripped conditions in scratch; it is genuinely non-gating (only its file-read helper exits non-zero; the stop logic never blocks). It honestly names the judgment-based conditions it does not detect (DECISION-008). The BRR_POLICY 'Automatic Stop Triggers' section ties to the Stop-Instead-of-Guess Policy and the auto-promotion gate without duplicating them, and the two owner maxims are recorded verbatim in a shared Governing Principles note (grep-confirmed). git status shows only the one new script and the intended docs/state files - no schema change, no unexpected scripts, no weakened stop condition. The worker's decision not to edit REPO_GOVERNANCE is defensible (the detector is a tool, not a new workflow step, and makes nothing stale). All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-009-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-009': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed at verification time (pushed immediately after for GPT). Claude drafted, built, and verified this cycle; and this is safety machinery (a stop-condition detector). GPT review of the surface-vs-gate design is specifically recommended.
* Risk from last verification of 'pcc-brr2-009': Key design decision, flagged for owner/GPT: the detector is advisory/non-gating - nothing yet auto-invokes it or acts on a STOP. This is deliberate (plan's controlled-forward-motion caution) but means it only helps if something runs it. Making stops actually gate self-promotion would be a separate, explicit escalation, not done here.
* Risk from last verification of 'pcc-brr2-009': Condition 4 (approved-lane) is a formal string check that promotion_basis.lane references a known approved-lane source, not a semantic check that the cited lane is correct; the verifier remains the backstop for semantic correctness.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-009' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-009' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
