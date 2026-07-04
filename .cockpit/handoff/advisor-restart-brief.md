# Advisor Restart Brief

Generated 2026-07-04T00:16:59-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-005
* Title: BRR Execution: Status-Change Refresh Invariant
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Operationalize the generic invariant that any repo-native path which changes live task status must leave both live handoff artifacts regenerated from the post-write state, not just one of them. Build the lightest viable repo-native mechanism, guardrail, or shared helper that makes this two-artifact refresh rule explicit across the existing status-mutating workflow paths so the recurring stale-artifact defect becomes structurally harder to reintroduce.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-005', verified at 2026-07-04T00:18:00-06:00
* Summary: pcc-brr2-005 satisfies its scope and fixes the recurring stale-artifact pattern at the real root. The repo now has one shared refresh helper, advance-cockpit-state.ps1 refreshes both live handoff artifacts internally after state writes, finalize-worker-handback.ps1 uses the same helper for the returned-for-verification path, and the live returned state verifies clean under the independent guardrails.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-005-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-005': A future brand-new status-mutating script could still bypass the shared helper if it is introduced outside the existing paths; this task narrows the memory surface sharply but does not make bypass structurally impossible.
* Risk from last verification of 'pcc-brr2-005': The shared helper still depends on the existing generator scripts remaining the canonical way to rebuild the live handoff artifacts.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
