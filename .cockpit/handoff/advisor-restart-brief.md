# Advisor Restart Brief

Generated 2026-07-03T21:53:54-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-1

## Active Task

* Task ID: pcc-brr1-002
* Title: BRR Policy: Task Safety Classification
* Status: ready_for_worker
* Objective: Define the BRR Phase 1 Task Safety Classification in canonical repo truth, building directly on the new Owner Review Matrix in docs/BRR_POLICY.md. Record the Class A / B / C / D model there in a practical, bounded way: what each class means, when each class applies, and how the classes relate to owner review and acceptance boundaries, without implementing Phase 2 runtime flow or automatic gating. Reuse and extend docs/BRR_POLICY.md rather than creating another broad planning document unless a narrower truth-surface need clearly requires otherwise.

## Last Verified

* Verdict: PASS for task 'pcc-brr1-001', verified at 2026-07-03T22:35:00-06:00
* Summary: Reviewed the new BRR policy doc and its propagated truth-surface updates against the task boundaries and completion criteria. The repo now has a concrete canonical Owner Review Matrix in docs/BRR_POLICY.md, all 11 required owner-review cases are covered, the owner_decisions ambiguity is resolved as a small STATE_MODEL clarification, and no runtime or out-of-scope changes were introduced. All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr1-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr1-001': Row 11 of the Owner Review Matrix intentionally depends on pcc-brr1-002 for full task-class operationalization, so that row is bounded correctly but not yet final in isolation.
* Risk from last verification of 'pcc-brr1-001': This is policy content, so correctness is judgment-based rather than deterministically testable; DECISION-022's recommendation for independent secondary review remains appropriate as a standing BRR Phase 1 practice.
* Risk from last verification of 'pcc-brr1-001': Rows 9 and 10 intentionally overlap with the upcoming Stop-Instead-of-Guess Policy; that later task must cross-reference this matrix rather than drift from it.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Claude Code executes task 'pcc-brr1-002' from the generated directive and returns evidence for Codex to verify.
* Project-level: Worker executes task 'pcc-brr1-002' using the generated directive and returns evidence for independent verification.
