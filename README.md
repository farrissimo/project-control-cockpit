# Project Control Cockpit

Project Control Cockpit is a lean, local-first AI project control board designed to reduce owner babysitting in AI-assisted project work.

It keeps projects moving through bounded task cycles, clean handoffs, explicit verification, canonical machine state, and local-first routing.

## Primary Goal

Reduce owner babysitting while keeping project work honest, stateful, verifiable, and moving.

## What It Solves

Project Control Cockpit is intended to reduce:

* repeated owner instructions
* manual copy/paste between chats
* weak new-chat handoffs
* fake completion
* unclear task status
* over-chatting
* under-verifying
* state loss
* drift
* unnecessary model/session usage

## Core Workflow

```text
task selected
→ directive created
→ worker executes
→ evidence returned
→ verification verdict issued
→ state updated or rejected
→ next action is clear
```

## V1 Focus

V1 is focused on proving one bounded workflow:

1. Maintain canonical project and task state.
2. Generate a clean worker directive.
3. Hand the directive to Claude Code through a local file bridge.
4. Receive worker results and evidence.
5. Verify the result against an explicit completion contract.
6. Update state only after verifier PASS or explicit owner override.
7. Produce the next clear action.

## Non-Negotiable Rule

If the system becomes another thing the owner has to babysit, it is failing.

## Local-First Principle

Project Control Cockpit should prefer local deterministic tools before model usage.

Examples:

* PowerShell
* Git Bash
* Git
* filesystem commands
* search/diff tools
* JSON/YAML validators
* local scripts

## Initial Worker Layer

Claude Code is the initial worker execution layer.

V1 uses a simple local file bridge:

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

## Verification Verdicts

The verifier must issue one of:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE

Only PASS allows automatic state advancement.

## What V1 Avoids

V1 intentionally avoids:

* full autonomous execution
* full desktop UI
* paid API dependence
* broad model orchestration
* full knowledge base / RAG
* fake truth detection
* fake chat health scoring
* immediate replacement of Claude Code or Codex

## Documentation

Key docs:

* `docs/PROJECT_CHARTER.md`
* `docs/V1_Scope.md`
* `docs/STATE_MODEL.md`
* `docs/HANDOFF_PACKET_SPEC.md`
* `docs/COMPLETION_CONTRACT_SPEC.md`
* `docs/VERIFICATION_RESULT_SPEC.md`
* `docs/DECISIONS.md`
* `docs/ARCHITECTURE.md`
* `docs/REPO_GOVERNANCE.md`

Working intake:

* `backlog/IDEAS.md` for non-canonical ideas

Local validation:

* `powershell -ExecutionPolicy Bypass -File .\scripts\validate-cockpit-state.ps1`

## Current Status

Foundation is complete.

The repo has completed the initial proof cycles and is now in bounded V1 implementation work.

The core loop has now been exercised successfully:

```text
state → directive → worker → evidence → verification → state update or retry
```

Active next step:

* `pcc-v1-012` ("Safety Net: Clean Stop") is complete and verified PASS. Repo is paused at a natural break; next step is picking the next backlog idea to promote into a task.

## Plain-Language Task Names

Task IDs (`pcc-v1-0XX`) and idea IDs (`IDEA-0XX`) are the permanent record, but they don't say what the work actually was. This table is a plain-English memory aid, grouped by theme - it does not rename or replace the IDs used in state files, archives, or git history.

**Foundation** - the earliest setup work:

* `pcc-v1-001` - First Runbook
* `pcc-v1-002` - First Live Test
* `pcc-v1-003` - Auto State Update
* `pcc-v1-004` - Auto-Generated Directions
* `pcc-v1-005` - Single Source of Truth

**Fresh Start** - lets a brand-new chat (advisor or worker) pick up work cold, without you re-explaining anything:

* `pcc-v1-006` - Advisor Notes
* `pcc-v1-007` - Worker Ready Check
* `pcc-v1-008` - Fresh-Start Test
* `pcc-v1-009` - Ready Lock (the one check allowed to block a handoff)

**Safety Net** - protects work and lets a session end or recover cleanly:

* `pcc-v1-010` - Backup & Restore
* `pcc-v1-011` - Health Check
* `pcc-v1-012` - Clean Stop

**Honesty Checks** - keeps the system from quietly drifting or claiming false progress (not yet built; see `backlog/IDEAS.md`):

* `IDEA-008` - Activity Log
* `IDEA-003` - Format Check
* `IDEA-001` - Automatic Checks (deferred)
* `IDEA-009` - Retry Limit (deferred)

Going forward, new task titles in `task-state.json` lead with `Category: Plain Name` (e.g. `Honesty Checks: Activity Log`) so this grouping stays visible in the canonical state itself, not just in this table.
