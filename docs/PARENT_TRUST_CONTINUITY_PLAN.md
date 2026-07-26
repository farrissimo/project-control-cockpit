# Parent trust & continuity fix plan (phased, bounded)

**Status:** Active. Authorized by the owner 2026-07-25 after the LE trust-trial day-1 session.
**Rule:** Every problem observed in Land Evaluator that traces back to the parent is fixed HERE, in
PCC, not in the child. Each task is bounded and runs the canonical workflow: (spec if non-trivial) →
(ADR if a significant decision) → build → CI green on the exact commit → **Codex as technical advisor
throughout and primary independent verifier** → done. One task at a time. No self-certification.

Supersedes the loose tally in [PCC_FIX_BACKLOG.md](PCC_FIX_BACKLOG.md) (kept as origin notes).

## Goal (the one test every task is judged by)
Reduce the chance PCC itself interrupts real work or forces the owner to operate the machine. The
day-1 failure mode: the owner became the **manual relay** between chats, re-enabling build sessions
and shuttling continuations. That is the babysitting this plan must remove.

## Execution order (LOCKED — Codex-advised 2026-07-25)
**1.1 → 2.1 → 3.2 → 1.2 → 2.2 → 3.1.** Rationale: auto-continue over a safety stop (1.2) is only
defensible AFTER the active limiter is explicit (2.1) and limits are project-local rather than hidden
defaults (3.2). Task 1.1 is the smallest safe first unit — it directly reduces owner relay with a
bounded blast radius and does not weaken any core safety stop. The phase groupings below stay thematic;
this line is the sequence we actually work in.

## Phasing (thematic; work in the locked execution order above)

### Phase 1 — Build & task continuity (unblock forward motion; kill the relay)
The two things that stopped LE from moving without the owner in the loop.

- **Task 1.1 — Build-authority continuity across "Continue in fresh chat."**
  LE origin: backlog #5. Continued chats land read-only; the owner must re-click "Enable build
  session" and forgets, so tools look randomly disabled.
  Bounded scope: either safely inherit build authority into the continued chat, OR make re-approval a
  single visible step in the continue flow. No broader authority-model changes.
  Needs ADR (0021 — authority model change). Acceptance (EARS): WHEN a build-enabled chat is continued
  in a fresh chat THE SYSTEM SHALL either carry build authority forward or present a one-click
  re-approval in the continue flow, never leave it a hidden memory task.

- **Task 1.2 — Run a bounded governed task to completion without the human relaying.** (highest value, highest risk)
  LE origin: backlog #6. A governed task (reproduce→fix→prove→commit→verify) exceeds `--max-turns`
  (hit the 40-cap at 41 turns) and stops mid-task; the owner must paste a continuation.
  Bounded scope: safe auto-continue past a per-message turn-cap stop for a whitelisted governed task,
  under a HARD ceiling (max auto-continues, max cumulative spend) with live visibility, so the owner is
  informed, not operating. This modifies a safety mechanism — design conservatively, Codex-heavy.
  Needs ADR (0023 — 0022 is the stop-policy reframe). Acceptance (EARS): WHEN a governed task hits the per-message turn cap mid-task AND
  auto-continue is in force AND the hard ceiling is not exceeded THE SYSTEM SHALL continue the task in a
  new segment and report progress, WITHOUT requiring the owner to relay; AND WHEN the hard ceiling is
  reached THE SYSTEM SHALL stop and say so plainly.
  **Codex-advised design constraints (2026-07-25) — bind these into ADR-0023:**
  - Whitelisted governed task type ONLY; no general auto-continue.
  - Continue ONLY on the specific `max_turns` stop — never on cost/authority/error stops.
  - Hard ceilings: small `max_auto_continues` (1-2), cumulative turn cap, cumulative USD cap, wall-clock cap.
  - Require a stable task ID + same workspace/chat lineage before continuing (guard context drift).
  - No replay of side effects across segments (no duplicate commits / re-run destructive steps).
  - Force an explicit STOP on uncertainty, missing state, or a failed resume — never a silent retry.
  - Emit a visible "continued because X; remaining budget Y" event per segment.
  - Failure modes to avoid: silent retries, recursive continue, auto-bypassing approval, auto-retry after errors,
    authority escalation from over-broad inheritance, hiding a real failure behind a "helpful" continuation.

### Phase 2 — Legibility of stops (predict, don't reverse-engineer)
- **Task 2.1 — Surface the binding limiter in plain language.**
  LE origin: backlog #2 (Codex #4/#6). Four limiters (`max_turns`, `max_turn_usd`, `max_chat_usd`,
  real 5-hour usage); the owner can't tell which is nearest or which fired.
  Bounded scope: show the nearest/active limiter and, on a stop, which one stopped it. May extend
  ADR-0018 rather than a new ADR.
- **Task 2.2 — Live turn cost + progress visibility during a long turn.**
  LE origin: backlog #3 (Codex #3). Owner watches "working…" for 7-8+ min with no view of cost or
  which cap is near. Bounded scope: live turn spend + coarse progress; no full activity firehose.

### Phase 3 — Trust-surface correctness + parity
- **Task 3.1 — Port the monotonic chat-length meter fix into PCC.**
  LE origin: backlog #1. Do this AFTER LE proves its fix; apply the identical fix to PCC's
  `app/renderer/renderer.js` + `chat-health.js` so every future child inherits it.
- **Task 3.2 — New-project scaffolding writes `.cockpit/state/usage-limits.json`.**
  LE origin: backlog #4 (TRIAL-LE-01 root). New children must ship the owner-tunable limits file the
  app actively reads, not fall back to hidden code defaults.

## Working agreement
- Codex is consulted as technical advisor at each task's design point and is the primary verifier at
  each task's close (verdict recorded verbatim; `codex exec`, stdin piped `$null` on Windows).
- A restore point is taken before each build cycle (`scripts/backup-protected-files.ps1 -Action Backup`).
- If a task proves bigger than "bounded," STOP and bring the reshaped scope to the owner before diving in.

## Log
- 2026-07-25: Plan created and authorized. Next: Codex advisory review of the phasing + Task 1.2 risk,
  then begin Task 1.1 (or the smallest safe unit Codex recommends) under ADR-0021.
