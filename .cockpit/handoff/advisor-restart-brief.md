# Advisor Restart Brief

Generated 2026-07-04T13:38:28-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-5

## Active Task

* Task ID: pcc-brr5-005
* Title: Record Scheduled Watcher Deployment
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Document that scripts/codex-verify-watcher.ps1 (pcc-brr5-004) is now deployed as a native Windows Scheduled Task ('PCC-CodexVerifyWatcher', 3-minute interval, running the script with -Once) rather than left as code the owner must run manually or in an open loop. This is a docs-only record of an operational deployment step, not a code change: no script's behavior changes as part of this task. This task is also the first real end-to-end test of the deployed watcher itself -- it is deliberately left in 'returned_for_verification' for the running scheduled task to pick up and invoke real Codex verification on its own, with no manual 'codex exec' invocation by the worker.

## Last Verified

* Verdict: PASS for task 'pcc-brr5-005', verified at 2026-07-04T13:35:47-06:00
* Summary: Verified pcc-brr5-005 at strict evidence depth. I independently re-ran scripts/verify-handback-guardrails.ps1, reviewed the live task state, worker evidence, DECISION-068, and the REPO_GOVERNANCE watcher paragraph directly, and confirmed the live diff stays within the allowed docs-only scope. The repo-side evidence also shows this verification was picked up through the watcher path for task pcc-brr5-005: the current codex-watcher lock names this task, and the watcher script contains the exact brief-based verifier prompt used for this run. No script or schema change was introduced by this task.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-005-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr5-005': Direct Scheduled Task API inspection (Get-ScheduledTask / Get-ScheduledTaskInfo) was permission-blocked with Access denied in this verifier session, so OS-level task metadata was not independently re-queried here; the PASS verdict relies on the recorded docs changes, worker evidence, the live watcher lock for pcc-brr5-005, and the clean independent guardrail pass.
* Risk from last verification of 'pcc-brr5-005': The worker's claimed three idle-state manual trigger results were not replayed by the verifier because this task is explicitly docs-only and this verification run must not advance state or perform its own operational close-out.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr5-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr5-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
