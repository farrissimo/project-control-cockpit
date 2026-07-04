# Advisor Restart Brief

Generated 2026-07-03T19:25:34-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-011
* Title: Add advisory doctor health-check command
* Status: complete
* Objective: Create a local deterministic doctor command that composes the existing PCC checks and answers whether the repo is safe to trust and hand off right now. Keep it read-only, advisory, and non-gating. It may surface schema/state warnings, restart-safety status, handoff freshness, and similar structural signals, but it must not block or replace the separate enforce-handoff gate.

## Last Verified

* Verdict: PASS for task 'pcc-v1-011', verified at 2026-07-03T19:25:00-06:00
* Summary: Independently re-ran the worker's claimed tests (live doctor.ps1 report, live validate-cockpit-state.ps1, and a fresh scratch-copy reproduction of the drifted-state ISSUE scenario under the same PowerShell 5.1 runtime) and confirmed all completion criteria are met: doctor.ps1 composes existing checks, reports OK/WARN/ISSUE clearly, always exits 0, and is not wired as a precondition anywhere in the repo. Confirmed via git diff that only docs/HANDOFF_PACKET_SPEC.md was touched by this task among canonical docs, with a clean 4-line addition. No out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-011': doctor.ps1 shells out to pwsh for two of its four checks; if pwsh is not installed on a given machine, those checks degrade to a generic ISSUE rather than their real status (inherited dependency from the scripts it composes, not new).
* Risk from last verification of 'pcc-v1-011': The ANSI-stripping regex targets the current Write-Error SGR color-code shape; a future PowerShell rendering change could cause raw codes to reappear (a readability regression, not a correctness one).
* Risk from last verification of 'pcc-v1-011': The 'last known handoff gate' check is purely informational and does not indicate how stale a PASS/FAIL verdict actually is, only whether it matches the current task_id.
* Risk from last verification of 'pcc-v1-011': Self-verification note: this verification was performed by the same model/session that acted as worker for this task, per the owner's explicit 2026-07-03 decision to operate in a dual worker/advisor role going forward. Independence that would normally catch self-serving evidence review is reduced; mitigated here by independently re-running the worker's claimed commands from scratch (not just reading the narrative) and reproducing the two bug fixes in a fresh scratch copy before accepting them.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Advance task-state.json to complete via scripts/advance-cockpit-state.ps1, archive this cycle's directive/result/verification artifacts, then draft the next bounded task.
* Project-level: Advance task-state.json to complete via scripts/advance-cockpit-state.ps1, archive this cycle's directive/result/verification artifacts, then draft the next bounded task.
