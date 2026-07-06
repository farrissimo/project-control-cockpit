# Advisor Restart Brief

Generated 2026-07-05T18:43:25-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-002
* Title: Directive + Verification Panels (Read-Only)
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Extend scripts/generate-dashboard.ps1 (pcc-pathD-001, DECISION-089) per docs/PATH_A_PLAN.md section 6, Phase D1, with two more read-only panels: the Directive Panel (current directive, boundaries, required evidence, success criteria, handoff target, from .cockpit/handoff/worker-directive.md) and the Verification Panel (returned evidence, changed files, verdict, missing evidence, next action, from .cockpit/result/worker-result.md and .cockpit/result/verification-result.json). This remains a pure consumer of the .cockpit/ file bridge (DECISION-074/077/087) and the local-first execution discipline (DECISION-088): still plain PowerShell + static HTML, zero LLM dependency, zero external runtime, no new engine-script calls.

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-002)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner explicitly said to keep going until told to stop, with verification paused before each cycle per the owner's chosen mode this session.
## Last Verified

* Verdict: PASS for task 'pcc-pathD-002', verified at 2026-07-05T20:10:00-06:00
* Summary: scripts/generate-dashboard.ps1's two new panels (Directive, Verification) preserve the same read-only, self-contained, extractability-compliant shape verified on pcc-pathD-001. The Directive Panel's task-state.json-sourced simplification is sound and explicitly within the task's allowed scope. The pcc-pathD-001 process gap (skipped pre-task backup gate) is confirmed genuinely corrected this cycle, with a coherent, non-contradictory evidence trail. No blocker found; two disclosed minor notes (hardcoded role line; pointer-only evidence file) do not affect the verdict.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-002': The dashboard's 'Current Role' line remains a hardcoded standing-role string rather than a live state field, same as the prior cycle; disclosed, not a blocker.
* Risk from last verification of 'pcc-pathD-002': The Verification Panel's worker-result.md-as-pointer-only design (not rendering its content) is judged acceptable for this phase but remains an assumption rather than a fully proven UX decision.
* Risk from last verification of 'pcc-pathD-002': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification. The reviewer also flagged a connector-level limitation fetching DECISION-092's full body text directly (see evidence_reviewed).

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathD-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
