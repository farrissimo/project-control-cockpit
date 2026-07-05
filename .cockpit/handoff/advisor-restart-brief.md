# Advisor Restart Brief

Generated 2026-07-04T18:36:11-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathB-001
* Title: Behavior Controls: Communication Preferences Stored And Surfaced In Worker Directive
* Status: complete
* Safety Class: C (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver the original project scope's Tone / Chattiness / Language Controls (archive/PCC Original Project Scope.md §7.16; DECISION-009) as fielded state rather than an unenforced principle: add a communication_prefs object to .cockpit/state/project-state.json (and its schema) holding the owner's standing communication defaults, and edit scripts/generate-worker-directive.ps1 to render a 'Communication Defaults' section from it, so a fresh worker session auto-applies the owner's tone/language/behavior preferences without the owner restating them each session. This is a direct babysitting reduction (DECISION-001): repeated owner corrections about communication style are exactly what §7.16 exists to prevent. It is the sole honestly-buildable pre-checkpoint task in Category B; §7.19 (suggested tools) is declined for now as low-value and overlapping with scripts/classify-routing.ps1 / DECISION-002. This is Task Safety Class C because it edits a schema (a truth surface, Owner Review Matrix row 7); the owner approved it before execution.

## Last Verified

* Verdict: PASS for task 'pcc-pathB-001', verified at 2026-07-04T18:35:04-06:00
* Summary: Independent verification found pcc-pathB-001 complete within its bounded scope. The project state and schema now carry the seeded communication defaults, the directive generator surfaces them for fresh worker sessions, the missing-field guard omits the section cleanly instead of erroring, the required docs updates are present, and the verifier's independent guardrail re-run completed cleanly.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathB-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathB-001': communication_prefs is advisory-only worker guidance rendered into the directive; it does not enforce behavior. That is intentional and consistent with the task boundary.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathB-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathB-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
