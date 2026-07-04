# Advisor Restart Brief

Generated 2026-07-03T20:12:38-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-013
* Title: Honesty Checks: Activity Log
* Status: complete
* Objective: Add a local deterministic activity-log helper that appends factual, structured events to .cockpit/logs/routing-log.jsonl, so meaningful cycle events (task drafted, verified PASS/FAIL/etc., corrections applied) are recorded consistently instead of hand-typed free-form JSON prone to drift or omission (as happened this session, when several real entries were missed and had to be backfilled by hand). The helper must be strictly append-only, must validate event/result types against a small explicit set rather than accepting arbitrary free text there, and must be able to derive an entry directly from the current .cockpit/result/verification-result.json so the verifier does not have to hand-type JSON for the common case.

## Last Verified

* Verdict: PASS for task 'pcc-v1-013', verified at 2026-07-03T20:20:00-06:00
* Summary: Independently re-ran log-event.ps1's key claims from a fresh scratch copy: confirmed only Add-Content is used to write (structural append-only guarantee), re-tested the invalid-EventType guard with a correctly-checked exit code (the worker's own first test attempt had a shell-pipe masking issue, which they caught themselves), tested derived mode against a different archived verification result than the worker used and confirmed correct task_id/event_type/detail derivation, and independently confirmed via diff that prior log lines were untouched. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-013-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-013': This tool only fixes hand-typing drift; it does not fix the deeper 'someone has to remember to run it' problem, which is explicitly out of scope here (that's IDEA-001, currently deferred).
* Risk from last verification of 'pcc-v1-013': routing-log.jsonl now permanently contains two structurally different line shapes (old route/reason/result vs new event_type/detail); any future reader of this file needs to handle both.
* Risk from last verification of 'pcc-v1-013': -FromVerificationResult has no built-in staleness check; running it against an already-superseded verification-result.json would log a correct-but-late entry with nothing flagging the delay.
* Risk from last verification of 'pcc-v1-013': Self-verification note (DECISION-019): this verification was performed by the same session that acted as worker. Mitigated by independently re-running the guard-condition and derived-mode tests from a fresh scratch copy using different source data (a different archived verification result) than the worker used, and by independently confirming the append-only guarantee via a fresh diff rather than trusting the worker's reported result.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: pcc-v1-013 close-out is fully complete (state advanced, doctor/health check clean, advisor brief refreshed, verification logged via log-event.ps1, cycle archived, work to be committed). Repo is paused at a natural break. Next action: owner selects which backlog idea to promote next, then draft that task into task-state.json.
* Project-level: pcc-v1-013 close-out is fully complete (state advanced, doctor/health check clean, advisor brief refreshed, verification logged via log-event.ps1, cycle archived, work to be committed). Repo is paused at a natural break. Next action: owner selects which backlog idea to promote next, then draft that task into task-state.json.
