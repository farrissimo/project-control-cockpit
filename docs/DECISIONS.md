# Decisions

## Purpose

This file records explicit owner/project decisions that must be preserved across tasks, chats, handoffs, and worker cycles.

The decision log exists so the owner does not have to repeat the same rules and conclusions over and over.

---

## Core Rule

If a decision affects future project behavior, scope, architecture, workflow, verification, or owner expectations, record it here.

Chat history is not the source of truth.
Recorded decisions are.

---

## Decision Format

Each decision should use this format:

```markdown id="xeovj6"
## DECISION-000: Short Decision Title

Date:
Status: Active / Superseded / Reversed
Owner Decision:

Reason:

Implications:

Supersedes:
Related:
```

---

## Decision Status Values

### Active

The decision is currently valid.

### Superseded

The decision was replaced by a newer decision.

### Reversed

The decision was explicitly undone.

---

## Initial Decisions

## DECISION-001: Reducing Owner Babysitting Is the Primary Rule

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit's #1 rule is reducing owner babysitting.

Reason:

The project exists because current AI-assisted project workflows require too much manual steering, repeated instruction, copy/paste handoff, verification effort, and state correction from the owner.

Implications:

Any feature that increases process burden must justify itself by reducing babysitting, preserving state, improving verification, or preventing repeated manual correction.

Supersedes: None
Related: PROJECT_CHARTER.md, V1_Scope.md

---

## DECISION-002: Local-First by Default

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit should prefer local deterministic tools such as PowerShell, Git Bash, Git, filesystem commands, and simple scripts before using model sessions.

Reason:

Many tasks do not require an LLM and should not burn limited model/session usage.

Implications:

The system should route shell-grade work locally when possible and only use models when reasoning, synthesis, coding judgment, or verification requires it.

Supersedes: None
Related: V1_Scope.md

---

## DECISION-003: No Paid API Dependence for V1

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit V1 should not depend on direct paid API calls.

Reason:

The project should use existing subscriptions, CLI tools, local tools, file bridges, and owner-controlled workflows rather than creating a separate API cost burden.

Implications:

Integrations should favor local file bridges, CLI workflows, clipboard/browser fallback, and subscription-based tools where available.

Supersedes: None
Related: PROJECT_CHARTER.md, V1_Scope.md

---

## DECISION-004: Claude Code Is the Initial Worker Layer

Date: 2026-07-03
Status: Active

Owner Decision:

Claude Code will be the initial worker execution layer for V1.

Reason:

The immediate goal is not to replace Claude Code, but to reduce babysitting by creating cleaner directives, handoffs, verification, and state management around it.

Implications:

V1 should support a local file-based bridge to Claude Code before attempting broader worker orchestration.

Supersedes: None
Related: HANDOFF_PACKET_SPEC.md

---

## DECISION-005: Advisor / Verifier Is a First-Class Role

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit must include an advisor/verifier role.

Reason:

Execution without disciplined verification leads to fake completion, weak evidence, drift, and owner babysitting.

Implications:

V1 must generate worker directives, review returned evidence, issue verification verdicts, and prevent state updates without PASS or owner override.

Supersedes: None
Related: V1_Scope.md, VERIFICATION_RESULT_SPEC.md

---

## DECISION-006: Worker Claims Are Evidence, Not Truth

Date: 2026-07-03
Status: Active

Owner Decision:

A worker’s claim of completion does not automatically update project truth.

Reason:

Workers can be wrong, incomplete, vague, or overconfident.

Implications:

Project/task state updates only after verifier PASS or explicit owner override.

Supersedes: None
Related: STATE_MODEL.md, VERIFICATION_RESULT_SPEC.md

---

## DECISION-007: V1 Uses Bounded Work Cycles

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit should use bounded task cycles instead of endless chats.

Reason:

Endless chats create drift, context rot, weak handoffs, and state confusion.

Implications:

V1 should support task definition, directive creation, worker execution, evidence return, verification, state update, and clean rollover.

Supersedes: None
Related: V1_Scope.md

---

## DECISION-008: Avoid Fake Intelligence Metrics

Date: 2026-07-03
Status: Active

Owner Decision:

V1 should avoid pretending it can perfectly detect truth, lies, model cognition, or chat health.

Reason:

Those concepts cannot be measured directly and would risk creating false confidence.

Implications:

V1 should use structural, observable signals instead: missing evidence, failed handoffs, repeated revisions, unresolved assumptions, out-of-scope changes, local-tool-suitable tasks, and verification verdicts.

Supersedes: None
Related: V1_Scope.md

---

## DECISION-009: Tone and Communication Controls Matter

Date: 2026-07-03
Status: Active

Owner Decision:

Project Control Cockpit should support concise, direct, no-cheerleading communication defaults, with configurable tone, chattiness, and language level.

Reason:

Communication style affects owner friction, wasted turns, clarity, and trust.

Implications:

V1 should preserve these defaults even if the first implementation is config-based rather than a full UI.

Supersedes: None
Related: V1_Scope.md

---

## DECISION-010: Fresh-Thread Rollover Is a Core Safety Mechanism

Date: 2026-07-03
Status: Active

Owner Decision:

The system should support clean reset, fork, and rollover instead of relying on long-running chats.

Reason:

Many reliability failures are better handled by clean handoff and fresh state than by trying to perfectly measure drift.

Implications:

V1 must be able to produce a clean handoff summary that preserves project truth, task state, evidence, unresolved issues, and next action.

Supersedes: None
Related: STATE_MODEL.md, HANDOFF_PACKET_SPEC.md

---

## DECISION-011: Canonical Project Name Is Project Control Cockpit

Date: 2026-07-03
Status: Active

Owner Decision:

The canonical project name is Project Control Cockpit. "PCC" is the approved short form.

Reason:

The project needs one stable identity across repo path, docs, handoffs, and runtime state so naming drift does not become an early source-of-truth problem.

Implications:

Docs, examples, and runtime state should use Project Control Cockpit as the full name. PCC may be used as a shorthand label, but not as a replacement for the canonical project name in source-of-truth documents unless a specific field is intended to be abbreviated.

Supersedes: None
Related: README.md, PROJECT_CHARTER.md, STATE_MODEL.md

---

## Adding Future Decisions

Add new decisions below this line.

Each decision should be numbered sequentially.

---

## DECISION-012: Claude Code Is The Primary Worker And Codex Is The Advisor Verifier

Date: 2026-07-03
Status: Active

Owner Decision:

Claude Code is the primary worker execution layer for PCC V1. Codex serves as the advisor/verifier and source-of-truth guard.

Reason:

The intended operating model is to use Claude for heavier worker throughput while using Codex more selectively for repo-truth inspection, task shaping, verification, and state discipline.

Implications:

PCC should default worker directives toward Claude Code unless a task is better handled by local deterministic tools. Codex should focus on bounded advisory, verification, and source-of-truth work rather than acting as the default heavy-lift worker.

Supersedes: None
Related: PROJECT_CHARTER.md, V1_Scope.md, .cockpit/state/project-state.json

---

## DECISION-013: Repo Governance And Source-Of-Truth Intake Must Be Explicit

Date: 2026-07-03
Status: Active

Owner Decision:

PCC must use an explicit repo-governance process for canonical docs, idea intake, task promotion, and stale-doc handling. Ideas must stay separate from active tasks.

Reason:

Defining this early reduces stale documentation, prevents quasi-canonical drift, keeps the repo organized, and supports a predictable professional workflow that scales.

Implications:

Canonical docs should be added only with narrow purpose and explicit justification. Non-canonical ideas should be captured in one controlled backlog file. Active tasks should live in `.cockpit/state/task-state.json`. Stray, duplicate, superseded, or unknown docs must be classified and then archived, merged, kept, or deleted according to the governance policy.

Supersedes: None
Related: docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, backlog/IDEAS.md

---

## DECISION-014: Every Meaningful Change Must Update The Relevant Truth Surfaces

Date: 2026-07-03
Status: Active

Owner Decision:

PCC must treat change propagation as a non-negotiable part of the workflow. Any meaningful change must trigger review and update of the relevant source-of-truth artifacts.

Reason:

Unpropagated changes create stale docs, conflicting truth, weak handoffs, and hidden repo drift. Catching this early is necessary for a professional and scalable workflow.

Implications:

When behavior, workflow, scope, governance, routing, state structure, or verification expectations change, the system must review impacted canonical docs, decisions, live state, and active handoff artifacts. Work is not complete if the artifact changed but the corresponding truth surfaces were left stale.

Supersedes: None
Related: docs/REPO_GOVERNANCE.md, docs/DECISIONS.md, .cockpit/state/project-state.json

---

## DECISION-015: State Consistency Must Be Checked With A Local Deterministic Validator

Date: 2026-07-03
Status: Active

Owner Decision:

PCC must use a local deterministic validation step to check core `.cockpit` state consistency before treating state updates as complete.

Reason:

State drift has already appeared once during setup. A lightweight local check is a high-leverage guardrail that reduces repeated babysitting and catches stale or conflicting truth before it spreads.

Implications:

When project state, task state, verification result, or handoff references change, the local state validator should be run. This does not replace verification judgment, but it does enforce basic consistency between canonical files and referenced paths.

Supersedes: None
Related: docs/REPO_GOVERNANCE.md, .cockpit/state/project-state.json, scripts/validate-cockpit-state.ps1

---

## DECISION-016: Verified PASS Must Advance The Task To Complete

Date: 2026-07-03
Status: Active

Owner Decision:

When PCC records a verified `PASS`, the active task should advance directly to `complete` rather than stopping at an intermediate `verified_pass` live status.

Reason:

Leaving PASS in an in-between state keeps unnecessary semantic ambiguity in the core loop and creates more babysitting around whether work is truly done. The verifier already decides the verdict; the state system should reflect that decision clearly.

Implications:

The deterministic state-advance helper should map `PASS` to `complete`. `verified_pass` should not remain an active live-task status in the canonical state model. Drafting the next task still remains a separate advisor/verifier step after completion.

Supersedes: None
Related: docs/STATE_MODEL.md, scripts/advance-cockpit-state.ps1, .cockpit/state/task-state.json

---

## DECISION-017: Generated Worker Truth Must Come From Canonical Repo State

Date: 2026-07-03
Status: Active

Owner Decision:

Facts that appear in generated worker directives as standing operational truth should live in canonical repo state rather than as hardcoded strings inside the directive generator.

Reason:

If a worker-facing fact can change but only exists inside the script, the repo reintroduces the same drift and babysitting problem PCC is meant to reduce.

Implications:

PCC may keep stable worker-context facts in canonical project state so deterministic helpers can render them without hidden script-only truth. Generator logic should prefer canonical state over hardcoded directive facts.

Supersedes: None
Related: docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, .cockpit/state/project-state.json, scripts/generate-worker-directive.ps1

---

## DECISION-018: Fresh Session Restart Safety Is A Core PCC Capability

Date: 2026-07-03
Status: Active

Owner Decision:

PCC must make it safe and practical to start a fresh Codex advisor/verifier chat and a fresh Claude Code worker chat at any time without the owner having to rebuild the project context manually.

Reason:

Long-lived chat dependence is one of the main unsolved babysitting failures this project exists to remove. A disposable chat is only safe if the repo can rehydrate the role from canonical truth.

Implications:

Fresh-session resilience is a first-class product goal, not a side effect. Canonical state, verified artifacts, and generated handoff materials must support restart-safe operation for both advisor and worker roles. Bounded tasks that directly improve restart safety are within V1 scope.

Supersedes: None
Related: docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, .cockpit/state/project-state.json

---

## DECISION-019: Claude May Temporarily Hold Both Worker And Advisor/Verifier Roles

Date: 2026-07-03
Status: Superseded (by DECISION-023, 2026-07-03 — Codex resumed as advisor/verifier)

Owner Decision:

