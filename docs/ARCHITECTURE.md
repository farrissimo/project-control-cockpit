# Architecture

## Purpose

Project Control Cockpit is a local-first control board for AI-assisted project work.

The architecture should stay simple, stateful, inspectable, and focused on reducing owner babysitting.

---

## Core Architecture Principle

Do not build a giant autonomous agent.

Build a small, reliable control loop:

```text id="bl02h5"
state → directive → worker → evidence → verification → state update or retry
```

Everything in V1 should support that loop.

---

## System Layers

## 1. Owner Control Layer

The owner control layer is the human-facing interface.

In V1, this may start as a CLI or simple local interface. A desktop UI can come after the workflow proves itself.

Responsibilities:

* show current project state
* show current task state
* show next expected action
* allow owner decisions
* allow owner override
* start directive generation
* start verification
* trigger rollover/reset

---

## 2. State Layer

The state layer stores canonical project/task truth.

Primary files:

```text id="5ph6sz"
.cockpit/state/project-state.json
.cockpit/state/task-state.json
```

Responsibilities:

* preserve current project truth
* preserve current task truth
* prevent reliance on chat history
* record owner decisions
* track current status
* track next expected action

State is not updated just because a worker claims completion.

State updates require:

* verifier PASS, or
* explicit owner override

---

## 3. Handoff Layer

The handoff layer prepares role-specific packets.

Primary file:

```text id="rx5gpz"
.cockpit/handoff/worker-directive.md
```

Responsibilities:

* generate worker directives
* preserve current truth
* define exact next action
* define allowed scope
* define forbidden scope
* define completion criteria
* define required evidence
* reduce copy/paste handoff chaos

---

## 4. Worker Layer

The worker layer executes bounded work.

Initial V1 worker:

* Claude Code

V1 bridge:

* local file-based handoff

Responsibilities:

* read worker directive
* execute the bounded task
* stay within allowed scope
* return required evidence
* report blockers instead of improvising broad changes

The worker is not the source of truth.

Worker output is evidence.

---

## 5. Verification Layer

The verification layer reviews worker output against the completion contract.

Primary file:

```text id="y92kcm"
.cockpit/result/verification-result.json
```

Responsibilities:

* inspect worker result
* inspect evidence
* compare result against completion criteria
* identify missing evidence
* identify out-of-scope work
* issue one verdict:

  * PASS
  * FAIL
  * INSUFFICIENT
  * BLOCKED
  * OUT_OF_SCOPE
* decide whether state update is allowed

Only PASS allows automatic state advancement.

---

## 6. Local Tool Layer

The local tool layer handles deterministic work without wasting model usage.

Tools may include:

* PowerShell
* Git Bash
* Git
* filesystem commands
* grep/ripgrep
* diff tools
* JSON/YAML validators
* local scripts

Responsibilities:

* handle shell-grade work locally
* inspect repo state
* validate files
* support verification
* reduce model/session usage

---

## 7. Routing Layer

The routing layer decides the next execution path.

V1 routing should be simple and mostly deterministic.

Possible routes:

* local tool
* advisor/verifier
* Claude Code worker
* owner decision
* rollover/reset

Routing inputs:

* task type
* file paths
* command-like user request
* current task status
* completion contract
* evidence state
* failure count
* owner decision requirements

V1 should avoid model-based routing unless clearly needed.

---

## 8. Rollover Layer

The rollover layer creates clean state handoffs for fresh chats or fresh worker cycles.

Responsibilities:

* preserve verified project truth
* preserve current task state
* preserve unresolved issues
* preserve latest evidence/verdict
* produce next expected action
* prevent long-chat context rot

Rollover is a safety mechanism, not a failure.

---

## V1 Data Flow

```text id="zvztwk"
Owner creates/selects task
        ↓
Project/task state updated to drafted
        ↓
Directive generated
        ↓
Directive written to .cockpit/handoff/worker-directive.md
        ↓
Claude Code reads directive and executes
        ↓
Worker writes result/evidence
        ↓
Verifier reviews result against completion contract
        ↓
verification-result.json written
        ↓
If PASS: state updates
If not PASS: state preserved and next action defined
```

---

## Local File Bridge

V1 uses predictable local files instead of complex automation.

Recommended structure:

```text id="wh78p8"
.cockpit/
  state/
    project-state.json
    task-state.json
  handoff/
    worker-directive.md
    archive/
  result/
    worker-result.md
    verification-result.json
    archive/
  logs/
    routing-log.jsonl
```

This keeps the system inspectable and easy to debug.

---

## Owner Override

The owner may override a verifier result.

An override must be recorded as an owner decision and should include:

* original verdict
* reason for override
* owner-approved state update
* timestamp

Owner override is allowed, but it should be explicit.

---

## Logging

V1 should log important events:

* task created
* directive generated
* worker handoff written
* worker result received
* verification verdict issued
* state update accepted/rejected
* owner override
* rollover created
* routing decision

Logs should support later babysitting-reduction metrics.

---

## What This Architecture Avoids

V1 intentionally avoids:

* full autonomous multi-agent loops
* paid API dependence
* full model orchestration
* broad RAG/knowledge-base systems
* fake truth scoring
* fake chat health scoring
* deep CCB integration
* complex UI before workflow proof

---

## Architecture Success Test

The architecture is successful if it makes this loop reliable:

```text id="tld1mr"
bounded task
→ clear directive
→ worker execution
→ evidence return
→ verification verdict
→ state update or recovery
```

If the architecture makes that loop harder, it is wrong.
