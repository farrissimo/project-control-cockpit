# Advisor Restart Brief

Generated 2026-07-04T15:05:25-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-postbrr-002
* Title: Fuller BRR Metrics: Review-Trigger Categorization And Per-Task Breakdown
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Extend scripts/summarize-routing-log.ps1 (read-only, no state mutation, unchanged principle from pcc-brr4-003) to close two of the three gaps docs/BRR_PLAN.md's Phase 4 item 2 and its own Phase 5 Readiness Review explicitly name as undelivered: 'owner-review triggers by category' and a per-task view enabling 'owner interruptions per task'. The third named gap, 'repeated instruction frequency', has no existing log signal at all (no event captures raw owner chat interjections) and inventing one would mean parsing conversational content into routing-log.jsonl -- a new, invasive instrumentation change far beyond read-only reporting on already-logged data, and exactly the kind of invented interpretation DECISION-008 forbids. This task explicitly declines to attempt it and documents why, rather than fabricating a proxy.

## Auto-Promotion Basis

* Approved lane: BRR_PLAN
* Priority / plan reference: DECISION-069 carried-forward backlog item 3 (fuller BRR Metrics)
* Justification (continuation, not a fork): Second of a two-task, owner-approved post-BRR bundle testing the independent-verification pipeline across consecutive cycles. Scoped after reading docs/BRR_PLAN.md's exact gap list and scripts/summarize-routing-log.ps1's existing coverage, and docs/BRR_POLICY.md's Stop-Instead-of-Guess trigger table, to avoid guessing at what is honestly measurable.
## Last Verified

* Verdict: PASS for task 'pcc-postbrr-002', verified at 2026-07-04T15:03:49-06:00
* Summary: Independent verification found the task complete within its bounded scope. The reporting script now delivers the required review-trigger categorization and per-task breakdown, explicitly labels the owner-interruption metric as a proxy, preserves the deliberate non-delivery of repeated instruction frequency, and runs cleanly against the real routing log while keeping legacy-format handling intact. The required decision and BRR plan amendments are present, and the verifier's independent guardrail pass completed cleanly.
* Last verified handoff: .cockpit/handoff/archive/pcc-postbrr-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-postbrr-002': Several newly added categories have no real historical examples yet in the current routing log, so those branches were verified by direct code review plus clean functional execution rather than by observed live examples for every category.
* Risk from last verification of 'pcc-postbrr-002': The stop_condition_fired sub-reason categorization is intentionally coupled to fixed wording emitted by scripts/check-stop-conditions.ps1; if that script's message text changes later, these counts may under-report until the reporting script is updated.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-postbrr-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-postbrr-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
