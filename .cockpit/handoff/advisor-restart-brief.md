# Advisor Restart Brief

Generated 2026-07-03T22:22:26-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-1

## Active Task

* Task ID: pcc-brr1-004
* Title: BRR Policy: Operating Definitions
* Status: complete
* Objective: Define the BRR Phase 1 Operating Definitions in canonical repo truth, extending docs/BRR_POLICY.md so the key terms already used across the prior three BRR policy tasks are explicit, stable, and non-contradictory. At minimum define safe unattended, safe with review, owner decision, blocked, insufficient evidence, and escalation, reconciling them with the Owner Review Matrix, Task Safety Classification, and Stop-Instead-of-Guess Policy already recorded, without introducing runtime enforcement, new statuses, or Phase 2 fielding mechanics.

## Last Verified

* Verdict: PASS for task 'pcc-brr1-004', verified at 2026-07-04T00:20:00-06:00
* Summary: Reviewed the new Operating Definitions against the task criteria and the three prior BRR policy sections. The six required terms are now explicit, cross-reconciled, and consistent with the existing matrix, classification, and stop-policy language. The worker was also right not to declare the phase transition unilaterally: BRR Phase 1 policy scope is now complete, but deciding whether to continue hardening Phase 1, move to Phase 2, or choose another lane is a separate boundary decision. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr1-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr1-004': All four BRR Phase 1 policy deliverables now exist, but whether to declare Phase 1 complete and move into Phase 2 remains an explicit owner/advisor decision rather than an automatic transition.
* Risk from last verification of 'pcc-brr1-004': This remains judgment-heavy policy content rather than deterministically testable behavior; independent secondary review remains the right standing BRR Phase 1 practice.
* Risk from last verification of 'pcc-brr1-004': The new glossary defines escalation as current reporting behavior rather than a hardened mechanism; building that mechanism remains future Phase 2 work.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr1-004' is complete and verified PASS. BRR Phase 1 policy scope is complete; owner/advisor explicitly decides whether to declare the phase complete and continue hardening, transition to Phase 2, or choose another next lane.
* Project-level: Task 'pcc-brr1-004' is complete and verified PASS. BRR Phase 1 policy scope is complete; owner/advisor explicitly decides whether to declare the phase complete and continue hardening, transition to Phase 2, or choose another next lane.
