# Advisor Restart Brief

Generated 2026-07-04T00:31:02-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-006
* Title: BRR Governance: Secondary Workflow Canon
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Formalize the degraded secondary-workflow model in repo truth so work can continue cleanly when Codex is unavailable: define exactly when Claude Code may perform both worker and verifier roles, how GPT repo-access review fits as a secondary review input, what that does and does not count as for independence/disclosure purposes, and what artifact wording the repo requires in that mode. Keep it bounded to workflow truth and verification-language clarity rather than broad automation changes.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-006', verified at 2026-07-04T00:31:00-06:00
* Summary: Independently re-ran scripts/verify-handback-guardrails.ps1 against the actual returned-for-verification state (clean, all applicable checks OK). Independently re-read all four touched truth surfaces (docs/DECISIONS.md's DECISION-036, docs/VERIFICATION_RESULT_SPEC.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md) side by side and confirmed the GPT-role characterization (secondary review input, not independent verification, remote-only, additive not substitutive) and the push-authorization scope (time-boxed, does not permanently amend DECISION-020) are stated consistently across all four with no contradiction. Confirmed via git diff/status that only the four intended docs and the expected state/handoff files changed - no scripts, schemas, verdicts, task safety classes, or BRR Phase 1 policy content were touched, matching the out-of-scope confirmation. All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-006-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-006': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed this cycle (this is the first cycle under the new arrangement, prior to any push GPT could review against).
* Risk from last verification of 'pcc-brr2-006': The commit-and-push pre-authorization DECISION-036 records is explicitly time-boxed to 'the remainder of this BRR phase' rather than a fixed count or date; future cycles must actively judge whether that window is still open rather than assuming it indefinitely, since nothing enforces the boundary automatically.
* Risk from last verification of 'pcc-brr2-006': This task's own standard disclosure wording is being exercised for the first time in this very verification result; any awkwardness in it is now visible in practice rather than only in the abstract.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-006' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-006' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
