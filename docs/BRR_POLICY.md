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

## Governing Principles (BRR Autonomous Operation)

Two owner-stated principles govern the whole "when may PCC proceed vs. must it
stop" model — both the Safe Next-Task Drafting Rules (when PCC may proceed) and
the Automatic Stop Triggers (when it must stop) below sit under them:

1. **Owner approval is for direction changes, not routine continuation inside
   an already-approved lane.**
2. **The pre-task prep work is what justifies the automation.**

Together: PCC earns the right to move on its own by the depth of prior review
already invested in a lane — not as a default. Where that prep exists and the
next step is obvious in-lane continuation, PCC proceeds; where direction is in
question or the prep does not justify the move, it stops and asks. This is why
a self-promotion must be able to point at the reviewed lane and priority that
justify it (`promotion_basis`): showing the prep *is* showing the earned
automation. No prep, no lane, no automation (`DECISION-038`).

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

---

## Automatic Stop Triggers

This is BRR Phase 2's fourth deliverable (`docs/BRR_PLAN.md` Phase 2 item 4).
It is the "stop" half of the model the Governing Principles describe: where the
Safe Next-Task Drafting Rules say when PCC may proceed, this says when it must
stop instead of guessing, and makes the *deterministically-checkable* stop
conditions detectable automatically.

`scripts/check-stop-conditions.ps1` is the mechanism (`DECISION-040`). It reads
live state and reports **CLEAR TO PROCEED** or **STOP** with reasons, detecting:

* an unresolved `owner_decision_request` on the active task (an owner decision
  is pending, `DECISION-037`);
* a repo-health `[ISSUE]` reported by `doctor.ps1`;
* an active task in an attention-needed status (`blocked`, `verified_fail`,
  `insufficient_evidence`, `out_of_scope`);
* a self-promoted task (`promotion_basis` populated) whose recorded `lane` does
  not reference a recognized approved-lane source — a *formal* check that the
  justification points at a real approved lane, not a check of whether the
  cited lane/priority is semantically correct (that stays the verifier's job).

### Advisory and non-gating, on purpose

The check is advisory: it **always exits 0** and never hard-blocks any script,
task, or owner-directed action. A reported STOP is a recommendation to stop
instead of guess — to be surfaced through the Owner-Decision Capture Flow or
resolved — not an automatic halt of the whole system. This is deliberate: the
plan's Phase 2 special caution is "controlled forward motion, not friction; do
not let this become automatic blocking everywhere." `scripts/enforce-handoff-restart-safety.ps1`
remains the only script permitted to gate a handoff. Automatic stop triggers
constrain PCC's *own* autonomous forward motion; they do not gate the owner.

### What it honestly does not detect

Some stop conditions are not mechanically decidable, and this check does not
pretend to detect them (`DECISION-008`, no fake intelligence): whether more
than one defensible next step exists (a fork), whether work aligns with the
north star, and whether a new owner-level decision is required. These remain a
matter of judgment, surfaced through `owner_decision_request` when recognized.
The check certifies only the mechanical conditions above — a CLEAR result means
"no *detectable* stop condition," not "no stop condition of any kind."

### What this does not yet enable

Detecting and surfacing stop conditions is not the same as *automatically
acting* on them, and this deliverable does not switch on unattended execution.
Full unattended draft-and-run still additionally requires Phase 2 item 5
(Acceptance Boundary Rules) and a verified pilot, per `DECISION-038`.

---

## Acceptance Boundary Rules

This is BRR Phase 2's fifth and final deliverable (`docs/BRR_PLAN.md` Phase 2
item 5, `DECISION-041`). It answers a different question from the stop
triggers: not "may PCC proceed / must it stop," but — once work is done —
**what may PCC accept as complete on its own, and what must wait for review?**

It defines no new concept; it makes the acceptance half of Task Safety
Classification explicit as a boundary:

| Class | May PCC self-accept its own result? |
|-------|-------------------------------------|
| **A — Safe unattended** | Yes. A Class A result may be self-verified/self-accepted, provided the stop-condition check is also CLEAR (no mechanically-detectable stop). |
| **B — Safe to execute, review before acceptance** | **No.** A Class B result must not be self-accepted; it requires independent verifier review, or an explicit owner override, before advancing to `complete` (`DECISION-006`/`DECISION-016`, Owner Review Matrix row 11). |
| **C — Owner approval required before execution** | N/A — a Class C task does not execute unattended, so unattended acceptance never arises. |
| **D — Blocked** | N/A — a Class D task does not proceed at all. |

