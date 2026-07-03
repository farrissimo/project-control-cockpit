# AI Project Control Cockpit — Full Project Scope

Note: This file is planning background, not the canonical V1 source of truth.
Canonical V1 project truth lives in `README.md` and the `docs/` files.

## 1. Project Goal

Build a lean, local-first AI project control cockpit that reduces owner babysitting by keeping AI-assisted project work bounded, stateful, verifiable, and efficiently routed.

The system should act as the owner-facing control board for project planning, task execution, handoffs, verification, session hygiene, and model/tool routing. It should not try to magically make LLMs honest or fully autonomous. Instead, it should prevent the known failure modes of AI-assisted project work: weak handoffs, state loss, fake completion, endless chat drift, over-chatting, under-verifying, repeated owner corrections, unclear task state, and chaotic new-chat restarts.

The #1 rule is reducing owner babysitting.

---

## 2. Primary Problem

The current AI-assisted project workflow requires too much manual babysitting.

The owner repeatedly has to:

* restate the same rules
* copy/paste context between chats
* manually create new-chat handoffs
* tell workers what to read
* keep advisor and worker roles aligned
* detect fake completion
* catch drift
* verify repo/project health
* manage session usage
* decide when to restart or compact
* prevent workers from changing unrelated things
* keep project state coherent

The product exists to reduce that burden.

---

## 3. Core Product Definition

This is a local-first project management and execution cockpit for AI-assisted work.

It coordinates:

* the human owner
* an advisor/verifier role
* a worker execution role such as Claude Code
* local deterministic tools such as PowerShell and Git Bash
* project/task state files
* handoff packets
* verification results
* session reset/rollover workflows
* model/tool routing decisions

It is not just a chat app.

It is the control board that governs project work cycles.

---

## 4. Intended User

The initial user is a hands-on project owner / visionary who uses LLMs to build, revise, plan, verify, and manage software or technical projects.

The owner does not want to babysit every step manually, but also does not trust fully autonomous agents to run unchecked.

The system should support the owner by:

* preserving project truth
* preparing clean directives
* routing work efficiently
* verifying completion
* reducing repetition
* reducing copy/paste
* keeping work bounded
* surfacing when human approval is actually needed

---

## 5. Core Operating Model

The system runs projects through bounded work cycles:

1. Owner defines or revises the project/task goal.
2. Advisor/verifier clarifies the task and checks current state.
3. System prepares a bounded worker directive.
4. Local-first router determines whether the task should be handled locally or by a worker/model.
5. Worker executes the task.
6. Worker returns evidence/results.
7. Advisor/verifier checks results against the completion contract.
8. System produces a verdict.
9. State is updated only after adequate verification.
10. System either advances to the next task or rolls over to a clean fresh cycle.

The system should prefer bounded cycles over endless chats.

---

## 6. Non-Negotiable V1 Principle

Reducing owner babysitting is the #1 non-negotiable rule.

Any feature that increases complexity, friction, or governance burden must justify itself by reducing owner babysitting, improving verification, preserving state, or preventing repeated manual correction.

If the cockpit becomes something the owner has to babysit, it is failing.

---

## 7. V1 Non-Negotiable Features

### 7.1 Canonical Project State

V1 must maintain a canonical project state file.

This file should track:

* project name / ID
* project goal
* current phase
* current task
* current task status
* owner decisions
* active constraints
* active branch / repo location where applicable
* current role state
* current blocker(s)
* current next action
* last verified handoff
* last verification verdict
* last known evidence
* open issues / unresolved assumptions

This is required because machine state is the backbone of the system.

---

### 7.2 Canonical Task State

V1 must maintain task-level state separately from broad project state.

The task state should track:

* task ID
* task objective
* task owner role
* assigned worker role
* status
* completion criteria
* boundaries
* required evidence
* attempts
* failures
* current directive
* returned result
* verification verdict
* next action

This prevents muddy task state and repeated owner clarification.

---

### 7.3 Truth Source Model

