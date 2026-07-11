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
4. IDEA-008 — **Honesty Checks: Activity Log** (non-blocking; enables honest metrics) — DONE (quality-gate half via pcc-brr4-001; retry half via pcc-brr4-002)
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
  Status: promoted-to-task
  Plain name: Honesty Checks: Activity Log
  Summary: Extend routing-log.jsonl with factual failure/retry/quality-gate events so babysitting reduction becomes measurable, not a feeling.
  Details: none
  Notes: Rank 4. Non-blocking by nature (records only), low bloat. Lower immediate payoff than IDEA-005..007 but safe and cheap; enables the honest metrics from original scope 7.22/7.23. CCB #7. Keep events factual (what happened), not narrative (why we think it happened). DELIVERED across two BRR Phase 4 Multi-Cycle Pilot cycles: pcc-brr4-001 (run #1) added the "quality-gate" half -- scripts/check-stop-conditions.ps1 and scripts/check-autonomous-gate.ps1 log stop_condition_fired / gate_blocked events; pcc-brr4-002 (run #2, cycle 1) added the "retry" half -- scripts/finalize-worker-handback.ps1 now increments task-state.json's "attempts" field on every handback and logs a retry_attempted event specifically when a handback follows a prior non-PASS verdict on the same task.

- IDEA-009: Deterministic retry governor / circuit breaker
  Status: promoted-to-task
  Plain name: Honesty Checks: Retry Limit
  Summary: Track repeated failures by stable signature (using the existing unused task-state "attempts" field) and stop useless retries automatically.
  Details: none
  Notes: Rank 7. Originally DEFER pending PCC running semi-autonomously (CCB #6; original scope 7.11). Promoted and DELIVERED via pcc-postbrr-001 (DECISION-070, 2026-07-04) once pcc-brr5-004/005 demonstrated real semi-autonomous, independently-verified cycles. scripts/finalize-worker-handback.ps1 now blocks a task (task_status: blocked, owner_decision_request populated) after a second consecutive non-PASS verdict rather than allowing a third unattended handback, per docs/BRR_POLICY.md's existing Stop-Instead-of-Guess trigger 4 / Owner Review Matrix row 9.

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

- IDEA-012: Extend doctor.ps1 with dirty-working-tree, branch-hygiene, and file-structure checks
  Status: promoted-to-task
  Plain name: Metrics & Evidence: Repo Health Checks (DELIVERED)
  Summary: doctor.ps1 currently reports state consistency, restart safety, schema format, last gate result, and active task status only. Original scope §12.7 also calls for dirty-working-tree, branch-hygiene, and file-structure checks, which doctor.ps1 does not yet have.
  Details: none
  Notes: Category C (docs/CCB_PCC_RELATIONSHIP.md §7 roadmap; DECISION-074), first of the category. Scoped against the three-filter test (babysitting / bloat / modularity per docs/PROJECT_CHARTER.md's Core Design Rule) on 2026-07-04: (1) Bloat — additive only, three more read-only checks inside an already-existing advisory script; no new gate, no new required step, no new file format, no new schema. (2) Babysitting — net reduction: a dirty tree, wrong branch, or missing/stray .cockpit file is currently only caught if the owner notices it manually; doctor now says so. (3) Modularity — doctor.ps1 already composes other scripts by invoking them and reading stdout/exit code, no shared state; the new checks read git plumbing (status/branch) and the filesystem directly and print a report line, same shape, no new shared state introduced, stays inside the DECISION-074 extractability rule. Guardrail carried into the task: doctor.ps1 must keep its `exit 0` always-advisory behavior — these new checks are additional report lines, never a new blocking condition. DELIVERED via pcc-pathC-001 (DECISION-078): all three checks added and functionally tested, including induced-failure cases for branch mismatch and a missing .cockpit/ subdirectory, both confirmed and cleanly reverted. A real pre-existing bug was found and fixed in the same task: doctor.ps1 never actually loaded project-state.json.

- IDEA-013: Richer evidence review during verification (diffs, logs, artifacts)
  Status: proposed
  Plain name: Metrics & Evidence: Deeper Verification Review
  Summary: Original scope §12.8 calls for better inspection of diffs, logs, artifacts, screenshots, generated files, and test outputs during verification, beyond what verification-result.schema.json's free-text evidence_reviewed array currently captures.
  Details: none
  Notes: Category C (docs/CCB_PCC_RELATIONSHIP.md §7 roadmap; DECISION-074), second of the category. Scoped against the same three-filter test on 2026-07-04, with a caveat 12.7 does not carry: verification here is performed by an AI verifier reading things, not by a deterministic script, so there is no structural component to bound the same way doctor.ps1's checks are bounded. (1) Bloat — real risk: without a concrete, checkable target this becomes "the verifier should look harder," a process instruction with no bounded feature behind it, the same shape of thing IDEA-001 was declined for. (2) Babysitting — ambiguous: a genuine catch (a real evidence gap that would otherwise slip through) reduces babysitting by preventing a bad PASS; a vague checklist adds a different kind of babysitting (owner now has to confirm the checklist was actually followed). (3) Modularity — neutral if kept as verifier discipline only (no schema/state change); becomes a real modularity risk if implemented by adding new required fields to verification-result.schema.json, since every script reading that file would need to account for the contract change. Status kept at `proposed` (not yet promoted): this idea is intentionally held until a concrete, nameable gap in current evidence review actually surfaces (a real incident), rather than promoted speculatively — promoting it without that concrete trigger would itself be the bloat this backlog exists to filter out.

- IDEA-014: Pre-Checkpoint Kernel Quality Audit
  Status: proposed
  Plain name: Pre-Checkpoint: Kernel Quality Check
  Summary: A one-time, tightly bounded audit of PCC's core scripts (generator, handback, verification, close-out, doctor, guardrails) against six PCC-native standards (correctness, verification-friendliness, leanness, modularity/extractability, maintainability, failure clarity), run once before the Maturity Checkpoint to answer one narrow question: is the kernel solid enough to freeze, preserve, and branch from with confidence.
  Details: backlog/details/idea-014-pre-checkpoint-kernel-audit.md
  Notes: Owner-introduced 2026-07-04, explicitly scoped as pre-checkpoint work, not a Category A/B/C item itself. Deliberately narrow by design: findings are required to sort into exactly three buckets (real risks / maintainability smells / optional polish), with polish items ignored by default -- this is the guardrail against the audit becoming an open-ended rewrite pass, a taste contest, or an excuse to expand scope before the freeze. Kept at `proposed`, not promoted: the owner's own Promotion Guardrails require the checkpoint to be reasonably near and the kernel to be mostly stable before this should be scoped as an active task -- neither is yet true (Category C's own first task, pcc-pathC-001, is still mid-verification-cycle as of this entry). Natural companion to DECISION-074's Maturity Checkpoint extractability audit (see details doc's "Relationship to the Maturity Checkpoint" section); the two could be one task or two, a call left to whoever promotes this.

