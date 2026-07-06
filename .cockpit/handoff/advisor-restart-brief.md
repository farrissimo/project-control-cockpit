# Advisor Restart Brief

Generated 2026-07-05T18:15:20-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-001
* Title: Dashboard Skeleton + Owner Control Board Panel (Read-Only)
* Status: returned_for_verification
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver the first Category D (Product Surface) task per docs/PATH_A_PLAN.md section 6, Phase D1: a new, self-contained, read-only script scripts/generate-dashboard.ps1 that reads .cockpit/state/project-state.json and .cockpit/state/task-state.json (paths overridable by parameter) and renders a local static HTML file at dashboard/index.html showing the Owner Control Board panel (original scope section 11): current project, current task, current state, next expected action, current role, current worker, current verdict, and current blocker. This proves the UI's pure-consumer-of-the-file-bridge pattern (DECISION-074/077 extractability rule; DECISION-087 UI form decision) before any other panel is added. The script is read-only over the .cockpit/ bridge: it writes only the new top-level dashboard/ directory, never mutates any .cockpit/ file, and calls no other script (DECISION-088 local-first execution discipline: plain PowerShell + HTML, zero LLM dependency, zero external runtime).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-001)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); this is continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner separately confirmed readiness to start Path A actual work in this session.
## Last Verified

* Verdict: PASS for task 'pcc-pathC-004', verified at 2026-07-05T15:49:00-06:00
* Summary: Independent verification passes. The worker completed the bounded extractability audit in scope, grounded its per-script findings in the audited files, found no real blocker to extractability, and correctly identified DECISION-083's issue as a process-timing problem rather than a substantive contradiction. This supplies the missing two-role proof for checkpoint criterion 2.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathC-004': DECISION-083 remains in repo truth ahead of the formal post-PASS cleanup. Its substantive conclusion is now supported by this verified audit, but the repo still needs a final follow-through step to record checkpoint-reached on the back of this PASS rather than leaving the earlier premature wording standing alone.
* Risk from last verification of 'pcc-pathC-004': The audit is intentionally bounded to the named script set and direct support scripts. That matches the task contract and the checkpoint framing used for this cycle.

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
* Project-level: Worker evidence for task 'pcc-pathD-001' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
