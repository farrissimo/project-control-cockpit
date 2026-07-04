# PCC BRR Plan / Scope

> **Canonical status.** This is the plan of record for the Babysitter-Reduced
> Role (BRR) program, the active phase after V1 (see `DECISION-021`,
> `DECISION-022`). It is the BRR-phase analogue of `docs/V1_Scope.md`: it
> defines what the phase is trying to achieve and its non-negotiables, but it
> is not itself a task list. Concrete work is delivered as bounded `pcc-brrX-0XX`
> tasks per this plan's own "Recommended Task Breakdown Strategy" (Section 7),
> with the active phase determining the `brrX` segment.
> This document was authored by the owner and recorded verbatim into canonical
> repo truth so BRR work does not depend on chat history (`STATE_MODEL.md` truth
> priority; `DECISION-018` restart safety).
>
> **Phase 1 policy content itself lives in `docs/BRR_POLICY.md`**, not in this
> plan. This plan defines the program and structures Phase 1 into bounded
> tasks (`DECISION-022`); `docs/BRR_POLICY.md` is where each `pcc-brr1-0XX`
> task records the actual policy text it produces (Owner Review Matrix, Task
> Safety Classification, Stop-Instead-of-Guess Policy, Operating Definitions).

## Purpose

This plan defines how Project Control Cockpit should evolve from a bounded V1 proof system into a practical Babysitter-Reduced Role (BRR) workflow.

The goal is not full autonomy.

The goal is to reduce owner babysitting as much as safely possible while preserving:

* canonical truth
* bounded tasks
* explicit verification
* clean restart safety
* local-first behavior
* honest stop conditions
* non-blocking discipline unless a block is clearly justified

This plan assumes PCC must stay lean, honest, and resistant to governance bloat.

---

# 1. BRR Goal Definition

## BRR target state

BRR means the owner can step away for meaningful stretches of time and reasonably expect PCC to keep work moving forward safely **only within clearly defined boundaries**.

A successful BRR system should:

* keep project truth coherent without owner re-briefing
* choose or shape the next bounded task safely when allowed
* generate clean worker directives without the owner rewriting the same instructions
* reject weak or out-of-scope work instead of quietly accepting it
* stop and ask for owner input only when a true owner decision is needed
* make fresh-session restart normal rather than painful
* reduce repeated owner steering, not just document it better

## BRR non-goals

BRR is not:

* blind autonomy
* automatic project direction changes
* automatic strategic decision-making
* "the model decides what the product should be"
* hidden gating that blocks progress over trivial issues
* fake confidence scoring or fake lie detection
* replacing all human review

---

# 2. Alignment With PCC North Star

BRR aligns directly with PCC's north star because PCC's primary goal is reducing owner babysitting while keeping work honest, stateful, verifiable, and moving.

This plan stays aligned by preserving the core PCC rules:

* reduce owner babysitting first
* worker claims are evidence, not truth
* local-first by default
* bounded cycles instead of endless chats
* restart-safe operation
* no fake intelligence scoring
* no process theater
* no new blocking behavior unless clearly justified

---

# 3. Current Reality

PCC is already strong at:

* canonical project/task state
* bounded task cycles
* worker directives and handoff discipline
* evidence-based verification
* restart safety
* repo governance / truth-surface discipline
* local deterministic safety-net tools

PCC is not yet strong enough for true BRR because the system still lacks a fully defined operating boundary for when it may continue without the owner and when it must stop.

That missing boundary is the main reason BRR should be the next focused phase rather than broad post-V1 expansion.

---

# 4. BRR Success Standard

BRR Phase 1–4 succeeds if PCC can do the following with materially less owner intervention than today:

1. determine whether a task is safe to run without owner review
2. determine whether a task may execute but not self-accept
3. determine when owner review is required before execution
4. determine when to stop instead of guessing
5. continue across fresh chats without rebuilding context manually
6. reject or return inadequate work without owner catching it late
7. keep truth surfaces synchronized without hand-fixing routine state drift

A failure condition is any BRR layer that:

