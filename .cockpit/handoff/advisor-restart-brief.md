# Advisor Restart Brief

Generated 2026-07-03T19:55:10-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-012
* Title: Add safe-stop clean-rollover command
* Status: complete
* Objective: Create a local deterministic safe-stop command that confirms the repo is in a resumable state before ending a session: check state consistency and restart safety using existing checks, confirm canonical next_action is present and current, and print a short human-readable summary of what to read first and what to do next. It must not advance task status, write a verification verdict, or gate anything - it is a convenience wrap-up step, not enforcement.

## Last Verified

* Verdict: PASS for task 'pcc-v1-012', verified at 2026-07-03T19:45:00-06:00
* Summary: Independently re-ran safe-stop.ps1 against the live repo and against a fresh scratch copy with a different field blanked than the worker tested (project-state.json's next_expected_action rather than task-state.json's next_action), confirming the same cascading ISSUE behavior and, critically, confirming via before/after checksums that the script wrote nothing to any of the four key files - the read-only guarantee holds. Found and fixed a garbled sentence in the worker's docs/HANDOFF_PACKET_SPEC.md addition before accepting the result. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-012-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-012': safe-stop.ps1 shells out to pwsh for its two composed checks, inheriting the same environment dependency already accepted for doctor.ps1 and the restart-safety scripts.
* Risk from last verification of 'pcc-v1-012': The 'resume by reading' list is a fixed, hand-authored path list rather than dynamically derived the same way generate-advisor-restart-brief.ps1 builds its Read First list; a future canonical read-first file would need a matching manual update here.
* Risk from last verification of 'pcc-v1-012': The ANSI-stripping helper is duplicated between doctor.ps1 and safe-stop.ps1 rather than shared, a minor maintenance duplication accepted to keep each script self-contained.
* Risk from last verification of 'pcc-v1-012': Self-verification note (DECISION-019): this verification, and the task drafting that preceded it, were both performed by the same session acting as advisor and worker. Mitigated by independently re-running the checks from a fresh scratch copy (a different field than the worker tested) rather than only reading the worker's narrative, and by finding and fixing a real doc wording defect the worker introduced before accepting the result.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: pcc-v1-012 close-out is fully complete (state advanced, doctor/health check clean, advisor brief refreshed, cycle archived, work committed locally as 414205b and pushed). Repo is paused at a natural break. Next action: owner selects which backlog idea to promote next, then draft that task into task-state.json.
* Project-level: pcc-v1-012 close-out is fully complete (state advanced, doctor/health check clean, advisor brief refreshed, cycle archived, work committed locally as 414205b and pushed). Repo is paused at a natural break. Next action: owner selects which backlog idea to promote next, then draft that task into task-state.json.
