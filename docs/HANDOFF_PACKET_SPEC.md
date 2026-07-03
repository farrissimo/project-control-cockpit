# Handoff Packet Spec

## Purpose

A handoff packet transfers project/task context from one role or session to another without relying on messy chat history, memory, or manual owner restatement.

The handoff packet exists to solve:

* new-chat handoff nightmares
* copy/paste chaos
* role confusion
* missing task context
* weak worker directives
* lost project truth

---

## Core Rule

A handoff packet must be specific enough that the receiving role can understand the current task, the current truth, the next required action, and the boundaries without asking the owner to restate the project.

---

## Handoff Packet Location

V1 handoff packets should live at:

```text
.cockpit/handoff/
```

The active worker directive should live at:

```text
.cockpit/handoff/worker-directive.md
```

Optional archived handoffs may use:

```text
.cockpit/handoff/archive/
```

---

## Required Sections

Every handoff packet must include:

1. Receiving Role
2. Project Identity
3. Current Task
4. Current Truth
5. Objective
6. Exact Next Action
7. Allowed Scope
8. Forbidden Scope
9. Completion Criteria
10. Required Evidence
11. Expected Return Format
12. Blocked / Failure Instructions

---

## Handoff Template

```markdown
# Worker Directive

## Receiving Role

Worker

## Project

- Project ID:
- Project Name:
- Repo Path:
- Active Branch:

## Current Task

- Task ID:
- Task Title:
- Task Status:

## Objective

State the exact task objective in plain language.

## Current Truth

List only verified truth that the worker should rely on.

## Exact Next Action

Tell the worker exactly what to do next.

## Allowed Scope

The worker may:
- 

## Forbidden Scope

The worker must not:
- 

## Completion Criteria

The task is complete only if:
- 

## Required Evidence

Return the following evidence:
- files changed
- summary of changes
- commands/tests run
- command/test results
- known risks
- unresolved assumptions
- confirmation that forbidden scope was not touched

## Expected Return Format

Return your result in this structure:

### Summary

### Files Changed

### Commands / Tests Run

### Results

### Evidence

### Known Risks

### Unresolved Assumptions

### Out-of-Scope Confirmation

Confirm whether anything outside the allowed scope was touched.

## Blocked / Failure Instructions

If blocked, do not improvise broad changes. Return:
- blocker
- what you tried
- what evidence you have
- recommended next action
```

---

## Directive Generation Is a Local Deterministic Step

`scripts/generate-worker-directive.ps1` drafts `.cockpit/handoff/worker-directive.md` directly from `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`, following this template. Worker-facing standing truth should come from canonical state rather than hidden script-only facts. The generator refuses to draft a directive if the two state files disagree on the active task, or if the task's objective, allowed scope, forbidden scope, or completion criteria are missing.

---

## Handoff Quality Rules

A handoff is valid only if it includes:

* one clear task
* explicit scope
* explicit forbidden scope
* explicit completion criteria
* explicit required evidence
* no vague “improve this” language without boundaries
* no hidden reliance on prior chat history
* no permission to rewrite unrelated project areas

---

## Bad Handoff Example

```markdown
Fix the app and make it work better. Check everything and improve whatever seems wrong.
```

Why this is invalid:

* no bounded task
* no completion criteria
* no evidence requirement
* no forbidden scope
* invites drift
* impossible to verify cleanly

---

## Good Handoff Example

```markdown
Task: Fix the verification result writer so it records PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE in .cockpit/result/verification-result.json.

Allowed scope:
- app/verify.*
- schemas/verification-result.schema.json
- tests related directly to verification result writing

Forbidden scope:
- do not change routing behavior
- do not modify project-state schema
- do not redesign CLI commands

Completion criteria:
- verification result file is written to the expected path
- verdict value is one of the allowed enum values
- invalid verdict values are rejected
- test or command output proves the behavior

Required evidence:
- files changed
- command/test run
- result output
- known risks
```

---

## Role-Specific Notes

### Advisor / Verifier Handoff

When handing to an advisor/verifier, include:

* current state
* worker result
* evidence path
* completion contract
* verification question
* required verdict

### Worker Handoff

When handing to a worker, include:

* task objective
* allowed scope
* forbidden scope
* exact action
* required evidence

### Fresh-Chat Handoff

When starting a fresh chat, include:

* project goal
* current phase
* current task
* verified truth
* unresolved issues
* next expected action
* files/paths to read first

---

## V1 Discipline

Handoff packets should stay practical.

Do not add ceremony unless it directly improves task completion, verification, or owner babysitting reduction.
