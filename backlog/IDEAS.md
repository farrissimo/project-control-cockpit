# Idea Backlog

This file is the single intake location for non-canonical ideas.

Ideas are placeholders, not active tasks and not project truth.

If an idea needs more detail, add one supporting file under `backlog/details/` and link it from the placeholder entry below.

## Entry Format

```markdown
- IDEA-000: Short title
  Status: proposed | under-review | promoted-to-task | rejected | archived
  Plain name: Category: Plain Name (non-technical, 2-4 words - see docs/REPO_GOVERNANCE.md "Plain-Language Naming")
  Summary: One short sentence.
  Details: backlog/details/<file>.md or none
  Notes: Optional short note.
```

## Priority Ranking (2026-07-03 owner review)

Ranked under one filter: **babysitting reduction first, no governance bloat, and nothing that risks blocking task completion.** Promotion to an active task remains a separate advisor/owner step (DECISION-013).

1. IDEA-005 — **Safety Net: Backup & Restore** — DONE (only Tier-1 item that *structurally* cannot block completion)
2. IDEA-006 — **Safety Net: Health Check** — DONE (advisory / non-gating)
3. IDEA-007 — **Safety Net: Clean Stop** — DONE
4. IDEA-008 — **Honesty Checks: Activity Log** (non-blocking; enables honest metrics) — NEXT UP
5. IDEA-003 — **Honesty Checks: Format Check** — **conditional: warn-by-default, not a hard halt**
6. IDEA-001 — **Honesty Checks: Automatic Checks** — **defer: highest bloat + completion-blocking risk**
7. IDEA-009 — **Honesty Checks: Retry Limit** — defer until PCC runs semi-autonomously

Deferred entirely (fail the filter for V1): see IDEA-010.

Already delivered / fulfilled: IDEA-004 (delivered by pcc-v1-007..009); IDEA-002 (fulfilled by this review).

## Entries

- IDEA-001: Add optional CI or pre-commit enforcement for PCC state and governance checks
  Status: proposed
  Plain name: Honesty Checks: Automatic Checks
  Summary: Add lightweight automated enforcement so state validation and governance rules are checked without relying only on manual discipline.
  Details: none
  Notes: Rank 6. DEFER. Under the 2026-07-03 filter this carries the highest bloat and completion-blocking risk — it is automation whose whole job is to stop things. Revisit only if manual discipline actually starts failing, and only after IDEA-003's check set is finalized so automation wraps it once.

- IDEA-002: Harvest still-live roadmap items from archived scope into tracked backlog placeholders
  Status: archived
  Summary: Review the archived original scope and promote any still-relevant future ideas into explicit backlog placeholders.
  Details: none
  Notes: Fulfilled by the 2026-07-03 advisor review of "PCC Original Project Scope.md", V1_Scope.md, and the CCB lessons list. Still-live items were captured as IDEA-005 through IDEA-010 below. Archived rather than deleted to preserve the intake history.

- IDEA-003: Enforce live state against JSON schemas at runtime
  Status: promoted-to-task
  Plain name: Honesty Checks: Format Check
  Summary: Wire schema validation into the local validate/advance/generate flow so schemas become enforced gates instead of documentation only.
  Details: none
  Notes: DELIVERED via pcc-v1-015, as advisory-only per the original conditional note (not a hard gate). A pre-task spike confirmed pwsh's Test-Json correctly handles our schemas (additionalProperties: false, enums, nullable unions, and verification-result.schema.json's if/then block). scripts/check-schemas.ps1 validates the three canonical JSON files and is composed into doctor.ps1 as one OK/ISSUE finding; doctor.ps1 still always exits 0. This was the last open V1 backlog item.

- IDEA-004: Fail validation when the live worker directive diverges from generator output
  Status: promoted-to-task
  Plain name: Fresh Start: Worker Ready Check (delivered)
  Summary: Extend local validation so a stale or hand-edited worker directive cannot silently drift from canonical task state.
  Details: none
  Notes: DELIVERED. Implemented across pcc-v1-007 (worker restart-safety), pcc-v1-008 (dual-restart proof), and pcc-v1-009 (handoff-restart-safety enforcement gate + handoff-gate.json). Kept for history; no further action.

