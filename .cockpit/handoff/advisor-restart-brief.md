# Advisor Restart Brief

Generated 2026-07-05T20:35:18-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-009
* Title: Tone/Behavior Controls (communication_prefs, First Request-Driven State Mutation)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's final named task: update project-state.json's communication_prefs via a request-file -> existing state-update path, never a direct edit from the UI. This is the first task where a request-file consumer actually mutates canonical .cockpit/state/project-state.json (pcc-pathD-008's consumer only ran the existing read-only safe-stop.ps1 check and never touched canonical state). Deliver scripts/request-communication-prefs-update.ps1 (producer: a CLI script the owner runs, accepting one optional named parameter per communication_prefs field, writing a communication_prefs_update request containing only the fields to change) and scripts/process-communication-prefs-requests.ps1 (consumer: detects pending requests, builds the proposed merged communication_prefs object, validates the FULL proposed project-state.json against schemas/project-state.schema.json BEFORE writing anything -- rejecting, not writing, if invalid -- then writes it, re-runs scripts/validate-cockpit-state.ps1 as a post-write cross-check, and marks the request processed/rejected accordingly). No direct UI edit of communication_prefs exists or is created; the dashboard only displays the command to run.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-009)
* Justification (continuation, not a fork): Final task in the owner-authorized Phase D3 scope (DECISION-097). Last task named in the current plan for Category D; completes the plan's currently-specified Phase D3.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-009', verified at 2026-07-05T23:30:00-06:00
* Summary: Given this is the first request-driven canonical-state mutation in the project, the reviewer traced the consumer script's actual execution order line by line rather than trusting the worker's account. The critical safety claim -- full proposed-object schema validation strictly before any write to disk -- is genuinely true in the code, with no path found for invalid input to reach a partial or corrupted write. The field allowlist correctly confines all writes to communication_prefs and updated_at only. No blocker found.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-009-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-009': Disclosed, non-blocking: the consumer does not validate incoming request files against schemas/request.schema.json itself, relying on lightweight structural checks instead. Reviewer judged this acceptable because the real safety concern -- validating the full proposed project state before writing it -- is genuinely and correctly done.
* Risk from last verification of 'pcc-pathD-009': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathD-009' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Path A's currently-named Category D scope (pcc-pathD-001..009) is complete and verified, but the original project scope (archive/PCC Original Project Scope.md) is NOT fully built out (DECISION-101). The next task to draft is IDEA-015 (backlog/IDEAS.md): log routing decisions to routing-log.jsonl, closing the section 7.22 gap found in DECISION-101's audit. Owner has directed that PCC continue working rather than stop, since the original scope is not fully delivered.
