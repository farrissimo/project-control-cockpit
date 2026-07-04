# Advisor Restart Brief

Generated 2026-07-04T14:15:01-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-postbrr-001
* Title: Deterministic Retry Governor (IDEA-009)
* Status: out_of_scope
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Field IDEA-009: use the existing task-state.json 'attempts' field so a task that fails twice in a row with no new evidence automatically stops itself (task_status: 'blocked', an owner_decision_request populated) instead of allowing a third unattended handback. This implements, mechanically, the rule already stated in docs/BRR_POLICY.md's Stop-Instead-of-Guess trigger 4 / Owner Review Matrix row 9 ('repeated failure with no new evidence... further unattended retries stop... the task itself needs the owner to change approach, scope, or evidence') and docs/BRR_POLICY.md's own restated verdict mapping for FAIL ('repeated failure with nothing new is... Class D (BLOCKED), not another unattended attempt'). This is deliberately a narrow, deterministic mechanism (count-based), not a judgment call about whether a failure is 'the same approach' -- it fires on attempt count and non-PASS verdict alone, exactly as the check-stop-conditions.ps1 precedent already treats 'blocked' as an existing attention-needed status it detects.

## Auto-Promotion Basis

* Approved lane: backlog/IDEAS.md
* Priority / plan reference: IDEA-009
* Justification (continuation, not a fork): Owner-approved 2026-07-04: IDEA-009 was deferred pending PCC running semi-autonomously, which pcc-brr5-004/005 just demonstrated for real (unattended, independently-verified cycles). This is the first post-BRR task, owner-selected from the backlog after explicit review of the net benefit and cost.
## Last Verified

* Verdict: OUT_OF_SCOPE for task 'pcc-postbrr-001', verified at 2026-07-04T14:11:20-06:00
* Summary: Independent verification found the main implementation and guardrail re-run broadly consistent with the intended retry-governor behavior, but the cycle cannot pass because the worker also changed backlog/IDEAS.md outside the task's authorized scope. Under the verification spec, that requires an OUT_OF_SCOPE verdict even when the primary code change itself appears sound.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr5-005-worker-directive.md

## Open Issues

* Project blocker: Independent verification found the main implementation and guardrail re-run broadly consistent with the intended retry-governor behavior, but the cycle cannot pass because the worker also changed backlog/IDEAS.md outside the task's authorized scope. Under the verification spec, that requires an OUT_OF_SCOPE verdict even when the primary code change itself appears sound.
* Task blocker: Independent verification found the main implementation and guardrail re-run broadly consistent with the intended retry-governor behavior, but the cycle cannot pass because the worker also changed backlog/IDEAS.md outside the task's authorized scope. Under the verification spec, that requires an OUT_OF_SCOPE verdict even when the primary code change itself appears sound.
* Risk from last verification of 'pcc-postbrr-001': The worker result states the task boundaries were amended mid-task to permit the scripts/log-event.ps1 change. The final authoritative task-state does permit that one-line script edit, but the same authoritative scope still does not authorize backlog/IDEAS.md.
* Risk from last verification of 'pcc-postbrr-001': The completion criteria text contains an internal inconsistency: one bullet's scratch-test wording says attempts=1 should block, while the exact rule and the separate normal-single-retry criterion both require attempts=1 to remain a normal retry. The implementation follows the exact rule rather than that contradictory phrasing.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Remove or explicitly authorize the backlog/IDEAS.md change, then resubmit the task for verification with scope aligned to the actual files touched.
* Project-level: Remove or explicitly authorize the backlog/IDEAS.md change, then resubmit the task for verification with scope aligned to the actual files touched.
