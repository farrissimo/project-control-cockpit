# Advisor Restart Brief

Generated 2026-07-04T10:48:46-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-4

## Active Task

* Task ID: pcc-brr4-002
* Title: Honesty Checks: Retry Log
* Status: returned_for_verification
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: PILOT RUN #2, CYCLE 1 of 2 (docs/BRR_PLAN.md Phase 4 item 1; scope finalized in DECISION-056). Deliver IDEA-008's remaining 'retry' half: increment task-state.json's currently-unused 'attempts' field on every worker handback, and log a factual 'retry_attempted' event via scripts/log-event.ps1 specifically when a handback follows a prior non-PASS verdict on the same task_id (not on a task's first-ever handback). No new script; the change lives in scripts/finalize-worker-handback.ps1 (attempts/logging) and scripts/log-event.ps1 (new event type).

## Last Verified

* Verdict: PASS for task 'pcc-brr4-001', verified at 2026-07-04T10:30:00-06:00
* Summary: PILOT RUN #1 verification. All ten completion criteria are met with direct evidence, cross-checked at 'strict' depth against the actual diff and the raw tool-call transcript (not narrative alone). The change is purely additive: two new event types, two new logging call sites, zero changes to either script's existing decision logic, exit-code contract, or fail-closed/advisory nature. A real mid-cycle defect (stale handoff artifact) was caught by existing tooling and fixed transparently. Per this task's own pre-execution classification (Class B, self-close not eligible) and the owner's pilot design, this PASS is recorded as a candidate for owner/GPT review -- close-out has deliberately NOT been run, and task_status remains 'returned_for_verification', not 'complete'.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr4-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr4-001': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review has occurred. GPT secondary review: not yet performed on this specific cycle -- this verification-result.json is being produced specifically so it CAN be reviewed, not as a final close-out.
* Risk from last verification of 'pcc-brr4-001': PILOT DESIGN: this task is Class B, so per the Acceptance Boundary Rules this result must not be self-accepted. Unlike every other Class B task this session (pcc-brr3-001 through pcc-brr3-005, self-verified-and-closed under the DECISION-033 fallback disclosure), this cycle deliberately STOPS HERE: scripts/close-out-verified-task.ps1 has NOT been run, task_status remains 'returned_for_verification' (not 'complete'), and no commit has been made for this cycle's work. This verification-result.json records a self-verified PASS *candidate* for the owner/GPT to review -- it is explicitly not a final acceptance.
* Risk from last verification of 'pcc-brr4-001': Verification Depth Policy row applied: Class B, truth-surface-affecting (touches scripts/) -> strict. Strict depth was applied: full re-read of all three changed scripts, full diff review, and cross-checking the worker's test claims against the raw tool-call transcript rather than accepting the narrative alone.
* Risk from last verification of 'pcc-brr4-001': The mid-cycle defect (stale advisor-restart-brief.md) was a real process slip on my part, caught by doctor.ps1 rather than by my own discipline. It was fixed before it affected the actual test, but it is disclosed here as a genuine finding for the owner/GPT's judgment-quality review, not minimized.
* Risk from last verification of 'pcc-brr4-001': Per the pilot's own failure criterion, whether this run 'should have stopped, been differently classified, or should not have self-closed' is exactly the question this held-for-review verification result is submitted to answer -- I do not consider my own self-assessment (in worker-result.md) sufficient to settle it.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Worker evidence is in .cockpit/result/worker-result.md. Codex reviews evidence and issues a verification verdict per docs/VERIFICATION_RESULT_SPEC.md.
* Project-level: Worker evidence for task 'pcc-brr4-002' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