### This constrains PCC's own acceptance, not the owner

These boundaries govern only what *PCC* may accept when acting autonomously.
They place **no** gate, block, or friction on owner-directed work: the owner
may accept, override, or direct anything at any time. Acceptance boundaries are
a limit PCC observes on *itself*, never a limit imposed on the owner.

### Interaction with the current fallback

Under the `DECISION-033`/`DECISION-036` degraded fallback (Codex unavailable),
every cycle is currently self-verified with explicit disclosure. That is a
temporary, disclosed compromise — not the acceptance model this section
describes. This section defines the **target** (restored two-role) state: when
independent verification is available, Class B results route to it rather than
being self-accepted. Until then, the fallback's disclosure requirement stands
in for the boundary, and the fact that a Class B result was self-accepted under
fallback is recorded honestly in each verification result.

### This does not switch on unattended execution

Defining what PCC *may* self-accept does not, by itself, make PCC run
unattended, and this deliverable builds no enforcement. With all five Phase 2
deliverables now defined, the machinery exists on paper, but full unattended
draft-and-run remains **off** and requires two further, deliberate steps that
are explicitly *not* taken here: wiring the gate (below), and a verified pilot
(`DECISION-038`).

### The self-gate on PCC's autonomous path (now wired)

`scripts/check-autonomous-gate.ps1` (`DECISION-042`, `pcc-brr2-011`) wires the
seam this section described. Before PCC self-promotes or self-accepts a step
**unattended**, that gate must report `GATE: PROCEED`, which it does only when
**both**:

* `scripts/check-stop-conditions.ps1` reports CLEAR; **and**
* the task's class permits the action per the table above (self-acceptance
  requires Class A; Class B must not self-accept).

Unlike the advisory stop-detector (which always exits 0), this gate is
**fail-closed**: exit 0 = PROCEED, any non-zero = do not proceed. It applies
**only** to PCC's self-promotion / autonomous-continuation path — none of the
owner-directed scripts (`finalize-worker-handback.ps1`, `close-out-verified-task.ps1`,
`verify-handback-guardrails.ps1`, `doctor.ps1`, `advance-cockpit-state.ps1`,
`enforce-handoff-restart-safety.ps1`) call it, so **owner-directed work is never
gated by it**. `scripts/check-stop-conditions.ps1` itself remains advisory and
unchanged; this gate composes it, it does not replace it.

Wiring the gate does **not** by itself start unattended operation. It is the
guard that *would make* unattended continuation safe; the first actual gated
autonomous run is the **supervised** pilot (`pcc-brr2-012`). Until that pilot
runs and is reviewed, no task runs unattended. `PROCEED` also remains a floor,
not a guarantee — see "CLEAR is necessary, not sufficient" above; judgment
conditions still govern regardless of the gate.

### Standing checks for future autonomy tasks (secondary review, `pcc-brr2-011`)

Two properties of this gate are safe *now* but are not structurally
guaranteed, so every future autonomy task must re-check them rather than
assume them:

* **Narrow-by-call-site is not structural.** The gate is safe against gating
  owner work only because no owner-directed script currently invokes it — not
  because the repo prevents that. Every future autonomy task must re-verify
  that no owner-path script calls `check-autonomous-gate.ps1`.
* **`self_promote` covers mechanical stops only.** `self_promote` gating
  leans entirely on `check-stop-conditions.ps1`, which detects mechanical
  stops. Judgment-heavy promotion mistakes — a fork, a direction choice, or a
  new-owner-decision case disguised as continuation — are **not** automatically
  caught and remain the judgment layer's responsibility (`DECISION-008`). A
  `GATE: PROCEED` on `self_promote` never licenses proceeding through a
  genuine fork.

### CLEAR is necessary, not sufficient

Even where self-acceptance is permitted (Class A) and the stop-check is CLEAR,
that means only *no mechanically-detectable stop was found* — not "safe in
every sense." The judgment-based conditions remain outside automatic detection
(`DECISION-008`): whether more than one defensible next step exists (a fork),
whether the work aligns with the north star, and whether a new owner-level
decision is required. A CLEAR stop-check plus a self-acceptable class is a
floor, not a guarantee; genuine judgment still governs.

---

## Verification Depth Policy

