# BRR Policy

> **Canonical status.** This is canonical BRR (Babysitter-Reduced Role) policy,
> narrow in purpose: it defines the permission model for unattended progress
> per `docs/BRR_PLAN.md` Phase 1 and `DECISION-022`. It does not implement any
> runtime enforcement, task-class execution logic, or automatic gating — that
> is explicitly Phase 2 (`docs/BRR_PLAN.md` Section 5). This doc will grow
> across BRR Phase 1's four bounded tasks (`pcc-brr1-001` through
> `pcc-brr1-004`); it now covers the Owner Review Matrix (`pcc-brr1-001`) and
> Task Safety Classification (`pcc-brr1-002`).

## Purpose

Define, concretely, the cases where PCC must stop and wait for owner review
before unattended progress continues or before work is accepted as done.

This is policy, not enforcement. Nothing in this document causes a script to
block, gate, or halt anything. Applying these rules inside live task flow is
Phase 2 work.

---

## Owner Review Matrix

Each row states a case where PCC must stop and wait for explicit owner
review — either before execution starts, or before a result is accepted as
done, or both. "Stop" means: do not guess, do not proceed on an assumption,
and do not self-accept; surface the situation and the choice to the owner.

| # | Case | Stop point | Why |
|---|------|------------|-----|
| 1 | Change to project goal | Before execution | The goal is the one fact every other decision derives from; only the owner may change it (`docs/PROJECT_CHARTER.md`). |
| 2 | Change to architecture or major design direction | Before execution | Structural changes are expensive to reverse and shape all future work. |
| 3 | Ambiguous next-step selection where more than one valid path exists | Before execution | Picking a direction is a project decision, not a bounded task; guessing here recreates the babysitting problem BRR exists to remove (`docs/BRR_PLAN.md` Section 6.D). |
| 4 | New external dependency with meaningful tradeoffs | Before execution | New dependencies carry cost, security, and maintenance tradeoffs the owner has not yet weighed. |
| 5 | Destructive or irreversible operation | Before execution | Examples: force-push, history rewrite, deleting canonical state, dropping backups. Irreversible actions must never be taken on an assumption. |
| 6 | Security, secrets, credentials, or data-risk changes | Before execution | Risk here is asymmetric — a wrong guess can cause real harm outside the repo. |
| 7 | Changes to truth surfaces, the verification model, or governance rules | Before execution | These define what "done" and "true" mean project-wide; changing them without review can invalidate prior verified work (`docs/STATE_MODEL.md`, `docs/REPO_GOVERNANCE.md`). |
| 8 | High-risk scope changes | Before execution | Scope creep disguised as a small change is a known failure mode; high-risk scope needs an explicit owner call, not a worker judgment call. |
| 9 | Repeated failure after bounded retries | Before further execution | Continuing to retry the same approach without new evidence is guessing, not progress; the owner should decide whether to change approach, scope, or task. |
| 10 | Insufficient evidence with non-trivial uncertainty | Before acceptance | Thin or ambiguous evidence must not be accepted as PASS on the assumption it's probably fine; this is exactly what the `INSUFFICIENT` verdict exists for (`docs/VERIFICATION_RESULT_SPEC.md`). |
| 11 | Self-verification on a task type deemed too risky for self-acceptance | Before acceptance | Self-verification is the highest-risk operating compromise currently in play (`docs/BRR_PLAN.md` Section 6.A); some task types must not be self-accepted regardless of who executed them. Which task types this covers is defined by Task Safety Classification (see "Task Safety Classification" below) — Class B tasks may execute unattended but must not be self-accepted, consistent with `DECISION-022`'s recommendation for Phase 1 tasks themselves. |

### Notes on scope

* This matrix names *when* to stop. It does not define *how* PCC halts, *how* it records an owner-decision request, or *how* execution resumes after the owner responds — that operational mechanics is Phase 2 (`docs/BRR_PLAN.md` Section 5, Phase 2 "Owner-Decision Capture Flow").
* This matrix does not define task safety classes (Class A/B/C/D) directly — see "Task Safety Classification" below (`pcc-brr1-002`).
* This matrix does not define the Stop-Instead-of-Guess trigger list (ambiguous scope, conflicting truth surfaces, weak evidence, etc.) as its own policy — that is `pcc-brr1-003`. Rows 9 and 10 above overlap with that upcoming policy by necessity, since both are named explicitly in `docs/BRR_PLAN.md` Phase 1's own deliverable list; `pcc-brr1-003` should cross-reference this matrix rather than redefine these two cases.
* This matrix does not define the operating-definition glossary (e.g. what exactly "safe unattended" or "escalation" mean) — that is `pcc-brr1-004`.

