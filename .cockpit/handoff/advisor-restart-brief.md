# Advisor Restart Brief

Generated 2026-07-03T17:28:18-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-006
* Title: Generate a fresh-advisor restart brief from canonical truth
* Status: ready_for_worker
* Objective: Create one local deterministic helper that generates a concise advisor restart brief from canonical repo truth and verified artifacts so a brand-new Codex advisor/verifier session can resume the project without owner re-briefing. Keep it local, bounded, and explicit.

## Last Verified

* Verdict: PASS for task 'pcc-v1-005', verified at 2026-07-03T17:30:00-06:00
* Summary: Claude completed the bounded pcc-v1-005 task within scope by moving generated worker Current Truth facts fully into canonical state and updating the directive generator to rely on that state.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-005-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-005': project-state.schema.json now documents worker_context_facts as required, but live state is not yet validated against JSON Schema at runtime.
* Risk from last verification of 'pcc-v1-005': validate-cockpit-state.ps1 still checks structural consistency only and does not yet prove that the live directive matches fresh generator output.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Give the pcc-v1-006 directive to Claude Code and wait for evidence.
* Project-level: Hand pcc-v1-006 to Claude Code and collect evidence for verification.