This is BRR Phase 3's first deliverable (`docs/BRR_PLAN.md` Phase 3 item 1,
`pcc-brr3-001`). It answers a question the prior sections leave open: the
Acceptance Boundary Rules say *whether* a result may be self-accepted or must
go to review; this section says *how much rigor* that review (self- or
independent) must actually apply. Not every task in scope for review deserves
the same depth of checking — treating a one-line mechanical script fix and a
change to the verification model itself with identical rigor either wastes
effort or under-checks the riskier case.

### The three levels

* **light** — Confirm the mechanical result matches its deterministic check
  (a script's exit code, a schema validator's pass/fail, a byte-for-byte
  diff against an expected output). No independent read-through of reasoning
  or prose is required, because there is no reasoning or prose to
  mis-verify — the check *is* the evidence.
* **normal** — Read the worker's evidence against each completion criterion
  individually, run the standard guardrail scripts
  (`scripts/verify-handback-guardrails.ps1`), and confirm the diff matches
  the allowed scope with no drift. This is the default depth for ordinary
  work that is not purely mechanical but also does not touch a truth
  surface.
* **strict** — Everything `normal` requires, plus: read the full changed
  content itself (not a diff summary), explicitly cross-check it line-by-line
  against every other canonical doc, schema, or decision it references or
  could contradict, and record that cross-check in the verification result
  rather than asserting it happened. Self-verification performed at `strict`
  depth still requires the standard `DECISION-036` disclosure wording, and
  independent secondary review (currently GPT, per `DECISION-036`) is
  recommended before the result is treated as settled, even though it cannot
  substitute for local guardrail re-verification (`DECISION-031`/`DECISION-032`).

No new verdict is introduced. Depth governs how the verifier reaches a verdict
(`PASS`/`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE`), not which verdicts
exist.

### Mapping: Task Safety Class × task type → depth

Depth is a lookup against two already-existing facts about a task — its
Task Safety Class (`docs/BRR_POLICY.md` "Task Safety Classification") and its
task type — not a fresh judgment call each cycle. Three task types cover the
cases seen so far:

* **Deterministic/mechanical** — correctness is fully checkable by rerunning
  a script, a validator, or a diff; no prose judgment is involved (e.g. a
  schema field addition, a state-transition script, a mechanical rename).
* **Judgment-heavy / prose** — correctness depends on reading and judging
  written content (policy wording, documentation, explanatory text) that does
  **not** define or alter a truth surface.
* **Truth-surface / governance-affecting** — the change defines or alters a
  truth surface itself: the verification model, task safety classification,
  the Owner Review Matrix, Stop-Instead-of-Guess triggers, schemas, or the
  state machine's semantics (Owner Review Matrix row 7, `docs/BRR_POLICY.md`).

