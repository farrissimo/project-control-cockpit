# Advisor Restart Brief

Generated 2026-07-04T09:47:51-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-3

## Active Task

* Task ID: pcc-brr3-004
* Title: BRR Policy: Inadequate-Work Return Path
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Add an 'Inadequate-Work Return Path' section to docs/BRR_POLICY.md (docs/BRR_PLAN.md Phase 3 item 4) making it explicit that FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE are normal, expected, safe outcomes of verification, not exceptional or failure states -- naming the mechanics that already make the path symmetric with PASS, the one real asymmetry (no dedicated close-out convenience script for non-PASS verdicts), and what happens after each verdict, without touching the fallback authority model, autonomous gate, acceptance boundary rules, task-class meanings, or the five verdict definitions. Also, per explicit owner instruction this cycle, reword the 'silent adjacent-scope edits' description added under pcc-brr3-003 to frame it as a required reviewer discipline rather than a precise deterministic detector -- a distinct, owner-directed micro-edit, not part of item 4's own content.

## Auto-Promotion Basis

* Approved lane: docs/BRR_PLAN.md Phase 3 (owner-approved BRR program plan; Phase 3 entered via DECISION-045)
* Priority / plan reference: docs/BRR_PLAN.md Phase 3 deliverable item 4, 'Inadequate-Work Return Path' -- the fourth and final listed Phase 3 item, directly after pcc-brr3-003's item 3
* Justification (continuation, not a fork): Independently re-checked against the full 8-part Safe Next-Task Drafting Rules gate (docs/BRR_POLICY.md, DECISION-039): current task (pcc-brr3-003) complete/PASS; repo health/state checks clean (check-stop-conditions.ps1 CLEAR, check-autonomous-gate.ps1 PROCEED); already-approved lane (BRR_PLAN.md Phase 3, final item); scope kept deliberately definitional (no new script), matching the precedent of items 1-3 and the owner's own stop-condition against broadening into governance redesign; aligned with the babysitting-reduction north star (makes non-PASS outcomes routine rather than something that quietly gets avoided); bounded and classifiable (Class B, matching precedent); no Owner Review Matrix 'before execution' row applies since this names and clarifies already-existing mechanics rather than granting or changing authority; changes no project goal, architecture, authority model, or safety posture. The owner directly reviewed and pre-authorized self-promoting this specific item this cycle ('self-promote Phase 3 item 4 under the same gate... does not need fresh owner naming'), with two explicit stop-conditions (do not touch the fallback authority model/autonomous gate/acceptance boundary/class meanings/verdict definitions; do not broaden beyond return-path normalization into governance redesign) carried verbatim into this task's forbidden-scope list. The owner also gave explicit wording for a small, distinct fix to pcc-brr3-003's existing text (reframe the adjacent-scope check as a reviewer discipline, not a strong detector) -- that specific edit is owner-directed, not self-promoted, and is called out separately in boundaries/completion criteria so it is never conflated with item 4's own self-promoted content.
## Last Verified

* Verdict: PASS for task 'pcc-brr3-004', verified at 2026-07-04T09:43:00-06:00
* Summary: Verified pcc-brr3-004 (BRR Policy: Inadequate-Work Return Path) at 'strict' depth. Read the full added section directly, re-read scripts/advance-cockpit-state.ps1 itself to confirm the section's factual claims about existing mechanics are accurate (not just plausible-sounding), and confirmed via git diff that the only other change in docs/BRR_POLICY.md is exactly the two owner-named 'silent adjacent-scope edits' passages -- nothing else in that file, DECISION-033/036, the Acceptance Boundary Rules, Task Safety Classification, or the five verdict definitions in docs/VERIFICATION_RESULT_SPEC.md was touched. All ten completion criteria are met with direct evidence. Independent local guardrails clean. This completes all four BRR Phase 3 policy deliverables named in docs/BRR_PLAN.md; BRR Phase 3 itself was not marked complete, consistent with treating that as a separate, deliberate owner/advisor decision (per DECISION-049's own reasoning, mirroring how DECISION-021/028/045 each treated phase completion as its own explicit step).
* Last verified handoff: .cockpit/handoff/archive/pcc-brr3-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr3-004': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review of this specific completed result: not performed this cycle.
* Risk from last verification of 'pcc-brr3-004': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Strict depth was applied (full read of the new section and the two amended passages, plus line-by-line cross-check against Stop-Instead-of-Guess Policy, Acceptance Boundary Rules, Task Safety Classification, and the actual behavior of scripts/advance-cockpit-state.ps1, performed and recorded here, not merely asserted).
* Risk from last verification of 'pcc-brr3-004': Circularity-restriction self-check: this task does NOT fall into the pcc-brr3-002 circularity case -- it does not modify DECISION-033/036's text, the autonomous gate scripts, the Acceptance Boundary Rules, a Task Safety Class's core definition, or the verdict definitions; it names existing mechanics and adds an adjacent section, plus a scoped, owner-directed wording fix. Correctly eligible for self-verification.
* Risk from last verification of 'pcc-brr3-004': This is the third consecutive self-promoted task, this time under the owner's most direct pre-authorization yet (naming the specific item and giving explicit stop-conditions). The gate check and the wording-fix disclosure are both PCC's own self-report; an independent reviewer re-checking the actual diff (as this verification did via git diff, not just narrative) is the strongest available substitute for now, but is not equivalent to a genuinely independent second party.
* Risk from last verification of 'pcc-brr3-004': This is the first time a previously-verified, closed-out task's canonical text (pcc-brr3-003's Out-of-Scope Detection section) was amended after close-out. The chosen mechanism (amend the live doc in place, disclose distinctly, do not reopen the closed task record or its PASS verdict) is a reasonable precedent but is itself a new judgment call worth an independent second look before treating it as settled procedure for future similar cases.
* Risk from last verification of 'pcc-brr3-004': The recommended scripts/return-inadequate-work.ps1 remains unbuilt; the actual PASS/non-PASS close-out friction asymmetry this task named still exists in the repo today, disclosed rather than fixed.
* Risk from last verification of 'pcc-brr3-004': DECISION-036's commit-and-push-every-PASS authorization remains lapsed in BRR Phase 3. Per the owner's standing instruction, this commit is not pushed; only e34b06c (pcc-brr3-001) remains on remote.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr3-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: BRR Phase 3 policy scope is complete (DECISION-050): all four docs/BRR_PLAN.md Phase 3 deliverables are written and verified. current_phase remains brr-phase-3 pending a separate owner decision on the next lane -- build the two recommended follow-on hardening scripts as bounded tasks, or advance to BRR Phase 4 (which would also require adding brr-phase-4 to schemas/project-state.schema.json's enum first).
