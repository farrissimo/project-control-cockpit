# Advisor Restart Brief

Generated 2026-07-05T19:00:21-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-004
* Title: Auto-Refresh / Watch Mode (Phase D2, Read-Only)
* Status: returned_for_verification
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D2's first task: a new script scripts/watch-dashboard.ps1 that polls the .cockpit/ files scripts/generate-dashboard.ps1 already reads (project-state.json, task-state.json, verification-result.json, routing-log.jsonl) and re-invokes scripts/generate-dashboard.ps1 (as an explicit subprocess, the same composition pattern already used and verified for classify-routing.ps1 in pcc-pathD-003) whenever any of them changes, so the dashboard/index.html output stays current without the owner manually re-running the generator. Remains strictly read-only over the .cockpit/ bridge: watch-dashboard.ps1 itself never writes any file except by delegating the actual write to generate-dashboard.ps1's own existing, already-read-only render step. As minor housekeeping folded in per the pcc-pathD-003 verification's own next_action, also correct scripts/generate-dashboard.ps1's header comment block, which currently still states the older blanket 'calls no other script' claim alongside the newer, narrower pcc-pathD-003 exception language -- update it to state the current, accurate contract only (reads the four .cockpit/ inputs, invokes exactly one subprocess, classify-routing.ps1, writes only -OutputPath).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-004)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle. Folds in the minor header-comment correction disclosed in pcc-pathD-003's verification (DECISION-093 / verification-result.json's next_action).
## Last Verified

* Verdict: PASS for task 'pcc-pathD-003', verified at 2026-07-05T20:55:00-06:00
* Summary: The new Local Tools and Routing History panels are correctly scoped: exactly one other script (classify-routing.ps1) is invoked, as an explicit, failure-tolerant subprocess call, and the doctor.ps1 composition-pattern comparison used to justify this exception holds up as a legitimate (if imperfect) precedent. All claimed graceful-degradation behavior is genuinely implemented in code and confirmed by the reviewer, and the malformed-core-state failure path is unchanged. The reviewer independently judged the subprocess design reasonable for this phase, preferring it to duplicating classification logic, while noting a shared structured data file could be a cleaner long-term evolution. Two minor, disclosed, non-blocking notes (a stale header comment; intentionally opaque stdout coupling) do not affect the verdict.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-003': Minor, disclosed, non-blocking: scripts/generate-dashboard.ps1's header comment block still contains the older blanket 'calls no other script' statement alongside the newer pcc-pathD-003 exception language -- not functionally harmful, but internally inconsistent and worth a cleanup pass in a future task.
* Risk from last verification of 'pcc-pathD-003': Minor, disclosed, non-blocking: capturing classify-routing.ps1's full stdout as opaque display text is intentionally loose coupling -- correct for a read-only advisory panel, but means the dashboard has no structured understanding of what it displays.
* Risk from last verification of 'pcc-pathD-003': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

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
* Project-level: Worker evidence for task 'pcc-pathD-004' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