Starting after task `pcc-v1-011`, Claude Code may act as both the worker and the advisor/verifier for PCC task cycles, on a trial basis, proceeding slowly with close owner review.

Reason:

DECISION-012 assigns Claude Code as worker and Codex as advisor/verifier specifically to keep completion claims and completion review independent. The owner is not currently able to run the two-role split and stated this is "not ideal but it's the only way I can work right now" — a practical constraint, not a reversal of the reasoning behind DECISION-012.

Implications:

This is an explicit, owner-approved exception to DECISION-012's role split, not a replacement for it. While it is in effect: Claude must disclose in every verification result that the verification was self-performed (no independent second party), per the existing risk-disclosure pattern already used in `.cockpit/result/verification-result.json` for `pcc-v1-011`. Claude must independently re-run and re-check evidence when verifying its own worker output rather than only reviewing its own prior narrative, and verification must remain genuinely willing to issue FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE against Claude's own work, not default to PASS. This arrangement should be revisited if it produces a rubber-stamped PASS, a missed out-of-scope change, or any other sign that self-verification is failing to catch what independent verification would have caught.

Supersedes: None (temporary exception to, not replacement of, DECISION-012)
Related: DECISION-005, DECISION-006, DECISION-012, docs/VERIFICATION_RESULT_SPEC.md

---

## DECISION-020: Verifier Close-Out Includes A Repo Health Check And A Git Commit

Date: 2026-07-03
Status: Active

Owner Decision:

After issuing a PASS verdict and advancing state, the verifier must also: run `scripts/doctor.ps1` and `scripts/validate-cockpit-state.ps1` to confirm the repo is consistent and healthy, refresh `.cockpit/handoff/advisor-restart-brief.md` if `doctor` reports it stale, archive the cycle's directive/result/verification artifacts, and commit the verified changes to git.

Reason:

Verified work was accumulating uncommitted across multiple cycles (`pcc-v1-009` through `pcc-v1-011`) with no defined step responsible for syncing it to git history. Running `doctor` after every cycle is exactly the use case it was built for (`pcc-v1-011`), and skipping it left real drift (a stale advisor brief) undetected until asked about directly.

Implications:

This does not make `doctor` a gate — it stays advisory, per `backlog/details/idea-006-doctor-healthcheck.md`; the verifier reads its report and acts on findings manually, and `doctor` itself still never blocks anything. Git commits made under this step are for the verifier's own already-verified state/doc/script changes for the completed task; they are not a general license to commit unrelated or unverified work. Force-push, history rewriting, and pushing to any remote remain outside this decision and require separate explicit approval.

Supersedes: None
Related: docs/HANDOFF_PACKET_SPEC.md, scripts/doctor.ps1, scripts/validate-cockpit-state.ps1, scripts/advance-cockpit-state.ps1

---

## DECISION-021: V1 Is Complete; BRR Phase 1 Begins

Date: 2026-07-03
Status: Active

Owner Decision:

V1 is complete as of `pcc-v1-015`. The project now moves into BRR ("Babysitter Reduction Role") Phase 1, with reducing owner babysitting (DECISION-001) as the explicit, named top priority of this next phase.

Reason:

Every V1 Done Criterion in `docs/V1_Scope.md` has been demonstrated repeatedly across 15 real bounded cycles (`pcc-v1-001` through `pcc-v1-015`): canonical project/task state, generated worker directives, a local file bridge to Claude Code, evidence-based verification with all five verdict types exercised, state advancement gated on PASS, and restart-safe fresh-session handoff for both advisor and worker roles. The backlog's ready items (`IDEA-005` through `IDEA-011`, `IDEA-003`) are all delivered; the two remaining items (`IDEA-001`, `IDEA-009`) remain deliberately deferred per their own recorded reasoning, not because V1 is incomplete.

Implications:

`project-state.json`'s `current_phase` moves from `implementation` to `brr-phase-1` (added to `schemas/project-state.schema.json`'s enum alongside the existing V1 phase values, which are kept for historical accuracy rather than removed). See `docs/V1_Scope.md`'s "V1 Closure" section for the explicit, honest accounting of what V1 proved and did not prove, and confirmation that deferred backlog items remain deferred. Future tasks drafted under this phase should be justified primarily by how directly they reduce owner babysitting, per the same non-negotiable rule that has governed V1 (`docs/PROJECT_CHARTER.md`, `docs/V1_Scope.md`). This decision does not authorize any new scope, automation, or governance beyond what is already recorded; it only marks the phase transition.

Task IDs for tasks drafted after V1's close use the format `pcc-brr1-0XX` (e.g. `pcc-brr1-001`), resetting the sequence number rather than continuing V1's `pcc-v1-0XX` count, so it stays immediately visible how many BRR-phase tasks exist independent of V1's history. See `docs/REPO_GOVERNANCE.md`'s "BRR Phase 1 Task ID Format" for detail. Existing `pcc-v1-0XX` and `IDEA-0XX` identifiers are unaffected and remain permanent, per the existing Plain-Language Naming convention.

Supersedes: None
Related: DECISION-001, docs/V1_Scope.md, docs/PROJECT_CHARTER.md, docs/REPO_GOVERNANCE.md, .cockpit/state/project-state.json, schemas/project-state.schema.json

---

## DECISION-022: BRR Plan Of Record And Phase 1 Structure

Date: 2026-07-03
Status: Active

Owner Decision:

The owner provided the full BRR program plan and delegated the structuring of Phase 1 work. The plan is recorded canonically at `docs/BRR_PLAN.md`; Phase 1 ("BRR Policy Foundation") is structured as the four bounded, docs-only policy tasks below.

Reason:

The plan was delivered in chat, which is not project truth (`STATE_MODEL.md` truth priority; `DECISION-018` restart safety). Per `docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process, a durable, narrow-purpose program plan that no existing doc covers warrants its own canonical doc, so `docs/BRR_PLAN.md` is the BRR analogue of `docs/V1_Scope.md`. Structuring was derived from the plan's own Section 5 (sequential phases), Section 7 (break each phase into small bounded tasks), and its explicit Phase 1 deliverable list — not inferred.

Implications:

**Phase 1 is delivered as four bounded `pcc-brr1-0XX` policy tasks, in dependency order** (which is also the plan's own listed order):

1. `pcc-brr1-001` — Owner Review Matrix. Anchors the rest, because task classes and stop triggers both reference "owner-required."
2. `pcc-brr1-002` — Task Safety Classification (Class A/B/C/D). Builds on the review matrix; Class C = an owner-required case.
3. `pcc-brr1-003` — Stop-Instead-of-Guess Policy. Its stop states land on the existing verdicts in `docs/VERIFICATION_RESULT_SPEC.md` (`BLOCKED`/`INSUFFICIENT`/`OUT_OF_SCOPE`), not new ones.
4. `pcc-brr1-004` — BRR Operating Definitions. Comes last, reconciling terms the prior three put into use; several (`blocked`, `insufficient_evidence`) already have canonical meaning in `STATE_MODEL.md`/`VERIFICATION_RESULT_SPEC.md` and are extended, not redefined.

**Phase 1 tasks are policy only** — they write rules into canonical docs (likely a new `docs/BRR_POLICY.md`) and touch no runtime scripts. Applying the policy in live task flow is explicitly Phase 2 in the plan. This keeps Phase 1 lean and structurally incapable of blocking a cycle (it changes no executable behavior), directly honoring the plan's Phase 1 special caution against governance bloat and hidden gating.

**Phase 1 tasks should get independent (secondary) review, not just self-verification.** V1's closure (`docs/V1_Scope.md`) honestly records that independent verification has no real track record here and that policy content cannot be verified by re-running a deterministic script. Policy tasks are therefore exactly where self-verification (`DECISION-019`) is weakest. This decision recommends the owner route each Phase 1 policy task through the secondary reviewer (e.g. ChatGPT) before it is accepted; it does not mandate the owner's tooling, but flags policy as the wrong place to rely on self-verification alone.

This decision structures Phase 1 only. It does not author the policy content itself (that is the tasks' job), does not pre-approve Phases 2–5, and does not authorize any runtime, automation, or gating change.

Supersedes: None
Related: DECISION-018, DECISION-019, DECISION-021, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/VERIFICATION_RESULT_SPEC.md, docs/COMPLETION_CONTRACT_SPEC.md

---

## DECISION-023: Return To Canonical Two-Role Workflow; Codex Resumes As Advisor/Verifier

Date: 2026-07-03
Status: Active

Owner Decision:

Codex is available again. PCC returns to the canonical two-role split of DECISION-012: Claude Code is the worker, Codex is the advisor/verifier and source-of-truth guard. The temporary dual-role trial (DECISION-019) ends and is marked superseded.

Reason:

DECISION-019 was always an explicit, temporary exception taken only because the owner could not run the two-role split at the time. That constraint is now resolved. Independent verification is the stronger arrangement (DECISION-005, DECISION-006), and V1's closure (`docs/V1_Scope.md`) records honestly that self-verification accumulated no independent track record during the trial — so returning to independent review is the correct next step, especially before BRR policy work, which is judgment-heavy and not deterministically verifiable.

Implications:

Effective the next task (`pcc-brr1-001` onward), Claude Code produces worker evidence and does not self-issue the verification verdict; Codex reviews evidence and issues the verdict per `docs/VERIFICATION_RESULT_SPEC.md`. Work self-verified during the DECISION-019 trial (`pcc-v1-009` through `pcc-v1-015`) remains recorded as PASS but was never independently reviewed; the returning verifier may spot-check any of it (this is surfaced as an open question at the V1→BRR handoff, not silently assumed sound). This decision does not by itself re-run or invalidate any prior verdict.

Supersedes: DECISION-019
Related: DECISION-005, DECISION-006, DECISION-012, DECISION-021, DECISION-022, docs/VERIFICATION_RESULT_SPEC.md, docs/V1_Scope.md

---

## DECISION-024: BRR Owner Review Matrix Recorded (pcc-brr1-001)

Date: 2026-07-03
Status: Active

Owner Decision:

The first BRR Phase 1 policy deliverable, the Owner Review Matrix, is recorded canonically in the new `docs/BRR_POLICY.md`, per `DECISION-022`'s task breakdown.

Reason:

`docs/BRR_PLAN.md` Phase 1 requires a concrete, durable rule set defining when PCC must stop and wait for owner review before unattended progress continues. `docs/BRR_PLAN.md` is the program plan, not the policy text itself, so a narrow-purpose canonical doc was warranted per `docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process (the concept is durable, does not fit cleanly into an existing doc, and has one narrow purpose).

Implications:

`docs/BRR_POLICY.md` now holds an 11-row Owner Review Matrix covering every owner-required case named in `docs/BRR_PLAN.md` Phase 1, plus a note that it does not yet define task safety classes (`pcc-brr1-002`), the Stop-Instead-of-Guess trigger list (`pcc-brr1-003`), or the operating-definitions glossary (`pcc-brr1-004`) — those remain separate, not-yet-written tasks. This decision does not implement any runtime enforcement, gating, or task-class execution logic; applying the matrix in live task flow remains Phase 2 (`docs/BRR_PLAN.md` Section 5). Separately, `project-state.json`'s `owner_decisions` field is now explicitly documented (`docs/STATE_MODEL.md`) as a curated operational subset of this file, not a full mirror — this file remains the sole authoritative decision log regardless of what is or isn't carried into `owner_decisions`.

Supersedes: None
Related: DECISION-021, DECISION-022, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md

---

## DECISION-025: BRR Task Safety Classification Recorded (pcc-brr1-002)

Date: 2026-07-03
Status: Active

Owner Decision:

The second BRR Phase 1 policy deliverable, Task Safety Classification, is recorded canonically in `docs/BRR_POLICY.md`, extending it directly rather than creating a new doc, per `DECISION-022`'s task breakdown.

Reason:

