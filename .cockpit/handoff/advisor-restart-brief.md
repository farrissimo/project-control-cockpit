# Advisor Restart Brief

Generated 2026-07-04T11:49:15-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-4

## Active Task

* Task ID: pcc-brr4-004
* Title: BRR Policy: Semi-Autonomy Ceiling
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/BRR_PLAN.md Phase 4 item 4 ('Semi-Autonomy Ceiling'): record, in docs/BRR_POLICY.md, an explicit, plain statement of what PCC may do unattended in this phase, per Task Safety Class, consolidating what has already been established (Task Safety Classification, Acceptance Boundary Rules, Safe Next-Task Drafting Rules) into one place a reader can check without re-deriving it from four documents. Also close the one concrete gap DECISION-059 found during pilot run #2: nothing currently requires archiving a cycle's evidence before chaining into the next one. Add that as an explicit ceiling rule.

## Last Verified

* Verdict: PASS for task 'pcc-brr4-004', verified at 2026-07-04T11:49:00-06:00
* Summary: Verified pcc-brr4-004 (Semi-Autonomy Ceiling) at 'strict' depth. Read the full new section directly, cross-checked it against Task Safety Classification, Acceptance Boundary Rules, and the Safe Next-Task Drafting Rules (no contradiction found), and independently re-verified its two most load-bearing factual claims -- that Class A self-accept has never actually been exercised, and that exactly two cycles have been piloted -- against the actual decision history (DECISION-054 through 059) rather than accepting them as asserted. All nine completion criteria are met with direct evidence. Independent local guardrails clean. This delivers Phase 4 item 4 and is a stated precondition for Phase 5's own first deliverable.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr4-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr4-004': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT secondary review not yet performed on this specific cycle.
* Risk from last verification of 'pcc-brr4-004': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Applied via full re-read of the new section, cross-check against the three sections it consolidates, and re-verification of its factual claims (Class A untested, two cycles piloted) against actual decision history rather than accepted as asserted.
* Risk from last verification of 'pcc-brr4-004': The consolidation restates existing rules from three other sections; while cross-checked directly against all three during this review and no contradiction was found, a restatement always carries some residual risk of subtle drift that a second independent reviewer is better positioned to catch than the same party who wrote both the original and the restatement.
* Risk from last verification of 'pcc-brr4-004': The archive-before-chaining rule is policy-only, not enforced by any script; its practical effect depends entirely on being read and followed by whoever runs the next multi-cycle pilot.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr4-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr4-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