- IDEA-015: Log routing decisions to routing-log.jsonl (original scope §7.22)
  Status: proposed, ready to promote
  Plain name: Record Every Local-vs-Model Routing Call
  Summary: Original scope §7.22 asked that every routing decision (local tool vs. model, with reason, escalation request if any, owner approval/denial if any) be written to the permanent log. scripts/classify-routing.ps1's classification is currently only printed to stdout and shown on the dashboard's Local Tools Panel -- it is never written to .cockpit/logs/routing-log.jsonl. Add a new log event type (e.g. routing_classified) so classify-routing.ps1's output becomes permanent, measurable history, not an ephemeral display value.
  Details: none
  Notes: Found by DECISION-101's original-scope audit (2026-07-05), triggered by the owner directly questioning whether "Path A done" meant "original scope done." Not previously tracked anywhere. Scoped against the three-filter test: (1) Babysitting -- real: without this, there is no way to later measure whether local-first routing is actually happening, which is the entire point of the §7.22/§7.23 metrics chain; (2) Bloat -- low: one new log event type, one new call site inside classify-routing.ps1 (or a thin wrapper that logs its output), no new schema; (3) Modularity -- low risk: routing-log.jsonl already tolerates multiple entry shapes (confirmed during pcc-pathD-003's Routing History panel work), so adding one more event type does not break existing readers. Natural first task for a fresh session to promote directly; ready, not blocked on anything else.

- IDEA-016: Chat media/file input — paste/drop images and a "+" button to attach files
  Status: proposed (OWNER-REQUESTED 2026-07-09)
  Plain name: Chat: Add Images & Files
  Summary: Let the owner paste or drop images into the chat, and add files via a "+" button, so visual context and documents can be handed to the worker directly instead of described in text.
  Details: none
  Notes: OWNER EXPLICITLY REQUESTED BOTH (image copy/paste AND a "+" file button) on 2026-07-09, and correctly flagged that they were never captured. Truth at time of writing: the app has NO attach/image UI at all (chat is text-only; the worker is even told it is a "text-only chat panel"); image paste appeared NOWHERE in repo truth; file-attach existed only as a weak conditional deferral in docs/DECISIONS.md ("a lean file-attach last, only if lack of it proves to cause babysitting"). Recorded here as a first-class proposed feature so the request is not lost again. This is REAL feature work (handling pasted/dropped image data, passing files/images through to the `claude -p` worker, and the composer UI), NOT a config fix — needs scoping before promotion. Supersedes/absorbs the DECISIONS.md file-attach note as the canonical placeholder for chat media input. Part of the IDEA-017 guiding principle (Claude-Code-parity where it reduces friction, not a full clone).