* adds more babysitting than it removes
* creates new ambiguous authority
* blocks progress over minor issues
* hides risk instead of surfacing it
* expands scope faster than the safety model matures

---

# 5. BRR Program Structure

BRR should be built in five phases.

The phases below are intentionally sequential. This is not the place for parallel "let's build everything" behavior.

---

# Phase 0 — V1 Close-Out and BRR Readiness Gate

## Objective

Formally finish V1 and establish a clean handoff into BRR work.

## Recommended completion window

2–4 days

## Deliverables

* V1 closure note
* explicit statement of what V1 proved
* explicit statement of what V1 did not prove
* confirmation that deferred items remain deferred unless re-approved
* clean backlog entry or phase marker that BRR work is the next program lane

## Why this matters

Without a formal V1 close-out, BRR work risks becoming a fuzzy continuation of V1 instead of a deliberate new phase with its own safety model.

## Special caution

Do not let V1 close-out become another long polishing cycle.
This should be a brief, honest transition, not a new mini-project.

## Exit criteria

* V1 is formally marked complete enough to stop arguing about whether it is "still in progress"
* BRR is explicitly identified as the next active lane

---

# Phase 1 — BRR Policy Foundation

## Objective

Define the permission model for unattended progress.

This is the most important BRR phase.

## Recommended completion window

4–7 days

## Deliverables

### 1. Owner Review Matrix

A canonical rule set defining when PCC must stop and wait for owner review.

At minimum, owner-required cases should include:

* change to project goal
* change to architecture or major design direction
* ambiguous next-step selection where more than one valid path exists
* new external dependency with meaningful tradeoffs
* destructive or irreversible operation
* security / secrets / credentials / data-risk changes
* changes to truth surfaces, verification model, or governance rules
* high-risk scope changes
* repeated failure after bounded retries
* insufficient evidence with non-trivial uncertainty
* self-verification on a task type deemed too risky for self-acceptance

### 2. Task Safety Classification

Every task must be classified before execution.

Recommended classes:

* Class A: Safe unattended
* Class B: Safe to execute, but review before acceptance
* Class C: Owner approval required before execution
* Class D: Blocked

### 3. Stop-Instead-of-Guess Policy

Explicit rules that favor stopping over inventing.

Trigger examples:

* ambiguous scope
* conflicting truth surfaces
* weak or missing evidence
* repeated failure with no new evidence
* out-of-scope drift
* no trusted way to verify a risky task
* unresolved owner-facing tradeoff

### 4. BRR Operating Definitions

Define the meaning of:

* safe unattended
* safe with review
* owner decision
* blocked
* insufficient evidence
* escalation

## Why this matters

This phase creates the boundary between "project can safely keep moving" and "owner must step in."

Without it, BRR is just hope.

## Special caution

This is the phase most at risk of turning into abstract governance bloat.

Keep it practical:

* concrete rules
* real task classes
* clear examples
* no philosophical essays
* no giant state machine unless later proven necessary

## Exit criteria

* PCC can determine, in writing and in state, whether a task may proceed unattended
* owner-required situations are explicitly documented
* stop conditions are explicit

---

# Phase 2 — BRR Execution Control Layer

## Objective

Teach PCC to apply the BRR policy in live task flow.

## Recommended completion window

1–2 weeks

## Deliverables

### 1. Task Classification Fielding

Add the chosen safety class into the live task flow in a lightweight way.

### 2. Owner-Decision Capture Flow

When owner approval is required, PCC should record:

* what decision is needed
* why it is needed
* what options exist
* what remains blocked until the decision is made

### 3. Safe Next-Task Drafting Rules

PCC should be able to draft the next task only when:

* backlog priority is already known
* the candidate task is bounded
* the task class allows drafting/execution
* the next step does not require new owner intent

### 4. Automatic Stop Triggers

PCC should stop automatically when the task class or stop policy requires it.

### 5. Acceptance Boundary Rules

For some task classes, execution may proceed but self-acceptance may not.

## Why this matters

