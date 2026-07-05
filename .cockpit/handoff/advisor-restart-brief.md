# Advisor Restart Brief

Generated 2026-07-04T18:24:55-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathA-001
* Title: Local-First Routing: Advisory Task Routing Classifier
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver the original project scope's Local-First Routing capability (archive/PCC Original Project Scope.md §7.12) as a lean, read-only, self-contained advisory: a new script scripts/classify-routing.ps1 that reads the active task from .cockpit/state/task-state.json and mechanically classifies its routing-suitability (local_deterministic / model_judgment / mixed / unknown) using only fixed, observable signals already present in task state (task_safety_class and literal keyword matches against the task title/objective), then prints an advisory, explicitly non-authoritative recommendation to prefer local deterministic tools for the local-suitable portions (DECISION-002). It surfaces the local-first principle as a checkable per-task signal instead of an unmeasured convention. It is advisory only: it never gates, never redirects or executes work, never mutates state, and calls no other script. This is the first Path-A (post-BRR original-scope) task per DECISION-074's roadmap re-cut; §7.17 (session/usage pressure) is deferred and §7.18 (premium escalation) is already covered by the existing Owner Review Matrix, so this task is the entirety of Category A's honestly-buildable pre-checkpoint scope.

## Last Verified

* Verdict: PASS for task 'pcc-pathA-001', verified at 2026-07-04T18:11:32-06:00
* Summary: Independent verification found pcc-pathA-001 complete within its bounded scope. The new classify-routing script is present, read-only, advisory-only, mechanically classifies routing suitability from task-state signals, reports its firing signals and DECISION-002 recommendation clearly, fails cleanly on bad input, and passed the verifier's independent local guardrail re-run.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathA-001-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathA-001': The classifier is intentionally a mechanical keyword heuristic and may misclassify edge cases; this is disclosed in its own output and does not create enforcement risk because the script is advisory-only.
* Risk from last verification of 'pcc-pathA-001': The live worktree also contains unrelated DECISION-074 / docs/CCB_PCC_RELATIONSHIP.md changes outside this task's claimed file list; no evidence reviewed tied those changes to pcc-pathA-001, so this verdict is based on the task-scoped artifacts and behavior actually verified.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathA-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathA-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