V1 must define what counts as authoritative truth.

Truth sources may include:

* canonical project state
* canonical task state
* owner decisions
* current repo state
* active branch
* current worker directive
* last verified handoff packet
* last verified test output
* verification verdicts
* evidence files or logs
* explicitly attached source files

The system must not treat the latest model answer as truth by default.

---

### 7.4 State-Write Discipline

V1 must control when project truth can be updated.

Basic rule:

Project/task truth is updated only after advisor/verifier approval or explicit owner override.

Worker claims do not automatically update truth.

The worker can propose changes.
The verifier checks them.
The system updates state only after a valid verdict.

This prevents state fiction.

---

### 7.5 Clean Handoff Packets

V1 must generate clean role-based handoff packets.

Each handoff should include:

* receiving role
* project identity
* current task
* objective
* established truth
* current repo/project state if applicable
* explicit next action
* completion criteria
* required evidence
* boundaries / out-of-scope warnings
* unresolved issues
* owner decisions that must be respected
* what the recipient must not assume or change

This is required to eliminate new-chat handoff nightmares and copy/paste chaos.

---

### 7.6 Advisor / Verifier Role

V1 must include an advisor/verifier role.

This role is responsible for:

* shaping tasks
* writing bounded worker directives
* reviewing worker results
* comparing evidence against success criteria
* catching fake completion
* identifying missing evidence
* identifying out-of-scope changes
* preserving project truth
* preparing the next handoff
* deciding whether the task passed, failed, is blocked, or is insufficient

This is the role currently being played manually through Codex/chat workflows.

---

### 7.7 Worker Directive Builder

V1 must create clear worker directives.

A directive should include:

* task objective
* exact scope
* repo/file context
* allowed actions
* forbidden actions
* completion criteria
* required proof/evidence
* expected output format
* failure instructions
* handoff return instructions

The directive must be specific enough that the worker can execute without the owner restating the task.

---

### 7.8 Completion Contracts

V1 must require a completion contract for every task.

A completion contract defines what proof is required before a task can be marked complete.

Example for code tasks:

* changed files
* summary of changes
* test or command run
* result of the test/command
* diff summary
* known risks
* unresolved assumptions
* confirmation that no out-of-scope files were changed

Example for planning tasks:

* decision or recommendation
* alternatives considered
* constraints considered
* unresolved questions
* proposed next task
* owner decision needed or not

Example for local file tasks:

* exact action performed
* affected paths
* before/after summary
* validation result

This is one of the main protections against fake completion.

---

### 7.9 Verification Gate

V1 must include a verification gate with explicit verdicts.

Allowed verdicts:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT OF SCOPE

Definitions:

PASS:
The task met the completion criteria and returned adequate evidence.

FAIL:
The task did not meet the completion criteria.

INSUFFICIENT:
The result may be correct, but the evidence is missing, unclear, or incomplete.

BLOCKED:
The task cannot proceed without owner input, missing dependency, access, or external resolution.

OUT OF SCOPE:
The worker changed, attempted, or recommended work outside the directive.

State should not advance to completed unless the verdict is PASS or the owner explicitly overrides.

---

### 7.10 Refusal / Insufficiency Path

V1 must make it normal and acceptable for the system to say:

* result is inadequate
* evidence is missing
* task needs decomposition
* owner decision is required
* worker went out of scope
* current path should stop

This prevents rubber-stamping and fake progress.

---

### 7.11 Failure Recovery Loop

V1 must define what happens when a task fails.

Default policy:

* first failure: tighten directive and retry
* second failure: decompose task or switch method
* missing evidence: request evidence before continuing
* out-of-scope change: stop and require review
* repeated failure: mark blocked, escalate, or request owner decision

The system should not improvise failure handling each time.

---

### 7.12 Local-First Routing

V1 must prefer local deterministic tools before model usage.

Local tools include:

* PowerShell
* Git Bash
* Git
* filesystem commands
* grep/ripgrep-style search
* diff tools
* JSON/YAML validators
* other simple command-line utilities

