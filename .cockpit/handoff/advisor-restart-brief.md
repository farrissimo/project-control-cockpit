# Advisor Restart Brief

Generated 2026-07-04T10:09:15-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-3

## Active Task

* Task ID: pcc-brr3-005
* Title: Safety Net: Non-PASS Close-Out Script
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Add scripts/return-inadequate-work.ps1, mirroring scripts/close-out-verified-task.ps1's shape (archive, advance state, health-check, log, optional local-only commit) for the four non-PASS verdicts (FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE), fielding the asymmetry named as future work in pcc-brr3-004/DECISION-049. Update docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md's Task Process to name the new script, and make a narrow, disclosed update to docs/BRR_POLICY.md's 'Inadequate-Work Return Path' section noting the script now exists, per DECISION-051's Post-Close Canonical Amendment Rule.

## Last Verified

* Verdict: PASS for task 'pcc-brr3-005', verified at 2026-07-04T10:12:00-06:00
* Summary: Verified pcc-brr3-005 (Safety Net: Non-PASS Close-Out Script) at 'strict' depth. Read the new script's full text directly and confirmed via git diff that no existing script, schema, or authority/gate/class-defining text was touched. Went beyond reviewing the worker's own test transcript: independently created a second, fresh isolated scratch copy and re-ran the script myself against a different verdict (OUT_OF_SCOPE, vs. the worker's FAIL) to get real independent confirmation rather than trusting the worker's report alone, per DECISION-031. All eight completion criteria are met with direct evidence, including the doc updates and the correctly-scoped, non-rewriting pointer added to pcc-brr3-004's already-closed section under DECISION-051's new rule. Independent local guardrails clean.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr3-005-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr3-005': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed this cycle. Independent re-testing in a fresh scratch copy (rather than only re-reading the worker's own transcript) was performed as a substitute strengthening step, per DECISION-031's requirement that the verifier independently re-run relevant checks rather than trust the worker's report alone -- this is not equivalent to a genuinely independent second party, but is stronger than narrative-only self-review.
* Risk from last verification of 'pcc-brr3-005': Verification Depth Policy row applied: Class B, truth-surface-affecting (touches scripts/) -> strict. Strict depth was applied: full read of the new script, the doc updates, and an independent functional re-test with a different verdict than the worker used.
* Risk from last verification of 'pcc-brr3-005': Circularity-restriction self-check: this task does NOT fall into the pcc-brr3-002 circularity case -- it does not modify DECISION-033/036's text, the autonomous gate scripts' own logic, the Acceptance Boundary Rules, or a Task Safety Class's core definition; it adds a new, separate convenience script that calls existing unmodified logic. Correctly eligible for self-verification.
* Risk from last verification of 'pcc-brr3-005': Only two of the four non-PASS verdicts (FAIL by the worker, OUT_OF_SCOPE by me independently) were actually exercised end-to-end; INSUFFICIENT and BLOCKED were not separately tested, though they route through the same unmodified hashtable lookups in advance-cockpit-state.ps1 and log-event.ps1 that both tested verdicts also exercise.
* Risk from last verification of 'pcc-brr3-005': This is the second application of DECISION-051's Post-Close Canonical Amendment Rule (first was its own writing); the rule's practical workability is still only lightly exercised.
* Risk from last verification of 'pcc-brr3-005': DECISION-036's commit-and-push-every-PASS authorization remains lapsed. Per the owner's standing instruction, this commit is local-only pending a fresh explicit push instruction.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr3-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr3-005' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
