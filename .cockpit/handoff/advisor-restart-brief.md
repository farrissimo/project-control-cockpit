# Advisor Restart Brief

Generated 2026-07-04T12:42:28-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-5

## Active Task

* Task ID: pcc-brr5-003
* Title: Safety Net: Automatic Push On Commit
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Per explicit, direct owner instruction (not self-promoted), make push-to-remote automatic whenever a verified cycle is committed, removing the standing per-time push approval requirement (DECISION-020's push clause). Update scripts/close-out-verified-task.ps1, scripts/return-inadequate-work.ps1, and scripts/archive-held-cycle.ps1 so that, when -Commit is passed and the commit succeeds, the script also pushes the current branch to origin automatically. Record the policy change explicitly, since it supersedes a standing decision.

## Last Verified

* Verdict: PASS for task 'pcc-brr5-003', verified at 2026-07-04T12:43:00-06:00
* Summary: Verified pcc-brr5-003 (Safety Net: Automatic Push On Commit) at 'strict' depth. Read identical diffs across all three targeted scripts confirming the push addition is scoped exactly as required (inside the existing -Commit branch only, dynamic branch detection, non-fatal failure handling, no force-push or alternate remote). Independently re-tested the exact push logic myself in a separate fresh scratch git repository against a real local bare remote, deliberately using a different branch name ('main') than the worker's own test ('master') to confirm the logic is genuinely branch-name-agnostic rather than coincidentally correct. All nine completion criteria are met with direct, independently-reproduced evidence. This is a real, owner-directed governance change (superseding DECISION-020's per-time push approval) -- the change itself was directly authorized by the owner in this conversation; this verification confirms the implementation correctly matches that authorization, not that the authorization itself needed verifying.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-003-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr5-003': Self-verified under DECISION-033 degraded fallback. No independent second-party (Codex) review has occurred. GPT secondary review not yet performed on this specific cycle. This is a meaningful governance/authority change (superseding DECISION-020's push clause) verified only under the fallback -- the owner's own direct instruction is the actual authority here, not this verification, which only checks that the implementation matches that instruction correctly.
* Risk from last verification of 'pcc-brr5-003': Verification Depth Policy row applied: Class B, truth-surface-affecting -> strict. Applied via full diff review of all three scripts plus an independent, separately-constructed functional re-test (different branch name than the worker used) rather than trusting the worker's test transcript alone.
* Risk from last verification of 'pcc-brr5-003': Neither the worker's nor my own testing exercised the real repo's actual GitHub remote -- both used scratch/local git repositories by design, to avoid any risk to real history. The very first real push under this new behavior (this task's own close-out) will be the first true end-to-end confirmation against the actual remote.
* Risk from last verification of 'pcc-brr5-003': A failed push is currently only visible in script output; nothing alerts the owner if a push silently fails and is never retried. Disclosed by the worker as a known, un-addressed gap, not fixed by this task.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr5-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr5-003' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
