# Advisor Restart Brief

Generated 2026-07-05T20:04:48-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-008
* Title: Rollover/Handoff Controls (First Producer + Consumer, Command-to-Copy Design)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's second task: the first real producer and consumer for the .cockpit/request/ inbox contract defined in pcc-pathD-007. DESIGN DECISION (owner-confirmed): the dashboard remains a static HTML file with no server; a rollover 'control' cannot be a live clickable button that writes a file from the browser. Instead, this delivers (a) scripts/request-rollover.ps1, a small producer script the owner runs from a terminal that writes a properly-shaped rollover request file into .cockpit/request/; (b) scripts/process-rollover-requests.ps1, a consumer that detects pending rollover requests and runs the existing scripts/safe-stop.ps1 (unmodified, already read-only and always-exit-0) as its response, capturing the report into the request and moving it to .cockpit/request/processed/ or .cockpit/request/rejected/; (c) a small addition to the dashboard's Handoff/Rollover panel showing the exact command to run to request a rollover, matching the existing Local Tools Panel's command-preview pattern from the original scope. This does NOT invent any new automated rollover/reset behavior -- the 'existing safe-stop/handoff path' is exactly scripts/safe-stop.ps1's existing advisory check, run in response to the request, not a new irreversible action.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-008)
* Justification (continuation, not a fork): Continuation of the owner-authorized Phase D3 (DECISION-097). Design fork (command-to-copy vs. local server) was explicitly re-confirmed with the owner before drafting; command-to-copy was chosen to preserve the existing static-file architecture, per the owner's own stated reasoning.
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

* Task-level: Task 'pcc-pathD-008' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-008' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