- IDEA-017: Steerable chat — interject/redirect while the worker is still running
  Status: proposed (OWNER-REQUESTED 2026-07-09)
  Plain name: Chat: Steer While It Works
  Summary: Let the owner steer or redirect a reply while Claude is still working (send a follow-up / course-correct mid-response) instead of waiting for each turn to finish — the way Codex and Claude Code allow.
  Details: none
  Notes: OWNER-REQUESTED 2026-07-09 ("steering a conversation instead of waiting on Claude to respond — needed; this is something Codex is able to do"). Today pcc:send is strict request/response: the composer disables (busy=true) until the worker's turn completes, so the owner cannot interject. REAL feature work (cancelable/streaming worker turns + a queued/interrupt input path), not a config fix. GUIDING PRINCIPLE the owner set 2026-07-09 for ALL the chat-parity asks (IDEA-016 image paste, IDEA-016 file "+", IDEA-017 steering): the chat should match Claude Code's genuinely-useful affordances WHERE THEY REDUCE FRICTION, but must NOT become a full Claude-Code clone — replicating everything is bloat. Scope each affordance by "does the owner actually need it", not "does Claude Code have it".

- IDEA-018: PCC Engineering Assurance Plan — permanent standard for integrity-critical code
  Status: proposed (OWNER-AUTHORED 2026-07-10)
  Plain name: Engineering: Assurance Standard
  Summary: Adopt the PCC Engineering Assurance Plan as the standing engineering standard — one authority per domain, claims must match implementation, no swallowed critical failures, malformed input fails closed, recoverable mutations, provenance for displayed truth, commit-bound verification, the Claude-worker/Codex-verifier workflow, risk-based test thinking, a regression rule, test isolation, backup discipline, and an anti-bloat constraint.
  Details: docs/ENGINEERING_ASSURANCE_PLAN.md
  Notes: OWNER-AUTHORED 2026-07-10 during the PCC data-trust recovery; the authoritative content lives in docs/ENGINEERING_ASSURANCE_PLAN.md (added on branch fix/data-truth-recovery). This is a STANDARD/practice, not a discrete build task — it governs how the remaining recovery slices and future core features are built and verified (Parts 2 and 9). It also defines two future work items to promote once the recovery lands: the one-time existing-code hardening sweep (Part 7) and final system hardening (Part 10). Explicitly anti-bloat: adds no owner governance, no scoring/percentages, and no new UI unless a real product-truth problem requires it. This backlog entry exists only so the plan is discoverable from the idea intake and its future-work parts are not lost; see the doc for the full standard.

- IDEA-019: Verification-workflow hardening — toward independent, self-observed proof
  Status: proposed (owner discussion 2026-07-11)
  Plain name: Verification: Independent Proof Loop
  Summary: Strengthen the canonical build/verify loop at its two real weak points — the worker can't observe the one independent proof (CI), and it writes both the code and its tests — without adding gates or governance.
  Details: backlog/details/idea-019-verification-workflow-improvements.md
  Notes: Came out of a 2026-07-11 owner "how could this workflow significantly improve" discussion, after the Part 7 hardening batch (I1/I3/I8) + the CI unit-suite fix on branch fix/data-truth-recovery. Five ranked improvements; the two real gaps they attack: (1) every local "N/N passed" is Claude's self-reported run and Codex reviews code not runs, so the only independent execution proof — the GitHub Actions run on push — is NOT observable by the worker (no gh/token), leaving the loop ending in owner babysitting; (2) the same agent authors code AND tests, so a weak test gives a false green. RECOMMENDED (lean, reduce owner involvement): Item 1 = close the CI observation loop (read-only Actions token + a ci-result.ps1 that wraps the existing app/ci-status.js reader, reports the real conclusion+URL, fails honest never green); Item 2 = mechanically prove each regression test FAILS on the pre-fix code (red→green), killing weak/decoration tests. PAPERCUT: Item 3 = a deterministic Codex-review wrapper (fixes the heredoc-ate-the-diff and sandbox-ran-the-tests-and-false-FAILed mistakes seen in practice; must reuse verify-work.ps1/second-opinion.ps1, not add a 4th Codex caller). HELD until a concrete failure justifies them (anti-bloat, like IDEA-001): Item 4 = adversarial Codex PANEL for CRITICAL-class changes only; Item 5 = durable commit-bound verification provenance (verifier+sha+verdict as a git note/trailer — addresses the verification-origin seam, but governance-adjacent). Full implementation/what-it-fixes/how-it-improves-PCC + three-filter scoping per item in the details doc. Operationalizes two IDEA-018 principles (independent proof, commit-bound verification).
