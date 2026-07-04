# Advisor Restart Brief

Generated 2026-07-03T22:56:12-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-001
* Title: BRR Execution: Task Classification Fielding
* Status: ready_for_worker
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field the BRR task safety class into PCC's live task flow in the lightest viable way. Add one explicit Class A/B/C/D field to canonical task state, validate it in schema, and surface it in the worker/advisor handoff artifacts so every active task can carry a visible safety classification. Keep this bounded to lightweight fielding only: make the class visible and durable in state plus handoff surfaces, but do not yet implement automatic stop triggers, owner-decision capture flow, acceptance-boundary enforcement, or autonomous next-task drafting. For this retry specifically, make sure the final health evidence reflects the repo's actual returned-for-verification state: after any state or status change that affects the live handoff summaries, regenerate the handoff artifacts again before the final doctor and validation pass you report as evidence.

## Last Verified

* Verdict: FAIL for task 'pcc-brr2-001', verified at 2026-07-04T00:50:00-06:00
* Summary: The core fielding work is sound: task_safety_class is added to schema and live state, surfaced in both generated handoff artifacts, and the task's own Class B classification is justified correctly. However, the task does not satisfy its completion contract as returned because after task-state/project-state were moved to returned_for_verification, the live advisor restart brief was left stale. Re-running doctor.ps1 against the repo as handed back reports a real restart-safety issue on the advisor side, so the 'local validation remains healthy' criterion is not met in the actual returned state.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr1-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-001': The Class B classification for pcc-brr2-001 is the right call and should be preserved on retry: this task is safe to execute, but correctness is judgment-heavy and touches truth surfaces.
* Risk from last verification of 'pcc-brr2-001': The new task_safety_class field is now part of live task state and generated handoff surfaces, but advance-cockpit-state.ps1 has still only been compatibility-checked structurally rather than exercised through a PASS close-out for this field.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Retry pcc-brr2-001 as a Class B task. Keep the existing fielding changes, but make the final reported health evidence come from the actual returned-for-verification repo state after regenerating the live handoff artifacts one last time.
* Project-level: Run Claude Code against .cockpit/handoff/worker-directive.md for the pcc-brr2-001 retry. Preserve Class B, keep the existing fielding changes, and make the final reported health evidence reflect the actual returned-for-verification repo state.