- IDEA-005: Pre-task protected-file backup / restore point
  Status: promoted-to-task
  Plain name: Safety Net: Backup & Restore
  Summary: Auto-create a local restore point of core .cockpit/scripts files before risky cycles, independent of git commit hygiene.
  Details: backlog/details/idea-005-pretask-backup.md
  Notes: Rank 1. Promoted to active task pcc-v1-010 on 2026-07-03. Clears all three filters cleanly: reduces babysitting (cheap recovery, less supervision fear), adds no governance, and structurally cannot block completion (a snapshot is passive). Highest safety-per-unit-complexity from the CCB list (#1).

- IDEA-006: `doctor` / repo health-check command (advisory, non-gating)
  Status: promoted-to-task
  Plain name: Safety Net: Health Check
  Summary: One command that composes the existing checks and returns a single readable "is the repo safe to hand off right now?" answer.
  Details: backlog/details/idea-006-doctor-healthcheck.md
  Notes: Rank 2. Promoted to active task pcc-v1-011 on 2026-07-03. Big babysitting win (replaces "which of 4 scripts do I run?" with one answer), low bloat (composes existing scripts). CRITICAL: must be read-only/advisory and never a mandatory blocking precondition — the existing enforce-handoff gate stays the separate blocking step. Natural home for IDEA-003 as an advisory line. CCB #11.

- IDEA-007: `safe-stop` / clean-rollover command
  Status: promoted-to-task
  Plain name: Safety Net: Clean Stop
  Summary: One command that ends a session in a guaranteed-resumable state so the next fresh session avoids "where were we?" overhead.
  Details: backlog/details/idea-007-safe-stop.md
  Notes: Rank 3. Promoted to active task pcc-v1-012 on 2026-07-03. Reduces babysitting, low bloat, non-blocking (runs after work, not as a gate). Also closes a named-but-unbuilt V1 component (original scope 7.14, V1_Scope.md 9, DECISION-010). Must respect state-write discipline (does not advance status).

- IDEA-008: Append-only failure / event log
  Status: proposed
  Plain name: Honesty Checks: Activity Log
  Summary: Extend routing-log.jsonl with factual failure/retry/quality-gate events so babysitting reduction becomes measurable, not a feeling.
  Details: none
  Notes: Rank 4. Non-blocking by nature (records only), low bloat. Lower immediate payoff than IDEA-005..007 but safe and cheap; enables the honest metrics from original scope 7.22/7.23. CCB #7. Keep events factual (what happened), not narrative (why we think it happened).

- IDEA-009: Deterministic retry governor / circuit breaker
  Status: proposed
  Plain name: Honesty Checks: Retry Limit
  Summary: Track repeated failures by stable signature (using the existing unused task-state "attempts" field) and stop useless retries automatically.
  Details: none
  Notes: Rank 7. DEFER. Real ROI only once PCC runs semi-autonomously, which it does not yet (cycles are owner-driven). CCB #6; original scope 7.11 (failure recovery loop). Revisit alongside any autonomy work.

- IDEA-010: Deferred non-V1 concepts (holding entry)
  Status: rejected
  Summary: Concepts reviewed on 2026-07-03 that fail the V1 filter (bloat / governance / no current fit); kept only so the rationale is not lost.
  Details: none
  Notes: (a) Explicit workflow state machine with many named states (CCB #4) — CCB itself flags as heavy; PCC's status-transition sketch suffices until multiple agents/gates exist. (b) Provider identity / fallback authority tracking (CCB #9) — CCB says less necessary for lightweight tools; PCC has fixed roles (Claude worker, Codex advisor). (c) UI freshness indicators / stale-state warnings (CCB #10) — V1 explicitly has no UI; handoff-gate.json already covers staleness in non-UI form. "Rejected" means rejected for V1, not permanently; reopen if the product grows a UI or multi-agent execution.

- IDEA-011: Fix close-out truth-surface staleness in advance-cockpit-state.ps1
  Status: promoted-to-task
  Plain name: Safety Net: Wrap-Up Fix
  Summary: advance-cockpit-state.ps1 copies verification.next_action verbatim and points last_verified_handoff at the live (not archived) directive path, so both go stale the moment close-out (doctor/refresh/archive) actually runs, until someone manually corrects them.
  Details: none
  Notes: DELIVERED via pcc-v1-014. advance-cockpit-state.ps1 now defaults PASS's next_action to a durable statement instead of copying the verifier's own pre-close-out checklist, and accepts -ArchivedDirectivePath so last_verified_handoff points at the archived copy (both optional, falling back to prior behavior when omitted). Demonstrated on pcc-v1-014's own close-out with zero manual correction needed, unlike pcc-v1-011/pcc-v1-012. Recommended close-out order (archive, then advance, then doctor, then log, then commit) documented in docs/HANDOFF_PACKET_SPEC.md.
