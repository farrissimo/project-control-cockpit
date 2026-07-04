# Advisor Restart Brief

Generated 2026-07-03T20:46:37-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-1

## Active Task

* Task ID: pcc-v1-015
* Title: Honesty Checks: Format Check
* Status: complete
* Objective: Add a light, non-blocking JSON-schema format check for the three canonical runtime JSON files (project-state.json, task-state.json, verification-result.json) against schemas/*.schema.json, using pwsh's Test-Json (confirmed via a spike to correctly handle our schemas' required fields, additionalProperties: false, enum values, and nullable ["string","null"] union types). Fold this into doctor.ps1 as one additional advisory finding rather than a separate gate; it must never block, halt, or fail any task cycle. This is the last open V1 backlog item before wrap-up.

## Last Verified

* Verdict: PASS for task 'pcc-v1-015', verified at 2026-07-03T20:50:00-06:00
* Summary: Independently re-ran doctor.ps1 against the live repo (confirmed OK) and reproduced the ISSUE path in a fresh scratch copy using a missing-required-field violation, different from either corruption the worker tested, confirming the check genuinely generalizes rather than being tuned to the worker's specific test cases. Confirmed via grep that check-schemas.ps1 is referenced only by doctor.ps1, never wired as a gate. This closes out IDEA-003, the last open V1 backlog item. All completion criteria met; no out-of-scope changes found.
* Last verified handoff: .cockpit/handoff/archive/pcc-v1-015-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-v1-015': check-schemas.ps1 requires pwsh; if unavailable, doctor.ps1 falls back to a generic ISSUE rather than real schema status - an inherited risk already accepted for the other composed checks.
* Risk from last verification of 'pcc-v1-015': Test-Json's error messages use JSON Pointer paths (e.g. '/task_status') rather than plain English, less immediately readable than doctor's other prose findings.
* Risk from last verification of 'pcc-v1-015': handoff-packet.schema.json was deliberately excluded since no live JSON runtime file exists to validate against it.
* Risk from last verification of 'pcc-v1-015': Self-verification note (DECISION-019): mitigated by independently reproducing the ISSUE path with a different schema violation (missing required field) than either of the worker's own tests (bad enum, disallowed additional property), and by confirming via grep that the new script is never invoked outside doctor.ps1.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-v1-015' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-v1-015' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
