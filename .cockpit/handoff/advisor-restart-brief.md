# Advisor Restart Brief

Generated 2026-07-04T14:46:23-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-postbrr-001
* Title: Deterministic Retry Governor (IDEA-009)
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field IDEA-009: use the existing task-state.json 'attempts' field so a task that fails twice in a row with no new evidence automatically stops itself (task_status: 'blocked', an owner_decision_request populated) instead of allowing a third unattended handback. This implements, mechanically, the rule already stated in docs/BRR_POLICY.md's Stop-Instead-of-Guess trigger 4 / Owner Review Matrix row 9 ('repeated failure with no new evidence... further unattended retries stop... the task itself needs the owner to change approach, scope, or evidence') and docs/BRR_POLICY.md's own restated verdict mapping for FAIL ('repeated failure with nothing new is... Class D (BLOCKED), not another unattended attempt'). This is deliberately a narrow, deterministic mechanism (count-based), not a judgment call about whether a failure is 'the same approach' -- it fires on attempt count and non-PASS verdict alone, exactly as the check-stop-conditions.ps1 precedent already treats 'blocked' as an existing attention-needed status it detects.

## Auto-Promotion Basis

* Approved lane: backlog/IDEAS.md
* Priority / plan reference: IDEA-009
* Justification (continuation, not a fork): Owner-approved 2026-07-04: IDEA-009 was deferred pending PCC running semi-autonomously, which pcc-brr5-004/005 just demonstrated for real (unattended, independently-verified cycles). This is the first post-BRR task, owner-selected from the backlog after explicit review of the net benefit and cost.
## Last Verified

* Verdict: PASS for task 'pcc-postbrr-001', verified at 2026-07-04T14:39:00-06:00
* Summary: Independent verification found the resubmitted task consistent with its live, reopened scope: the retry-governor implementation is present in repo truth, verifier guardrails re-run cleanly, and independent scratch testing reproduced both the unaffected single-retry path and the repeated-failure blocking path. No remaining out-of-scope finding or missing evidence blocks acceptance of the current task state.
* Last verified handoff: .cockpit/handoff/archive/pcc-postbrr-001-attempt2-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-postbrr-001': This PASS depends on the task having been explicitly reopened/re-scoped after the earlier OUT_OF_SCOPE verdict; the original archived OUT_OF_SCOPE cycle remains valid history and is not overwritten.
* Risk from last verification of 'pcc-postbrr-001': The independently reproduced functional testing covered the default threshold behavior (2) required by this task, not broader parameter fuzzing of custom MaxAttemptsBeforeBlock values.
* Risk from last verification of 'pcc-postbrr-001': doctor.ps1 still reports the handoff-gate warning that the last recorded enforce-handoff-restart-safety result is for an older task; verify-handback-guardrails.ps1 correctly treats that as informational at returned_for_verification status, not as a blocking issue.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-postbrr-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-postbrr-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
