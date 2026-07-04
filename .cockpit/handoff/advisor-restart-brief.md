# Advisor Restart Brief

Generated 2026-07-03T23:38:08-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-004
* Title: BRR Verification: Deterministic Close-Out
* Status: ready_for_worker
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Operationalize verifier close-out and repo-sync duties in the same concrete way pcc-brr2-002 operationalized worker handback and pcc-brr2-003 operationalized verifier guardrails. Build the lightest viable verifier-side helper or equivalent repo-native mechanism that performs the normal post-PASS close-out sequence in a fixed, repeatable order: archive the cycle artifacts, advance state with the archived handoff path, run the post-close-out health check, log the event, and leave the repo in a clean commit-ready state so repo sync is an official duty expressed directly in the repo rather than a remembered checklist.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-003', verified at 2026-07-03T23:33:00-06:00
* Summary: pcc-brr2-003 satisfies its scope and cleanly operationalizes verifier-side independent guardrails. The repo now has a deterministic, read-only verifier path in scripts/verify-handback-guardrails.ps1; the related docs and decision log are propagated; the script handles status-specific applicability honestly; and independent verifier-side check-schemas, validate-cockpit-state, and doctor runs all confirm the actual returned-for-verification repo state is healthy. The script also states clearly that it certifies repo health only and does not itself decide the verification verdict.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-003': Verifier-side independent guardrails are now deterministic, but verifier close-out and repo-sync duties still rely on a remembered sequence rather than one concrete repo-native path.
* Risk from last verification of 'pcc-brr2-003': Both verifier and worker helper scripts currently detect doctor issues by reading doctor.ps1 output text, so any future doctor output-label change should update those helpers together.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Read .cockpit/handoff/worker-directive.md, implement pcc-brr2-004 within scope, and return evidence to .cockpit/result/worker-result.md.
* Project-level: Run Claude Code against .cockpit/handoff/worker-directive.md for task 'pcc-brr2-004', focused on operationalizing verifier close-out and repo-sync duties in one deterministic repo path.
