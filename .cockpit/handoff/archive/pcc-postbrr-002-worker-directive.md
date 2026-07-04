# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-postbrr-002
* Task Title: Fuller BRR Metrics: Review-Trigger Categorization And Per-Task Breakdown
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: BRR_PLAN
* Priority / plan reference: DECISION-069 carried-forward backlog item 3 (fuller BRR Metrics)
* Justification (continuation, not a fork): Second of a two-task, owner-approved post-BRR bundle testing the independent-verification pipeline across consecutive cycles. Scoped after reading docs/BRR_PLAN.md's exact gap list and scripts/summarize-routing-log.ps1's existing coverage, and docs/BRR_POLICY.md's Stop-Instead-of-Guess trigger table, to avoid guessing at what is honestly measurable.
## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* State updates require verifier PASS or explicit owner override.
* Prefer local deterministic tools before model usage.
* Avoid fake intelligence scoring and fake truth detection.
* Worker claims are evidence, not truth.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.

## Exact Next Action

Extend scripts/summarize-routing-log.ps1 (read-only, no state mutation, unchanged principle from pcc-brr4-003) to close two of the three gaps docs/BRR_PLAN.md's Phase 4 item 2 and its own Phase 5 Readiness Review explicitly name as undelivered: 'owner-review triggers by category' and a per-task view enabling 'owner interruptions per task'. The third named gap, 'repeated instruction frequency', has no existing log signal at all (no event captures raw owner chat interjections) and inventing one would mean parsing conversational content into routing-log.jsonl -- a new, invasive instrumentation change far beyond read-only reporting on already-logged data, and exactly the kind of invented interpretation DECISION-008 forbids. This task explicitly declines to attempt it and documents why, rather than fabricating a proxy.

## Allowed Scope

The worker may:

* Edit scripts/summarize-routing-log.ps1 to add the category breakdown and per-task grouping described above.
* Edit docs/DECISIONS.md to record the new decision.
* Edit docs/BRR_PLAN.md to add the 'Later update' pointer described above.
* Edit backlog/IDEAS.md ONLY if a corresponding IDEA entry needs a delivered-status update for this exact change (check first; do not edit if none applies).

## Forbidden Scope

The worker must not:

* Do not modify any script other than scripts/summarize-routing-log.ps1 (and backlog/IDEAS.md/docs only as scoped above).
* Do not add any new log event type to scripts/log-event.ps1's ValidateSet.
* Do not modify any schema.
* Do not attempt to instrument or approximate 'repeated instruction frequency' by any means, including parsing chat content, conversation logs, or inventing a new signal -- explicitly decline it with documented reasoning instead.
* Do not change the meaning of any existing verdict, task status, or Task Safety Class.
* Do not manually invoke 'codex exec' for this task's own verification -- let the live scheduled watcher handle it.
* Do not touch the Acceptance Boundary Rules or the Owner Review Matrix.

## Completion Criteria

The task is complete only if:

* scripts/summarize-routing-log.ps1 gains a category breakdown of owner-review-triggering log events, using ONLY mappings that are mechanically exact (the event type or a fixed-format detail string this codebase itself writes, never free-text interpretation of arbitrary content): (a) 'repeated_failure_blocked' events map exactly to Stop-Instead-of-Guess trigger 4 / Owner Review Matrix row 9 (docs/BRR_POLICY.md) -- this event type is only ever logged by that exact branch; (b) 'verified_insufficient' events map exactly to trigger 3 (INSUFFICIENT is that trigger's unique verdict); (c) 'verified_out_of_scope' events map exactly to trigger 5 (OUT_OF_SCOPE is that trigger's unique verdict); (d) 'gate_blocked' events are reported as their own distinct category (BRR Phase 2 autonomous-gate mechanism, not itself one of the 7 numbered triggers); (e) 'stop_condition_fired' events are broken down further into the 4 known deterministic sub-reasons scripts/check-stop-conditions.ps1 itself writes as fixed-prefix sentences (owner decision pending / attention-needed status / repo health ISSUE / unrecognized self-promotion lane), matched by literal string prefix against that script's own known output format, not guessed from arbitrary text; (f) 'verified_blocked' and 'verified_fail' events are reported in their own honest category explicitly labeled as NOT uniquely attributable to one trigger from the event type alone (BLOCKED can result from triggers 1, 2, 6, or 7; a bare FAIL is not necessarily a REPEATED failure) -- disclosing this real limit rather than guessing further; (g) 'correction_applied' remains its own category, not force-mapped into the 7-trigger taxonomy since it is a distinct signal (a correction already applied, not itself a stop trigger).
* scripts/summarize-routing-log.ps1 gains a per-task_id breakdown (grouping the existing known event-type counts, plus the new category breakdown above, by task_id) so a per-task view of review-touchpoint density is possible -- this directly enables an honest, disclosed proxy for 'owner interruptions per task': the count of owner-review-triggering events (the union of stop_condition_fired, gate_blocked, verified_blocked, verified_out_of_scope, verified_insufficient, repeated_failure_blocked, correction_applied) per task_id. This MUST be labeled in the script's own output as a proxy for 'system-detected review/stop points', explicitly NOT a claim to measure actual owner chat interjections -- overclaiming this distinction would misrepresent what is actually measured.
* The script's output explicitly states that 'repeated instruction frequency' remains undelivered and names why (no log signal exists at the chat-instruction level; fabricating one would require capturing conversational content, which this task deliberately does not do), mirroring how pcc-brr4-003 already discloses its own gaps rather than silently dropping them.
* No new log event type is added. No existing script other than scripts/summarize-routing-log.ps1 is modified. This remains strictly read-only: no file is written, no state mutated, no other script called.
* Functionally tested (not read-through only) against the real .cockpit/logs/routing-log.jsonl (70+ real entries spanning legacy and current formats) to confirm the new category and per-task breakdowns produce sane, correct-looking output and do not crash on the known legacy pre-event_type format (pcc-brr4-003's existing handling for that format must remain intact and unchanged).
* A new decision is recorded in docs/DECISIONS.md.
* docs/BRR_PLAN.md's Phase 5 Readiness Review 'what remains unsafe or immature' bullet on the fuller BRR Metrics gap, and DECISION-069's carried-forward backlog note, are both updated with a 'Later update' pointer (per DECISION-051's Post-Close Canonical Amendment Rule) noting two of the three named items are now delivered and the third is explicitly and permanently declined with reasoning, not silently dropped.
* No existing verdict, task safety class, Acceptance Boundary Rule, or schema is changed. This task's own verification is performed by the live 'PCC-CodexVerifyWatcher' scheduled task (no manual codex exec by the worker).

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.

## Expected Return Format

Return your result in this structure:

### Summary

### Files Changed

### Commands / Tests Run

### Results

### Evidence

### Known Risks

### Unresolved Assumptions

### Out-of-Scope Confirmation

Confirm whether anything outside the allowed scope was touched.

## Blocked / Failure Instructions

If blocked, do not improvise broad changes. Return:

* blocker
* what you tried
* what evidence you have
* recommended next action
