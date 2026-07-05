# Advisor Restart Brief

Generated 2026-07-05T15:43:27-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathC-004
* Title: Checkpoint Gate: Bounded Extractability Audit (Verified Cycle)
* Status: returned_for_verification
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Run the bounded extractability audit as a real two-role PCC cycle to satisfy Maturity Checkpoint criterion 2 (docs/CCB_PCC_RELATIONSHIP.md §8), replacing the self-declared DECISION-083 with a properly worker-produced, independently Codex-verified audit. DECISION-083 recorded 'extractability audit passes / checkpoint reached' directly in the decision log without a bounded task or independent verification; this task supplies the missing verified proof. Working only from repo truth, audit whether the extractability rule (DECISION-074/077: every capability is a discrete unit with an explicit .cockpit/ file-bridge contract, no hidden shared state, no undocumented cross-script assumptions) actually holds across the scripts changed since DECISION-074 plus the direct bridge/support scripts they rely on. Produce the audit and its evidence in .cockpit/result/worker-result.md, sorted strictly into real blockers / maintainability smells / optional polish. This task does NOT record checkpoint-reached and does NOT edit DECISION-083 or any doc/script/schema; recording checkpoint-reached is a separate step that happens only after Codex issues PASS.

## Last Verified

* Verdict: PASS for task 'pcc-pathC-003', verified at 2026-07-05T15:16:00-06:00
* Summary: Independent verification passes. DECISION-081 records the required Category C checkpoint-accounting call in bounds, chooses one allowed outcome clearly, grounds that judgment in existing repo truth about IDEA-012, IDEA-013, and DECISION-074, and leaves the final bounded extractability audit as the only remaining pre-checkpoint gate.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathC-003': This is a judgment-record task rather than a purely mechanical one. The PASS verdict rests on the repo's own stated checkpoint bar and the cited backlog and decision records, not on a script-checkable proof.
* Risk from last verification of 'pcc-pathC-003': DECISION-081 keeps IDEA-013 deferred based on its current incident-gated rationale. If a concrete evidence-review failure appears later, that idea should still be promoted then.

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
* Project-level: Worker evidence for task 'pcc-pathC-004' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict.
