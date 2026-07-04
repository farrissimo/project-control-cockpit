# Advisor Restart Brief

Generated 2026-07-04T00:04:45-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-005
* Title: BRR Execution: Status-Change Refresh Invariant
* Status: ready_for_worker
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Operationalize the generic invariant that any repo-native path which changes live task status must leave both live handoff artifacts regenerated from the post-write state, not just one of them. Build the lightest viable repo-native mechanism, guardrail, or shared helper that makes this two-artifact refresh rule explicit across the existing status-mutating workflow paths so the recurring stale-artifact defect becomes structurally harder to reintroduce.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-004', verified at 2026-07-04T00:04:00-06:00
* Summary: pcc-brr2-004 satisfies its scope and cleanly operationalizes verifier-side post-PASS close-out. The repo now has a deterministic close-out path in scripts/close-out-verified-task.ps1; the related docs and decision log are propagated; the script correctly refreshes both live handoff artifacts after state advance; and independent verifier-side guardrails confirm the actual returned-for-verification repo state is healthy before live close-out.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-004': First real-use risk remains until the verifier executes scripts/close-out-verified-task.ps1 on a live PASS cycle; scratch testing was strong, but this run is the first live use.
* Risk from last verification of 'pcc-brr2-004': The script uses the same [ISSUE]-text-match coupling to doctor.ps1 output format as the other deterministic handoff helpers; if doctor output labels change, those scripts will need coordinated updates.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Read .cockpit/handoff/worker-directive.md, implement pcc-brr2-005 within scope, and return evidence to .cockpit/result/worker-result.md.
* Project-level: Run Claude Code against .cockpit/handoff/worker-directive.md for task 'pcc-brr2-005', focused on making the two-artifact refresh invariant explicit for every repo-native task-status change path.
