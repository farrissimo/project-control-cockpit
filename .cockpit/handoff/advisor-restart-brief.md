# Advisor Restart Brief

Generated 2026-07-05T19:41:55-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-007
* Title: Request-File Inbox Contract + Schema (Phase D3 Foundation)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's first task, explicitly owner-authorized (DECISION-097): define the .cockpit/request/ inbox convention and its schema -- the one genuinely new bridge surface for Category D. This task defines the contract ONLY: a new schemas/request.schema.json, the .cockpit/request/ directory, and a short canonical documentation of the request lifecycle (who writes, who consumes, how a request moves from pending to processed/rejected). It does NOT build any dashboard UI control that writes a request file (that is pcc-pathD-008/009), and does NOT build any consumer/watcher script that reads and acts on request files (also later tasks). This keeps the contract-defining step cleanly separated from its first real producer and consumer.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-007)
* Justification (continuation, not a fork): Explicitly owner-authorized per DECISION-097 (direct yes/no confirmation obtained for Phase D3 specifically, not assumed from general continuation momentum). This is the first Phase D3 task, gated by its own owner decision as the plan itself requires; not an in-lane auto-promotion like the Phase D1/D2 tasks.
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

* Task-level: Task 'pcc-pathD-007' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-007' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
