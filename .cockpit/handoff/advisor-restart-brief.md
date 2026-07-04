# Advisor Restart Brief

Generated 2026-07-04T09:31:29-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-3

## Active Task

* Task ID: pcc-brr3-003
* Title: BRR Policy: Out-of-Scope Detection
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Add an 'Out-of-Scope Detection' section to docs/BRR_POLICY.md (docs/BRR_PLAN.md Phase 3 item 3) giving concrete, checkable definitions for the three named failure modes (unauthorized file changes, unintended truth-surface edits, silent adjacent-scope edits) and a required, structural verification procedure covering them -- formalizing practice already used ad hoc in prior verification results (per-file diff review against boundaries.allowed/forbidden), without adding new scripts or touching the self-verification fallback, autonomous gate, acceptance boundary rules, or any Task Safety Class's core meaning.

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 3, 'Out-of-Scope Detection Hardening' -- the next listed item after pcc-brr3-002's item 2
* Justification (continuation, not a fork): Independently re-checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039): current task (pcc-brr3-002) complete/PASS; repo health/state checks clean; already-approved lane (BRR_PLAN.md Phase 3); scope kept deliberately definitional/procedural (not a new script) to stay bounded without new owner intent, per the owner's own caution against chasing perfect detection; aligned with the babysitting-reduction north star; bounded and classifiable (Class B, matching precedent); no Owner Review Matrix 'before execution' row applies since this defines detection criteria rather than granting or changing authority; changes no project goal, architecture, authority model, or safety posture. Distinct from pcc-brr3-002: this time the owner directly reviewed and pre-authorized self-promoting this specific item this cycle ('self-promote Phase 3 item 3 next... it does not need owner naming directly'), including two explicit stop-conditions (do not touch the self-verification fallback/autonomous gate/acceptance boundary/class meanings; do not broaden into governance redesign) that are carried into this task's forbidden-scope list verbatim. That owner sign-off is stronger corroborating context than GPT's prior recommendation, but the gate check above -- not the owner's blessing of the mechanism -- remains the recorded basis, consistent with treating self-promotion as a checkable claim rather than an assumed one.
## Last Verified

* Verdict: PASS for task 'pcc-brr3-003', verified at 2026-07-04T09:32:00-06:00
* Summary: Verified pcc-brr3-003 (BRR Policy: Out-of-Scope Detection) at 'strict' depth. Read the full added 'Out-of-Scope Detection' section directly, cross-checked it against Owner Review Matrix row 7, Task Safety Classification, Acceptance Boundary Rules, the Verification Depth Policy, and the Self-Verification Restrictions, and confirmed via git diff that DECISION-033/036's text is byte-for-byte unchanged and no scripts/schemas were touched. Applied the task's own new detection procedure to itself as an extra check: no out-of-scope findings. All nine completion criteria are met with direct evidence. Independent local guardrails clean. This is the second consecutive self-promoted task, this time under the owner's direct, explicit pre-authorization (plus two stop-conditions, both confirmed held) rather than GPT's suggestion -- recorded accurately in promotion_basis and DECISION-048 as corroborating context, with the independent gate check as the actual basis.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr3-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr3-003': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review of this specific completed result: not performed this cycle.
* Risk from last verification of 'pcc-brr3-003': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Strict depth was applied (full read of the added section plus line-by-line cross-check against Owner Review Matrix row 7, Task Safety Classification, Acceptance Boundary Rules, Verification Depth Policy, and Self-Verification Restrictions, performed and recorded here, not merely asserted).
* Risk from last verification of 'pcc-brr3-003': Circularity-restriction self-check: this task does NOT fall into the circularity case defined in pcc-brr3-002 -- it does not modify DECISION-033/036's text, the autonomous gate scripts, the Acceptance Boundary Rules, or a Task Safety Class's core definition; it adds a new adjacent detection-criteria section. It was therefore correctly eligible for self-verification under the existing rule, not an exception to it.
* Risk from last verification of 'pcc-brr3-003': This is the second consecutive self-promoted task. Unlike pcc-brr3-002 (GPT-suggested, independently re-verified), this cycle had the owner's direct, explicit pre-authorization to self-promote this specific item plus two stop-conditions -- both held (confirmed above), but the underlying scoping choices (what belongs on the truth-surface list; where 'silent adjacent-scope edit' starts) remain PCC's own drafting judgment and are worth independent re-check.
* Risk from last verification of 'pcc-brr3-003': The truth-surface list is a snapshot; if a new canonical doc is added later without this list being updated, detection of edits to that new doc as 'truth-surface' would silently under-fire until the list is refreshed. Disclosed in the policy text itself, not hidden.
* Risk from last verification of 'pcc-brr3-003': The procedure is definitional/manual only -- nothing automates it; its real-world value depends on a verifier (self or independent) actually running the five steps each cycle, same enforcement gap disclosed for the two prior Phase 3 sections.
* Risk from last verification of 'pcc-brr3-003': DECISION-036's commit-and-push-every-PASS authorization remains lapsed in BRR Phase 3. Per the owner's explicit instruction this cycle, pcc-brr3-002's commit (281781e) and this task's commit are to be pushed only if/when separately instructed -- neither is pushed as part of this close-out.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr3-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr3-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