| Task Safety Class | Task type | Verification depth |
|---|---|---|
| A | Deterministic/mechanical | light |
| A | Judgment-heavy / prose (non-truth-surface) | normal |
| A | Truth-surface / governance-affecting | not applicable — a truth-surface change is an Owner Review Matrix row 7 case and is Class C by definition (see "Task Safety Classification" above), so no Class A task can be truth-surface-affecting |
| B | Deterministic/mechanical | normal (Class B's acceptance restriction already requires independent review or owner override regardless of depth; `normal` is the floor since some non-triviality is why the task is Class B rather than Class A) |
| B | Judgment-heavy / prose (non-truth-surface) | normal |
| B | Truth-surface / governance-affecting | strict |
| C | any | not applicable — a Class C task does not execute unattended, so no verification-depth question arises until the owner approves it and it is (re)classified for execution |
| D | any | not applicable — a Class D task does not proceed |

This BRR Phase 3 policy task (`pcc-brr3-001`) is itself Class B,
judgment-heavy prose that edits a truth surface (`docs/BRR_POLICY.md`,
`docs/DECISIONS.md`) — by its own table, it requires **strict** depth, which
is the depth actually applied to verify it.

### Relationship to Acceptance Boundary Rules

These two sections answer different questions and do not overlap:
Acceptance Boundary Rules gate *whether* PCC may self-accept a result at all
(Class A yes if the stop-check is CLEAR; Class B no, regardless of depth).
Verification Depth governs *how thoroughly* whichever party performs the
review — self or independent — must check the work once review is happening.
A Class B result is never self-accepted no matter its depth; a Class A result
may be self-accepted, but a truth-surface Class A task cannot exist (see the
mapping table), so self-acceptance under this policy is always at `light` or
`normal` depth, never `strict`.

### Notes on scope

* This section defines the three levels and the class × type mapping. It does
  not implement automatic depth selection, does not modify
  `scripts/verify-handback-guardrails.ps1` or any other script to enforce a
  minimum depth, and does not change `verification-result.json`'s required
  shape (`docs/VERIFICATION_RESULT_SPEC.md`) — applying this policy inside a
  script is future work, not taken here, consistent with how prior BRR policy
  sections were defined before being fielded.
* This section does not change Self-Verification Restrictions (BRR Phase 3
  item 2), Out-of-Scope Detection Hardening (item 3), or the Inadequate-Work
  Return Path (item 4) — those remain separate, not-yet-drafted Phase 3 tasks
  per `docs/BRR_PLAN.md`.
* No existing verdict, task safety class, Owner Review Matrix row, or stop
  condition is redefined or weakened by this section. Cross-checked against
  Task Safety Classification, the Acceptance Boundary Rules, and the
  Stop-Instead-of-Guess Policy while drafting — no contradiction was found.

---

## Self-Verification Restrictions

This is BRR Phase 3's second deliverable (`docs/BRR_PLAN.md` Phase 3 item 2,
`pcc-brr3-002`). `DECISION-033`/`DECISION-036` created a temporary, standing
exception letting Claude Code perform both worker and verifier roles when
Codex is unavailable. That exception itself is **not** reopened, narrowed,
expanded, or redefined here — this section answers the narrower question
Phase 3 poses given that the exception exists: what limits apply on top of
it, so "we self-verify when Codex is out" does not quietly become "we
self-verify anything, at any depth, forever."

### Which task classes may be self-verified

* **Class A** — may be self-verified as a standing rule, not a fallback
  artifact. This is already true under the Acceptance Boundary Rules (a
  Class A result is self-acceptable when the stop-check is CLEAR); this
  section does not add a new restriction here.
* **Class B** — may be self-verified **only** while the `DECISION-033`
  fallback is actively in effect (Codex unavailable), and only with the
  standard `DECISION-036` disclosure wording present in the verification
  result. Self-verification of a Class B task is never a standing right —
  outside the fallback, `DECISION-006`/`DECISION-016`'s normal rule applies
  and a Class B result requires Codex or an explicit owner override, exactly
  as before this section existed.
* **Class C / Class D** — never reach a self-verification question, because
  neither executes unattended (Task Safety Classification).

### Which task types require a second reviewer or stronger checks, beyond depth alone

The Verification Depth Policy (above, `pcc-brr3-001`) already requires
`strict` depth for any Class B, truth-surface-affecting task. That raises
rigor, but rigor alone does not fix every case: a self-verifying party
reading its own change more carefully is still the same party. One category
is restricted further, past what depth alone can fix:

**A task whose subject matter is the self-verification fallback itself, the
autonomous gate, the Acceptance Boundary Rules, or the Owner Review
Matrix/Task Safety Classification's core definitions must not be closed out
by self-verification alone, even under the active `DECISION-033` fallback and
even at `strict` depth.** This means: any task that would modify
`DECISION-033`/`DECISION-036`'s own text or authorization scope, alter
`scripts/check-autonomous-gate.ps1` or `scripts/check-stop-conditions.ps1`'s
behavior, redefine a Task Safety Class's meaning, or change what a class may
self-accept. For such a task, self-verification is not a depth problem to
solve with more rigor — it is a **circularity problem**: the same party whose
judgment could be wrong about the change is the only one checking it, on the
exact subject where being wrong matters most. The correct response is not
"apply `strict` depth and proceed" but to route the task to an actual second
party: Codex, once available, or an explicit owner review. If neither is
available, the task is reported `BLOCKED` (Stop-Instead-of-Guess trigger 6,
"no trusted way to verify a risky task exists yet") rather than self-verified
and closed.

