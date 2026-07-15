---
status: Accepted
date: 2026-07-14
deciders: owner (approved lean essence + research), Claude (worker)
---

# ADR-0003: Lean per-feature spec-shape (Objective / Behavior / EARS acceptance criteria)

## Context and Problem

The owner already aligns before building and has scattered spec/scope docs, but no single
lean, standard shape for stating "what a feature should do" that ties to "done." Spec-driven
development attacks the one gap only the owner can own — "was it the RIGHT thing?" — by making
intent explicit and checkable up front (External Candidate #6). The risk is over-governance:
the full spec→design→tasks pipeline (Kiro/Spec Kit's heavy layer) is exactly the trap that
burned CCB.

## Decision

Adopt the **lean essence only**: one one-screen file per feature at `docs/specs/<feature>.md`
with **Objective / Behavior / Acceptance criteria**, criteria written in **EARS** form
(`WHEN <trigger> THE SYSTEM SHALL <response>`). The single load-bearing rule: **every
acceptance criterion needs a passing test; "done" = all green.** Skip the spec for trivial,
reversible changes. Do NOT adopt a spec→design→tasks pipeline or auto-generated task lists.
Standard + template + a worked example live in `docs/specs/README.md`.

## Consequences

- Gain: intent is stated and checkable before code; acceptance criteria map 1:1 to tests, so
  "the right thing" and "built right" both get proof; it completes the what(spec)/why(ADR)/
  done(trust-guide) trio.
- Give up: a few minutes writing a spec for non-trivial work (deliberately skipped for trivial).
- Kept lean by rule, not enforced by machinery (unlike ADRs) — matches the minimum-structure
  lesson; if it ever ossifies into ceremony, cut it.

## Confirmation

- Format validated against current-2026 primary sources (GitHub Spec Kit v0.11.0 / June 2026,
  AWS Kiro EARS, Microsoft "SDD: AI-native engineering" / June 2026) — the recommended lean
  core, heavyweight layers deliberately removed.
- Dogfooded: `docs/specs/README.md` includes a worked example (this repo's decision-record
  validator) written in the shape, whose acceptance criteria correspond to the real, proven
  `scripts/check-adr.ps1` tests (ADR-0002). Docs-only change; no runtime code touched, suite
  unaffected; `scripts/check-adr.ps1` passes on all four ADRs.

## Engagement

- Claude worker / Codex verifier / other tools: a "Feature specs" section in AGENTS.md points
  to the standard and the one rule.
- Future chats: `docs/specs/` is the home; README is the standard + template.
- Spawned projects: the scaffolder will seed `docs/specs/README.md` + the template (DECISION-116
  Track 3 scaffolder work).

## Supersedes / Related

Related: External Candidate #6, DECISION-117 (rollout discipline), `docs/TRUST_CALIBRATION.md`
(the "done" companion), ADR-0000 (decision format), `docs/specs/README.md`.
