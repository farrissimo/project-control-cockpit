# Advisor Restart Brief

Generated 2026-07-05T16:49:25-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathC-004
* Title: Checkpoint Gate: Bounded Extractability Audit (Verified Cycle)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Run the bounded extractability audit as a real two-role PCC cycle to satisfy Maturity Checkpoint criterion 2 (docs/CCB_PCC_RELATIONSHIP.md §8), replacing the self-declared DECISION-083 with a properly worker-produced, independently Codex-verified audit. DECISION-083 recorded 'extractability audit passes / checkpoint reached' directly in the decision log without a bounded task or independent verification; this task supplies the missing verified proof. Working only from repo truth, audit whether the extractability rule (DECISION-074/077: every capability is a discrete unit with an explicit .cockpit/ file-bridge contract, no hidden shared state, no undocumented cross-script assumptions) actually holds across the scripts changed since DECISION-074 plus the direct bridge/support scripts they rely on. Produce the audit and its evidence in .cockpit/result/worker-result.md, sorted strictly into real blockers / maintainability smells / optional polish. This task does NOT record checkpoint-reached and does NOT edit DECISION-083 or any doc/script/schema; recording checkpoint-reached is a separate step that happens only after Codex issues PASS.

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

* Task-level: Task 'pcc-pathC-004' is complete and verified PASS. That verified cycle is the basis for the checkpoint: the next optional step is to freeze and back up this kernel baseline.
* Project-level: Path A is confirmed as the post-checkpoint direction and its plan of record is canonical at docs/PATH_A_PLAN.md (DECISION-087). The next buildable Path A task is pcc-pathD-001 (Category D, Phase D1: read-only Owner Control Board dashboard), promotable directly from docs/PATH_A_PLAN.md section 6 through the normal worker/verifier cycle. No further planning is required to begin Category D.
