# Advisor Restart Brief

Generated 2026-07-05T19:37:32-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-007
* Title: Request-File Inbox Contract + Schema (Phase D3 Foundation)
* Status: returned_for_verification
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D3's first task, explicitly owner-authorized (DECISION-097): define the .cockpit/request/ inbox convention and its schema -- the one genuinely new bridge surface for Category D. This task defines the contract ONLY: a new schemas/request.schema.json, the .cockpit/request/ directory, and a short canonical documentation of the request lifecycle (who writes, who consumes, how a request moves from pending to processed/rejected). It does NOT build any dashboard UI control that writes a request file (that is pcc-pathD-008/009), and does NOT build any consumer/watcher script that reads and acts on request files (also later tasks). This keeps the contract-defining step cleanly separated from its first real producer and consumer.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D3
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-007)
* Justification (continuation, not a fork): Explicitly owner-authorized per DECISION-097 (direct yes/no confirmation obtained for Phase D3 specifically, not assumed from general continuation momentum). This is the first Phase D3 task, gated by its own owner decision as the plan itself requires; not an in-lane auto-promotion like the Phase D1/D2 tasks.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-006', verified at 2026-07-05T22:00:00-06:00
* Summary: Both of the worker's mid-task findings (check-stop-conditions.ps1's log-write side effect; its stale approved-lane-source list not recognizing docs/PATH_A_PLAN.md) were independently confirmed by reading that script's source directly, not taken on trust. The correction to a no-subprocess design was independently judged the right call given the real constraints (no safer alternative exists in repo truth, and building one was out of scope). The delivered Handoff/Rollover panel was independently confirmed to match its claims: no new subprocess call, no .cockpit/ mutation, correct use of already-loaded state. No blocker found.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-006-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-006': Disclosed, non-blocking, and endorsed by the reviewer: the Handoff/Rollover panel intentionally mirrors only two of check-stop-conditions.ps1's four conditions (owner decision pending; attention-needed status), not doctor.ps1-issue surfacing or lane-recognition. Reviewer agrees this narrowing is correct given the full script could not be invoked safely and duplicating all its logic would have been the worse design.
* Risk from last verification of 'pcc-pathD-006': The stale approved-lane-source list in scripts/check-stop-conditions.ps1 (not recognizing docs/PATH_A_PLAN.md) remains unaddressed, as disclosed -- a real gap in a different script, out of this task's scope to fix, worth a future task.
* Risk from last verification of 'pcc-pathD-006': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

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
* Project-level: Worker evidence for task 'pcc-pathD-007' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
