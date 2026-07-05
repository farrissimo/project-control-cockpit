# Advisor Restart Brief

Generated 2026-07-05T15:29:27-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathC-003
* Title: Checkpoint Truth: Record Category C Accounting Decision
* Status: complete
* Safety Class: C (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Record an explicit pre-checkpoint Category C accounting decision in canonical repo truth. Working only from the repo's own evidence, state whether Category C (Metrics & Evidence Depth) is now substantially complete for checkpoint purposes, and explain why IDEA-013 remains deferred absent a concrete evidence-review failure, OR conclude that Category C is not yet substantially complete and identify the one concrete additional Category C task that is still required before the checkpoint. This is the owner-approved pre-checkpoint Task 2, after the state-drift repair and before the final extractability audit gate.

## Last Verified

* Verdict: PASS for task 'pcc-pathC-003', verified at 2026-07-05T15:16:00-06:00
* Summary: Independent verification passes. DECISION-081 records the required Category C checkpoint-accounting call in bounds, chooses one allowed outcome clearly, grounds that judgment in existing repo truth about IDEA-012, IDEA-013, and DECISION-074, and leaves the final bounded extractability audit as the only remaining pre-checkpoint gate.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathC-003': This is a judgment-record task rather than a purely mechanical one. The PASS verdict rests on the repo's own stated checkpoint bar and the cited backlog and decision records, not on a script-checkable proof.
* Risk from last verification of 'pcc-pathC-003': DECISION-081 keeps IDEA-013 deferred based on its current incident-gated rationale. If a concrete evidence-review failure appears later, that idea should still be promoted then.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Maturity Checkpoint reached. No further pre-checkpoint task is required; owner may freeze and back up the kernel, then choose post-checkpoint direction.
* Project-level: Maturity Checkpoint reached. Owner may freeze and back up this kernel, then decide post-checkpoint direction from evidence rather than guesswork.
