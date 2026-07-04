# Advisor Restart Brief

Generated 2026-07-04T01:45:58-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-010
* Title: BRR Execution: Acceptance Boundary Rules
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Implement BRR Phase 2's fifth and final deliverable (docs/BRR_PLAN.md Phase 2 item 5, Acceptance Boundary Rules) as a canonical POLICY LAYER in docs/BRR_POLICY.md that defines, per task safety class, what PCC may self-complete/self-accept vs. what must wait for independent review. Ground it in the existing Task Safety Classification (Class A safe-unattended = self-acceptable; Class B safe-to-execute-but-review-before-acceptance = must NOT self-accept; Class C/D do not execute unattended so acceptance does not arise) rather than redefining classes. Honor the secondary reviewer's (GPT) explicit constraints: (a) do NOT build enforcement or wire the pcc-brr2-009 stop-detector as a gate - that is a deliberate later task; (b) do NOT switch on or broaden unattended execution; (c) acceptance boundaries constrain PCC's OWN self-acceptance only and must NOT block or add friction to owner-directed work; (d) describe explicitly the clean seam by which a LATER task could hard-gate PCC's self-promotion/autonomous-continuation path (using check-stop-conditions.ps1 CLEAR plus acceptance-boundary-permitted), and state that seam is NOT wired now; (e) reaffirm that a CLEAR stop-check means only 'no mechanically-detectable stop', not 'safe in every sense', with fork/north-star/new-owner-decision still outside automatic detection. Keep it docs-primarily.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-010', verified at 2026-07-04T01:46:00-06:00
* Summary: Reviewed the Acceptance Boundary Rules section against the completion criteria and GPT's relayed constraints. git status confirms this was docs-only (README, BRR_POLICY, DECISIONS, REPO_GOVERNANCE) with zero script and zero schema changes - the strongest evidence GPT's 'policy layer only, no enforcement wired' constraint was honored, since no code capable of gating exists. grep confirmed the load-bearing protective language is present: acceptance constrains PCC's own acceptance not the owner; the hard-gating seam is described but deliberately not wired; a CLEAR stop-check is a floor not a guarantee; unattended run remains off. The per-class table is grounded in the existing Task Safety Classification without redefining it, and the fallback interaction is handled honestly (target two-role model vs. current self-verify-with-disclosure). All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-010-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-010': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: GPT reviewed and approved the constraints this task was built to (relayed by the owner this turn); a confirming read of the resulting Acceptance Boundary Rules section is still appropriate. Claude drafted, built, and verified the cycle.
* Risk from last verification of 'pcc-brr2-010': All five Phase 2 deliverables are now DEFINED, but unattended draft-and-run remains OFF and requires two further deliberate, not-yet-authorized steps (wire PCC's own path to self-gate; verified pilot). Risk of misreading 'deliverables defined' as 'autonomy ready'; the policy, DECISION-041, and README all state it is not, but the owner should confirm that distinction reads clearly.
* Risk from last verification of 'pcc-brr2-010': Whether to mark Phase 2 complete, build the gate-wiring + pilot, or move to Phase 3 is a genuine fork and an owner decision - not taken here. A natural use of the Owner-Decision Capture Flow when the next step is considered.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-010' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-010' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