Tasks that should often be local-first:

* file listing
* directory inspection
* renaming
* moving/copying files
* exact search
* find/replace
* diffing
* validation
* line counts
* structured extraction
* simple transformations
* repo status checks

The system should avoid burning model usage for shell-grade work.

---

### 7.13 Worker Bridge to Claude Code

V1 should support clean handoff to Claude Code as the primary worker layer.

Minimum bridge behavior:

* write directive to a known local handoff file
* tell worker what file to read
* receive worker result/evidence from a known location
* pull returned output back into the verification cycle
* update task state after verification

This can begin as a file-based bridge and become more automated later.

---

### 7.14 Manual Compact / Restart / Fork / Rollover

V1 must support clean reset and rollover.

This is the practical replacement for fuzzy, unreliable “chat health” detection.

The system should be able to:

* capture current truth
* capture current task state
* capture evidence/results
* write a fresh handoff
* start a clean advisor/verifier cycle
* start a clean worker cycle if needed
* continue without dragging bloated chat history forward

This directly addresses new-chat handoff nightmares.

---

### 7.15 Session Hygiene Triggers

V1 must include simple configurable triggers for reset/rollover suggestions.

Possible triggers:

* task cycle completed
* task failed twice
* directive changed too many times
* too many turns without state update
* too many unresolved assumptions
* worker/advisor contradiction found
* evidence missing after claimed completion
* owner manually requests reset
* new major phase begins

These should be configurable and visible.

---

### 7.16 Tone / Chattiness / Language Controls

V1 must keep communication controls visible and accessible.

Tone:

* Direct
* Balanced
* Chatty

Language:

* Plain English
* Mixed
* Technical

Behavior toggles:

* No cheerleading
* Concise by default
* Explicit uncertainty
* Separate facts from inference when relevant

These are not cosmetic. They reduce wasted turns, frustration, and repeated owner corrections.

---

### 7.17 Visible Usage / Session Pressure Awareness

V1 must show usage/session pressure in a practical way.

This should include:

* current selected model/tool
* session pressure if known
* weekly pressure if known/configured
* whether the system is estimating or reading actual usage
* warning before using tighter-limit or premium paths

The system must not pretend to know exact provider limits if it cannot measure them.

---

### 7.18 Premium Escalation Permission Rule

V1 must never silently escalate to a premium, tighter-limit, or higher-cost model/tool path.

If escalation is recommended, the system must:

* stop
* explain why in plain English
* explain what the stronger model/tool is expected to improve
* state the tradeoff
* offer cheaper/local alternatives if available
* ask permission before proceeding

This preserves trust and prevents runaway session usage.

---

### 7.19 Narrow Suggested-Tools Feature

V1 must include a narrow suggested-tools feature.

This should be rule-based or static at first, not a broad AI tool-discovery engine.

Purpose:

* prevent reinventing the wheel
* suggest local commands or common utilities
* reduce unnecessary chat-based problem solving

Examples:

* exact repo search → ripgrep
* JSON inspection → jq
* Git change review → git diff / git status
* directory structure → tree / fd
* file comparison → diff tools
* bulk rename → PowerShell

This should remain lean.

---

### 7.20 Structural Warning Signals

V1 must include measurable warning signals, not fake mind-reading metrics.

Examples:

* task has too many revisions
* too many turns since last state update
* worker claimed completion without required evidence
* repeated failure path
* unresolved assumptions accumulating
* no local tool use despite local-tool-suitable task
* output repeats previous approach
* out-of-scope file changes detected
* advisor/worker handoff mismatch

These are allowed because they are structurally observable.

The system should avoid claiming it can perfectly detect lying, truth, or model cognition.

---

### 7.21 File Attachment and Local File Access

V1 must support local files where needed.

Uses:

* project state files
* task state files
* handoff packets
* worker results
* evidence logs
* local project documents
* repo inspection
* attached source files

This is another reason the product should be desktop/local-first.

---