This restriction is prospective and narrow. It governs *future* tasks that
would touch those specific mechanisms — it does not reopen or re-decide any
already-built and already-verified Phase 2 autonomy decision
(`DECISION-038` through `DECISION-042`, `DECISION-045`); those stand as
recorded. Ordinary BRR policy work that *adds* an adjacent, non-redefining
section (as `pcc-brr1-001` through `pcc-brr1-004`, `pcc-brr2-008` through
`pcc-brr2-010`, and this document's own two Phase 3 sections so far all did)
is not, by itself, "modifying the self-verification fallback, the autonomous
gate, the Acceptance Boundary Rules, or Task Safety Classification's core
definitions" — it is Class B, truth-surface-affecting work under the
Verification Depth Policy's existing `strict` row, not this narrower
circularity case.

### A named bootstrap, not a hidden exception

Both `pcc-brr3-001` and this task, `pcc-brr3-002`, were themselves
self-verified under the `DECISION-033` fallback, before this restriction
existed to constrain them. Neither modifies `DECISION-033`/`DECISION-036`'s
text, the autonomous gate scripts, or an existing class's definition — both
add new, adjacent policy sections, which is exactly the ordinary Class B
`strict`-depth case above, not the circularity case. This is the same
bootstrap every earlier BRR policy foundation task went through (the Task
Safety Classification itself was drafted and accepted before it existed to
classify its own drafting task) — named here explicitly rather than glossed
over, consistent with `DECISION-008`'s standing rejection of overstating what
has actually been checked.

### What extra evidence is required when self-verification is allowed

Beyond the standard `DECISION-036` disclosure wording (already required in
every self-verified `verification-result.json`), a self-verified Class B
result must also record, in `risks` or `summary`:

1. Confirmation of which Verification Depth Policy row applied (`normal` or
   `strict`) and why.
2. For `strict`-depth results specifically: that the required line-by-line
   cross-check against other canonical docs/schemas was actually performed,
   not merely asserted (per the Verification Depth Policy's own `strict`
   definition).
3. An explicit statement that the task does **not** fall into this section's
   circularity restriction (i.e., it does not modify the self-verification
   fallback, the autonomous gate, the Acceptance Boundary Rules, or a Task
   Safety Class's core definition) — or, if it does, that it was **not**
   self-closed and was instead routed to `BLOCKED` or an explicit owner
   review.
4. Whether GPT secondary review was performed this cycle or explicitly
   marked not performed, per the existing `DECISION-036` wording.

No new verdict or `verification-result.json` field is introduced; all four
items are recorded in the existing `risks`/`summary` fields, the same
mechanism `DECISION-036`'s disclosure wording already uses.

### Notes on scope

* This section restricts self-verification further; it does not touch
  `DECISION-033`/`DECISION-036`'s actual authorization text, does not revisit
  whether the fallback should exist, and does not reopen any Phase 2
  autonomy decision.
* This section does not implement automatic detection of the circularity
  case (e.g., a script that flags "this diff touches
  `check-autonomous-gate.ps1`") — applying it is a verifier judgment call for
  now, the same non-enforcement posture every other BRR policy section takes
  before being fielded.
* This section does not define Out-of-Scope Detection Hardening (Phase 3 item
  3) or the Inadequate-Work Return Path (item 4) — those remain separate,
  not-yet-drafted Phase 3 tasks.
* No existing verdict, task safety class, Owner Review Matrix row, or stop
  condition is redefined or weakened. Cross-checked against Task Safety
  Classification, the Acceptance Boundary Rules, the Verification Depth
  Policy, and `DECISION-033`/`DECISION-036` while drafting — no contradiction
  was found; `DECISION-033`/`DECISION-036`'s own authorization text is
  unchanged.

---

## Out-of-Scope Detection

This is BRR Phase 3's third deliverable (`docs/BRR_PLAN.md` Phase 3 item 3,
`pcc-brr3-003`). Every task directive already carries `boundaries.allowed`
and `boundaries.forbidden` (`docs/STATE_MODEL.md`), and every verification
result already has an `out_of_scope_findings` field
(`docs/VERIFICATION_RESULT_SPEC.md`). What has been missing is a concrete,
checkable definition of *what counts as out-of-scope* beyond "not in the
allowed list" — this section names three specific failure modes and a
structural procedure for catching each, rather than leaving the check to
whatever the verifier happens to think to look at.

Per `docs/BRR_PLAN.md` Phase 3's own special caution, this stays structural
and measurable. It does not attempt to detect whether a change's *meaning* or
*intent* silently drifted — that is exactly the "perfect hallucination
detection" the plan warns against chasing. It defines checks a verifier can
mechanically perform against a diff, not a semantic judgment about whether
the diff is "really" fine.

### The three failure modes, defined checkably

* **Unauthorized file changes** — any changed, created, or deleted file that
  does not appear in the task's `boundaries.allowed` list (by explicit path
  or by an unambiguous pattern named there, e.g. `.cockpit/handoff/*`).
  Check: enumerate every file touched (`git diff --stat` against the
  pre-cycle commit, or the equivalent) and confirm each one is covered by an
  `allowed` entry. Any file not covered is a finding, regardless of how
  small or well-intentioned the change looks.
* **Unintended truth-surface edits** — a change to a file on the truth
  surface list below that was **not** specifically named in the task's
  `boundaries.allowed` for *this* task, even if that same file is a normal,
  expected target for *other* kinds of tasks. Being generally editable does
  not make a truth surface fair game for a task that didn't name it. The
  truth surface list, for the purposes of this check:
  * `docs/DECISIONS.md`, `docs/BRR_PLAN.md`, `docs/BRR_POLICY.md`,
    `docs/STATE_MODEL.md`, `docs/VERIFICATION_RESULT_SPEC.md`,
    `docs/REPO_GOVERNANCE.md`, `docs/HANDOFF_PACKET_SPEC.md`,
    `docs/PROJECT_CHARTER.md`, `docs/V1_Scope.md`;
  * every file under `schemas/`;
  * every file under `scripts/`.
  This list may grow as new canonical docs are added
  (`docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process already governs
  that); it is not itself a new governance rule, only an enumeration of
  files the Owner Review Matrix (row 7) and existing canonical-doc process
  already treat as truth surfaces.
* **Silent adjacent-scope edits** — a change to a file that *is* covered by
  `boundaries.allowed`, but where part of the diff falls outside what the
  task's objective and completion criteria actually called for (e.g. a task
  allowed to add one new section to a doc that also, quietly, edits an
  unrelated existing section). Being in an allowed file does not license
  every change within it. Check: for each allowed file, confirm the diff's
  location and content match what the objective/completion criteria describe
  — not just that the file itself was a legitimate target.

### Required verification procedure

For every verification cycle (self- or independently verified, any task
safety class), the verifier must, and must record in
`out_of_scope_findings`:

1. Enumerate every file the diff touched (created, modified, or deleted).
2. Check each file against `boundaries.allowed`; anything uncovered is a
   finding under "unauthorized file changes."
3. Check each touched file against the truth-surface list above; anything
   that is a truth surface but was not specifically named in this task's
   `boundaries.allowed` is a finding under "unintended truth-surface edits,"
   even if it is also, separately, an "unauthorized file change."
4. For each allowed file, spot-check that the diff's content matches the
   objective/completion criteria's description; anything that doesn't is a
   finding under "silent adjacent-scope edits."
5. Record the result explicitly — "none found, confirmed via `git diff`" is
   an acceptable and expected `out_of_scope_findings` entry; it is not
   optional filler, since it is exactly what step 1–4 are supposed to
   produce as their record.

No new verdict or `verification-result.json` field is introduced. A finding
under any of the three modes is reported as `OUT_OF_SCOPE`
(`docs/VERIFICATION_RESULT_SPEC.md`), the same existing verdict this policy
does not add to or change.

### Notes on scope

* This section defines checkable criteria and a procedure; it does not
  implement a script that runs the procedure automatically. Fielding an
  automated out-of-scope checker (analogous to how `check-stop-conditions.ps1`
  fielded the Automatic Stop Triggers) is future work, not taken here,
  consistent with how every other BRR policy section in this document was
  defined before being fielded.
* Per the owner's explicit stop-conditions for this task: this section does
  not alter the self-verification fallback (`DECISION-033`/`DECISION-036`),
  the autonomous gate (`scripts/check-autonomous-gate.ps1`,
  `scripts/check-stop-conditions.ps1`), the Acceptance Boundary Rules, or any
  Task Safety Class's core meaning — it defines detection criteria only, and
  introduces no new authority, verdict, or governance mechanism. It therefore
  does not fall into the Self-Verification Restrictions' circularity
  restriction (above) either.
* This section does not define the Inadequate-Work Return Path (Phase 3 item
  4) — that remains a separate, not-yet-drafted Phase 3 task.
* No existing verdict, task safety class, Owner Review Matrix row, or stop
  condition is redefined or weakened. Cross-checked against the Owner Review
  Matrix (row 7), Task Safety Classification, the Acceptance Boundary Rules,
  the Verification Depth Policy, and the Self-Verification Restrictions while
  drafting — no contradiction was found.
