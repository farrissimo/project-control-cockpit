# Advisor Restart Brief

Generated 2026-07-04T13:18:10-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-5

## Active Task

* Task ID: pcc-brr5-004
* Title: Fresh Start: Codex Verification Watcher
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field DECISION-066's restored two-role split (Claude Code worker, Codex advisor/verifier) as a real, low-cost mechanism instead of a manually-run, manually-relayed Codex session. Add scripts/codex-verify-watcher.ps1, a plain (non-AI) polling script that watches task-state.json's task_status and invokes 'codex exec' exactly once per task needing verification -- never polling Codex itself, never invoking it just to check for work, so idle time costs zero session usage and real invocations happen at the same rate as today's manual process (once per cycle), not more.

## Last Verified

* Verdict: PASS for task 'pcc-brr5-004', verified at 2026-07-04T13:14:00-06:00
* Summary: Verified pcc-brr5-004 (Fresh Start: Codex Verification Watcher) at strict depth. I independently re-ran scripts/verify-handback-guardrails.ps1, read the new watcher script and the governing docs directly, confirmed the real Codex CLI flag shape, and reproduced the watcher's core behavior in a disposable scratch copy using a stub Codex command. The watcher performs only cheap local polling reads until genuine verification work appears, invokes Codex exactly once per task needing verification, holds a lock to prevent double-invocation while a verdict is pending, and clears that lock once verification-result.json matches again. DECISION-067 is recorded, no existing script behavior was modified, and this verification session itself is the required real Codex invocation for the task's own live verification.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr5-004': The watcher intentionally leaves the lock in place if 'codex exec' exits non-zero. That avoids double-invocation but means a failed or interrupted run may require manual lock cleanup before retrying; this is disclosed by the worker and present in the script.
* Risk from last verification of 'pcc-brr5-004': The loop mode itself was not exercised against a long-running real multi-cycle live scenario during verification; I independently verified the core once-per-task decision logic and lock behavior via -Once, which is the substantive risk area for this task.
* Risk from last verification of 'pcc-brr5-004': The prompt tells Codex not to advance state or run close-out scripts, but that remains an instruction-following boundary rather than an enforced sandbox rule inside the watcher.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr5-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr5-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
