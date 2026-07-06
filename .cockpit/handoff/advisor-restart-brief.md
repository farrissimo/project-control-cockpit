# Advisor Restart Brief

Generated 2026-07-05T19:02:47-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathD-004
* Title: Auto-Refresh / Watch Mode (Phase D2, Read-Only)
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver docs/PATH_A_PLAN.md section 6 Phase D2's first task: a new script scripts/watch-dashboard.ps1 that polls the .cockpit/ files scripts/generate-dashboard.ps1 already reads (project-state.json, task-state.json, verification-result.json, routing-log.jsonl) and re-invokes scripts/generate-dashboard.ps1 (as an explicit subprocess, the same composition pattern already used and verified for classify-routing.ps1 in pcc-pathD-003) whenever any of them changes, so the dashboard/index.html output stays current without the owner manually re-running the generator. Remains strictly read-only over the .cockpit/ bridge: watch-dashboard.ps1 itself never writes any file except by delegating the actual write to generate-dashboard.ps1's own existing, already-read-only render step. As minor housekeeping folded in per the pcc-pathD-003 verification's own next_action, also correct scripts/generate-dashboard.ps1's header comment block, which currently still states the older blanket 'calls no other script' claim alongside the newer, narrower pcc-pathD-003 exception language -- update it to state the current, accurate contract only (reads the four .cockpit/ inputs, invokes exactly one subprocess, classify-routing.ps1, writes only -OutputPath).

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-004)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle. Folds in the minor header-comment correction disclosed in pcc-pathD-003's verification (DECISION-093 / verification-result.json's next_action).
## Last Verified

* Verdict: PASS for task 'pcc-pathD-004', verified at 2026-07-05T21:20:00-06:00
* Summary: scripts/watch-dashboard.ps1's change-detection and failure-handling logic is confirmed sound and appropriate for this phase's babysitting-reduction goal, with the normal mtime-polling caveat correctly disclosed rather than hidden. The claimed comment-only fix to scripts/generate-dashboard.ps1 was directly verified by comparing it against the previously-reviewed version: only the header comment changed, all executable logic is identical. All three claimed test scenarios are genuinely supported by the code, not just asserted. Three minor, disclosed, non-blocking notes (generator-script-itself not tracked; path overrides not passed through to the delegated render call; failure is warning-only for the overall exit code) do not affect the verdict.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathD-004-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathD-004': Disclosed, non-blocking: the watch script tracks only the four .cockpit/ inputs, not scripts/generate-dashboard.ps1 itself -- a change to the generator script alone would not trigger a re-render until a tracked input also changes. Reviewer judged this correct against the task's actual objective (watch the dashboard's data inputs, not its own code) and not a blocker.
* Risk from last verification of 'pcc-pathD-004': Disclosed, non-blocking: scripts/watch-dashboard.ps1 delegates to generate-dashboard.ps1 with no arguments, so running the watcher against non-default tracked paths does not pass those overrides through to the delegated render call -- a real flexibility/testing-symmetry limitation, not a blocker for the default live-use case.
* Risk from last verification of 'pcc-pathD-004': Disclosed, non-blocking: a failed render (non-zero exit from generate-dashboard.ps1) is warning-only and does not make the overall watch script exit non-zero when the loop completes normally -- matches the intended non-fatal design, worth knowing for anyone scripting around it.
* Risk from last verification of 'pcc-pathD-004': This verification was performed via the ChatGPT manual bridge (DECISION-086) with remote, read-only repo access only -- no local execution, no independent re-run of scripts/verify-handback-guardrails.ps1 or other local guardrails. Per docs/VERIFICATION_RESULT_SPEC.md, this is additive review, not a substitute for local-guardrail-based independent verification.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathD-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathD-004' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
