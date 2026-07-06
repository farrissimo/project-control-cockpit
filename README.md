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

`scripts/classify-routing.ps1` (`DECISION-075`, first Path-A task per `DECISION-074`) makes this principle a checkable per-task signal: a read-only, advisory, non-gating classifier that flags whether the active task looks local-tool-suitable. It never redirects or executes work.

## Communication Defaults

The owner's standing tone/language/behavior preferences live in `project-state.json`'s `communication_prefs` and are auto-surfaced into every generated worker directive (`DECISION-076`, `DECISION-009`, §7.16), so a fresh worker session applies them without the owner restating them.

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
* `docs/BRR_PLAN.md` (current BRR program plan)
* `docs/BRR_POLICY.md` (BRR Phase 1 policy content: Owner Review Matrix and successors)
* `docs/CCB_PCC_RELATIONSHIP.md` (audit determination: PCC and CCB are separate products, Path A now / Path B deferred — see `DECISION-074`)
* `docs/PATH_A_PLAN.md` (Path A plan of record: Category D UI broken into phases/tasks/subtasks — see `DECISION-087`; first deliverable `scripts/generate-dashboard.ps1` — see `DECISION-089`)

Working intake:

* `backlog/IDEAS.md` for non-canonical ideas

Local validation:

* `powershell -ExecutionPolicy Bypass -File .\scripts\validate-cockpit-state.ps1`

## Current Status

**V1 is complete** (see `DECISION-021`). The core loop was exercised successfully across 15 real bounded cycles (`pcc-v1-001` through `pcc-v1-015`):

```text
state → directive → worker → evidence → verification → state update or retry
```

Every V1 Done Criterion (`docs/V1_Scope.md`) was demonstrated repeatedly, all five verification verdicts were exercised for real, and the ready backlog items (`IDEA-005` through `IDEA-011`, `IDEA-003`) are delivered. `IDEA-001` and `IDEA-009` remain deliberately deferred per their own recorded reasoning.

The project has completed **BRR Phase 1's policy foundation** (`DECISION-027`) and has moved into **BRR Phase 2** (`current_phase: brr-phase-2`) per `DECISION-028`. Reducing owner babysitting (`DECISION-001`) remains the explicit top priority. The full BRR program plan is recorded canonically in `docs/BRR_PLAN.md`. Phase 2 work so far (`pcc-brr2-001` through `pcc-brr2-009`) has fielded the task safety class into live flow, made worker handback and verifier close-out deterministic repo-native paths (`DECISION-030`, `DECISION-032`, `DECISION-034`, `DECISION-035`), captured the Owner-Decision Capture Flow (`DECISION-037`), recorded the Safe Next-Task Drafting Rules (`DECISION-038`/`DECISION-039`) - PCC's rule set for auto-promoting the next task within an already-approved lane, on the principle that owner approval is for direction changes, not routine in-lane continuation - added an advisory Automatic Stop Triggers detector (`DECISION-040`) that surfaces the deterministically-checkable "stop instead of guess" conditions without hard-gating anything, and recorded the Acceptance Boundary Rules (`DECISION-041`) defining per task safety class what PCC may self-accept vs. must leave for review. With all five Phase 2 deliverables defined, the owner chose to prove the model rather than pause: `pcc-brr2-011` wired the fail-closed self-gate on PCC's own autonomous path (`DECISION-042`) — `scripts/check-autonomous-gate.ps1`, which blocks PCC's self-promotion/self-acceptance unless the stop-check is CLEAR and the acceptance boundary permits it, gating PCC's autonomous path only (owner-directed work is never gated). Two supervised pilots followed: a non-blind cycle (`pcc-brr2-012`, `DECISION-043`) that proved the mechanism (one clean autonomous proceed, one judgment-caught direction fork), and a blind cycle (`pcc-brr2-013`, `DECISION-044`) where the owner supplied 5 candidates without disclosing traps — PCC called all 5 correctly (5/5) before reveal, including both disguised forks, while the mechanical gate alone was shown to be content-blind and would have waved every candidate through.

**BRR Phase 2 is now complete (`DECISION-045`).** The walk-away model has meaningful positive evidence — including a passed blind pilot — but is deliberately **not** declared fully proven in an absolute sense; the honest open question is how much further proof is wanted before widening unattended authority, not whether Phase 2 itself is done. PCC has moved to **BRR Phase 3** (`current_phase: brr-phase-3`, Verification Hardening), with optional future adversarial pilot testing available if stronger confidence is wanted later. Codex is currently unavailable; per `DECISION-033`/`DECISION-036`, Claude Code is temporarily performing both worker and verifier roles, with ChatGPT as a secondary (remote-only) review input, disclosed explicitly in each cycle's verification result.

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
