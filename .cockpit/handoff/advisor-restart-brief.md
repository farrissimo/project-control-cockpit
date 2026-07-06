# Advisor Restart Brief

Generated 2026-07-05T19:11:37-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-005
* Title: Session/Usage Panel, Honest-Only (No Duplication of Existing Panels)
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D2's Session/Usage panel: the honest home for original scope section 7.17 (Visible Usage / Session Pressure Awareness). Scoping note, checked against repo truth before drafting: section 7.17's honest remainder (per DECISION-075, which already determined real provider usage cannot be measured or estimated pre-checkpoint and that this is fundamentally a Category D/UI concern) is exactly 'current selected model/tool' and 'whether the system is estimating or reading actual usage' -- and 'current route' plus 'routing history' are already fully delivered as the Local Tools Panel and Routing History panel in pcc-pathD-003. Duplicating those tables under a new panel name would be exactly the bloat docs/PROJECT_CHARTER.md's three-filter test exists to catch. This task therefore adds a small, new, honest-only Session/Usage section to dashboard/index.html that (a) references/points to the existing Local Tools and Routing History panels rather than re-rendering their content, and (b) explicitly states, in plain language, that no real session/usage pressure number is tracked, computed, or estimated by PCC -- because PCC has no mechanism to measure real provider usage (DECISION-008: no fake intelligence / no fabricated numbers) -- rather than silently omitting any usage section at all, which is what original scope section 7.17 actually asks for ('must not pretend to know exact provider limits if it cannot measure them').

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-005)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle. Scope narrowed from the plan's literal wording to avoid duplicating pcc-pathD-003's already-delivered panels, per the three-filter test in docs/PROJECT_CHARTER.md -- a worker/verifier-discretion judgment call per DECISION-074's own framing, disclosed in this task's objective and to be recorded in the resulting decision.
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

* Task-level: Task 'pcc-pathD-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
