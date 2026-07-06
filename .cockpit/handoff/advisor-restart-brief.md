# Advisor Restart Brief

Generated 2026-07-05T19:20:17-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-006
* Title: Handoff / Rollover Panel (Read-Only) — Phase D2 Complete
* Status: returned_for_verification
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D2's final task: a Handoff/Rollover panel in dashboard/index.html showing the latest clean/verified handoff (from project-state.json's already-loaded last_verified_handoff field) and current rollover-trigger warnings. CORRECTED MID-TASK: the original plan was to invoke scripts/check-stop-conditions.ps1 as a subprocess, mirroring the classify-routing.ps1 pattern. Testing during this task discovered that check-stop-conditions.ps1 is NOT side-effect-free: it writes a stop_condition_fired event to routing-log.jsonl whenever it detects a stop condition (BRR Phase 4/IDEA-008), which would break the dashboard's read-only contract and would be actively dangerous under scripts/watch-dashboard.ps1's polling loop (repeated writes every few seconds while a condition stays active). Testing this also surfaced a real, pre-existing, out-of-scope finding: check-stop-conditions.ps1's approved-lane-source list does not recognize docs/PATH_A_PLAN.md, so it mechanically false-flags every Path A task's promotion_basis -- not fixed here (would require modifying a different existing script, forbidden by this task's scope), disclosed for a future task instead. The corrected design reads the two most owner-relevant, side-effect-free signals (owner_decision_request pending; task_status in an attention-needed state) directly from task-state.json fields already loaded, with no subprocess call and no write risk. Completing this delivers all of Phase D2 (pcc-pathD-004 through pcc-pathD-006).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-006)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-005', verified at 2026-07-05T21:45:00-06:00
* Summary: The worker's scope-narrowing judgment on pcc-pathD-005 (referencing the existing Local Tools/Routing History panels rather than duplicating them, and adding only the honest non-fabrication disclosure) was independently verified rather than taken at face value: the reviewer confirmed the earlier panels genuinely already cover the plan's literal 'current route'/'routing history' ask, confirmed the judgment call is consistent with DECISION-075's own prior honesty determination, and confirmed the disclosure text is explicit and specific enough to satisfy the no-fabrication requirement. No blocker found; one minor, disclosed, non-blocking note about the section's lighter-weight presentation format.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-005-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-005': Minor, disclosed, non-blocking: the new Session/Usage section is two paragraphs (a pointer plus a disclosure), not a structured table like the other panels -- reviewer judged this acceptable since there is no genuinely new structured data to show, only worth noting for anyone expecting visual parallelism across panels.
* Risk from last verification of 'pcc-pathD-005': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

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
* Project-level: Worker evidence for task 'pcc-pathD-006' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
