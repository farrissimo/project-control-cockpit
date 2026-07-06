# Advisor Restart Brief

Generated 2026-07-05T18:55:36-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-003
* Title: Routing / Local Tools Read-Only Panel
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Extend scripts/generate-dashboard.ps1 (pcc-pathD-001/002) per docs/PATH_A_PLAN.md section 6, Phase D1, with the Local Tools Panel and a routing-history summary: the Local Tools Panel shows classify-routing.ps1's advisory output as display-only text (the panel never executes anything); the routing-history summary is a read-only tail of .cockpit/logs/routing-log.jsonl. This is a deliberate, disclosed, narrow exception to pcc-pathD-001/002's stricter 'calls no other script' rule: scripts/classify-routing.ps1 is invoked as an explicit subprocess and its stdout captured as display text, mirroring scripts/doctor.ps1's already-audited composition pattern (explicit subprocess + stdout consumption, no hidden shared state) rather than introducing a new hidden coupling. Still zero LLM dependency, zero external runtime (DECISION-088); still writes only the dashboard output file and mutates no .cockpit/ file itself.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-003)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle.
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

* Task-level: Task 'pcc-pathD-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
