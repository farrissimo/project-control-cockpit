# Advisor Restart Brief

Generated 2026-07-04T12:08:36-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-5

## Active Task

* Task ID: pcc-brr5-001
* Title: BRR Readiness Review
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/BRR_PLAN.md Phase 5's sole deliverable: an honest BRR Readiness Review, added as a new section to docs/BRR_PLAN.md (mirroring how docs/V1_Scope.md's 'V1 Closure' section handled V1's own honest close-out). Must list, plainly: what PCC can safely do unattended today (with evidence); what still requires owner review; what remains unsafe or immature (explicitly including the gaps named in DECISION-060/061 -- Class A self-accept never exercised, archive-before-chaining policy-only, fuller Metrics and Failure Review Loop undelivered, and the standing single-party self-verification risk); and a recommendation for the next lane (continue BRR hardening / begin post-V1 expansion / keep both narrowly active), stated as a recommendation for the owner to decide, not a self-executed choice.

## Last Verified

* Verdict: PASS for task 'pcc-brr5-001', verified at 2026-07-04T12:05:00-06:00
* Summary: Verified pcc-brr5-001 (BRR Readiness Review) at 'strict' depth. Read the full new section directly, confirmed it is purely additive to docs/BRR_PLAN.md via diff, and spot-checked two of its evidentiary citations directly against docs/DECISIONS.md's actual text. All nine completion criteria are met, including the specific requirement that none of the six named unsafe/immature items be softened -- they are not. The review explicitly names its own most important limitation (single-party self-verification throughout BRR Phases 2-5) as the largest risk rather than minimizing it, and this very verification is itself an instance of that limitation, which is disclosed rather than hidden. The recommendation is framed correctly as a recommendation, deferring the actual next-lane choice to the owner. GPT (secondary reviewer) approved close-out and flagged one wording caution -- the original 'roughly thirty cycles' phrasing was unverified; corrected to the actual counted figures (26 completed BRR-phase cycles, 41 total including 15 V1 cycles, per .cockpit/result/archive/) before close-out, per GPT's specific request.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr5-001': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT secondary review not yet performed on this specific cycle -- notably, this cycle's own content names that exact gap as the single largest standing risk, which is itself worth the reader noticing: the review disclosing this limitation is being verified under the very limitation it discloses.
* Risk from last verification of 'pcc-brr5-001': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Applied via full re-read of the new section, cross-check against the Semi-Autonomy Ceiling, and direct spot-check of two citations against the underlying decision text rather than trusting the drafting pass alone.
* Risk from last verification of 'pcc-brr5-001': A synthesis document spanning ~26-41 prior cycles was only spot-checked at two citation points, not all of them; a reviewer with more time budget could reasonably re-verify a larger sample.
* Risk from last verification of 'pcc-brr5-001': The recommendation ('keep both narrowly active') is a judgment call, explicitly reasoned but not mechanically derivable; the owner and GPT may reasonably weigh the same facts differently.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr5-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr5-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
