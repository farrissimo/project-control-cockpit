# Advisor Restart Brief

Generated 2026-07-03T23:06:46-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-002
* Title: BRR Execution: Deterministic Worker Handback
* Status: ready_for_worker
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Reduce the sequencing gap surfaced during pcc-brr2-001 by giving the worker one deterministic local path for final handback ordering. Build the lightest viable worker-side helper or equivalent repo-native mechanism that performs the final returned-for-verification state update, regenerates the live handoff artifacts afterward, and runs the required local health checks last against that actual final state, so the worker is following a concrete repo workflow rather than relying on memory about what order to do those steps in.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-001', verified at 2026-07-03T23:06:00-06:00
* Summary: The original fielding work is complete, in scope, and now handed back cleanly. task_safety_class is added to schema and live state, surfaced in both generated handoff artifacts, the task's own Class B classification is justified correctly, and the final returned-for-verification repo state now passes check-schemas.ps1, validate-cockpit-state.ps1, and doctor.ps1 with no issues. The earlier failure was real, but it was a handback-ordering defect rather than a defect in the task's substantive output; that ordering defect is now corrected in the actual evidence being verified here.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-001': The underlying sequencing gap is still structural: the worker can satisfy this task by discipline, but the repo does not yet force the correct final handback order automatically.
* Risk from last verification of 'pcc-brr2-001': That sequencing gap should be treated as the next bounded hardening task rather than silently assumed solved just because this cycle now passes.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Read .cockpit/handoff/worker-directive.md, implement pcc-brr2-002 within scope, and return evidence to .cockpit/result/worker-result.md.
* Project-level: Run Claude Code against .cockpit/handoff/worker-directive.md for task 'pcc-brr2-002', focused on making final worker handback ordering deterministic so the last health pass always describes the actual returned state.
