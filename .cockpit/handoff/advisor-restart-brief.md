# Advisor Restart Brief

Generated 2026-07-03T17:42:34-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: implementation

## Active Task

* Task ID: pcc-v1-008
* Title: Run the dual-restart proof cycle
* Status: ready_for_worker
* Objective: Create one bounded dual-restart proof that demonstrates both a fresh advisor session and a fresh Claude worker session can resume from canonical repo truth and complete one real PCC cycle without owner re-briefing. Use the existing advisor restart brief, worker directive, and verified artifact paths as the core inputs. Keep the work local, explicit, and bounded.

## Last Verified

* Verdict: PASS for task 'pcc-v1-007', verified at 2026-07-03T18:05:00-06:00
* Summary: Claude completed the bounded pcc-v1-007 task within scope by adding a deterministic worker restart-safety check that proves the live worker directive is complete and fresh against canonical state.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-007-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-007': Live state is still not validated against JSON Schema at runtime.
* Risk from last verification of 'pcc-v1-007': Worker restart safety is currently proven by an on-demand local check, not yet enforced automatically before every handoff.
* Risk from last verification of 'pcc-v1-007': Timestamp formatting across multiple PowerShell helpers could drift again if future scripts interpolate JSON datetimes without a shared formatter.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Give the pcc-v1-008 directive to Claude Code and wait for evidence.
* Project-level: Hand pcc-v1-008 to Claude Code and collect evidence for verification.