Phase 1 defines the rules.
Phase 2 makes them real inside the workflow.

## Special caution

Do not let this become "automatic blocking everywhere."
The purpose is controlled forward motion, not friction.

## Exit criteria

* live tasks can be tagged as safe / review-required / owner-required / blocked
* PCC can halt safely when the rules require it
* PCC can continue without owner input when the rules clearly allow it

---

# Phase 3 — Verification Hardening For BRR

## Objective

Raise trustworthiness enough that unattended work is reasonable for low-risk task classes.

## Recommended completion window

1–2 weeks

## Deliverables

### 1. Verification Depth Policy

Not all tasks deserve the same verification rigor.

Recommended levels:

* light
* normal
* strict

Tie these to task safety class and task type.

### 2. Self-Verification Restrictions

The current temporary self-verification exception must be bounded carefully.

Define:

* which task classes may be self-verified
* which task classes require a second reviewer or stronger deterministic checks
* what extra evidence is required when self-verification is allowed

### 3. Out-of-Scope Detection Hardening

Strengthen detection of:

* unauthorized file changes
* unintended truth-surface edits
* silent adjacent-scope edits

### 4. Inadequate-Work Return Path

The failure/refusal path must be normal and safe:

* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE

This must become routine, not exceptional.

## Why this matters

BRR fails if the system keeps moving but quietly accepts weak work.

## Special caution

Do not chase "perfect hallucination detection."
Stay structural and measurable.

## Exit criteria

* low-risk unattended tasks can be verified with a trust level appropriate to their class
* risky tasks are prevented from self-accepting without the needed review depth

---

# Phase 4 — Controlled Semi-Autonomous Operation

## Objective

Let PCC run short bounded sequences with reduced owner touch.

## Recommended completion window

1–2 weeks

## Deliverables

### 1. Multi-Cycle BRR Pilot

Run a limited pilot where PCC completes several bounded cycles in sequence under the BRR rules.

### 2. BRR Metrics

Track real metrics such as:

* owner interruptions per task
* repeated instruction frequency
* manual correction count
* failed handoff count
* claimed-vs-verified completion rate
* stop-trigger count
* owner-review triggers by category

### 3. Failure Review Loop

When BRR fails, review:

* why it should have stopped earlier
* whether the task was misclassified
* whether verification depth was too weak
* whether owner-review rules were incomplete

### 4. Semi-Autonomy Ceiling

Set the explicit ceiling for what PCC may do unattended in this phase.

Example:

* may draft and run Class A tasks
* may draft but not self-accept some Class B tasks
* may never proceed on Class C without owner decision

## Why this matters

This is the first real proof that BRR works in practice rather than on paper.

## Special caution

Do not broaden autonomy during the pilot.
The pilot exists to measure and refine, not to prove bravery.

## Exit criteria

* PCC can complete a short bounded sequence with clearly reduced owner babysitting
* failures are understandable and feed back into the model
* the unattended ceiling is explicit and trusted

---

# Phase 5 — BRR Readiness Review and Post-V1 Expansion Gate

## Objective

Decide honestly whether PCC is ready for broader post-V1 work.

## Recommended completion window

3–5 days

## Deliverables

* BRR readiness review
* list of what PCC can safely do unattended
* list of what still requires owner review
* list of what remains unsafe or immature
* recommendation for next lane:

  * continue BRR hardening
  * begin post-V1 expansion
  * keep both narrowly active

## Why this matters

Without this review, the project will likely drift into feature-building before BRR is genuinely trustworthy.

## Exit criteria

* BRR scope is honestly assessed
* the next roadmap lane is chosen deliberately

---

## Phase 5 Readiness Review (Completed, 2026-07-04, `pcc-brr5-001`)

This is Phase 5's sole deliverable, added here rather than as a new
canonical doc, mirroring how `docs/V1_Scope.md`'s "V1 Closure" section
handled V1's own honest close-out. It does not choose the next lane — the
recommendation below is exactly that, a recommendation, per this phase's own
exit criteria ("the next roadmap lane is chosen deliberately" by the owner).

