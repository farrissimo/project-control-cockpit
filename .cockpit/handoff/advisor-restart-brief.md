# Advisor Restart Brief

Generated 2026-07-05T20:12:34-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-009
* Title: Tone/Behavior Controls (communication_prefs, First Request-Driven State Mutation)
* Status: returned_for_verification
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's final named task: update project-state.json's communication_prefs via a request-file -> existing state-update path, never a direct edit from the UI. This is the first task where a request-file consumer actually mutates canonical .cockpit/state/project-state.json (pcc-pathD-008's consumer only ran the existing read-only safe-stop.ps1 check and never touched canonical state). Deliver scripts/request-communication-prefs-update.ps1 (producer: a CLI script the owner runs, accepting one optional named parameter per communication_prefs field, writing a communication_prefs_update request containing only the fields to change) and scripts/process-communication-prefs-requests.ps1 (consumer: detects pending requests, builds the proposed merged communication_prefs object, validates the FULL proposed project-state.json against schemas/project-state.schema.json BEFORE writing anything -- rejecting, not writing, if invalid -- then writes it, re-runs scripts/validate-cockpit-state.ps1 as a post-write cross-check, and marks the request processed/rejected accordingly). No direct UI edit of communication_prefs exists or is created; the dashboard only displays the command to run.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-009)
* Justification (continuation, not a fork): Final task in the owner-authorized Phase D3 scope (DECISION-097). Last task named in the current plan for Category D; completes the plan's currently-specified Phase D3.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-008', verified at 2026-07-05T23:05:00-06:00
* Summary: The rollover producer/consumer pair does exactly what it claims: no new rollover/reset logic was invented, only new request-file workflow behavior wrapped around the existing, confirmed-unmodified, confirmed-read-only scripts/safe-stop.ps1. All three claimed test scenarios are genuinely backed by the code. No blocker found; one minor, disclosed, non-blocking note about lightweight (not full-schema) request validation.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-008-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-008': Disclosed, non-blocking: the consumer performs lightweight structural validation (required fields present) rather than full JSON Schema validation against schemas/request.schema.json. Reviewer judged this consistent with the task's own completion criteria, though lighter than full schema validation -- worth tightening in a future task if request-file volume or diversity grows.
* Risk from last verification of 'pcc-pathD-008': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Worker evidence is in .cockpit/result/worker-result.md. Codex reviews evidence and issues a verification verdict per docs/VERIFICATION_RESULT_SPEC.md.
* Project-level: Worker evidence for task 'pcc-pathD-009' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
