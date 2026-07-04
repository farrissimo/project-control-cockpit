# Advisor Restart Brief

Generated 2026-07-03T23:22:40-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-003
* Title: BRR Verification: Deterministic Verifier Guardrails
* Status: ready_for_worker
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Operationalize verifier-side independent guardrails in the same concrete way pcc-brr2-002 operationalized worker handback. Build the lightest viable verifier-side helper or equivalent repo-native mechanism that runs the applicable independent local checks against the actual handed-back state before a verdict is issued, so verifier guardrails are a repeatable repo path rather than a memory-based checklist. Keep it bounded to normal verifier-side health checks and close review of applicability, without redesigning verdicts, worker flow, or broader BRR policy.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-002', verified at 2026-07-03T23:21:00-06:00
* Summary: pcc-brr2-002 satisfies its scope and closes the worker-side sequencing gap cleanly. The repo now has one deterministic worker handback path in scripts/finalize-worker-handback.ps1, the related docs and decision log are propagated, the active task was handed back using that path, and independent verifier-side check-schemas, validate-cockpit-state, and doctor runs all confirm the actual returned-for-verification repo state is healthy. The added verifier-duty clarification in DECISION-031 is also in scope because this task already touched the same verifier/handback truth surfaces and the owner explicitly requested that those official duties be recorded now.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-002-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-002': Worker handback ordering is now deterministic, but verifier-side independent guardrails are still recorded as duties and should be operationalized just as concretely to reduce future reliance on memory or judgment.
* Risk from last verification of 'pcc-brr2-002': The new script intentionally excludes scripts/enforce-handoff-restart-safety.ps1 because that gate applies only to ready_for_worker fresh-session handoff, not returned_for_verification worker handback; future changes should preserve that distinction.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Read .cockpit/handoff/worker-directive.md, implement pcc-brr2-003 within scope, and return evidence to .cockpit/result/worker-result.md.
* Project-level: Run Claude Code against .cockpit/handoff/worker-directive.md for task 'pcc-brr2-003', focused on operationalizing verifier-side independent guardrails in one concrete, repeatable repo path.
