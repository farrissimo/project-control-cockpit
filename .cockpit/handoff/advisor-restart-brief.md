# Advisor Restart Brief

Generated 2026-07-05T14:59:37-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathC-002
* Title: Truth Surface: Repair Canonical State Drift For Checkpoint Prep
* Status: complete
* Safety Class: C (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Repair the owner-approved canonical-state drift before checkpoint work proceeds: update .cockpit/state/project-state.json so its DECISION-020 summary reflects DECISION-065's supersession of the old per-push approval clause, add the modularity/extractability rule to active_constraints in worker-facing canonical form, regenerate the live handoff artifacts from the updated state, and re-run scripts/validate-cockpit-state.ps1, scripts/check-schemas.ps1, and scripts/doctor.ps1 against the resulting repo state. This is pre-checkpoint Task 1 from the owner-approved sequence, and it is held for independent Codex verification rather than self-close.

## Last Verified

* Verdict: PASS for task 'pcc-pathC-002', verified at 2026-07-05T15:00:00-06:00
* Summary: Independent verification passes. The requested canonical-state repair is present in repo truth, the modularity/extractability rule is now carried in worker-facing state and rendered into the live directive, the mandatory Class C handoff gate was remediated before finalize and created restore point 20260705-145432, and verifier-side guardrails re-run cleanly against the returned-for-verification state with no ISSUE findings.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathC-002': This cycle proves the requested end-state, but not clean worker authorship of the two substantive project-state.json truth-surface edits; those edits were already present in the working tree at cycle start and were disclosed rather than re-created for appearance's sake.
* Risk from last verification of 'pcc-pathC-002': A real process gap remains: the mandatory Class C handoff gate and pre-task backup were skipped during task setup and only remediated mid-cycle before finalize. The remediation is complete and verified for this task, but the setup-time gap itself is not fixed by this task.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathC-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathC-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
