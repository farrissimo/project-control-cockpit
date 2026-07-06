# Advisor Restart Brief

Generated 2026-07-05T19:24:14-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-006
* Title: Handoff / Rollover Panel (Read-Only) — Phase D2 Complete
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D2's final task: a Handoff/Rollover panel in dashboard/index.html showing the latest clean/verified handoff (from project-state.json's already-loaded last_verified_handoff field) and current rollover-trigger warnings. CORRECTED MID-TASK: the original plan was to invoke scripts/check-stop-conditions.ps1 as a subprocess, mirroring the classify-routing.ps1 pattern. Testing during this task discovered that check-stop-conditions.ps1 is NOT side-effect-free: it writes a stop_condition_fired event to routing-log.jsonl whenever it detects a stop condition (BRR Phase 4/IDEA-008), which would break the dashboard's read-only contract and would be actively dangerous under scripts/watch-dashboard.ps1's polling loop (repeated writes every few seconds while a condition stays active). Testing this also surfaced a real, pre-existing, out-of-scope finding: check-stop-conditions.ps1's approved-lane-source list does not recognize docs/PATH_A_PLAN.md, so it mechanically false-flags every Path A task's promotion_basis -- not fixed here (would require modifying a different existing script, forbidden by this task's scope), disclosed for a future task instead. The corrected design reads the two most owner-relevant, side-effect-free signals (owner_decision_request pending; task_status in an attention-needed state) directly from task-state.json fields already loaded, with no subprocess call and no write risk. Completing this delivers all of Phase D2 (pcc-pathD-004 through pcc-pathD-006).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-006)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-006', verified at 2026-07-05T22:00:00-06:00
* Summary: Both of the worker's mid-task findings (check-stop-conditions.ps1's log-write side effect; its stale approved-lane-source list not recognizing docs/PATH_A_PLAN.md) were independently confirmed by reading that script's source directly, not taken on trust. The correction to a no-subprocess design was independently judged the right call given the real constraints (no safer alternative exists in repo truth, and building one was out of scope). The delivered Handoff/Rollover panel was independently confirmed to match its claims: no new subprocess call, no .cockpit/ mutation, correct use of already-loaded state. No blocker found.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-006-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-006': Disclosed, non-blocking, and endorsed by the reviewer: the Handoff/Rollover panel intentionally mirrors only two of check-stop-conditions.ps1's four conditions (owner decision pending; attention-needed status), not doctor.ps1-issue surfacing or lane-recognition. Reviewer agrees this narrowing is correct given the full script could not be invoked safely and duplicating all its logic would have been the worse design.
* Risk from last verification of 'pcc-pathD-006': The stale approved-lane-source list in scripts/check-stop-conditions.ps1 (not recognizing docs/PATH_A_PLAN.md) remains unaddressed, as disclosed -- a real gap in a different script, out of this task's scope to fix, worth a future task.
* Risk from last verification of 'pcc-pathD-006': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathD-006' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-006' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
