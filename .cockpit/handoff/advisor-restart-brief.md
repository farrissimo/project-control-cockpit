# Advisor Restart Brief

Generated 2026-07-03T22:14:24-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-1

## Active Task

* Task ID: pcc-brr1-004
* Title: BRR Policy: Operating Definitions
* Status: ready_for_worker
* Objective: Define the BRR Phase 1 Operating Definitions in canonical repo truth, extending docs/BRR_POLICY.md so the key terms already used across the prior three BRR policy tasks are explicit, stable, and non-contradictory. At minimum define safe unattended, safe with review, owner decision, blocked, insufficient evidence, and escalation, reconciling them with the Owner Review Matrix, Task Safety Classification, and Stop-Instead-of-Guess Policy already recorded, without introducing runtime enforcement, new statuses, or Phase 2 fielding mechanics.

## Last Verified

* Verdict: PASS for task 'pcc-brr1-003', verified at 2026-07-03T23:50:00-06:00
* Summary: Reviewed the new Stop-Instead-of-Guess Policy against the task criteria and the prior BRR policy sections. All seven required triggers are covered, verdict reuse is explicit, and the policy stays aligned with the Owner Review Matrix and Task Safety Classification without inventing new enforcement behavior. The two looser mappings called out by the worker are acceptable as written: they disclose that those triggers are related by purpose and pattern rather than pretending to be exact row lookups. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr1-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr1-003': The out-of-scope drift trigger and the owner-facing tradeoff trigger intentionally use a looser relationship to prior matrix rows than the other triggers; that is acceptable here because it makes the non-1:1 fit explicit rather than forcing a false mapping.
* Risk from last verification of 'pcc-brr1-003': This remains judgment-heavy policy content rather than deterministically testable behavior; independent secondary review remains the right standing BRR Phase 1 practice.
* Risk from last verification of 'pcc-brr1-003': The final BRR Operating Definitions task must preserve the verdict and stop terminology already established here rather than rephrasing it into something that drifts.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Claude Code executes task 'pcc-brr1-004' from the generated directive and returns evidence for Codex to verify.
* Project-level: Worker executes task 'pcc-brr1-004' using the generated directive and returns evidence for independent verification.
