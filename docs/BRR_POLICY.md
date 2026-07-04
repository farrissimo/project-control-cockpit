# BRR Policy

> **Canonical status.** This is canonical BRR (Babysitter-Reduced Role) policy,
> narrow in purpose: it defines the permission model for unattended progress
> per `docs/BRR_PLAN.md` Phase 1 and `DECISION-022`. It does not implement any
> runtime enforcement, task-class execution logic, or automatic gating — that
> is explicitly Phase 2 (`docs/BRR_PLAN.md` Section 5). This doc will grow
> across BRR Phase 1's four bounded tasks (`pcc-brr1-001` through
> `pcc-brr1-004`); this first pass adds the Owner Review Matrix only.

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
| 11 | Self-verification on a task type deemed too risky for self-acceptance | Before acceptance | Self-verification is the highest-risk operating compromise currently in play (`docs/BRR_PLAN.md` Section 6.A); some task types must not be self-accepted regardless of who executed them. Which task types this covers is defined by Task Safety Classification (`pcc-brr1-002`, not yet written) — until that classification exists, treat any task whose subject matter is judgment-heavy (e.g. policy content, verification design) rather than deterministically checkable as requiring independent review, consistent with `DECISION-022`'s recommendation for Phase 1 tasks themselves. |

### Notes on scope

* This matrix names *when* to stop. It does not define *how* PCC halts, *how* it records an owner-decision request, or *how* execution resumes after the owner responds — that operational mechanics is Phase 2 (`docs/BRR_PLAN.md` Section 5, Phase 2 "Owner-Decision Capture Flow").
* This matrix does not define task safety classes (Class A/B/C/D) — that is `pcc-brr1-002`.
* This matrix does not define the Stop-Instead-of-Guess trigger list (ambiguous scope, conflicting truth surfaces, weak evidence, etc.) as its own policy — that is `pcc-brr1-003`. Rows 9 and 10 above overlap with that upcoming policy by necessity, since both are named explicitly in `docs/BRR_PLAN.md` Phase 1's own deliverable list; `pcc-brr1-003` should cross-reference this matrix rather than redefine these two cases.
* This matrix does not define the operating-definition glossary (e.g. what exactly "safe unattended" or "escalation" mean) — that is `pcc-brr1-004`.

---

## Relationship To Existing Verdicts

Rows 9 and 10 map onto verdicts PCC already has:

* Row 9 (repeated failure) relates to `FAIL` recurring without new evidence.
* Row 10 (insufficient evidence) is `INSUFFICIENT` (`docs/VERIFICATION_RESULT_SPEC.md`).

No new verdict is introduced by this matrix. `pcc-brr1-003` (Stop-Instead-of-Guess Policy) is expected to formalize this mapping further; this document only establishes that the matrix is meant to reuse the existing five verdicts (`PASS`/`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE`), not add to them.
