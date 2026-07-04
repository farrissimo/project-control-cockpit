# Advisor Restart Brief

Generated 2026-07-04T09:07:51-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-3

## Active Task

* Task ID: pcc-brr3-001
* Title: BRR Policy: Verification Depth
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Define a Verification Depth Policy in docs/BRR_POLICY.md establishing three verification rigor levels (light/normal/strict) and a concrete, checkable mapping from Task Safety Class (A/B/C/D) and task type (deterministic/mechanical vs. judgment-heavy/prose vs. truth-surface-or-governance-affecting) to the level required, per docs/BRR_PLAN.md Phase 3 deliverable 1.

## Last Verified

* Verdict: PASS for task 'pcc-brr3-001', verified at 2026-07-04T09:08:00-06:00
* Summary: Verified pcc-brr3-001 (BRR Policy: Verification Depth) at 'strict' depth, as the task's own new policy requires for a Class B, truth-surface-affecting change. Read the full added 'Verification Depth Policy' section directly, cross-checked it line-by-line against the existing Task Safety Classification and Acceptance Boundary Rules sections, and found no contradiction. All six completion criteria are met with direct evidence. Independent local guardrails (validate-cockpit-state, check-schemas, doctor) all clean. Task selection this cycle was owner-directed (the owner named the task ID and source directly), not a PCC self-promotion, so promotion_basis correctly remains null and the auto-promotion gate does not apply.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr3-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr3-001': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed this cycle.
* Risk from last verification of 'pcc-brr3-001': This task is Class B and truth-surface-affecting, which by its own new policy requires 'strict' depth; strict depth was applied, but strict depth performed by the same party who authored the change is a narrower independent check than a genuinely separate reviewer would provide -- the same self-refereeing limitation already disclosed for other BRR policy cycles under this fallback.
* Risk from last verification of 'pcc-brr3-001': The policy is definitional only and not yet fielded into any script; nothing currently enforces that future verification cycles actually apply the depth this table calls for. That gap is inherent to a policy-only deliverable and is named explicitly in the section's own 'Notes on scope', not hidden.
* Risk from last verification of 'pcc-brr3-001': The DECISION-036 commit-and-push-every-PASS authorization was time-boxed to 'the remainder of BRR Phase 2' and has lapsed now that PCC is in BRR Phase 3 (per DECISION-036's own text). This cycle's changes are being committed locally per the standing DECISION-020 default; pushing to any remote requires a fresh, explicit owner approval this cycle, not an assumption that DECISION-036 still covers it.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr3-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr3-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
