# Advisor Restart Brief

Generated 2026-07-03T22:04:47-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-1

## Active Task

* Task ID: pcc-brr1-003
* Title: BRR Policy: Stop-Instead-of-Guess
* Status: ready_for_worker
* Objective: Define the BRR Phase 1 Stop-Instead-of-Guess Policy in canonical repo truth, extending docs/BRR_POLICY.md so PCC has explicit rules for when it must stop rather than inventing or pushing through ambiguity. Cover the trigger examples named in docs/BRR_PLAN.md Phase 1 and tie them cleanly to the existing verification verdicts and to the Owner Review Matrix / Task Safety Classification already recorded, without introducing new verdicts, runtime enforcement, or Phase 2 execution mechanics.

## Last Verified

* Verdict: PASS for task 'pcc-brr1-002', verified at 2026-07-03T23:15:00-06:00
* Summary: Reviewed the new Task Safety Classification against the task criteria and the existing Owner Review Matrix. The class model is concrete, directly mapped, docs-only, and internally coherent. The worker's flagged design choice — separating execution from acceptance — is the right framing here because it cleanly distinguishes Class B from Class A and Class C without prematurely implementing Phase 2 flow. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr1-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr1-002': Class A versus Class B still depends on judgment for novel task types that fall outside the currently named matrix rows; more precedent or later policy hardening may tighten that boundary.
* Risk from last verification of 'pcc-brr1-002': This remains policy content, so correctness is judgment-based rather than deterministically testable; independent secondary review remains the right standing BRR Phase 1 practice.
* Risk from last verification of 'pcc-brr1-002': The upcoming Stop-Instead-of-Guess Policy must cross-reference this classification carefully so Class D and the failure/uncertainty triggers stay aligned.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Claude Code executes task 'pcc-brr1-003' from the generated directive and returns evidence for Codex to verify.
* Project-level: Worker executes task 'pcc-brr1-003' using the generated directive and returns evidence for independent verification.
