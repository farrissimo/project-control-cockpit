# Advisor Restart Brief

Generated 2026-07-03T20:24:39-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-014
* Title: Safety Net: Wrap-Up Fix
* Status: complete
* Objective: Fix scripts/advance-cockpit-state.ps1 so canonical next_action/next_expected_action and last_verified_handoff stay accurate after a verified PASS closes out a cycle, without needing manual correction each time (this has now happened twice: pcc-v1-011 and pcc-v1-012). Two confirmed root causes to fix: (1) advance-cockpit-state.ps1 copies verification.next_action verbatim, but that text is the verifier's own pre-close-out checklist (advance/doctor/archive/commit), so it describes already-completed steps as pending the moment they finish; (2) last_verified_handoff is set to task-state.json's current_directive_path (the live, soon-to-be-overwritten worker-directive.md), never the archived immutable copy created during close-out.

## Last Verified

* Verdict: PASS for task 'pcc-v1-014', verified at 2026-07-03T20:45:00-06:00
* Summary: Independently reproduced the core fix from a fresh scratch copy using a different synthetic task_id and a different deliberately-planted stale-checklist next_action string, confirming it does not leak through for a PASS verdict and that the archived path is used correctly. Also independently tested the BLOCKED verdict path (not covered by the worker's own tests) and confirmed non-PASS behavior is unaffected. Confirmed via diff that docs/DECISIONS.md was correctly left untouched, matching allowed scope. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-014-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-014': The fallback to old live-path behavior when -ArchivedDirectivePath is omitted means a verifier who forgets to archive-then-advance in the new order gets silently the old, still-slightly-wrong behavior rather than a warning.
* Risk from last verification of 'pcc-v1-014': The new default PASS next_action is a fixed generic template; richer per-cycle context requires remembering to pass -FinalNextAction explicitly.
* Risk from last verification of 'pcc-v1-014': The new close-out order is prose guidance only, not enforced by any script.
* Risk from last verification of 'pcc-v1-014': Self-verification note (DECISION-019): mitigated by independently reproducing the fix from a fresh scratch copy with different synthetic data (a different task_id, a different deliberately-planted stale string) than the worker used, and by independently testing a verdict path (BLOCKED) the worker's own testing did not cover.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-v1-014' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-v1-014' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
