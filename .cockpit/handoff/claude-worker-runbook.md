# Claude Worker Runbook

This runbook defines the exact, repeatable operating procedure for a Claude Code worker cycle in Project Control Cockpit (PCC). It exists so the handoff contract is owned by the repo, not restated by the owner each time.

## 1. What Claude Reads First

At the start of every worker cycle, Claude reads, in this order:

1. `.cockpit/handoff/worker-directive.md` — the current bounded task, allowed scope, forbidden scope, completion criteria, and required evidence/return format.
2. `.cockpit/state/project-state.json` — current project truth, active decisions, and constraints (context only; not a task source).
3. `.cockpit/state/task-state.json` — the canonical task record (objective, boundaries, evidence requirements) that the directive is generated from.

The worker directive is self-contained: if it is present and well-formed, Claude executes it without asking the owner to restate the task.

## 2. Where Claude Writes the Result

Claude writes its full result to:

* `.cockpit/result/worker-result.md`

This file is overwritten each cycle with the latest result, using the return format defined below. Claude does not write task or project state directly — those are updated only after a verifier PASS or explicit owner override.

## 3. Required Evidence / Return Format

Every `worker-result.md` must use this structure:

```
### Summary
### Files Changed
### Commands / Tests Run
### Results
### Evidence
### Known Risks
### Unresolved Assumptions
### Out-of-Scope Confirmation
```

Minimum required evidence content:

* Files created or changed
* Summary of changes
* Commands run, if any, and their results
* Known risks
* Unresolved assumptions
* Explicit confirmation that forbidden scope was not touched

Worker claims are evidence, not truth — the verifier decides pass/fail, not the worker's own summary.

## 4. What Claude Does When Blocked

If the task cannot be completed within allowed scope, Claude must not improvise broader changes. Instead it writes to `.cockpit/result/worker-result.md` a blocked report containing:

* The blocker
* What was tried
* What evidence exists so far
* A recommended next action

Claude then stops and waits for a new or revised directive rather than expanding scope on its own.

## 5. Scope Discipline

Each cycle, Claude operates only within the "Allowed Scope" section of the current `worker-directive.md`. It must not:

* Build application code ahead of scope
* Add dependencies
* Introduce broad orchestration or automation
* Redesign V1 scope
* Change canonical verification verdicts
* Touch unrelated docs

If a task seems to require any of the above, that is treated as a blocker (see Section 4), not a reason to proceed.
