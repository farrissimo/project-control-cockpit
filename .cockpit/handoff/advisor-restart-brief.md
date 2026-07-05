# Advisor Restart Brief

Generated 2026-07-04T22:24:04-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-checkpoint-001
* Title: Pre-Checkpoint Kernel Quality Audit (bundled with DECISION-074's extractability audit)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Perform a one-time, tightly bounded read-only audit of PCC's core kernel scripts (all 23 files under scripts/) against IDEA-014's six PCC-native standards (correctness, verification-friendliness, leanness, modularity/extractability, maintainability, failure clarity) to answer one narrow question: is the kernel solid enough to freeze, preserve, and branch from with confidence, ahead of DECISION-074's Maturity Checkpoint. This task also satisfies DECISION-074's own required extractability audit (confirming every script communicates only through the documented .cockpit/ file-bridge contract, with no hidden shared state or undocumented cross-script assumptions), bundled into the same pass per IDEA-014's own noted overlap rather than run as two separate reviews of the same files. This is read-only and produces a report only -- it changes no script's behavior. Findings must sort into exactly three buckets (real risks / maintainability smells / optional polish), per IDEA-014's guardrail against open-ended rewrite churn; polish items are recorded but not acted on. Task Safety Class B: the findings are judgment calls (code-quality assessment), not mechanically checkable, so this task may execute unattended but must not be self-accepted -- independent verifier review is required before acceptance.

## Last Verified

* Verdict: PASS for task 'pcc-checkpoint-001', verified at 2026-07-04T21:30:00-06:00
* Summary: Owner override: task closed complete by explicit, repeated owner instruction. Report content had already been independently verified correct prior to a self-inflicted lock-race producing a spurious FAIL (DECISION-082). No further waiting.
* Last verified handoff: .cockpit/handoff/worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-checkpoint-001': This is an owner-directed override of the acceptance boundary, not a fresh independent verifier PASS. The content was independently confirmed once already; the owner explicitly directed closing this out rather than waiting for a clean re-poll.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Owner directly overrode the acceptance boundary and closed this task complete, per explicit repeated instruction, rather than waiting further on independent verification. Content had already been independently confirmed correct once before an operational lock-race produced a spurious FAIL (see worker-result.md, DECISION-082). Owner/advisor selects the next bounded task.
* Project-level: Owner/advisor selects the next bounded task.
