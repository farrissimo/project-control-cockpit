# BRR Policy

> **Canonical status.** This is canonical BRR (Babysitter-Reduced Role) policy,
> narrow in purpose: it defines the permission model for unattended progress
> per `docs/BRR_PLAN.md` Phase 1 and `DECISION-022`. It does not implement any
> runtime enforcement, task-class execution logic, or automatic gating — that
> is explicitly Phase 2 (`docs/BRR_PLAN.md` Section 5). This doc covers all
> four of BRR Phase 1's bounded tasks: the Owner Review Matrix
> (`pcc-brr1-001`), Task Safety Classification (`pcc-brr1-002`), the
> Stop-Instead-of-Guess Policy (`pcc-brr1-003`), and the Operating Definitions
> (`pcc-brr1-004`) — completing BRR Phase 1's policy foundation.

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
* This matrix does not define the Stop-Instead-of-Guess trigger list (ambiguous scope, conflicting truth surfaces, weak evidence, etc.) as its own policy — see "Stop-Instead-of-Guess Policy" below (`pcc-brr1-003`). Rows 9 and 10 above overlap with that policy by necessity, since both are named explicitly in `docs/BRR_PLAN.md` Phase 1's own deliverable list; the Stop-Instead-of-Guess Policy cross-references this matrix rather than redefining these two cases.
* This matrix does not define the operating-definition glossary (e.g. what exactly "safe unattended" or "escalation" mean) — see "Operating Definitions" below (`pcc-brr1-004`).

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
  trigger list (see "Stop-Instead-of-Guess Policy" below, `pcc-brr1-003`) or
  the operating-definitions glossary (see "Operating Definitions" below,
  `pcc-brr1-004`); it uses plain-language descriptions of "safe unattended,"
  "review before acceptance," etc. here only so the classes are legible on
  their own, formalized without contradiction in "Operating Definitions."

---

## Stop-Instead-of-Guess Policy

The rule underneath every row of the Owner Review Matrix and every Class
C/D case is the same: when continuing would mean guessing, stop and surface
the situation instead of inventing an answer or pushing through. This section
names the concrete triggers for that stop, and ties each one to an existing
verification verdict — no new verdict is introduced anywhere in this policy.

| # | Trigger | What it looks like | Verdict / stop point | Relationship to Matrix / Class |
|---|---------|---------------------|-----------------------|----------------------------------|
| 1 | Ambiguous scope | The task objective or boundaries admit more than one valid reading, discovered mid-task rather than resolved up front. | Stop before proceeding on either reading. Reported as `BLOCKED` if execution has already started; otherwise the task should not have left `ready_for_worker`. | Same case as Owner Review Matrix row 3 (ambiguous next-step selection) — Class C. Discovering ambiguity mid-task does not downgrade it to a worker judgment call. |
| 2 | Conflicting truth surfaces | Two canonical sources (e.g. `docs/DECISIONS.md` vs. live state, or two docs) disagree about the same fact. | Stop and report the conflict rather than silently picking one source. `BLOCKED`. | Resolving which source is correct is itself a truth-surface question — Owner Review Matrix row 7, Class C. |
| 3 | Weak or missing evidence | A completion claim is supported by thin, partial, or unclear evidence. | `INSUFFICIENT` — do not accept as `PASS` on the assumption it's probably fine. | Directly Owner Review Matrix row 10; the reason a task is Class B rather than Class A. |
| 4 | Repeated failure with no new evidence | The same approach is retried without anything changing that would make the next attempt more likely to succeed. | `FAIL` is recorded; further unattended retries stop. | Directly Owner Review Matrix row 9, Class D — the task itself needs the owner to change approach, scope, or evidence before it may proceed again. |
| 5 | Out-of-scope drift | Work expands beyond the directive's allowed scope, even if well-intentioned. | `OUT_OF_SCOPE`. | Not itself a matrix row (the matrix governs starting a task; this governs staying inside one once started), but it is exactly the failure mode the Owner Review Matrix and Task Safety Classification exist to prevent from going unnoticed — a Class A or B task that drifts out of scope must still stop and report, not finish quietly. |
| 6 | No trusted way to verify a risky task | The task's correctness cannot be checked by any method currently available (no deterministic check, no qualified reviewer, no clear evidence standard). | `BLOCKED` until a verification method exists. | Relates to Owner Review Matrix row 11 / Class B's acceptance restriction: if even independent review has no reliable way to check the work, the task cannot be accepted at all yet, not just self-accepted. |
| 7 | Unresolved owner-facing tradeoff | A genuine tradeoff surfaces (cost, risk, direction) that only the owner can weigh. | Stop before deciding either way. `BLOCKED`, or handled as Class C if discovered before execution starts. | Same shape as Owner Review Matrix rows 4 and 8 (new dependency tradeoffs, high-risk scope changes) — the common thread is that a tradeoff belongs to the owner, not the worker or verifier. |

### Verdict reuse, not expansion

