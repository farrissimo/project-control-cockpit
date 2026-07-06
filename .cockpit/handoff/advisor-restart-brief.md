# Advisor Restart Brief

Generated 2026-07-05T19:51:20-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-008
* Title: Rollover/Handoff Controls (First Producer + Consumer, Command-to-Copy Design)
* Status: returned_for_verification
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's second task: the first real producer and consumer for the .cockpit/request/ inbox contract defined in pcc-pathD-007. DESIGN DECISION (owner-confirmed): the dashboard remains a static HTML file with no server; a rollover 'control' cannot be a live clickable button that writes a file from the browser. Instead, this delivers (a) scripts/request-rollover.ps1, a small producer script the owner runs from a terminal that writes a properly-shaped rollover request file into .cockpit/request/; (b) scripts/process-rollover-requests.ps1, a consumer that detects pending rollover requests and runs the existing scripts/safe-stop.ps1 (unmodified, already read-only and always-exit-0) as its response, capturing the report into the request and moving it to .cockpit/request/processed/ or .cockpit/request/rejected/; (c) a small addition to the dashboard's Handoff/Rollover panel showing the exact command to run to request a rollover, matching the existing Local Tools Panel's command-preview pattern from the original scope. This does NOT invent any new automated rollover/reset behavior -- the 'existing safe-stop/handoff path' is exactly scripts/safe-stop.ps1's existing advisory check, run in response to the request, not a new irreversible action.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-008)
* Justification (continuation, not a fork): Continuation of the owner-authorized Phase D3 (DECISION-097). Design fork (command-to-copy vs. local server) was explicitly re-confirmed with the owner before drafting; command-to-copy was chosen to preserve the existing static-file architecture, per the owner's own stated reasoning.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-007', verified at 2026-07-05T22:50:00-06:00
* Summary: The request-file inbox contract (schema, directory, lifecycle documentation) is sound enough for a foundation task, with only minor, disclosed, non-blocking looseness in field constraints and one lifecycle ambiguity worth revisiting later. Sequencing it ahead of any producer/consumer was independently judged the right call for the first authority-expanding phase. No blocker found.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-007-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-007': Disclosed, non-blocking: created_at/request_id/source are unconstrained strings and payload is an unconstrained object -- acceptable for a foundation contract per the worker's own stated deferral, revisit if/when a real producer/consumer surfaces a concrete need.
* Risk from last verification of 'pcc-pathD-007': Disclosed, non-blocking: the lifecycle text leaves slightly open whether a processed/rejected request is handled by file move, in-file status update, or both -- worth crisping in a later task, not now.
* Risk from last verification of 'pcc-pathD-007': Disclosed, non-blocking: doctor.ps1 now WARNs on the new .cockpit/request/ directory as unexpected, since that script was intentionally left untouched this cycle -- real but harmless cleanup debt.
* Risk from last verification of 'pcc-pathD-007': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

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
* Project-level: Worker evidence for task 'pcc-pathD-008' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
