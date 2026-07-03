# V1 Scope

## V1 Objective

Build the first working version of Project Control Cockpit that can manage one bounded AI-assisted project task from task definition through directive creation, worker handoff, evidence return, verification, and state update.

The goal is not to build the full future product. The goal is to prove the core workflow reduces owner babysitting.

---

## V1 Success Standard

V1 succeeds if Project Control Cockpit can run this cycle:

```text
task selected
→ directive created
→ worker executes
→ evidence returned
→ verification verdict issued
→ state updated or rejected
→ next action is clear
```

The cycle must require less manual owner babysitting than the current chat-bridge workflow.

---

## Non-Negotiable V1 Rule

Reducing owner babysitting is the #1 rule.

Any feature that does not reduce babysitting, improve handoff quality, preserve project truth, improve verification, or reduce repeated manual correction should be postponed.

---

## V1 Core Workflow

1. Load or create project state.
2. Load or create task state.
3. Define one bounded task.
4. Generate a worker directive.
5. Write the directive to a known local handoff location.
6. Worker reads directive and executes.
7. Worker returns result/evidence to a known location.
8. Advisor/verifier reviews evidence against the completion contract.
9. System records a verdict.
10. If PASS, state can update.
11. If not PASS, state does not advance and next action is defined.

---

## V1 Required Components

### 1. Canonical Project State

The system must maintain a project state file containing:

* project ID
* project name
* project goal
* current phase
* current task ID
* active constraints
* owner decisions
* active repo path, if applicable
* active branch, if applicable
* current blocker
* last verified handoff
* last verification verdict
* next expected action

---

### 2. Canonical Task State

The system must maintain a task state file containing:

* task ID
* task title
* task objective
* task status
* assigned worker
* completion criteria
* boundaries
* required evidence
* attempts
* current directive path
* result path
* verification verdict
* next action

---

### 3. Handoff Packet

The system must generate a clean handoff packet for the worker.

The packet must include:

* receiving role
* project identity
* current task
* objective
* current truth
* exact next action
* allowed scope
* forbidden scope
* completion criteria
* required evidence
* expected return format

---

### 4. Worker Directive

The worker directive must be specific enough that Claude Code can execute without the owner restating the task.

It must include:

* task objective
* files or areas to inspect
* allowed changes
* forbidden changes
* commands/tests to run when applicable
* evidence required
* output format
* what to do if blocked

---

### 5. Completion Contract

Each task must have an explicit proof requirement.

For code tasks, required evidence should include:

* files changed
* summary of changes
* commands/tests run
* command/test results
* known risks
* unresolved assumptions
* confirmation that no out-of-scope changes were made

For non-code tasks, required evidence should match the task type and must still be explicit.

---

### 6. Verification Gate

The verifier must produce one verdict:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE

State can only advance automatically on PASS.

Any other verdict must preserve the current state and define the next action.

---

### 7. State-Write Discipline

Worker output does not automatically become project truth.

Project/task state can update only after:

* verifier PASS, or
* explicit owner override

This is required to prevent state fiction.

---

### 8. Local File Bridge

V1 should use a simple local file bridge.

Minimum paths:

```text
.cockpit/
  state/
    project-state.json
    task-state.json
  handoff/
    worker-directive.md
  result/
    worker-result.md
    verification-result.json
  logs/
    routing-log.jsonl
```

The first bridge does not need to be fancy. It only needs to make handoff and return paths predictable.

---

### 9. Manual Rollover / Reset

V1 must support creating a clean handoff summary for a fresh thread or fresh worker cycle.

The rollover should preserve:

* project truth
* current task state
* latest verdict
* unresolved issues
* next action

---

### 10. Tone / Communication Defaults

V1 should preserve the owner’s preferred defaults:

* concise
* direct
* no cheerleading
* plain English unless technical detail is needed
* explicit uncertainty when relevant

These defaults should be visible or configurable, but they do not need a full UI in the first proof.

---

## V1 Should Not Build Yet

Do not include in the first proof:

* full desktop UI
* full knowledge base
* RAG/vector search
* parallel model compare
* broad model orchestration
* automatic premium model switching
* fake health score dashboards
* full CCB integration
* broad tool-discovery engine
* autonomous multi-agent loop

---

## First Proof Target

The first proof target is:

Project Control Cockpit can manage one real bounded task using a local file bridge to Claude Code, receive the result, verify the result against a completion contract, and update or reject state correctly.

---

## V1 Done Criteria

V1 is done when the system can complete at least one real task cycle and produce:

* project state file
* task state file
* worker directive
* worker result
* verification result
* final verdict
* next action

The owner should be able to see exactly what happened, what was verified, and what should happen next.