### What PCC can safely do unattended today

* **Draft, execute, and self-verify a Class B task end-to-end without
  owner check-in during execution, holding the result for review before
  acceptance.** Demonstrated repeatedly: `pcc-brr3-001` through
  `pcc-brr3-005` (`DECISION-046`–`052`), `pcc-brr4-001` through `pcc-brr4-004`
  (`DECISION-054`, `057`, `058`, `060`).
* **Self-promote the next task inside an already-approved lane, checked
  against the actual 8-part gate rather than accepted on anyone's say-so.**
  Demonstrated: `pcc-brr3-002` (`DECISION-047`, a GPT suggestion independently
  re-verified against the gate rather than accepted on GPT's authority);
  `pcc-brr3-003`/`004` (`DECISION-048`/`049`, owner-pre-authorized);
  `pcc-brr4-002`/`003` (`DECISION-057`/`058`, chained inside `DECISION-056`'s
  pre-approved scope).
* **Chain exactly two unattended cycles in sequence without stopping to ask
  between them, when the first resolves cleanly.** Demonstrated once: pilot
  run #2 (`pcc-brr4-002` → `pcc-brr4-003`), reviewed and approved
  (`DECISION-059`).
* **Catch a disguised authority/direction-change fork by judgment, even when
  the mechanical gate alone would wave it through.** Demonstrated: the blind
  pilot (`pcc-brr2-013`, `DECISION-044`), 5/5 correct including two disguised
  forks.
* **Functionally test new script behavior in an isolated scratch copy before
  trusting it, including catching and fixing real defects without
  corrupting live state.** Demonstrated: a stale-handoff-artifact bug
  (`pcc-brr4-001`, `DECISION-054`) and a legacy-log-format crash
  (`pcc-brr4-003`, `DECISION-058`), both caught by testing and fixed
  honestly rather than papered over.
* **Commit locally after a genuine `PASS` or a deliberately-held review
  checkpoint.** Demonstrated routinely throughout.

### What still requires owner review

* **Every Class B result, before it is marked complete** — never
  self-accepted without independent review or explicit owner override
  (Acceptance Boundary Rules). In practice this session, "independent
  review" has meant GPT's remote read plus the owner's own explicit sign-off,
  since Codex has been unavailable throughout.
* **Any Owner Review Matrix "before execution" case (Class C):**
  project-goal changes, architecture/major design changes, ambiguous
  next-step selection, new external dependencies, destructive/irreversible
  actions, security/secrets/data-risk changes, truth-surface/verification-
  model/governance-authority changes, high-risk scope changes. Never
  attempted unattended — every phase transition and every authority-level
  policy change this session was made by direct owner decision, not
  self-promoted.
* **Every remote push** — always required a fresh, explicit owner
  instruction each time, with no exception, including immediately after
  `DECISION-036`'s time-boxed authorization lapsed at the Phase 2→3
  boundary.
* **Genuine forks or ambiguous next steps discovered mid-task** — routed to
  a stop, never resolved by guessing (Stop-Instead-of-Guess Policy).

### What remains unsafe or immature

* **Class A self-accept has never been exercised in a real cycle.** It is
  policy-supported (Acceptance Boundary Rules, Semi-Autonomy Ceiling) but
  both pilot runs deliberately held even honestly-classified Class A work
  (`pcc-brr4-003`) for review rather than testing it (`DECISION-056`,
  `DECISION-060`).
* **The archive-before-chaining rule (`DECISION-060`) is policy-only.** No
  script enforces it. GPT's own review (`DECISION-061`) named this
  explicitly as "not the final trusted form" and recommended future fielding
  before the unattended model is called mature.
* **Chaining beyond two cycles is untested.** The two-cycle result should
  not be extrapolated to justify a longer unattended chain.
* **The fuller BRR Metrics deliverable is undelivered.** Owner interruptions
  per task, repeated instruction frequency, and owner-review triggers by
  category are not instrumented at all; only raw event-type counts and one
  named ratio exist (`pcc-brr4-003`).
* **A formalized Failure Review Loop does not exist.** Real failures this
  session were reviewed diligently, but ad hoc and by narrative each time,
  not against a standing, repeatable checklist a future session would
  automatically follow.
* **The single largest standing risk: every verification across BRR Phases
  2 through 5 has been performed by the same party that did the work.**
  Codex has been unavailable for the entire recorded history of this phase
  of the project, so every cycle ran under the `DECISION-033` self-
  verification fallback. GPT's remote review has been a genuine, valuable
  second opinion, but `DECISION-036` itself states plainly that GPT cannot
  locally re-run guardrails and is additive, not a substitute for
  independent verification. No fully independent, locally-executing second
  party has verified any BRR Phase 2–5 work to date.
* **Judgment-based fork detection has a real but small evidence base.** One
  blind pilot cycle, five candidates, two traps, both owner-authored rather
  than constructed by an independent, adversarial third party (`DECISION-044`'s
  own disclosed limits).

### Recommendation for next lane

The core draft → execute → self-verify → hold-or-close → review loop has
been exercised successfully across 26 completed BRR-phase cycles (per
`.cockpit/result/archive/`; 41 total including the 15 V1 cycles that used
the same core loop before BRR began), with every real defect caught before
being accepted and no known false `PASS`. Against that,
the verification-independence gap (no working Codex for the entire program)
has persisted throughout, and two named Phase 4 items remain undelivered.

**Recommendation: keep both narrowly active**, per Phase 5's own exit
criteria that the lane be chosen deliberately by the owner, not
self-selected here. Concretely: allow bounded, Class A/B-disciplined work
(new features or further BRR hardening alike) to continue using the exact
machinery already proven, while treating a short, explicit, non-blocking
list as ongoing priority: (1) restore or replace independent local
verification when possible (Codex's return, or an equivalent locally-
executing second reviewer); (2) field the archive-before-chaining rule into
an actual script; (3) if stronger confidence in the walk-away model is
wanted, run a genuinely adversarial (not owner-authored) blind pilot.

This recommendation deliberately avoids both extremes named in this plan's
own Section 6.C ("scope creep via safety"): it does not declare BRR fully
proven and stop hardening it — the self-verification gap alone rules that
out — and it does not block all other work until every BRR gap is closed,
which `DECISION-050` already rejected as a pattern for Phase 3's own
follow-on items.

---

## Phase 5 Closed (`DECISION-069`, 2026-07-04)

The recommendation above was written while the self-verification gap was
still open. It no longer is: `DECISION-066` restored the two-role split
once Codex became available again, and `pcc-brr5-004`/`pcc-brr5-005`
fielded and then proved, fully unattended end-to-end, a real independent
Codex verification mechanism (`scripts/codex-verify-watcher.ps1`, deployed
as the native scheduled task `PCC-CodexVerifyWatcher`). That was named as
the single largest standing risk in this review; it is now resolved for
real, not on paper.

Per `DECISION-069`, the owner has declared BRR's original goal
(`DECISION-001`/`DECISION-021`) satisfied and closed BRR Phase 5. The four
remaining items below are carried forward as backlog, not as a blocking
gate, since none of them represent an unverified or unsafe path — they are
extensions of an already-safe, already-independently-verified core loop:

1. Exercise Class A self-accept in a real cycle (never yet exercised).
2. Test unattended chaining beyond two cycles (untested beyond two).
3. Complete the fuller BRR Metrics deliverable (owner-interruption
   tracking, review-trigger categorization by category).
4. Formalize a Failure Review Loop (currently ad hoc, by narrative).

All standing BRR-era policy (`docs/BRR_POLICY.md`'s Task Safety
Classification, Acceptance Boundary Rules, Semi-Autonomy Ceiling, etc.)
remains fully active and unchanged. Closing the phase ends BRR's status as
the project's current named phase; it does not relax any safety rule.

> **Later update (`pcc-postbrr-001`, `DECISION-070`):** `backlog/IDEA-009`
> (Deterministic retry governor / circuit breaker) is delivered — this note
> is a pointer added per `docs/REPO_GOVERNANCE.md`'s Post-Close Canonical
> Amendment Rule (`DECISION-051`), not a rewrite of the closure above, which
> was accurate when Phase 5 closed. `IDEA-009` was not one of the four items
> listed above; it was a separately-tracked backlog item unlocked by this
> same closure (deferred since V1 pending semi-autonomous operation, which
> `pcc-brr5-004`/`005` demonstrated). It was run as the first of a two-task
> post-BRR bundle specifically chosen to also exercise item 2 above
> (unattended chaining beyond two cycles) as a natural byproduct of running
> consecutive real cycles through the now-live `PCC-CodexVerifyWatcher`.

---

# 6. Areas Requiring Special Caution

## A. Self-verification

This is the highest-risk operating compromise currently in play.

Special caution:

* never normalize self-verification just because it is convenient
* tie it to task class and verification depth
* require explicit disclosure every time it is used
* treat false PASS incidents as serious BRR failures

## B. Hidden gating

PCC already rejects fake blocking. BRR must preserve that.
A new check should not become a hard block unless:

* the risk is real
* the block is justified
* the owner can understand why it blocked
* the system cannot continue safely without it

## C. Scope creep via "safety"

This is a major risk.
Many bad systems justify bloat in the name of safety.

Every BRR addition must answer:

* does this reduce babysitting?
* does this reduce unsafe forward motion?
* does this preserve truth?
* is it small enough to prove?

If not, it does not belong.

## D. Task selection autonomy

Choosing the next task is more dangerous than executing a clearly bounded one.
Do not let PCC become a strategist before it proves it can be a reliable bounded operator.

## E. Ambiguity

BRR only works when ambiguity is surfaced and stopped.
Any attempt to "power through" ambiguity will recreate the same babysitting problem BRR is supposed to remove.

---

# 7. Recommended Task Breakdown Strategy

This plan should not be implemented as giant phases in one shot.

Each phase should be broken into small bounded tasks using the existing PCC discipline:

* one objective
* allowed scope
* forbidden scope
* required evidence
* verification depth
* clear next action

Good BRR tasks will usually be:

* one rule set
* one state/model update
* one verification improvement
* one stop-condition implementation
* one task-classification flow change
* one pilot / measurement step

Bad BRR tasks will usually be:

* "build autonomy"
* "make it smarter"
* "handle all review logic"
* "make PCC able to run everything without me"

---

# 8. Recommended Delivery Order

## Immediate next order

1. Formal V1 close-out
2. BRR Phase 1
3. BRR Phase 2
4. BRR Phase 3
5. BRR Phase 4 pilot
6. BRR readiness review
7. Then decide whether broader post-V1 work should begin

This ordering is intentional.

The system should earn broader expansion by first proving it knows when it may continue and when it must stop.

---

# 9. Honest Boundaries

Some parts of BRR cannot be made fully safe, at least not now.

These should be acknowledged honestly:

* perfect lie detection: not realistic
* perfect drift detection: not realistic
* safe fully autonomous project direction: not realistic
* strong unattended verification for all task classes: not realistic
* broad automatic next-task choice without well-defined boundaries: unsafe right now

PCC should honor those limits explicitly rather than faking confidence.

---

# 10. Professional Delivery Standard

A serious dev team would treat BRR as an operating-model program, not a feature dump.

That means:

* policy before autonomy
* bounded proofs before expansion
* root-cause fixes before polish
* explicit failure review
* minimal new moving parts
* no parallel governance maze
* no vague intelligence claims

Lean.
Mean.
Honest.
Safe enough to trust, but never pretending to be safer than it is.

---

# 11. Final Recommendation

BRR should be the next active program after V1 close-out.

Not because it is flashy.
Because it is the most important unsolved problem.

PCC has already built much of the cockpit.
BRR is the rulebook that determines when the cockpit may keep going without the owner and when it must stop.

That is the next serious milestone.
