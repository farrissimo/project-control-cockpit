# Advisor Restart Brief

Generated 2026-07-04T11:36:42-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-4

## Active Task

* Task ID: pcc-brr4-003
* Title: Honesty Checks: Metrics Summary
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: PILOT RUN #2, CYCLE 2 of 2 (docs/BRR_PLAN.md Phase 4 item 2; scope finalized in DECISION-056). Add a read-only script that summarizes .cockpit/logs/routing-log.jsonl into: a count of each existing event type, and the one ratio docs/BRR_PLAN.md Phase 4 item 2 names explicitly ('claimed-vs-verified completion rate' = verified_pass count divided by total verified_* event count). Explicitly report, rather than approximate, which of item 2's named metrics are not currently derivable from existing log data (owner interruptions per task, repeated instruction frequency, owner-review triggers by category). No new event types, no state mutation, no scoring, no invented categories -- strictly mechanical counting over already-structured, already-labeled data.

## Last Verified

* Verdict: PASS for task 'pcc-brr4-003', verified at 2026-07-04T10:56:00-06:00
* Summary: Verified pcc-brr4-003 (cycle 2, final cycle of pilot run #2) with an independent re-run of the script itself, not just a code read-through -- created my own fresh scratch copy and reproduced the worker's exact output against the real log, then spot-checked several counts by hand with grep. The script is genuinely read-only, strictly mechanical (raw counts plus one named ratio, explicit non-computation of three un-instrumented metrics), and the real legacy-format defect found during the worker's own testing was fixed honestly rather than papered over with an invented mapping. All ten completion criteria are met with direct, independently-reproduced evidence. This held PASS candidate, together with pcc-brr4-002's, is submitted for actual owner/GPT review -- pilot run #2 (both cycles) is complete and awaiting that review, not self-declared successful.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr4-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr4-003': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT review not yet performed on this specific cycle.
* Risk from last verification of 'pcc-brr4-003': PILOT DESIGN (DECISION-056): proposed Class A, but self-close not attempted this run regardless. This is a HELD candidate, alongside pcc-brr4-002 -- neither has been closed out.
* Risk from last verification of 'pcc-brr4-003': Verification Depth Policy: even though this task is Class A (which would normally warrant lighter 'light' or 'normal' depth per the Verification Depth Policy's own table), I applied a fuller check here anyway -- independently re-running the script myself rather than only reading the code -- because this is a held pilot cycle under active second-party review, not an ordinary Class A self-accept.
* Risk from last verification of 'pcc-brr4-003': The legacy-format handling (26 of 70 log lines) is a real, disclosed finding about the repo's own history, not a flaw introduced by this task -- but it does mean routing-log.jsonl itself is not a fully uniform data source, a fact this script surfaces honestly rather than papering over.
* Risk from last verification of 'pcc-brr4-003': This script's 'known event types' list is a hardcoded snapshot of log-event.ps1's current ValidateSet; if a future task adds another event type to log-event.ps1 without also updating this script, that new type would silently fall into the 'unrecognized' bucket rather than get its own line. Disclosed here, not fixed (fixing it would mean deriving the list from log-event.ps1's ValidateSet directly, a reasonable future improvement not required by this task's narrow scope).

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr4-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr4-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
