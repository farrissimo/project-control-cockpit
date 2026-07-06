# Advisor Restart Brief

Generated 2026-07-05T18:40:05-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-002
* Title: Directive + Verification Panels (Read-Only)
* Status: returned_for_verification
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Extend scripts/generate-dashboard.ps1 (pcc-pathD-001, DECISION-089) per docs/PATH_A_PLAN.md section 6, Phase D1, with two more read-only panels: the Directive Panel (current directive, boundaries, required evidence, success criteria, handoff target, from .cockpit/handoff/worker-directive.md) and the Verification Panel (returned evidence, changed files, verdict, missing evidence, next action, from .cockpit/result/worker-result.md and .cockpit/result/verification-result.json). This remains a pure consumer of the .cockpit/ file bridge (DECISION-074/077/087) and the local-first execution discipline (DECISION-088): still plain PowerShell + static HTML, zero LLM dependency, zero external runtime, no new engine-script calls.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-002)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner explicitly said to keep going until told to stop, with verification paused before each cycle per the owner's chosen mode this session.
## Last Verified

* Verdict: INSUFFICIENT for task 'pcc-pathD-001', verified at 2026-07-05T19:20:00-06:00
* Summary: The delivered script (scripts/generate-dashboard.ps1) is genuinely read-only, self-contained, and satisfies the extractability contract; the reported null-cast bug and its fix both check out. However, this is not a clean accept cycle: the worker's own Process Disclosure confirms the mandatory pre-task handoff/backup gate was skipped, so no true pre-task restore point exists, only a retroactive one. That is a real missing safeguard, not merely a caveat, so the cycle is INSUFFICIENT rather than PASS. Separately, DECISION-089 should be corrected to name this gap plainly, since as written it does not disclose what worker-result.md already discloses.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-001': The delivered script is technically sound (read-only, self-contained, no engine-script calls, no .cockpit/ writes) and the reported null-cast bug fix is correct and complete for this script's rendering path.
* Risk from last verification of 'pcc-pathD-001': The deficiency is process-compliance, not artifact quality: the mandatory pre-task handoff/backup gate (scripts/enforce-handoff-restart-safety.ps1) was skipped this cycle, so no genuine pre-task restore point exists -- only a retroactive, post-hoc backup taken after the changes were already made.
* Risk from last verification of 'pcc-pathD-001': DECISION-089 as currently recorded does not mention the skipped gate / missing true pre-task backup that worker-result.md discloses; as written, repo truth (the decision log) reads cleaner than the actual cycle was. This should be corrected regardless of how the task itself is resolved.
* Risk from last verification of 'pcc-pathD-001': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only. It has no local execution and did not independently re-run scripts/verify-handback-guardrails.ps1 or other local guardrails; per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

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
* Project-level: Worker evidence for task 'pcc-pathD-002' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
