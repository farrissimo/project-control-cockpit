# Advisor Restart Brief

Generated 2026-07-04T11:36:07-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-4

## Active Task

* Task ID: pcc-brr4-002
* Title: Honesty Checks: Retry Log
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: PILOT RUN #2, CYCLE 1 of 2 (docs/BRR_PLAN.md Phase 4 item 1; scope finalized in DECISION-056). Deliver IDEA-008's remaining 'retry' half: increment task-state.json's currently-unused 'attempts' field on every worker handback, and log a factual 'retry_attempted' event via scripts/log-event.ps1 specifically when a handback follows a prior non-PASS verdict on the same task_id (not on a task's first-ever handback). No new script; the change lives in scripts/finalize-worker-handback.ps1 (attempts/logging) and scripts/log-event.ps1 (new event type).

## Last Verified

* Verdict: PASS for task 'pcc-brr4-002', verified at 2026-07-04T10:50:00-06:00
* Summary: Verified pcc-brr4-002 (cycle 1 of pilot run #2) at 'strict' depth. The retry-detection read-before-increment ordering is correct (confirmed by direct diff inspection, not just narrative), the logging failure path is non-fatal by design, and no existing behavior of either touched script changed. All ten completion criteria are met with direct evidence, cross-checked against the raw execution transcript. Per DECISION-056, this cycle resolved cleanly enough to chain into cycle 2 without waiting for review -- that determination, and this held PASS candidate itself, are both submitted for actual owner/GPT review, not treated as self-settled.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr4-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr4-002': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT secondary review not yet performed on this specific cycle.
* Risk from last verification of 'pcc-brr4-002': PILOT DESIGN (DECISION-056): Class B, self-close not attempted this run regardless of class. This verification-result.json is a HELD candidate. scripts/close-out-verified-task.ps1 has NOT been run; task_status remains 'returned_for_verification'.
* Risk from last verification of 'pcc-brr4-002': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Applied via full re-read of both changed scripts, diff review, and cross-checking the test transcript against worker-result.md's narrative.
* Risk from last verification of 'pcc-brr4-002': The retry-detection mechanism depends on an implicit cross-script invariant (verification_verdict is never cleared to null between cycles by any other script) rather than an enforced contract -- confirmed true today by re-reading advance-cockpit-state.ps1, close-out-verified-task.ps1, and return-inadequate-work.ps1, but a future script change could silently break this assumption without any test catching it until a real retry happens.
* Risk from last verification of 'pcc-brr4-002': CHAINING DETERMINATION: this cycle resolved cleanly by DECISION-056's stated definition (self-verified PASS candidate, no stop-trigger, no scope issue), so per that decision's interpretation, cycle 2 (pcc-brr4-003) may be drafted next without waiting for this cycle's review to complete first. This interpretation was stated explicitly in DECISION-056 as correctable if wrong -- flagging again here so review of BOTH cycles together can catch it if the chaining judgment itself was premature.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr4-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr4-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
