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
Status: Active

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