---

## Task Safety Classification

Every task must be classified into one of four classes before execution. The
class governs two separate questions, not one: whether PCC may *execute*
without owner review, and whether PCC may *accept* (self-verify) the result
without owner or independent review. A class can restrict one without
restricting the other — see the "Execution" and "Acceptance" columns below.

| Class | Meaning | Execution | Acceptance | When it applies |
|-------|---------|-----------|------------|------------------|
| **A — Safe unattended** | Task may be executed and its result accepted without owner review. | Proceed without owner review. | May be self-verified or verified normally; no extra review required by class alone. | Bounded, low-risk, easily-checked work: local deterministic scripts, mechanical edits, tasks with clear pass/fail evidence, work that touches no truth surface named in the Owner Review Matrix. |
| **B — Safe to execute, review before acceptance** | Task may be executed unattended, but its result must be reviewed before it is accepted as done. | Proceed without owner review. | Must not be self-accepted. Requires independent verifier review (or explicit owner override) before advancing to `complete`, per `DECISION-006`/`DECISION-016`. | Work that is safe to attempt but whose correctness is judgment-heavy rather than mechanically checkable — e.g. policy/prose content, verification-model changes, anything Owner Review Matrix row 11 flags as unsafe to self-accept. |
| **C — Owner approval required before execution** | Task may not even start until the owner explicitly approves it. | Stop. Do not execute until the owner reviews and approves. | N/A until approved; once approved, the class the owner assigns for execution/acceptance going forward applies. | Any task matching an Owner Review Matrix "before execution" row (rows 1–8): project-goal changes, architecture/design direction, ambiguous next-step selection, new external dependencies, destructive/irreversible operations, security/secrets/data-risk changes, truth-surface/verification-model/governance changes, high-risk scope changes. |
| **D — Blocked** | Task must not proceed at all right now. | Stop. Do not execute. | N/A. | Repeated failure after bounded retries with no new evidence (matrix row 9), or any case where no trusted way to verify the task exists yet. Distinct from Class C: Class C is unblocked by owner *approval*; Class D means the task itself is not currently safe or possible to run, and needs the owner to change the task, evidence, or approach before it can be reclassified — approval alone does not resolve it. |

### Relationship to the Owner Review Matrix

The Owner Review Matrix (above) names *when* to stop; this classification
names *what class a task is* so that "when to stop" can be checked once per
task rather than re-derived from the matrix every time. The mapping is direct,
not a new judgment layer:

* Matrix rows 1–8 ("before execution") are Class C by definition — if a task
  matches one of these rows, it is Class C, full stop.
* Matrix row 9 ("repeated failure after bounded retries") is Class D — the
  task itself is not currently safe to keep running, distinct from merely
  needing approval.
* Matrix rows 10–11 ("before acceptance": insufficient evidence non-trivial
  uncertainty, and self-verification on risky task types) describe why a task
  is Class B rather than Class A — safe to execute, but the result cannot be
  self-accepted.
* A task that matches none of the matrix's rows defaults to Class A, unless
  something else about the task (not yet covered by the matrix) clearly makes
  self-acceptance unsafe, in which case it is Class B until the matrix or a
  future policy names the specific case.

This means classifying a task is mostly a lookup against the matrix already in
this document, not an independent judgment call — the matrix and the classes
are two views of the same underlying policy, not two separate policies that
could drift apart.

### Notes on scope

* This section defines the four classes and how they map to the Owner Review
  Matrix. It does not implement where in `task-state.json` or the worker
  directive a class gets recorded, how a worker or verifier checks it, or any
  automatic stop/gate behavior — that fielding work is Phase 2
  (`docs/BRR_PLAN.md` Section 5, Phase 2 "Task Classification Fielding").
* This section does not redefine or duplicate the Stop-Instead-of-Guess
  trigger list (`pcc-brr1-003`) or the operating-definitions glossary
  (`pcc-brr1-004`); it uses plain-language descriptions of "safe unattended,"
  "review before acceptance," etc. here only so the classes are legible on
  their own, and expects `pcc-brr1-004` to formalize those terms without
  contradicting the usage here.

---

## Relationship To Existing Verdicts

Rows 9 and 10 map onto verdicts PCC already has:

* Row 9 (repeated failure) relates to `FAIL` recurring without new evidence.
* Row 10 (insufficient evidence) is `INSUFFICIENT` (`docs/VERIFICATION_RESULT_SPEC.md`).

No new verdict is introduced by this matrix. `pcc-brr1-003` (Stop-Instead-of-Guess Policy) is expected to formalize this mapping further; this document only establishes that the matrix is meant to reuse the existing five verdicts (`PASS`/`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE`), not add to them.
