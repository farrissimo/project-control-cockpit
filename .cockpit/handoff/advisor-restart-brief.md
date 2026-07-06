# Advisor Restart Brief

Generated 2026-07-05T18:32:08-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-001
* Title: Dashboard Skeleton + Owner Control Board Panel (Read-Only)
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver the first Category D (Product Surface) task per docs/PATH_A_PLAN.md section 6, Phase D1: a new, self-contained, read-only script scripts/generate-dashboard.ps1 that reads .cockpit/state/project-state.json and .cockpit/state/task-state.json (paths overridable by parameter) and renders a local static HTML file at dashboard/index.html showing the Owner Control Board panel (original scope section 11): current project, current task, current state, next expected action, current role, current worker, current verdict, and current blocker. This proves the UI's pure-consumer-of-the-file-bridge pattern (DECISION-074/077 extractability rule; DECISION-087 UI form decision) before any other panel is added. The script is read-only over the .cockpit/ bridge: it writes only the new top-level dashboard/ directory, never mutates any .cockpit/ file, and calls no other script (DECISION-088 local-first execution discipline: plain PowerShell + HTML, zero LLM dependency, zero external runtime).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-001)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); this is continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner separately confirmed readiness to start Path A actual work in this session.
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

* Task-level: Task 'pcc-pathD-001' is complete via explicit owner override (DECISION-091), despite an INSUFFICIENT verifier verdict on process compliance (DECISION-090). The delivered artifact itself was independently confirmed sound; the override is a narrow, disclosed exception justified by an exact pre-task git commit already preserving the true restore point, and is not a precedent for future tasks. Next: pcc-pathD-002 (Directive + Verification panels) per docs/PATH_A_PLAN.md section 6.
* Project-level: Task 'pcc-pathD-001' is complete via explicit owner override (DECISION-091), despite an INSUFFICIENT verifier verdict on process compliance (DECISION-090). The delivered artifact itself was independently confirmed sound; the override is a narrow, disclosed exception justified by an exact pre-task git commit already preserving the true restore point, and is not a precedent for future tasks. Next: pcc-pathD-002 (Directive + Verification panels) per docs/PATH_A_PLAN.md section 6.