No new verdict, status, or state is introduced by this policy. Every trigger
above resolves to one of the five verdicts PCC already has
(`docs/VERIFICATION_RESULT_SPEC.md`): `PASS` is never the outcome of a
trigger firing; the other four (`FAIL`, `INSUFFICIENT`, `BLOCKED`,
`OUT_OF_SCOPE`) cover every case in the table. This mirrors and completes what
`DECISION-024` already established for the Owner Review Matrix's rows 9–10:
the matrix, the classification, and this policy are three views of one
underlying rule set, expressed for three different purposes (when to stop,
what class a task is, what to call it when a stop actually happens) — not
three separate rule sets that happen to agree today.

### Notes on scope

* This policy names triggers and their verdict mapping. It does not implement
  automatic detection of any trigger (e.g. a script that flags "conflicting
  truth surfaces"), does not change how `scripts/advance-cockpit-state.ps1` or
  any other script behaves, and does not gate anything — applying these
  triggers in live task flow remains Phase 2 (`docs/BRR_PLAN.md` Section 5).
* This policy does not define the operating-definitions glossary (e.g. the
  precise meaning of "escalation") — see "Operating Definitions" below
  (`pcc-brr1-004`), which uses the verdict mapping here as-is rather than
  redefining it.

---

## Operating Definitions

These are the standing definitions for terms already used, informally, across
the three sections above. They do not change how any of those sections
behave; they make the vocabulary explicit and stable so future BRR work (and
Phase 2 fielding) can rely on one meaning per term rather than re-deriving it
from context each time.

**Safe unattended** — a task may be executed and its result accepted without
any owner or independent review. This is exactly Task Safety Class A. A task
is safe unattended only if it matches no Owner Review Matrix row and nothing
about it makes self-acceptance unsafe (see Class A's "When it applies").

**Safe with review** — a task may be executed without owner review, but its
result must not be self-accepted; it requires independent verifier review (or
explicit owner override) before advancing to `complete`. This is exactly Task
Safety Class B. "Review" here means the acceptance-time check described in
`DECISION-006`/`DECISION-016` and `docs/VERIFICATION_RESULT_SPEC.md` — the
same review Codex already performs as advisor/verifier under `DECISION-023`,
not a new or heavier review step.

**Owner decision** — a point where continuing requires the owner's judgment,
not the worker's or verifier's, because the choice is the owner's to make
(goal, direction, risk tolerance, tradeoff). An owner decision is *needed*
whenever a task matches one of the Owner Review Matrix's "before execution"
rows (rows 1–8, Task Safety Class C) or when a Stop-Instead-of-Guess trigger
surfaces a tradeoff only the owner can weigh (trigger 7). Needing an owner
decision does not by itself mean the task is unsafe or broken — it means the
next step is the owner's to take, not PCC's to guess. Since `pcc-brr2-007`
(`DECISION-037`), an active owner decision is captured structurally in
`task-state.json`'s `owner_decision_request` field (`docs/STATE_MODEL.md`)
rather than only as prose, and surfaced in both generated handoff artifacts
(`docs/HANDOFF_PACKET_SPEC.md`) — this is capture and visibility only, not an
automatic stop mechanism; Phase 2's remaining items (automatic stop triggers,
acceptance-boundary enforcement) are separate future work.

**Blocked** — a task must not proceed at all right now, and owner approval
alone does not resolve it; the task, its evidence, or its approach must
change first. This is exactly Task Safety Class D and the `BLOCKED`
verification verdict (`docs/VERIFICATION_RESULT_SPEC.md`), and covers
Owner Review Matrix row 9 (repeated failure after bounded retries) and
Stop-Instead-of-Guess triggers 2 and 6 (conflicting truth surfaces; no
trusted way to verify a risky task). Blocked is distinct from an owner
decision: an owner decision is unblocked by the owner simply choosing;
blocked is only unblocked once something about the task itself changes.

**Insufficient evidence** — a completion claim exists but is not adequately
supported: thin, partial, ambiguous, or missing the proof the completion
criteria require. This is exactly the `INSUFFICIENT` verification verdict
(`docs/VERIFICATION_RESULT_SPEC.md`), Owner Review Matrix row 10, and
Stop-Instead-of-Guess trigger 3. Insufficient evidence is an acceptance-time
finding (the work may have happened; the proof of it did not clear the bar) —
distinct from `blocked`, which stops execution or further progress itself.

**Escalation** — the act of surfacing a stop (an owner decision, a blocked
state, insufficient evidence, or any other Stop-Instead-of-Guess trigger) to
the owner instead of resolving it unattended. Escalation is not itself a
class, verdict, or status; it is what happens when one of those conditions is
reported rather than acted on — the concrete behavior of "stop instead of
guess." Escalation happens today by the worker or verifier writing the
blocker into `.cockpit/result/worker-result.md` / `verification-result.json`
and stating it plainly to the owner; a more formal escalation *mechanism*
(where a request is recorded, tracked, and resolved) is explicitly Phase 2's
"Owner-Decision Capture Flow" (`docs/BRR_PLAN.md` Section 5), not defined
here.

### Reconciliation notes

* These six terms were already in informal use across `pcc-brr1-001` through
  `pcc-brr1-003`; this section does not change any prior usage, only makes it
  explicit. Cross-checked against all three prior sections while drafting —
  no contradiction was found between this glossary and the Owner Review
  Matrix, Task Safety Classification, or Stop-Instead-of-Guess Policy.
* "Owner decision" and "escalation" are related but distinct: an owner
  decision is the *condition* (a choice only the owner can make exists);
  escalation is the *action* (surfacing that condition instead of guessing).
  A single stop event has both — e.g. Class C triggers an owner decision, and
  escalation is how PCC actually stops and reports it.
* No new verdict, status, or state is introduced by this section, consistent
  with every prior BRR Phase 1 policy task.

### Notes on scope

* This section defines terms only. It does not implement an escalation
  mechanism or Phase 1 fielding — the Owner-Decision Capture Flow that gives
  "owner decision" a live home was fielded later in Phase 2 (`DECISION-037`).
* With this section, `docs/BRR_POLICY.md` contains all four BRR Phase 1 policy
  deliverables named in `docs/BRR_PLAN.md`. Phase 2 (applying them in live
  task flow) is underway; its own additions to this document follow below.

---

## Safe Next-Task Drafting Rules

This is BRR Phase 2's third deliverable (`docs/BRR_PLAN.md` Phase 2 item 3),
implementing `DECISION-038`'s operating principle: **owner approval is for
direction changes, not for routine continuation inside an already-approved
lane.** These rules define *when PCC may draft and promote the next task on
its own.* They do not, by themselves, switch on unattended execution — see
"What these rules do not yet enable" below.

### What counts as an already-approved lane

A lane is a stretch of work whose *scope and priority the owner has already
reviewed*. Auto-promotion is allowed only inside such a lane. Concretely, an
approved lane is one of:

* the deliverables of an owner-approved phase plan — e.g. the numbered
  deliverables of a BRR phase in `docs/BRR_PLAN.md` (`DECISION-022`,
  `DECISION-028`); or
* an owner-ranked backlog priority in `backlog/IDEAS.md` (its "Priority
  Ranking" reflects an explicit owner review).

A brand-new idea that has *not* been through that review is **not** an approved
lane and is not auto-promotable until the owner reviews it. Automation is
earned by that prior review, not assumed (`DECISION-038`).

### The auto-promotion gate (all must be true)

PCC may draft and promote the next task without a fresh per-task owner
approval only when **all** of the following hold:

1. the current task is `complete` / verified `PASS`;
2. repo health and state checks are clean (`scripts/doctor.ps1`,
   `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`);
3. the next task is inside an already-approved lane (above);
4. its purpose and scope are already sufficiently fleshed out (bounded
   objective, allowed/forbidden scope, completion criteria all derivable
   without new owner intent);
5. it solves a real project problem aligned with PCC's north star (reduce
   owner babysitting);
6. it is bounded and classifiable under Task Safety Classification;
7. no new owner-level decision is required (no Owner Review Matrix "before
   execution" case applies);
8. it changes no project goal, architecture, authority model, cost model, or
   safety posture.

If any condition fails, PCC does not self-promote; it stops and surfaces the
situation through the Owner-Decision Capture Flow (`owner_decision_request`,
`DECISION-037`) instead.

### Forks are a hard stop, not a tie PCC breaks

"More than one defensible next step" is an Owner Review Matrix row 3 case
(Class C) and trips the Owner-Decision Capture Flow — PCC must **not** pick
among genuine strategic alternatives for itself. This rule is additive within
already-approved lanes only; it does not weaken or shrink any existing stop
condition in the Owner Review Matrix or Stop-Instead-of-Guess Policy.

### Every auto-promotion must be falsifiable

When PCC self-promotes a task, it must record *why the promotion was in-lane*,
in the task's `promotion_basis` field (`docs/STATE_MODEL.md`): which approved
lane, which backlog-priority or phase-plan item, and a one-line justification
that it is continuation rather than a fork. This field travels with the task
and is archived with it, so a wrong call is catchable after the fact by the
verifier rather than resting on PCC's word. A task the owner drafted directly
leaves `promotion_basis` null (no self-promotion to justify).

### What these rules do not yet enable

These are drafting/promotion rules only. Full unattended draft-and-run — where
PCC promotes *and executes* the next task and walks a bounded sequence without
the owner — is **not** live on these rules alone. It also requires Phase 2
item 4 (Automatic Stop Triggers: making the halts here fire automatically) and
item 5 (Acceptance Boundary Rules: what a class may self-accept vs. must leave
for review). Per `DECISION-038`'s safe-sequencing clause, unattended execution
switches on only once items 4 and 5 are also built and verified, because safe
unattended running depends on those guarantees existing, not just on knowing
when a promotion is allowed.
