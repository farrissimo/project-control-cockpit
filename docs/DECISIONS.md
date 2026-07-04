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