### 7.22 Routing / Decision Logs

V1 should log important routing and verification decisions.

Log entries should include:

* task ID
* routing choice
* local/model/worker selected
* reason
* escalation request if any
* owner approval/denial if any
* verification verdict
* failure reason if any
* state update result

These logs will allow later measurement of whether the system is reducing babysitting.

---

### 7.23 Babysitting-Reduction Metrics

V1 should track simple metrics that measure whether the project is actually solving the main problem.

Suggested metrics:

* owner interruptions per task
* repeated owner corrections
* failed handoffs
* claimed-vs-verified completion rate
* turns to task completion
* manual copy/paste actions avoided
* local-tool routes used
* insufficient worker results caught
* out-of-scope changes caught
* number of clean rollovers performed

These metrics should be simple and honest.

---

## 8. Objectively Measurable Reliability-Layer Ideas Preserved

The original conversation reliability layer included ideas like session health, answer quality, head-down detection, drift detection, and usage thrift.

Many of those ideas should remain, but only in objectively measurable form.

### Preserved in V1 as structural signals

Session health becomes:

* turn count since last state update
* task cycle length
* unresolved assumptions
* failed attempts
* directive churn
* rollover triggers
* state-update age

Answer quality becomes:

* evidence present or missing
* tool-backed or not
* file-backed or not
* completion contract satisfied or not
* unsupported claim flagged when measurable
* verification verdict

Head-down meter becomes:

* repeated output pattern
* high activity without state progress
* no tool use where local tool would fit
* too many retries on same path
* no clarification despite ambiguity
* no evidence after claimed completion

Drift detection becomes:

* out-of-scope changes
* directive mismatch
* task objective changed without owner approval
* project truth overwritten without verification
* worker touched forbidden areas

Usage thrift becomes:

* local routes used
* premium escalations avoided
* permissioned escalations
* model/tool choice logs
* manual estimated session pressure

These are objective enough to preserve.

---

## 9. V1 Must Avoid

To stay lean, V1 must avoid:

* pretending to detect truth perfectly
* pretending to detect lying perfectly
* using LLM self-assessment as a primary metric
* broad autonomous governance
* full RAG/knowledge-base complexity
* broad multi-model orchestration
* runaway parallel model feedback
* magic session-health numbers with no basis
* replacing Claude Code or Codex completely
* becoming harder to manage than the projects it controls

The goal is practical control, not process theater.

---

## 10. Recommended Product Form

The product should be a local desktop app first.

Recommended form:

* Tauri or Electron desktop app
* local workspace folder
* local project/task state files
* local handoff packet files
* local logs
* local shell integration
* file-based Claude Code bridge initially
* optional clipboard/browser bridge for models or tools that cannot be automated safely

A pure web app is not the best first form because this product needs local project and shell access.

A local web UI could be considered later, but the product should behave like a local desktop control board.

---

## 11. Suggested V1 Interface Areas

### Owner Control Board

Shows:

* current project
* current task
* current state
* next expected action
* current role
* current worker
* current verdict
* current blocker

### Directive Panel

Shows:

* current worker directive
* boundaries
* required evidence
* success criteria
* handoff target

### Verification Panel

Shows:

* returned evidence
* changed files / outputs
* proof checklist
* verdict
* missing evidence
* next action

### Local Tools Panel

Shows:

* suggested local tool route
* PowerShell/Git Bash command preview
* command result
* validation output

### Session / Usage Panel

Shows:

* current model/tool route
* estimated or known session pressure
* escalation warnings
* routing history

### Handoff / Rollover Panel

Shows:

* latest clean handoff
* reset/fork/rollover controls
* current rollover trigger warnings

### Tone / Behavior Controls

Shows:

* tone
* language level
* chattiness
* no cheerleading toggle
* concise/default behavior

---

## 12. Down-the-Road Improvements

These are preserved ideas, but not required for V1.

### 12.1 Lightweight Persistent Project Memory

Expand pinned context into a local reference layer for:

