# Advisor Restart Brief

Generated 2026-07-04T12:21:49-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-5

## Active Task

* Task ID: pcc-brr5-002
* Title: Safety Net: Archive Before Chaining
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field the Semi-Autonomy Ceiling's policy-only 'archive before you chain' rule (docs/BRR_POLICY.md, DECISION-060/061) as an actual script, closing the gap DECISION-059 found: chaining into a next unattended cycle currently overwrites the prior cycle's live evidence (worker directive, worker result, verification result) before it is archived, with git history as the only fallback. Add scripts/archive-held-cycle.ps1 that preserves a held (self-verified but not yet accepted/closed) cycle's evidence into the same archive/ locations close-out-verified-task.ps1 uses, without advancing task_status or otherwise treating the cycle as accepted.

## Last Verified

* Verdict: PASS for task 'pcc-brr5-002', verified at 2026-07-04T12:23:00-06:00
* Summary: Verified pcc-brr5-002 (Safety Net: Archive Before Chaining) at 'strict' depth. Read the new script's full text directly and confirmed via git diff that no existing script, schema, or prior doc content was touched -- only additive changes. Independently re-tested the script myself in a fresh scratch copy, using a verdict (BLOCKED) neither the worker nor any real prior cycle had exercised, confirming both the happy path (task_status genuinely unchanged) and the re-run refusal. All ten completion criteria are met with direct, independently-reproduced evidence. This closes the concrete gap DECISION-059 found and GPT flagged as 'not the final trusted form' in DECISION-061 -- the archive-before-chaining rule now has an actual enforcement tool, not policy text alone.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr5-002': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT secondary review not yet performed on this specific cycle.
* Risk from last verification of 'pcc-brr5-002': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Applied via full re-read of the new script and doc changes, plus an independent re-test in a fresh scratch copy with a verdict not previously exercised, rather than trusting the worker's own test transcript alone.
* Risk from last verification of 'pcc-brr5-002': The new script remains a manually-invoked convenience tool, same as its two siblings -- nothing forces a verifier to actually run it before chaining into a next held cycle. The discipline still depends on a human or PCC-as-verifier reading and applying the Semi-Autonomy Ceiling; this task closes the 'no tool exists' gap, not the 'tool isn't always used' gap.
* Risk from last verification of 'pcc-brr5-002': Only three of the five verdicts have now been exercised against this script across worker and verifier testing combined (PASS, INSUFFICIENT, BLOCKED); FAIL and OUT_OF_SCOPE were not separately tested, though the code contains no verdict-conditional branching that would make this a meaningful gap.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr5-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr5-002' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