`docs/BRR_PLAN.md` Phase 1 requires a concrete Class A/B/C/D model so tasks can be classified before execution. `docs/BRR_POLICY.md` already existed as the narrow-purpose home for BRR Phase 1 policy text (`DECISION-024`), so extending it kept the classification tied directly to the Owner Review Matrix it builds on, per `docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process (question 1: can an existing canonical doc handle this — yes).

Implications:

`docs/BRR_POLICY.md` now defines four classes (A: safe unattended, B: safe to execute but not self-accept, C: owner approval required before execution, D: blocked) with an explicit, direct mapping back onto the Owner Review Matrix rows added by `DECISION-024`: matrix rows 1-8 map to Class C, row 9 maps to Class D, and rows 10-11 explain why a task is Class B rather than Class A. This decision does not implement Phase 2 fielding (recording a task's class in `task-state.json`, checking it automatically, or gating on it) — that remains future work per `docs/BRR_PLAN.md` Section 5, Phase 2 "Task Classification Fielding." No runtime scripts, schemas, or verification mechanics were changed.

Supersedes: None
Related: DECISION-022, DECISION-024, docs/BRR_PLAN.md, docs/BRR_POLICY.md

---

## DECISION-026: BRR Stop-Instead-of-Guess Policy Recorded (pcc-brr1-003)

Date: 2026-07-03
Status: Active

Owner Decision:

The third BRR Phase 1 policy deliverable, the Stop-Instead-of-Guess Policy, is recorded canonically in `docs/BRR_POLICY.md`, extending it directly rather than creating a new doc, per `DECISION-022`'s task breakdown.

Reason:

`docs/BRR_PLAN.md` Phase 1 requires explicit rules that favor stopping over inventing, covering seven named trigger examples. `docs/BRR_POLICY.md` already held the Owner Review Matrix (`DECISION-024`) and Task Safety Classification (`DECISION-025`) it needed to align with, so extending it kept all three pieces of Phase 1 policy in one place per `docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process (an existing canonical doc already covers this).

Implications:

`docs/BRR_POLICY.md` now maps all seven named triggers (ambiguous scope, conflicting truth surfaces, weak or missing evidence, repeated failure with no new evidence, out-of-scope drift, no trusted way to verify a risky task, unresolved owner-facing tradeoff) onto PCC's existing five verification verdicts — no new verdict, status, or state was introduced. The former "Relationship To Existing Verdicts" section (added under `DECISION-024`) was folded into this new section rather than left as a separate, now-redundant note, since both covered the same ground. This decision does not implement any automatic trigger detection, runtime enforcement, or gating — applying these triggers in live task flow remains Phase 2 (`docs/BRR_PLAN.md` Section 5). No runtime scripts, schemas, or verification mechanics were changed.

Supersedes: None
Related: DECISION-022, DECISION-024, DECISION-025, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/VERIFICATION_RESULT_SPEC.md

---

## DECISION-027: BRR Operating Definitions Recorded (pcc-brr1-004)

Date: 2026-07-03
Status: Active

Owner Decision:

The fourth and final BRR Phase 1 policy deliverable, the Operating Definitions glossary, is recorded canonically in `docs/BRR_POLICY.md`, extending it directly rather than creating a new doc, per `DECISION-022`'s task breakdown.

Reason:

`docs/BRR_PLAN.md` Phase 1 requires explicit definitions for six terms already in informal use across the prior three BRR policy sections. `docs/BRR_POLICY.md` already held all three prior sections it needed to reconcile with, so extending it kept the full Phase 1 policy foundation in one place per `docs/REPO_GOVERNANCE.md`'s New Canonical Doc Process (an existing canonical doc already covers this).

Implications:

`docs/BRR_POLICY.md` now defines all six named terms (safe unattended, safe with review, owner decision, blocked, insufficient evidence, escalation), each tied explicitly to the corresponding Task Safety Class, Owner Review Matrix row, Stop-Instead-of-Guess trigger, and/or existing verification verdict, with a "Reconciliation notes" subsection confirming no contradiction was found against the prior three sections. With this decision, `docs/BRR_POLICY.md` now contains all four BRR Phase 1 policy deliverables named in `docs/BRR_PLAN.md`, completing the phase's policy-only scope. This decision does not itself declare BRR Phase 1 complete, mark the transition into Phase 2, or implement any escalation mechanism, runtime enforcement, or fielding — those remain a separate, explicit owner/advisor decision and separate future work (`docs/BRR_PLAN.md` Section 5). No runtime scripts, schemas, or verification mechanics were changed.

Supersedes: None
Related: DECISION-022, DECISION-024, DECISION-025, DECISION-026, docs/BRR_PLAN.md, docs/BRR_POLICY.md

---

## DECISION-028: BRR Phase 1 Policy Scope Is Closed; BRR Phase 2 Begins With Task Classification Fielding

Date: 2026-07-03
Status: Active

Owner Decision:

BRR Phase 1's policy-only scope is now treated as complete, and PCC moves into BRR Phase 2. The first bounded Phase 2 task is `pcc-brr2-001`: lightweight Task Classification Fielding.

Reason:

`DECISION-027` completed the fourth and final Phase 1 policy deliverable, and the owner then explicitly chose to keep going rather than hold at the boundary. `docs/BRR_PLAN.md` defines Phase 2 as the execution-control layer that makes the Phase 1 policy real in live task flow, with "Task Classification Fielding" listed first among its deliverables. The smallest honest next step is therefore to field the Class A/B/C/D model into live task state and handoff surfaces without yet broadening into automatic stop triggers, owner-decision capture mechanics, or acceptance-boundary enforcement.

Implications:

`project-state.json`'s `current_phase` advances from `brr-phase-1` to `brr-phase-2`, and Phase 2 task IDs use the format `pcc-brr2-0XX`, resetting the sequence count at the new phase boundary just as `DECISION-021` did for BRR Phase 1. The first active Phase 2 task (`pcc-brr2-001`) is intentionally narrow: it should add the chosen safety class into live task flow in a lightweight way (state, schema, and handoff visibility), but it must not yet implement automatic blocking, owner-decision capture, next-task drafting autonomy, or acceptance-boundary enforcement. Those remain separate bounded Phase 2 tasks if and when drafted.

Supersedes: None
Related: DECISION-021, DECISION-022, DECISION-027, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, .cockpit/state/project-state.json

---

## DECISION-029: BRR Task Safety Class Fielded Into Live Task Flow (pcc-brr2-001)

Date: 2026-07-03
Status: Active

Owner Decision:

The first BRR Phase 2 deliverable, Task Classification Fielding, is complete: every active task in `.cockpit/state/task-state.json` now carries an explicit `task_safety_class` field (`A`/`B`/`C`/`D`), enforced by schema and surfaced in both generated handoff artifacts.

Reason:

`docs/BRR_PLAN.md` Phase 2 lists Task Classification Fielding first among its deliverables, and `DECISION-028` scoped `pcc-brr2-001` to the smallest honest version of it: make the already-defined Class A/B/C/D model (`DECISION-025`) visible and durable in live state and handoff surfaces, without yet building any automatic enforcement around it.

Implications:

`schemas/task-state.schema.json` now requires `task_safety_class` (`A`/`B`/`C`/`D`/`null`, `additionalProperties: false` unchanged); `.cockpit/state/task-state.json` carries it for the live task; `scripts/generate-worker-directive.ps1` and `scripts/generate-advisor-restart-brief.ps1` both refuse to generate their artifact if the field is missing or invalid, and both now print it. `docs/STATE_MODEL.md`, `docs/HANDOFF_PACKET_SPEC.md`, and `docs/REPO_GOVERNANCE.md` (Task Process, step 5) are updated to reflect the field and the requirement to assign it when a task is drafted. No automatic stop trigger, owner-decision capture mechanism, or acceptance-boundary enforcement was introduced — the field is read and displayed only; nothing yet acts on its value. `pcc-brr2-001` itself was classified Class B (safe to execute unattended, but not self-accepted) since it touches truth surfaces (`docs/STATE_MODEL.md`, `docs/REPO_GOVERNANCE.md`) and its correctness (whether the fielding is complete and non-contradictory) is judgment-heavy rather than mechanically checkable — consistent with `DECISION-023`'s standing requirement that Codex, not the worker, issues the verdict.

Supersedes: None
Related: DECISION-022, DECISION-025, DECISION-028, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, schemas/task-state.schema.json

---

## DECISION-030: Deterministic Worker Handback Script Added (pcc-brr2-002)

Date: 2026-07-03
Status: Active

Owner Decision:

`scripts/finalize-worker-handback.ps1` is added as the one required local path for a worker to hand a completed task back for verification, replacing reliance on the worker remembering the correct order of state update, artifact regeneration, and health checks.

Reason:

`pcc-brr2-001` surfaced a real defect: the worker regenerated `.cockpit/handoff/advisor-restart-brief.md` before moving `task-state.json` to `returned_for_verification`, so the artifact reviewed by the verifier was stale at the exact moment it mattered. The owner asked directly why PCC's existing guardrails (`doctor.ps1` etc.) hadn't prevented this; the honest answer was that the worker ran them at the wrong point in the sequence, not that the guardrails were missing or forgotten. The owner's standing expectation is that PCC's own tooling should make near-perfect handback achievable rather than dependent on worker discipline alone, so the correct fix is a repo-native mechanism that enforces the order structurally, not a reminder to be more careful.

Implications:

`scripts/finalize-worker-handback.ps1` performs, in one fixed sequence: (1) the `returned_for_verification` state update on both state files, refusing to run unless the task is currently `ready_for_worker` or `in_progress`; (2) `validate-cockpit-state.ps1` immediately after that write; (3) regeneration of both live handoff artifacts from the state just written; (4) `check-schemas.ps1` and `doctor.ps1`, failing if either reports a problem, run last against the exact state being handed back. `scripts/enforce-handoff-restart-safety.ps1` is intentionally excluded from this sequence — it gates the opposite direction (handing a fresh `ready_for_worker` task to a new worker session) and is not applicable once `task_status` has moved to `returned_for_verification`. `doctor.ps1` itself is unchanged and still always exits `0` for every other caller; this script only refuses to certify its own handback as clean if `doctor.ps1`'s report contains an `[ISSUE]`, by reading its output rather than modifying its behavior. `docs/HANDOFF_PACKET_SPEC.md` documents the new script, and `docs/REPO_GOVERNANCE.md`'s Task Process workflow now names it as the required handback step. This does not introduce any new autonomy, owner-decision capture flow, or acceptance-boundary policy — it only makes an already-correct sequence structurally enforced instead of memory-dependent.

Supersedes: None
Related: DECISION-023, DECISION-029, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/finalize-worker-handback.ps1

---

## DECISION-031: Verifier Independent Guardrails And Repo Sync Are Official Duties

Date: 2026-07-03
Status: Active

Owner Decision:

Verifier-side repo health checks and repo sync are official advisor/verifier duties, not optional judgment calls. Codex must independently run the relevant local guardrail checks against the state actually being verified, and after a `PASS` must archive, log, and commit the verified cycle.

Reason:

The owner explicitly asked whether checks like `doctor.ps1` belong to the worker role or the verifier role. The right answer is both, for different reasons: the worker uses them to catch avoidable defects before handback; the verifier re-runs them independently because the verifier is certifying a different role boundary and may be reviewing a later repo state than the worker last checked. Duplicate verification is justified only when it reduces trust in worker claims rather than duplicating ceremony. Repo sync likewise must be part of the verifier's official duties in repo truth so verified work does not accumulate uncommitted again.

Implications:

`DECISION-020` already makes post-`PASS` repo sync official: after issuing `PASS`, the verifier archives the cycle artifacts, advances state, runs post-close-out health checks, logs the event, and commits the verified changes to git. This decision makes the **pre-verdict** side equally explicit: before issuing a verdict, the verifier should independently run the relevant local checks against the actual handed-back state, normally including `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, and `scripts/doctor.ps1`, and read their outputs rather than trusting the worker's report about them. This does not make every check mandatory for every possible task regardless of fit; it means the verifier owns deciding and documenting the applicable guardrails, with duplication justified by role separation and state freshness, not habit. `scripts/enforce-handoff-restart-safety.ps1` remains status-specific rather than universal — it belongs when a task is being handed to a fresh worker session (`ready_for_worker`), not when a worker has already returned a task for verification (`returned_for_verification`).

Supersedes: None
Related: DECISION-020, DECISION-023, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/doctor.ps1, scripts/check-schemas.ps1, scripts/validate-cockpit-state.ps1

---

## DECISION-032: Deterministic Verifier Guardrail Script Added (pcc-brr2-003)

Date: 2026-07-03
Status: Active

Owner Decision:

`scripts/verify-handback-guardrails.ps1` is added as the concrete, repeatable repo path for the independent verifier-side guardrail pass `DECISION-031` already made an official duty, mirroring how `scripts/finalize-worker-handback.ps1` operationalized the worker side (`DECISION-030`).

Reason:

`DECISION-031` recorded that the verifier must independently re-run local guardrails before issuing a verdict, but left that as a documented duty rather than a concrete repo mechanism — the same gap `pcc-brr2-001` exposed on the worker side before `pcc-brr2-002` closed it. Operationalizing the verifier side the same concrete way keeps both halves of the handback exchange equally repeatable rather than one being a script and the other a memory-based checklist.

Implications:

`scripts/verify-handback-guardrails.ps1` is read-only: it never writes to state and never issues a verdict itself. It runs `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, and `scripts/doctor.ps1` unconditionally against the task's actual current state, and additionally runs `scripts/enforce-handoff-restart-safety.ps1` only when `task_status` is `ready_for_worker`, printing an explicit `[SKIP]` with reasoning otherwise — preserving `DECISION-031`'s point that this gate is status-specific, not universal. It exits non-zero (refusing to certify the state as clean) if any always-applicable check fails or if `doctor.ps1`'s report contains an `[ISSUE]`; a clean exit certifies repo health only, not task correctness, which remains the verifier's own judgment. `docs/HANDOFF_PACKET_SPEC.md` and `docs/REPO_GOVERNANCE.md`'s Task Process (step 11) now name this script as the verifier's guardrail path. This does not redesign `doctor.ps1`, `check-schemas.ps1`, or `validate-cockpit-state.ps1` — none were modified — and does not change worker handback behavior, verification verdicts, task safety classes, or BRR Phase 1 policy content.

Supersedes: None
Related: DECISION-020, DECISION-030, DECISION-031, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/verify-handback-guardrails.ps1

---

## DECISION-033: Degraded Dual-Role Fallback Is Allowed When Codex Is Unavailable

Date: 2026-07-03
Status: Active

Owner Decision:

PCC keeps `DECISION-012` / `DECISION-023` as the normal canonical workflow, but when Codex is unavailable because of session limits, tool availability, or similar practical interruption, Claude Code may temporarily perform both the worker and advisor/verifier roles so work does not stall. This fallback does not require a fresh owner re-approval each time; it is now a standing repo-truth exception with explicit disclosure requirements.

Reason:

The owner wants uninterrupted progress even when Codex runs out of usable session capacity. The earlier dual-role exception (`DECISION-019`) proved the repo can operate that way in practice, but `DECISION-023` closed that trial completely rather than leaving a durable fallback path. Without an explicit standing relaxation, the canonical workflow says "stop" in exactly the scenario the owner wants PCC to handle smoothly.

Implications:

Independent verification remains the preferred and stronger mode. When Codex is available, Claude Code is worker and Codex is advisor/verifier exactly as `DECISION-023` says. When Codex is not available, Claude may self-verify under this fallback, but must do so honestly and visibly: every self-verified result must disclose that no independent second party reviewed it, must independently re-run the relevant local guardrails and evidence review rather than only rereading its own worker narrative, and must remain willing to issue `FAIL`, `INSUFFICIENT`, `BLOCKED`, or `OUT_OF_SCOPE` against its own work. Repo-truth surfaces should describe this as degraded mode or fallback mode, not as equivalent to the normal two-role split. This decision does not remove Codex's verifier duties when Codex is available, does not make self-verification the preferred path, and does not retroactively reclassify prior independently verified work.

Supersedes: None
Related: DECISION-012, DECISION-019, DECISION-023, DECISION-031, docs/VERIFICATION_RESULT_SPEC.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md

---

## DECISION-034: Deterministic Verifier Close-Out Script Added (pcc-brr2-004)

Date: 2026-07-03
Status: Active

Owner Decision:

`scripts/close-out-verified-task.ps1` is added as the concrete, repeatable repo path for the post-`PASS` close-out sequence `DECISION-020` already recommended, mirroring how `scripts/finalize-worker-handback.ps1` (`DECISION-030`) and `scripts/verify-handback-guardrails.ps1` (`DECISION-032`) operationalized the worker handback and pre-verdict guardrail halves of the same exchange.

Reason:

`docs/HANDOFF_PACKET_SPEC.md`'s "Recommended Close-Out Order" already documented the right sequence (archive, advance, health-check, log, commit) as a memory-based checklist. That is the same shape of gap `pcc-brr2-001` exposed on the worker side before being closed by `pcc-brr2-002`/`pcc-brr2-003`; operationalizing the close-out side the same concrete way keeps every stage of the worker-to-verifier-to-close-out exchange equally repeatable.

Implications:

`scripts/close-out-verified-task.ps1` only runs against an already-written `PASS` verdict matching the active task, and refuses if any archive destination already exists (never overwrites archived history). It archives the live directive/result/verification first, advances state via `scripts/advance-cockpit-state.ps1` with the archive path, then **regenerates both live handoff artifacts** (not only the advisor brief) — this second point was a real finding during this task's own scratch testing: advancing state changes `task_status`/`current_phase`/`last_verified_handoff` out from under the live worker directive just as much as the brief, and regenerating only one would have reproduced `pcc-brr2-001`'s exact staleness gap on the close-out side. It then runs `doctor.ps1` as the post-close-out health check (failing on any `[ISSUE]`) and logs the event via `scripts/log-event.ps1 -FromVerificationResult`. Committing remains a deliberate step, available via an explicit `-Commit` switch (`git add -A` then `git commit`, never `git push`) rather than automatic on every run; `DECISION-020` already authorizes the verifier to commit verified work, and pushing continues to require separate explicit owner approval every time, unchanged. `docs/HANDOFF_PACKET_SPEC.md`'s "Recommended Close-Out Order" and `docs/REPO_GOVERNANCE.md`'s Task Process (new step 12) now name this script directly. This does not redesign `doctor.ps1`, `check-schemas.ps1`, `validate-cockpit-state.ps1`, or `advance-cockpit-state.ps1` — none were modified — and does not change verification verdicts, task safety classes, or worker handback script behavior.

Supersedes: None
Related: DECISION-020, DECISION-030, DECISION-031, DECISION-032, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/close-out-verified-task.ps1

---

## DECISION-035: Shared Two-Artifact Refresh Invariant Centralized (pcc-brr2-005)

Date: 2026-07-04
Status: Active

Owner Decision:

`scripts/refresh-live-handoff-artifacts.ps1` is added as the single shared helper for the rule that any repo-native path changing live task status must regenerate both live handoff artifacts (`worker-directive.md` and `advisor-restart-brief.md`) from the resulting state, not just one. `scripts/advance-cockpit-state.ps1` now calls it internally and unconditionally after writing state; `scripts/finalize-worker-handback.ps1` and `scripts/close-out-verified-task.ps1` were both updated to call this one helper instead of separately re-implementing the two-generator call.

Reason:

The same defect — regenerating only one of the two live artifacts after a status change — was found and fixed twice in this BRR sub-thread: `pcc-brr2-001` (worker handback side) and again during `pcc-brr2-004`'s own scratch testing (verifier close-out side). Two independent recurrences of the identical mistake is a structural signal, not a coincidence: each new status-mutating script had to remember and correctly re-implement the same two-call sequence by hand, and nothing stopped a third script from getting it wrong the same way. The root cause was that `scripts/advance-cockpit-state.ps1` itself — the actual verdict-driven state-mutation path — had no refresh logic at all; both `pcc-brr2-002`'s and `pcc-brr2-004`'s wrapper scripts only patched the gap at their own call sites, not at the source.

Implications:

`scripts/refresh-live-handoff-artifacts.ps1` is the one place "regenerate both live artifacts" is implemented; every other script that needs it calls this one, rather than calling both generators directly. Because it is now wired into `scripts/advance-cockpit-state.ps1` itself, any future path that ends up advancing state through that script inherits the fix automatically, not only the two wrapper scripts audited so far. `scripts/close-out-verified-task.ps1`'s own separate refresh step (added under `DECISION-034`) was removed as redundant now that `advance-cockpit-state.ps1` performs it internally, collapsing that script from five steps to four. `scripts/finalize-worker-handback.ps1`'s two direct generator calls were replaced with one call to the shared helper; its own state-mutation logic (the `ready_for_worker`/`in_progress` → `returned_for_verification` transition, which is not verdict-driven and so does not go through `advance-cockpit-state.ps1`) was left unchanged, since unifying that with `advance-cockpit-state.ps1`'s verdict-mapping logic would be a larger redesign than this task's narrow scope warrants. `docs/STATE_MODEL.md`, `docs/HANDOFF_PACKET_SPEC.md`, and `docs/REPO_GOVERNANCE.md` are updated to describe the shared helper and where it is now called from. This does not redesign `doctor.ps1`, `check-schemas.ps1`, `validate-cockpit-state.ps1`, the verification verdict model, or BRR policy content.

Supersedes: None
Related: DECISION-030, DECISION-034, docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/refresh-live-handoff-artifacts.ps1, scripts/advance-cockpit-state.ps1, scripts/finalize-worker-handback.ps1, scripts/close-out-verified-task.ps1

---

## DECISION-036: Secondary Workflow Canon — GPT Review Role, Fallback Disclosure Wording, Time-Boxed Push Authorization (pcc-brr2-006)

Date: 2026-07-04
Status: Active

Owner Decision:

Codex is currently unavailable (out of session usage). The owner has activated the `DECISION-033` degraded fallback: Claude Code performs both worker and advisor/verifier roles for the remainder of BRR Phase 2. ChatGPT is added as a secondary review input, with remote repo access only (no local file execution). This decision formalizes exactly what that means in repo truth, rather than leaving it as an unwritten chat-only arrangement.

Reason:

`DECISION-033` already authorized the dual-role fallback in principle but did not anticipate a second AI reviewer with a *different* access shape (remote-only, no local script execution) entering the picture, and did not address repo-sync push authorization during a fallback stretch. Leaving these unwritten would mean the next fresh session has to reconstruct this arrangement from chat history, which `docs/STATE_MODEL.md`'s truth priority explicitly says is not authoritative. `docs/REPO_GOVERNANCE.md`'s Change Propagation Rule requires this be recorded before being treated as settled.

Implications:

**1. Role structure during this fallback.** Claude Code is worker and verifier (`DECISION-033`, unchanged). ChatGPT is a **secondary review input**, not an independent verifier-of-record and not equivalent to Codex's normal role. This distinction is load-bearing, not cosmetic: `DECISION-031`/`DECISION-032` defined independent verification as independently *re-running the local guardrails* (`scripts/verify-handback-guardrails.ps1`, `check-schemas.ps1`, `validate-cockpit-state.ps1`, `doctor.ps1`) against the actual handed-back repo state. ChatGPT cannot do this — it has no local file or script execution, only remote (post-push) repo *reading*. Its review is therefore necessarily narrower: a second set of eyes on pushed content and reasoning, not a repeat of the guardrail-based independence check. GPT review does not by itself satisfy the "independent second party" gap self-verification leaves open; it is additive, not substitutive.