* decisions
* summaries
* reusable commands
* stable project rules
* prior task outcomes
* owner preferences

This should not become full RAG until needed.

### 12.2 Full Knowledge Base / RAG

A searchable local knowledge base may become useful later, but should wait until v1 proves what needs to be remembered.

### 12.3 Parallel Model Feedback

A controlled compare mode for hard decisions.

Rules:

* off by default
* explicit owner approval
* compact prompt only
* one-shot compare
* no runaway model conversation

### 12.4 Stronger Model/Tool Routing

More advanced task classification and routing rules based on logs and observed success.

### 12.5 Model Trust Profiles

Track where each model/tool tends to perform well or poorly.

Example:

* good at planning
* bad at evidence discipline
* verbose under stress
* prone to fake completion
* good at refactoring
* weak at repo truth

### 12.6 Escalation Ledger

Track premium escalation recommendations and whether they paid off.

### 12.7 Stronger Repo Health Diagnostics

Add project-specific repo checks:

* tests
* linting
* build checks
* dependency checks
* file-structure checks
* branch hygiene
* dirty working tree checks

### 12.8 Richer Evidence Review

Better inspection of:

* diffs
* logs
* artifacts
* screenshots
* generated files
* test outputs

### 12.9 Stronger Session Hygiene Automation

Smarter automatic rollover recommendations based on accumulated project data.

### 12.10 Broader Worker Integration

Support additional worker layers beyond Claude Code.

Possible future workers:

* Codex
* Gemini CLI
* local coding tools
* shell-script workers
* specialized verifiers

### 12.11 More Advanced Suggested Tools

Expand from static local suggestions into a curated local tool registry.

### 12.12 Better Structural Risk Detection

Improve measurable signals for:

* drift
* reactive loops
* stale assumptions
* over-chatting
* under-verifying
* repeated failed strategy

### 12.13 CCB Execution Layer Integration

Possibly use CCB or lessons from CCB as an execution/governance backend later, but only if it helps and does not bloat the cockpit.

### 12.14 Browser / Clipboard Orchestration

Support semi-automated interaction with official model UIs if direct automation is brittle or unavailable.

### 12.15 Team / Multi-Project Mode

Possibly support multiple projects, dashboards, or long-running portfolios later.

---

## 13. Superseded or Reframed Ideas

The following ideas are not discarded, but have been reframed.

### Perfect lie detection

Superseded by evidence contracts, verification gates, and structural proof requirements.

### General answer quality scoring

Reframed as provenance/evidence labels and completion-contract checks.

### Head-down meter

Reframed as structural reaction-risk signals.

### Session health meter

Reframed as session hygiene triggers, rollover warnings, task-cycle length, failed attempt count, and unresolved assumption count.

### Full autonomous project agent

Superseded by owner-facing control cockpit with bounded worker execution.

### Replacing Codex/Claude Code immediately

Superseded by controlling and coordinating worker tools first, with possible deeper replacement/integration later.

---

## 14. Success Criteria

The project succeeds if it materially reduces owner babysitting while keeping project work honest and moving.

Concrete signs of success:

* fewer repeated owner instructions
* fewer manual handoffs
* fewer copy/paste steps
* fewer fake completions slipping through
* fewer lost new-chat restarts
* clearer task status
* cleaner worker directives
* more local-tool usage where appropriate
* easier verification
* less session waste
* more consistent progress from task to task

The project fails if:

* it becomes another thing to babysit
* it adds process without reducing friction
* it creates fake confidence metrics
* it over-governs simple work
* it hides state
* it rubber-stamps bad work
* it loses project truth
* it becomes heavier than the problem it is meant to solve

---

## 15. Short Build Goal

Build the first working version of a local-first AI project control cockpit that maintains canonical project/task state, generates clean worker directives, routes deterministic work to local tools first, bridges execution to Claude Code, verifies returned work against explicit proof contracts, manages clean rollovers between chats/tasks, and reduces the owner’s manual babysitting burden.
