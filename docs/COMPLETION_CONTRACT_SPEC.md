# Completion Contract Spec

## Purpose

A completion contract defines the proof required before a task can be marked complete.

The goal is to prevent fake completion, vague progress claims, missing evidence, and state updates based only on worker confidence.

---

## Core Rule

A task is not complete because a worker says it is complete.

A task is complete only when the required evidence satisfies the completion criteria and the verifier issues a PASS verdict.

---

## Required Fields

Every task should define:

* task type
* objective
* completion criteria
* required evidence
* allowed scope
* forbidden scope
* verification mode
* failure handling rule

---

## Verification Modes

V1 supports three verification modes:

### Light

Use for low-risk, small tasks.

Example:

* documentation wording
* small formatting change
* simple file organization

Expected proof:

* summary
* affected files
* before/after or result confirmation

### Normal

Default mode.

Use for most implementation, planning, and project-state tasks.

Expected proof:

* summary
* affected files or artifacts
* commands/tests run when applicable
* result output
* known risks
* unresolved assumptions

### Strict

Use for high-risk tasks.

Example:

* state model changes
* verification logic
* routing behavior
* file-writing behavior
* anything that could corrupt project truth

Expected proof:

* summary
* files changed
* exact commands/tests run
* full relevant result output
* diff summary
* edge cases considered
* rollback notes if applicable
* unresolved assumptions
* confirmation forbidden scope was not touched

---

## Task Type: Code Change

Required completion criteria should usually include:

* intended behavior implemented
* affected files are within allowed scope
* forbidden scope was not touched
* relevant command/test was run
* command/test result supports completion
* known risks are documented
* unresolved assumptions are documented

Required evidence:

```text id="07y9pm"
- files changed
- summary of changes
- commands/tests run
- command/test results
- diff summary
- known risks
- unresolved assumptions
- out-of-scope confirmation
```

---

## Task Type: Documentation Change

Required completion criteria should usually include:

* requested document was created or updated
* content matches the requested purpose
* no unrelated docs were modified unless allowed
* open questions are documented

Required evidence:

```text id="4kpacs"
- files changed
- summary of changes
- location of updated content
- known risks or gaps
- out-of-scope confirmation
```

---

## Task Type: Planning / Analysis

Required completion criteria should usually include:

* problem or decision is clearly framed
* constraints are captured
* recommendation or options are provided
* unresolved questions are listed
* next action is clear

Required evidence:

```text id="ulviyz"
- summary
- recommendation or options
- constraints considered
- unresolved questions
- proposed next action
```

---

## Task Type: Local File Operation

Required completion criteria should usually include:

* exact operation completed
* affected paths are listed
* before/after state is clear
* operation stayed within allowed scope
* validation command or check confirms result

Required evidence:

```text id="t35t3d"
- command run
- affected paths
- before/after summary
- validation result
- out-of-scope confirmation
```

---

## Task Type: Repo Inspection

Required completion criteria should usually include:

* requested repo area was inspected
* findings are grounded in actual files/commands
* no changes were made unless explicitly allowed
* next action is clear

Required evidence:

```text id="6zasqt"
- commands run
- files inspected
- findings
- risks or gaps
- proposed next action
```

---

## Verification Verdicts

Verifier must issue exactly one verdict:

### PASS

The task met the completion criteria and supplied adequate evidence.

### FAIL

The task did not meet the completion criteria.

### INSUFFICIENT

The result may be correct, but evidence is missing, incomplete, or unclear.

### BLOCKED

The task cannot proceed without owner input, access, dependency, or external decision.

### OUT_OF_SCOPE

The worker touched, changed, or attempted work outside the allowed scope.

---

## Verdict Rules

### PASS

State may advance.

### FAIL

State must not advance.
Next action should define whether to retry, revise directive, decompose task, or stop.

### INSUFFICIENT

State must not advance.
Next action should request missing evidence or rerun verification.

### BLOCKED

State must not advance.
Next action should identify the blocker and owner decision needed.

### OUT_OF_SCOPE

State must not advance.
Next action should require review before further work.

---

## Failure Handling

Default failure policy:

```text id="b0aqhf"
first failure → tighten directive and retry
second failure → decompose task or switch method
missing evidence → request evidence before continuing
out-of-scope change → stop and review
blocked → owner decision required
```

---

## Completion Contract Template

```markdown id="f51xmf"
# Completion Contract

## Task Type

## Objective

## Verification Mode

Light / Normal / Strict

## Allowed Scope

- 

## Forbidden Scope

- 

## Completion Criteria

The task is complete only if:
- 

## Required Evidence

Worker must return:
- 

## Failure Handling

If the task cannot be completed:
- return blocker
- return what was attempted
- return evidence gathered
- recommend next action
```

---

## V1 Discipline

Completion contracts should be strict enough to prevent fake completion but simple enough to avoid becoming process theater.

Use the lightest verification mode that protects the project.