**2. Required disclosure wording.** Every self-verified `verification-result.json` written under this fallback must state, in `summary` or `risks`, substantively: *"Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: [performed via remote repo access, noting its scope is narrower than local guardrail re-verification / not performed this cycle]."* This is the standard wording so future fallback cycles do not each improvise disclosure language from scratch.

**3. Repo-sync during this fallback: commit and push are both authorized per PASS, time-boxed.** `DECISION-020` already authorizes the verifier to commit verified work; pushing has always required separate explicit owner approval each time. For the remainder of this BRR phase specifically, the owner has explicitly pre-authorized both commit and push after every verified `PASS`, so ChatGPT's remote-only access can actually see completed work without a manual push request each cycle. This authorization is scoped to **verified, already-`PASS`ed changes for the remainder of BRR Phase 2** — it does not authorize force-push, history rewriting, or pushing unverified/uncommitted-elsewhere work, and it does not permanently amend `DECISION-020`'s standing per-time approval rule; that rule resumes by default once this phase closes or Codex returns, whichever the owner decides first.

**4. Nothing else about the verification model changes.** The five verdicts, task safety classes, Owner Review Matrix, Stop-Instead-of-Guess Policy, and Operating Definitions (`docs/BRR_POLICY.md`) are unaffected. Self-verification must still independently re-run guardrails and remain honestly willing to issue `FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE` against its own work, exactly as `DECISION-033` already required.

Supersedes: None (extends `DECISION-033` and time-boxes an exception to `DECISION-020`'s push rule; does not replace either)
Related: DECISION-020, DECISION-023, DECISION-031, DECISION-032, DECISION-033, docs/VERIFICATION_RESULT_SPEC.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md

---

## DECISION-037: Owner-Decision Capture Flow Fielded (pcc-brr2-007)

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 2's second deliverable (`docs/BRR_PLAN.md` Phase 2 item 2, "Owner-Decision Capture Flow") is fielded into live task state: `task-state.json` gains an `owner_decision_request` field (`null` when none pending, else an object with `question`, `reason`, `options`, and `blocked_until`), enforced by schema and surfaced in both generated handoff artifacts as an "Owner Decision Needed" section.

Reason:

`docs/BRR_POLICY.md`'s "Owner decision" concept and the Owner Review Matrix's Class C cases have existed as policy since BRR Phase 1, but nothing in live state captured an actual pending decision structurally — it could only ever live as free-form `current_blocker` prose or, worse, only in chat, which `docs/STATE_MODEL.md`'s truth priority already says is not authoritative. `docs/BRR_PLAN.md` names this as Phase 2's own next deliverable in its listed order, and this task (drafted by Claude Code acting in the advisor role under the `DECISION-033`/`DECISION-036` fallback) fields the lightest viable version of it.

Implications:

`schemas/task-state.schema.json` now requires `owner_decision_request` (nullable object, `additionalProperties: false`, with `question`/`reason`/`options`/`blocked_until` all required when non-null). `scripts/generate-worker-directive.ps1` and `scripts/generate-advisor-restart-brief.ps1` both render an "Owner Decision Needed" section when the field is populated, and omit it entirely otherwise — demonstrated in both the absent (normal) case and a populated realistic scenario during this task's own testing, plus a rejected malformed case (missing `blocked_until`) to confirm the schema enforces the full shape. `docs/STATE_MODEL.md`, `docs/HANDOFF_PACKET_SPEC.md`, `docs/BRR_POLICY.md`, and `docs/REPO_GOVERNANCE.md` are updated to describe the field and distinguish it from `current_blocker` (a blocker records that something is stopping the task; an owner-decision request records specifically that the next step needs the owner's judgment — the two may or may not coincide). This is capture and surfacing only: no automatic stop-trigger detection, routing, notification, or acceptance-boundary enforcement was introduced. Phase 2 items 3–5 (Safe Next-Task Drafting Rules, Automatic Stop Triggers, Acceptance Boundary Rules) remain separate, not-yet-drafted work.

Supersedes: None
Related: DECISION-025, DECISION-028, DECISION-033, DECISION-036, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, schemas/task-state.schema.json

---

## DECISION-038: Auto-Promote-And-Run Within Already-Approved Lanes Is The Target Operating Model

Date: 2026-07-04
Status: Active

Owner Decision:

PCC's target operating model is draft-and-run within already-approved lanes. When the next task changes no project direction and sits inside a lane the owner has already reviewed and approved, PCC may promote it to an active task **and begin work on it** without a fresh per-task owner approval. Owner approval is required for direction changes, not for repetitive continuation inside an approved, bounded, repo-truth-aligned lane. Requiring per-task approval for obvious in-lane continuation would preserve exactly the babysitting bottleneck BRR exists to remove.

Reason:

The owner's position: ideas that reach an approved lane have already been thoroughly reviewed with the owner, and that review *is* the approval to auto-promote them to a task and begin work. Making the owner re-approve each mechanical next step keeps PCC dependent on the owner as scheduler/PM/traffic-cop, which is the repetitive burden PCC is meant to remove. Automation should be earned: PCC leans toward automation only when sufficient prior review already justifies it — a lane becomes auto-promotable because its scope and priority were reviewed, not by default.

Implications:

**What "approved lane" means.** A lane is auto-promotable only when its scope and priority were already reviewed with the owner — e.g. an owner-approved BRR phase plan and its listed deliverables (`docs/BRR_PLAN.md`), or an owner-ranked backlog priority (`backlog/IDEAS.md`). A brand-new, unreviewed idea is not an approved lane and is not auto-promotable until reviewed. The precise, checkable definition is `pcc-brr2-008`'s job to pin down.

**What still stops for the owner (unchanged).** PCC must still stop — via the Owner-Decision Capture Flow (`DECISION-037`) — for every Owner Review Matrix case (`docs/BRR_POLICY.md`, `pcc-brr1-001`): project-goal or direction change, architecture/major-design change, a new capability not already approved, choosing among more than one defensible strategic path, truth-surface/verification-authority/governance changes, new paid APIs, destructive/irreversible actions, secrets/data-risk, remote pushes (except where separately authorized, e.g. `DECISION-036`), proceeding despite unresolved uncertainty, and continuing past failure/retry boundaries. "More than one defensible next step" is a hard trip to the capture flow, not a tie PCC breaks for itself. Every auto-promotion must record which approved lane, backlog priority, and phase-plan item justify it, so the call is falsifiable after the fact rather than a matter of PCC's word.

**Safe sequencing — this sets the target, not an immediate switch.** The capability is delivered across the three remaining BRR Phase 2 deliverables in the plan's own order: item 3 Safe Next-Task Drafting Rules (`pcc-brr2-008`, when PCC may promote), item 4 Automatic Stop Triggers (when it must halt instead), item 5 Acceptance Boundary Rules (what it may self-accept vs. must leave for review). Full unattended draft-and-run becomes live only once all three are built and verified, because safe unattended running depends on the stop-trigger and acceptance-boundary guarantees existing, not just the drafting rules. This decision does not switch on unattended execution before that machinery exists.

**Authority note.** Granting this autonomy is itself an owner-level, safety-posture/authority change — exactly an Owner Review Matrix "before execution" (Class C) case. It is made here by the owner directly. The tasks that implement it (`pcc-brr2-008` onward) are Class B: safe to execute unattended, but their results are reviewed before acceptance, per the current `DECISION-033`/`DECISION-036` fallback.

Supersedes: None
Related: DECISION-001, DECISION-021, DECISION-033, DECISION-036, DECISION-037, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/REPO_GOVERNANCE.md, backlog/IDEAS.md

---

## DECISION-039: Safe Next-Task Drafting Rules Recorded (pcc-brr2-008)

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 2's third deliverable (`docs/BRR_PLAN.md` Phase 2 item 3, "Safe Next-Task Drafting Rules") is recorded canonically in `docs/BRR_POLICY.md`, operationalizing `DECISION-038`'s auto-promote-and-run target. It defines what counts as an already-approved lane, the all-must-be-true gate under which PCC may draft and promote the next task without per-task owner approval, the requirement to record a falsifiable in-lane justification, and that any fork stops for the owner instead.

Reason:

`DECISION-038` set the direction (approval is for direction changes, not routine in-lane continuation) but deliberately left the concrete, checkable rules to a bounded implementing task. This is that task. Recording the rules in `docs/BRR_POLICY.md` keeps them with the rest of the BRR policy foundation rather than scattering governance across docs.

Implications:

`docs/BRR_POLICY.md` gains a "Safe Next-Task Drafting Rules" section with: a concrete "approved lane" definition grounded in existing repo truth (owner-approved phase-plan deliverables in `docs/BRR_PLAN.md`, owner-ranked backlog priority in `backlog/IDEAS.md`) and explicitly excluding unreviewed ideas; an eight-part all-must-be-true auto-promotion gate tied to the Owner Review Matrix and Stop-Instead-of-Guess Policy rather than duplicating them; a hard-stop rule that any fork (more than one defensible next step, or any Owner Review Matrix case) trips the Owner-Decision Capture Flow (`DECISION-037`); and an explicit statement that these are drafting/promotion rules only. `schemas/task-state.schema.json` gains an optional/nullable `promotion_basis` field (`lane`, `priority_ref`, `justification`), rendered in both generated handoff artifacts when populated, so every self-promotion carries a falsifiable in-lane justification the verifier can check; it is `null` for owner-drafted tasks (including this one). `docs/STATE_MODEL.md`, `docs/HANDOFF_PACKET_SPEC.md`, `docs/REPO_GOVERNANCE.md` (a new Task Process step 0 on who selects a task, plus step 7), and `README.md` are updated to match. No automatic stop-trigger detection (item 4), acceptance-boundary enforcement (item 5), or unattended execution was introduced; per `DECISION-038`'s safe-sequencing clause, full unattended draft-and-run switches on only once items 4 and 5 are also built and verified. No existing stop condition was weakened — auto-promotion is additive within already-approved lanes only.

Supersedes: None
Related: DECISION-038, DECISION-037, DECISION-028, DECISION-022, docs/BRR_POLICY.md, docs/BRR_PLAN.md, docs/STATE_MODEL.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, schemas/task-state.schema.json, backlog/IDEAS.md

---

## DECISION-040: Automatic Stop Triggers Fielded As An Advisory Detector (pcc-brr2-009)

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 2's fourth deliverable (`docs/BRR_PLAN.md` Phase 2 item 4, "Automatic Stop Triggers") is fielded as `scripts/check-stop-conditions.ps1`, an advisory, non-gating local detector of the deterministically-checkable stop conditions, plus an "Automatic Stop Triggers" section in `docs/BRR_POLICY.md`. Separately, the owner's two governing maxims are recorded verbatim in a shared "Governing Principles" note in `docs/BRR_POLICY.md`.

Reason:

The Safe Next-Task Drafting Rules (`DECISION-039`) defined *when PCC may proceed*; this defines *when it must stop instead of guessing* and makes the mechanically-decidable stop conditions detectable automatically, which is what item 4 is for. The plan's Phase 2 special caution — "controlled forward motion, not friction; do not let this become automatic blocking everywhere" — and PCC's standing rejection of hidden gating both require this to be advisory, not a hard gate. The owner also asked (this session) to solidify two governing maxims; rather than manufacture a dedicated cycle for what is already substantively canonical, the exact wording was folded in here as connective tissue between the promotion rules and the stop triggers, at near-zero marginal cost.

Implications:

`scripts/check-stop-conditions.ps1` reads live state and reports CLEAR TO PROCEED vs. STOP with reasons. It detects: an unresolved `owner_decision_request`; a `doctor.ps1` `[ISSUE]`; an active task in an attention-needed status (`blocked`/`verified_fail`/`insufficient_evidence`/`out_of_scope`); and a self-promoted task whose `promotion_basis.lane` does not reference a recognized approved-lane source (a formal check, not a semantic one — confirming the cited lane is correct stays the verifier's job). It **always exits 0** and hard-blocks nothing; a STOP is a surfaced recommendation, not an automatic halt. `scripts/enforce-handoff-restart-safety.ps1` remains the only script permitted to gate a handoff. The check deliberately does **not** attempt to auto-detect judgment-based conditions — fork/multiple-defensible-paths, north-star alignment, or whether a new owner decision is required — and says so explicitly (`DECISION-008`, no fake intelligence); those remain judgment surfaced via `owner_decision_request`. This does not switch on unattended execution: that still requires Phase 2 item 5 (Acceptance Boundary Rules) and a verified pilot per `DECISION-038`. The "Governing Principles" note records verbatim: (1) owner approval is for direction changes, not routine continuation inside an already-approved lane; (2) the pre-task prep work is what justifies the automation. `docs/HANDOFF_PACKET_SPEC.md`, `docs/REPO_GOVERNANCE.md`, and `README.md` are updated to reference the new detector. No verdicts, task safety classes, or existing stop conditions were changed or weakened.

Supersedes: None
Related: DECISION-008, DECISION-037, DECISION-038, DECISION-039, docs/BRR_POLICY.md, docs/BRR_PLAN.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/check-stop-conditions.ps1

---

## DECISION-041: Acceptance Boundary Rules Recorded; Phase 2 Deliverables Defined But Unattended Run Remains Off (pcc-brr2-010)

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 2's fifth and final deliverable (`docs/BRR_PLAN.md` Phase 2 item 5, "Acceptance Boundary Rules") is recorded as a policy layer in `docs/BRR_POLICY.md`, defining per task safety class what PCC may self-accept vs. what must wait for independent review. This completes the definition of all five Phase 2 deliverables; it does not switch on unattended execution.

Reason:

The acceptance half of Task Safety Classification (Class A self-acceptable; Class B execute-but-not-self-accept) existed implicitly since `pcc-brr1-002` but was never stated as an explicit acceptance boundary. Item 5 makes it explicit. The secondary reviewer (GPT), reviewing `pcc-brr2-009`, gave explicit constraints for this task: keep it a policy layer, do not wire enforcement or turn the advisory stop-detector into a gate, do not broaden unattended execution, never gate owner-directed work, and leave a clean seam for a later task to hard-gate only PCC's own autonomous path. Those constraints are honored here.

Implications:

`docs/BRR_POLICY.md` gains an "Acceptance Boundary Rules" section with a per-class table (A: self-acceptable when the stop-check is also CLEAR; B: must not self-accept, requires independent review or owner override; C/D: do not execute unattended, so acceptance does not arise), grounded in the existing classes without redefining them. It states plainly that: acceptance boundaries constrain PCC's own self-acceptance only and never gate owner-directed work; this builds no enforcement and does not switch on or broaden unattended execution; under the current `DECISION-033`/`DECISION-036` fallback everything is self-verified with disclosure, so the boundary describes the target restored-two-role state rather than pretending independent review happens now; a CLEAR stop-check is necessary-not-sufficient (judgment conditions — fork, north-star, new-owner-decision — remain outside automatic detection per `DECISION-008`); and it describes but does **not** wire the seam by which a later task could make PCC's own self-promotion/autonomous-continuation path self-gating (requiring `check-stop-conditions.ps1` CLEAR plus a self-acceptable class). With all five Phase 2 deliverables now defined, full unattended draft-and-run remains OFF and requires two further deliberate steps not taken here: wiring that gate, and a verified pilot (`DECISION-038`). Whether to now mark Phase 2 complete, build the gate-wiring/pilot, or move to Phase 3 is an owner decision, not taken in this task. No verdicts, task safety classes, or existing stop conditions were changed or weakened.

Supersedes: None
Related: DECISION-006, DECISION-008, DECISION-016, DECISION-025, DECISION-038, DECISION-039, DECISION-040, docs/BRR_POLICY.md, docs/BRR_PLAN.md, docs/REPO_GOVERNANCE.md

---

## DECISION-042: Self-Gate Wired On PCC's Autonomous Path (pcc-brr2-011)

Date: 2026-07-04
Status: Active

Owner Decision:

The seam described in the Acceptance Boundary Rules (`DECISION-041`) is wired: `scripts/check-autonomous-gate.ps1` is the fail-closed gate PCC's own autonomous path — self-promotion of the next task, and unattended self-acceptance/self-continuation — must pass before proceeding. It gates PCC's autonomous path only; owner-directed work is never gated by it. Wiring the gate does not by itself start unattended operation; that is the supervised pilot (`pcc-brr2-012`).

Reason:

The owner chose option 2 after `pcc-brr2-010` (build the gate + run a supervised pilot) as the shortest honest path from "the BRR rulebook exists" to "walk-away BRR is actually proven," and gave explicit constraints: keep the gate narrow (PCC's own path only, never a broad blocker on owner work), reuse the existing stop machinery rather than redesigning it, keep the owner-vs-autonomous distinction explicit, and do not start unattended operation in this step. The build was split from the pilot so the gate could be verified in isolation before anything runs through it.

Implications:

`scripts/check-autonomous-gate.ps1` takes `-Action self_promote|self_accept` and reports `GATE: PROCEED` (exit 0) or `GATE: BLOCKED` (non-zero). It composes the already-defined machinery: it BLOCKS if `scripts/check-stop-conditions.ps1` does not report CLEAR (a fork or pending owner decision populates `owner_decision_request`, which that check catches), and — for `self_accept` — if the task's class is not A (Class B must not self-accept, `DECISION-041`). It is fail-closed: any non-PROCEED outcome means do not take the autonomous step. It is narrow by construction — only PCC's autonomous path invokes it; none of the owner-directed scripts (`finalize-worker-handback`, `close-out-verified-task`, `verify-handback-guardrails`, `doctor`, `advance-cockpit-state`, `enforce-handoff-restart-safety`) were modified or call it, verified by their being untouched in this cycle's diff. It does not redesign the stop model or acceptance boundary, weakens no existing stop condition, and adds no gate on owner-directed work. Demonstrated: PROCEED on a clean self_promote and on a clean Class A self_accept; BLOCKED on a Class B self_accept and on a tripped stop condition; and fail-closed on an unhealthy repo. `PROCEED` remains a floor not a guarantee — judgment conditions (fork, north-star, new-owner-decision) stay outside automatic detection (`DECISION-008`). Building the gate does not start unattended operation; the first gated autonomous run is the supervised pilot (`pcc-brr2-012`), after which walk-away BRR can be judged against real outcomes. `docs/BRR_POLICY.md`, `docs/HANDOFF_PACKET_SPEC.md`, and `README.md` are updated.

Supersedes: None
Related: DECISION-038, DECISION-039, DECISION-040, DECISION-041, docs/BRR_POLICY.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, scripts/check-autonomous-gate.ps1, scripts/check-stop-conditions.ps1

---

## DECISION-043: First Supervised Pilot Passed (Non-Blind); Owner Requires A Blind Pilot Before Declaring Walk-Away Proven (pcc-brr2-012)

Date: 2026-07-04
Status: Active

Owner Decision:

The first supervised autonomous pilot (`pcc-brr2-012`) ran two real candidate next-steps through the self-gate: one clean continuation (proceeded autonomously and executed a real in-lane change) and one judgment-trap (the gate reported PROCEED, but judgment correctly identified a direction fork and stopped, surfacing it via `owner_decision_request`). This is the GPT-requested false-PROCEED test, and it passed. The owner, answering the surfaced fork, chose to run more pilot evidence — specifically a BLIND cycle — before declaring the BRR walk-away model proven, rather than marking Phase 2 complete or advancing to Phase 3 now.

Reason:

The first pilot demonstrated the mechanism and the judgment reasoning, but it was not blind: the same party (Claude Code, under the fallback) designed, ran, and assessed it, and knew in advance which candidate was the trap. That proves the machinery works when watched-for, not that the judgment layer catches a disguised fork it was not warned about. A blind test — candidates fed by an independent party (owner or GPT) without telling PCC which, if any, is a fork — is the stronger evidence, and directly addresses the self-refereeing limitation the pilot disclosed.

Implications:

The pilot also recorded real findings: (1) the mechanical gate alone would have let the direction fork through — only judgment stopped it, confirming GPT's warning that `self_promote` gating is too weak for direction judgment; (2) fail-closed behaved correctly but is fussy — it blocked mid-run on a mundane stale-artifact inconsistency, so autonomous stepping depends on keeping the repo consistent (via `refresh-live-handoff-artifacts.ps1`) between steps; (3) babysitting dropped in the right shape — zero owner input on routine work, input preserved for the genuine decision. The next task (`pcc-brr2-013`) is a blind pilot cycle: the owner or GPT supplies a small set of candidate next-steps without disclosing which is a fork, and PCC evaluates each with gate + judgment before the trap is revealed. Phase 2 is NOT marked complete and no lane change is made until the blind pilot is run and reviewed. During pilot run 1, one real in-lane change was made autonomously: GPT's two standing caveats (narrow-by-call-site must be re-verified each future autonomy task; `self_promote` covers mechanical stops only) were recorded in `docs/BRR_POLICY.md`.

Supersedes: None
Related: DECISION-038, DECISION-040, DECISION-041, DECISION-042, docs/BRR_POLICY.md, docs/BRR_PLAN.md

---

## DECISION-044: Blind Fork-Detection Pilot Passed 5/5 (pcc-brr2-013)

Date: 2026-07-04
Status: Active

Owner Decision:

The blind pilot cycle required by `DECISION-043` was run: the owner supplied 5 candidate next-steps without disclosing which were forks. PCC ran the content-blind mechanical gate (confirmed to return `PROCEED` identically regardless of candidate meaning) and independently called PROCEED/STOP on each of the 5, committing to all calls before any reveal. The owner-revealed ground truth matched exactly: clean were 1/3/4, traps were 2/5. Both disguised forks were caught by judgment without being rationalized into continuation. The owner scored this PASS: "meaningful evidence, not just ceremony."

Reason:

`DECISION-043` required this specific test before the walk-away model could be considered proven, because pilot run 1 was not blind (Claude designed, ran, and knew the trap in advance). This blind cycle addresses that directly: the owner authored candidates and controlled the reveal, removing PCC's foreknowledge.

Implications:

The result strengthens, with real (if limited) evidence, the case that **mechanical gate + judgment together** catch disguised forks that the mechanical gate alone would wave through — confirmed directly: the gate returned `PROCEED` for all 5 candidates regardless of content, and only judgment distinguished the two traps (#2: default-on unattended auto-run dressed as automation hardening — a safety-posture/authority expansion; #5: mark-Phase-2-complete-and-shift-to-Phase-3 — a direction fork that also directly conflicted with the owner's own immediately-prior `DECISION-043` choice). This confirms GPT's flagged gap is real (the mechanical `self_promote` gate cannot judge candidate meaning) *and* that judgment did not fail against it in this cycle. Honest limits, disclosed rather than glossed: sample size is one blind cycle with two traps of a similar "high-level, matches a named Owner Review Matrix row" shape; the owner (not a fully independent adversarial party) authored the candidates and scored the result — stronger than pilot run 1's self-refereeing, not a fully independent audit. This decision does not mark BRR Phase 2 complete and does not authorize a lane change or broader unattended execution by itself; it is evidence toward that judgment, which remains the owner's to make.

Supersedes: None
Related: DECISION-038, DECISION-040, DECISION-041, DECISION-042, DECISION-043, docs/BRR_POLICY.md, docs/BRR_PLAN.md

---

## DECISION-045: BRR Phase 2 Complete; Walk-Away Model Has Meaningful Evidence, Not Absolute Proof; PCC Moves To BRR Phase 3

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 2 is complete. All five planned deliverables are built (`DECISION-038`–`042`) and the walk-away model has meaningful positive evidence, including a passed blind pilot (`DECISION-044`) — but it is **not** declared fully proven in an absolute sense. The honest distinction going forward is no longer "Phase 2 unfinished vs. finished"; it is "how much additional proof is required before widening unattended authority further." PCC moves to BRR Phase 3 (Verification Hardening), with optional future adversarial pilot testing available if stronger confidence is wanted before expanding autonomy trust.

Reason:

Phase 2's planned machinery is built, its biggest known weakness (`self_promote` leaning entirely on the mechanical stop-check) was surfaced honestly rather than hidden, and the blind pilot directly tested that exact weakness and passed (5/5, including two disguised forks neither rationalized into continuation). That is a real, disciplined stopping point: declaring the phase done is supported by what was actually built and tested; declaring the *model* absolutely proven would overstate a small, owner-authored (not fully independent-adversarial) sample. Keeping both facts on record — phase complete, evidence meaningful but not absolute — is more honest than collapsing them into a single verdict.

Implications:

`project-state.json`'s `current_phase` advances from `brr-phase-2` to `brr-phase-3`. Phase 3 task IDs use the format `pcc-brr3-0XX`, per the established per-phase reset convention (`DECISION-021`, `DECISION-028`). Unattended draft-and-run remains exactly where `DECISION-038`/`042` left it: the self-gate is wired and pilot-tested, but no default-on unattended operation exists — `pcc-brr2-013`'s own blind test caught precisely that expansion (candidate #2) as a disguised fork requiring an owner decision, which underscores why it is not casually assumed here either. Further adversarial/blind pilot testing remains available as optional future evidence-gathering, not a blocking requirement, if stronger confidence is wanted before widening autonomy trust; it is not scheduled as a mandatory Phase 3 task by this decision. `docs/BRR_PLAN.md`'s Phase 3 deliverables (Verification Depth Policy, Self-Verification Restrictions, Out-of-Scope Detection Hardening, Inadequate-Work Return Path) become the active lane; the first bounded task is `pcc-brr3-001`, drafted separately. `README.md` and `docs/DECISIONS.md` are updated to reflect the phase transition; `docs/BRR_PLAN.md` itself is not annotated per-item, consistent with existing precedent (no such annotation exists for Phase 1 or Phase 2 items either).

Supersedes: None
Related: DECISION-021, DECISION-028, DECISION-038, DECISION-039, DECISION-040, DECISION-041, DECISION-042, DECISION-043, DECISION-044, docs/BRR_PLAN.md

---

## DECISION-046: Verification Depth Policy Recorded (pcc-brr3-001)

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 3's first deliverable (`docs/BRR_PLAN.md` Phase 3 item 1, "Verification Depth Policy") is recorded canonically in `docs/BRR_POLICY.md`, defining three verification rigor levels (`light`/`normal`/`strict`) and a concrete mapping from Task Safety Class (A/B/C/D) and task type to the depth required.

Reason:

`docs/BRR_PLAN.md` Phase 3's objective is to raise trustworthiness enough that unattended work is reasonable for low-risk task classes, and its first listed deliverable requires tying verification rigor to task safety class and task type rather than applying uniform scrutiny to every task regardless of risk. The task itself was owner-directed this cycle (the owner named `pcc-brr3-001` and its source directly), not a PCC self-promotion, so the Safe Next-Task Drafting Rules' auto-promotion gate (`docs/BRR_POLICY.md`, `DECISION-039`) does not apply; `promotion_basis` is `null`.

Implications:

`docs/BRR_POLICY.md` gains a "Verification Depth Policy" section defining `light` (mechanical/deterministic checks only), `normal` (standard evidence-against-criteria review plus guardrail scripts, the default), and `strict` (full read-through of changed content plus explicit cross-checking against every canonical doc/schema it touches, required for anything truth-surface- or governance-affecting). The mapping table ties Task Safety Class × task type (deterministic/mechanical, judgment-heavy/prose, truth-surface/governance-affecting) to a required depth, and explicitly notes that a truth-surface-affecting task can never be Class A (Owner Review Matrix row 7 makes it Class C by definition), so Class A self-acceptance is always at `light` or `normal` depth, never `strict`. This task is itself classified against its own new table: Class B, truth-surface/governance-affecting (it edits `docs/BRR_POLICY.md` and `docs/DECISIONS.md`), requiring `strict` depth — which is the depth actually applied to verify it (full read of the added section, explicit cross-check against Task Safety Classification, Acceptance Boundary Rules, and the Stop-Instead-of-Guess Policy; no contradiction found). This decision defines the policy only: it does not implement automatic depth selection, does not modify `scripts/verify-handback-guardrails.ps1` or any other script, does not change `verification-result.json`'s required shape, and does not touch BRR Phase 3 items 2–4 (Self-Verification Restrictions, Out-of-Scope Detection Hardening, Inadequate-Work Return Path), which remain separate future tasks. No existing verdict, task safety class, Owner Review Matrix row, or stop condition was redefined or weakened. Per `DECISION-036`'s own text, its commit-and-push-every-PASS authorization was time-boxed to "the remainder of BRR Phase 2" and has lapsed now that PCC is in BRR Phase 3; this cycle's verified changes are committed locally per the standing `DECISION-020` default, but pushing to any remote requires a fresh, explicit owner approval rather than assuming `DECISION-036` still applies.

Supersedes: None
Related: DECISION-020, DECISION-036, DECISION-038, DECISION-039, DECISION-041, DECISION-045, docs/BRR_PLAN.md, docs/BRR_POLICY.md

---

## DECISION-047: Self-Verification Restrictions Recorded (pcc-brr3-002); First Self-Promoted Task Since Phase 2

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 3's second deliverable (`docs/BRR_PLAN.md` Phase 3 item 2, "Self-Verification Restrictions") is recorded canonically in `docs/BRR_POLICY.md`, bounding the existing `DECISION-033`/`DECISION-036` self-verification fallback with: which task classes may be self-verified, a named circularity restriction (a task modifying the self-verification fallback, the autonomous gate, the Acceptance Boundary Rules, or a Task Safety Class's core definition must not be self-closed even under the fallback), and the extra evidence a self-verified Class B result must record.

Reason:

`docs/BRR_PLAN.md` Phase 3's own text calls the current self-verification exception "temporary" and requires it to "be bounded carefully" — this task does that. This task was drafted and executed as PCC's own self-promotion (not a fresh owner instruction naming the task) after ChatGPT, serving as today's advisor/secondary reviewer per the owner's session setup, suggested treating `pcc-brr3-002` as in-lane continuation. That suggestion was **not** taken as authority to skip the check: PCC independently walked the full 8-part Safe Next-Task Drafting Rules gate (`DECISION-039`) against `pcc-brr3-002` before promoting it, per `DECISION-036`'s own limit on GPT's role (secondary review input, additive, not independent authority). All 8 conditions held on independent review, most notably that bounding an existing exception more tightly is a restriction, not an authority expansion — the opposite of the disguised-fork pattern the blind pilot (`DECISION-044`) caught in its candidate #2 (default-on unattended auto-run). `task-state.json`'s `promotion_basis` records this reasoning, not GPT's recommendation, as the basis.

Implications:

`docs/BRR_POLICY.md` gains a "Self-Verification Restrictions" section: Class A self-verification is unchanged (already a standing rule under Acceptance Boundary Rules); Class B self-verification remains possible only while `DECISION-033`'s fallback is actually active and only with the standard `DECISION-036` disclosure; Class C/D never reach the question. A new circularity restriction is added: any *future* task whose subject matter is the self-verification fallback itself, `scripts/check-autonomous-gate.ps1`/`scripts/check-stop-conditions.ps1`'s behavior, the Acceptance Boundary Rules, or a Task Safety Class's core definition must not be closed out by self-verification alone — such a task routes to Codex, an explicit owner review, or is reported `BLOCKED` (Stop-Instead-of-Guess trigger 6) if neither is available, because a self-verifying party cannot reliably certify a change to the rules that govern its own self-verification. This restriction is explicitly prospective and does not reopen or re-decide any already-built, already-verified Phase 2 autonomy decision (`DECISION-038` through `DECISION-042`, `DECISION-045`); the section states plainly that ordinary BRR policy work adding an adjacent, non-redefining section (as this task and `pcc-brr3-001` both did) is the existing Class B `strict`-depth case, not this narrower circularity case — and names the resulting bootstrap honestly: both Phase 3 tasks so far were themselves self-verified before this restriction existed, the same bootstrap every earlier BRR policy foundation task went through. The section also lists four extra evidence items a self-verified Class B result must record (which depth applied and why; that a `strict` cross-check was actually performed, not asserted; an explicit statement the task is not the circularity case, or that it was routed away from self-close if it is; whether GPT review occurred) — recorded in the existing `risks`/`summary` fields, introducing no new verdict or schema field. `DECISION-033`/`DECISION-036`'s own authorization text is unchanged. `pcc-brr3-001`'s commit was pushed to remote this cycle on a fresh, explicit owner instruction (not a revival of `DECISION-036`'s lapsed blanket authorization); this task's own commit follows the same standing `DECISION-020` default (local commit; remote push requires separate explicit approval each time).

Supersedes: None
Related: DECISION-006, DECISION-008, DECISION-016, DECISION-033, DECISION-036, DECISION-038, DECISION-039, DECISION-041, DECISION-042, DECISION-044, DECISION-045, DECISION-046, docs/BRR_PLAN.md, docs/BRR_POLICY.md

---

## DECISION-048: Out-of-Scope Detection Recorded (pcc-brr3-003); Owner Confirms Bootstrap And Circularity Boundary

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 3's third deliverable (`docs/BRR_PLAN.md` Phase 3 item 3, "Out-of-Scope Detection Hardening") is recorded canonically in `docs/BRR_POLICY.md`, defining three checkable failure modes (unauthorized file changes, unintended truth-surface edits, silent adjacent-scope edits), an enumerated truth-surface list, and a required five-step verification procedure recorded via the existing `out_of_scope_findings` field. Separately, the owner reviewed and explicitly confirmed two open questions from `pcc-brr3-002`'s close-out: the bootstrap reasoning (self-verifying `pcc-brr3-001`/`pcc-brr3-002` before the circularity restriction existed) is accepted as-is, not to be reopened; and the circularity boundary is confirmed as "adjacent policy/detection guidance = self-closeable; changing the fallback/gate/acceptance-boundary/class meanings = not self-closeable."

Reason:

`docs/BRR_PLAN.md` Phase 3's own text asks for hardened detection of exactly these three failure modes, and its special caution explicitly warns against chasing "perfect hallucination detection" — so the deliverable is scoped to checkable, structural criteria rather than a semantic-intent detector. This task was self-promoted, but under a materially different authorization shape than `pcc-brr3-002`: the owner directly reviewed and pre-authorized self-promoting this specific item this cycle ("self-promote Phase 3 item 3 next... it does not need owner naming directly"), attaching two explicit stop-conditions (do not touch the self-verification fallback/autonomous gate/acceptance boundary/class meanings; do not broaden into a governance redesign). Per the same discipline applied to `pcc-brr3-002`, that owner sign-off is treated as strong corroborating context, not a substitute for independently re-running the actual 8-part Safe Next-Task Drafting Rules gate — which was done and is recorded in `task-state.json`'s `promotion_basis`.

Implications:

`docs/BRR_POLICY.md` gains an "Out-of-Scope Detection" section: unauthorized file changes are checked by enumerating every touched file against `boundaries.allowed`; unintended truth-surface edits are checked against a named, enumerable truth-surface list (`docs/DECISIONS.md`, `docs/BRR_PLAN.md`, `docs/BRR_POLICY.md`, `docs/STATE_MODEL.md`, `docs/VERIFICATION_RESULT_SPEC.md`, `docs/REPO_GOVERNANCE.md`, `docs/HANDOFF_PACKET_SPEC.md`, `docs/PROJECT_CHARTER.md`, `docs/V1_Scope.md`, everything under `schemas/`, everything under `scripts/`), cross-referenced against whether that specific file was named in *this* task's `boundaries.allowed`; silent adjacent-scope edits are checked by confirming an allowed file's diff content actually matches what the objective/completion criteria described, not merely that the file itself was a legitimate target. The required five-step procedure is recorded via the existing `out_of_scope_findings` field — no new verdict or schema field is introduced; a finding under any mode reports as the existing `OUT_OF_SCOPE` verdict. The owner's two stop-conditions were carried verbatim into this task's forbidden-scope list and held: drafting did not touch `DECISION-033`/`DECISION-036`'s text, the autonomous gate scripts, the Acceptance Boundary Rules, or any Task Safety Class's core meaning, and did not broaden beyond detection criteria and procedure. The owner's confirmation of the bootstrap and circularity-boundary questions raised in `DECISION-047` is recorded here as settled: `pcc-brr3-001`/`pcc-brr3-002` are not reopened, and the "adjacent addition vs. mechanism change" line from `DECISION-047`'s own text is the operative boundary going forward, now with explicit owner sign-off rather than resting on PCC's own drafting judgment alone. `pcc-brr3-001`'s commit remains the only one pushed this session (`e34b06c`, on that cycle's specific owner instruction); `pcc-brr3-002`'s and this task's commits stay local per the owner's explicit instruction to push `281781e` "only if/when separately instructed" — `DECISION-036`'s lapsed blanket authorization is not revived by this decision.

Supersedes: None
Related: DECISION-006, DECISION-008, DECISION-020, DECISION-033, DECISION-036, DECISION-038, DECISION-039, DECISION-041, DECISION-042, DECISION-044, DECISION-045, DECISION-046, DECISION-047, docs/BRR_PLAN.md, docs/BRR_POLICY.md

---

## DECISION-049: Inadequate-Work Return Path Recorded (pcc-brr3-004); BRR Phase 3 Policy Foundation Complete

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 3's fourth and final deliverable (`docs/BRR_PLAN.md` Phase 3 item 4, "Inadequate-Work Return Path") is recorded canonically in `docs/BRR_POLICY.md`, making explicit that `FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE` are normal, safe, expected verification outcomes rather than exceptional ones. Separately, per explicit owner instruction this cycle, the "silent adjacent-scope edits" wording in the Out-of-Scope Detection section (`pcc-brr3-003`/`DECISION-048`) was reworded to describe it as a required reviewer discipline rather than a precise or deterministic detector. With this decision, `docs/BRR_POLICY.md` contains all four BRR Phase 3 policy deliverables named in `docs/BRR_PLAN.md`.

Reason:

`docs/BRR_PLAN.md` Phase 3's own text is direct: the non-`PASS` path "must become normal and safe... routine, not exceptional." This task was self-promoted under the owner's direct, explicit pre-authorization for this specific item ("self-promote Phase 3 item 4 under the same gate... does not need fresh owner naming"), with two stop-conditions attached (do not touch the fallback authority model/autonomous gate/acceptance boundary/class meanings/verdict definitions; do not broaden beyond return-path normalization into governance redesign). Per the same discipline applied to `pcc-brr3-002`/`pcc-brr3-003`, that owner sign-off is corroborating context, not a substitute for independently re-running the 8-part Safe Next-Task Drafting Rules gate — done and recorded in `task-state.json`'s `promotion_basis`. Separately, the owner reviewed `pcc-brr3-003`'s "silent adjacent-scope edits" language and judged it "directionally right but too soft to be load-bearing," giving exact reframing wording; that fix is owner-directed, not self-promoted, and is called out distinctly here rather than folded silently into item 4's own content — doing otherwise would itself be exactly the kind of unlabeled adjacent-scope edit the Out-of-Scope Detection policy exists to catch.

Implications:

`docs/BRR_POLICY.md` gains an "Inadequate-Work Return Path" section: states plainly that a non-`PASS` verdict is the verification model succeeding, not a failure to avoid or minimize; names that `scripts/advance-cockpit-state.ps1` already maps every verdict (not only `PASS`) to a `task_status` and refreshes both live handoff artifacts unconditionally, so the return path already runs on the same mechanism as `PASS`; names honestly the one real asymmetry — no dedicated close-out convenience script exists yet for non-`PASS` verdicts, unlike `close-out-verified-task.ps1` for `PASS` — and recommends fielding a future `scripts/return-inadequate-work.ps1` as future work, not built here; and restates, for visibility only, what happens after each of the four verdicts by pointing at the existing Stop-Instead-of-Guess Policy trigger table (`pcc-brr1-003`) rather than duplicating or changing it. No new verdict, task status, decision point, schema field, or script was introduced. The owner's two stop-conditions held: drafting did not touch `DECISION-033`/`DECISION-036`'s text, the autonomous gate, the Acceptance Boundary Rules, any Task Safety Class's core meaning, or the five verdict definitions, and did not broaden into governance redesign. Separately, `pcc-brr3-003`'s "silent adjacent-scope edits" bullet and its matching procedure step now explicitly describe that check as a required reviewer discipline rather than a precise detector, exactly matching the owner's given framing; this is the first instance of a canonical BRR policy text being revised after being marked complete, and it is handled by amending the existing section in place (not by reopening `pcc-brr3-003`'s task record or verdict, which stand as verified) with the change disclosed here rather than silently absorbed. `pcc-brr3-001`'s commit (`e34b06c`) remains the only one pushed this session; `pcc-brr3-002`'s (`281781e`) and `pcc-brr3-003`'s (`608ff55`) commits, and this task's own commit, stay local per the owner's standing instruction to push only on a fresh, explicit instruction each time — `DECISION-036`'s lapsed blanket authorization is not revived by this decision. This decision does not itself declare BRR Phase 3 complete or advance `current_phase` from `brr-phase-3` — Phase 3's policy foundation (all four `docs/BRR_PLAN.md` deliverables) is now written, but whether that also means the phase itself should be marked complete (as opposed to, e.g., first fielding the two recommended-future-work scripts named in this document) remains a separate, explicit owner/advisor decision, consistent with how `DECISION-021`/`DECISION-028`/`DECISION-045` each treated a phase-completion call as its own deliberate step rather than an automatic consequence of finishing the last listed item.

Supersedes: None
Related: DECISION-005, DECISION-006, DECISION-008, DECISION-020, DECISION-021, DECISION-028, DECISION-033, DECISION-036, DECISION-038, DECISION-039, DECISION-041, DECISION-042, DECISION-044, DECISION-045, DECISION-046, DECISION-047, DECISION-048, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/VERIFICATION_RESULT_SPEC.md

---

## DECISION-050: BRR Phase 3 Policy Scope Complete; Follow-On Hardening Scripts Are Separate Future Tasks, Not Prerequisites

Date: 2026-07-04
Status: Active

Owner Decision:

BRR Phase 3's policy scope is complete: all four planned deliverables (`docs/BRR_PLAN.md` Phase 3 — Verification Depth Policy, Self-Verification Restrictions, Out-of-Scope Detection, Inadequate-Work Return Path) are written in `docs/BRR_POLICY.md`. The two follow-on hardening scripts named as recommended future work in `pcc-brr3-003`/`pcc-brr3-004` (an automated out-of-scope checker; a non-`PASS` close-out convenience script) are real and valuable, but are **not** required before declaring the phase's policy scope complete — they are separate, bounded, follow-on implementation tasks. `project-state.json`'s `current_phase` is **not** advanced by this decision; it remains `brr-phase-3` pending a separate, explicit owner choice of the next lane (build the follow-on scripts as bounded tasks, or advance to BRR Phase 4).

Reason:

Holding a phase open until every useful follow-on tool named during it is actually built would blur the line between "the policy layer exists" and "all downstream hardening is implemented" — exactly the mechanism by which phases stay open indefinitely rather than closing on a defensible, honest boundary. The four deliverables `docs/BRR_PLAN.md` actually lists for Phase 3 are what was owed; recommending further hardening as a byproduct of doing that work well does not change what was owed. This mirrors the same discipline `DECISION-045` already applied to Phase 2 (distinguishing "the machinery is built" from "the walk-away model is absolutely proven") rather than collapsing two separable claims into one.

Implications:

Phase 3's status is recorded precisely as two separate facts, not one blended verdict: **(1) Phase 3 policy scope: complete** — `docs/BRR_POLICY.md` contains all four named deliverables, each independently verified `PASS` (`pcc-brr3-001` through `pcc-brr3-004`; `DECISION-046` through `DECISION-049`); **(2) recommended follow-on hardening work exists and is not yet built** — the two named scripts remain future, separately-bounded tasks (their own `pcc-brr3-0XX` or later IDs, own objective/scope/evidence, own verification), not hidden prerequisites for this decision. `current_phase` stays `brr-phase-3` in `project-state.json` — advancing it to a `brr-phase-4` value would itself require a schema change (`schemas/project-state.schema.json`'s `current_phase` enum does not yet include `brr-phase-4`) and a separate, deliberate decision, neither of which is made here. The next-lane choice — build the two follow-on scripts next, or move toward BRR Phase 4 — is explicitly left open for a separate owner/advisor decision, not pre-decided by this one.

Supersedes: None
Related: DECISION-021, DECISION-028, DECISION-045, DECISION-046, DECISION-047, DECISION-048, DECISION-049, docs/BRR_PLAN.md, docs/BRR_POLICY.md, .cockpit/state/project-state.json

---

## DECISION-051: Post-Close Canonical Amendment Rule Recorded

Date: 2026-07-04
Status: Active

Owner Decision:

`docs/REPO_GOVERNANCE.md` gains a "Post-Close Canonical Amendment Rule": a canonical doc may be amended after the task that wrote it has closed only when the change is a narrowly scoped clarification or correction, explicitly disclosed in a later decision; such an amendment never retroactively rewrites the original task's outcome; and a change that would materially alter the original task's claimed scope, evidence, or verdict basis must instead reopen the original task or spawn a distinct correction task, not ride in as a quiet amendment.

Reason:

`pcc-brr3-004` amended `pcc-brr3-003`'s already-closed `docs/BRR_POLICY.md` text (reframing the "silent adjacent-scope edits" wording) without reopening `pcc-brr3-003`'s task record. The owner judged that handling acceptable for that specific case, but explicitly asked for the boundary to be written down now, before informal handling of this pattern became slippery precedent — exactly the kind of small governance gap the BRR machinery exists to close honestly rather than leave to case-by-case judgment indefinitely.

Implications:

`docs/REPO_GOVERNANCE.md`'s "BRR Phase Task ID Format" section gains this new subsection, with `pcc-brr3-003`/`pcc-brr3-004` named as the motivating precedent. The rule gives a concrete distinguishing test: would an independent reader, comparing the amendment against the original task's completion criteria, conclude the original task's evidence no longer actually supports what it claimed? If yes, it is a correction task (own directive, evidence, verification), not an amendment. If the original task's claims remain fully supported and the change only sharpens wording or fixes an error that doesn't touch what was actually verified, it is a permitted amendment. This does not retroactively reclassify `pcc-brr3-004`'s own amendment to `pcc-brr3-003` (which was a narrow wording clarification, not a scope/evidence/verdict change, and remains valid under this rule applied after the fact) and does not change any existing verdict, task safety class, or stop condition.

Supersedes: None
Related: DECISION-006, DECISION-014, DECISION-048, DECISION-049, docs/REPO_GOVERNANCE.md, docs/STATE_MODEL.md, docs/VERIFICATION_RESULT_SPEC.md
