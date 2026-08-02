# Feature specs (lean spec-driven development)

A one-screen, versioned statement of **what** a feature should do, written **before** building
it, so intent doesn't drift and "done" is checkable. This is the lean essence of
spec-driven development — deliberately **not** a heavy spec → design → tasks pipeline (that's
the over-governance trap). One file per feature: `docs/specs/<feature>.md`.

## When to write one
- Write a spec for any **non-trivial** feature or behavior change.
- **Skip it** for trivial/reversible changes (wording, a small edit). Right-size to complexity.

## The one rule that makes it worth it
**Every acceptance criterion needs a passing test.** "Done" = all acceptance criteria have
passing tests. No criterion without a test; no merge until they're green. That single rule
gives spec-driven development's main benefit — verifiable intent — without the pipeline.

## Expected-Behavior Map (ADR-0027)
The Expected-Behavior Map does **not** replace full feature scope. Keep the normal governed flow:
idea scope, in/out boundaries, ADR/spec truth, risks, owner approval, build, tests, verification. The
map is one added testing artifact inside that flow.

The acceptance criteria above answer "what did we *decide* to build." The **Expected-Behavior Map**
also answers "what does the owner *expect* to happen when he presses the button" — including
expectations imported from a reference anchor (e.g. "mimic the Claude/Codex desktop chat") that were
never enumerated. Keep the map in the feature's ADR (`feature: true`), one lean table per feature —
see `docs/DECISION_AND_CHANGE_STANDARD.md` for the row shape, the source legend
(STATED/INFERRED/REFERENCE) and the status taxonomy (A–F). It is a **living** doc: add rows as new
expectations surface in use. The map catches the class an all-green suite cannot — a behavior built
*narrower than expected* (status **B**) — and doubles as the click-through script for the final
sign-off test.

Simple operating rule: `what the owner does -> what the app should visibly do -> how we prove it`.
Write rows as real app interactions wherever possible: click a button, choose an option, type in a
field, open a tab, send a chat turn, or run a named app action. Each row needs a visible or otherwise
observable result, plus the test/evidence that proves it. At verification time, AG checks the work
against those rows so the worker does not grade itself.

## Acceptance-criteria format — EARS
Write each criterion as one observable behavior:
`WHEN <trigger> THE SYSTEM SHALL <response>` (variants: `WHILE <state>`, `IF <condition>`,
`WHERE <context>`). One behavior per line → one test. Given/When/Then is allowed when a
scenario needs explicit preconditions.

## The template (copy this — keep it to one screen)
```
# <Feature name>   (status: draft | active | done)

## Objective
1–3 sentences: what this enables and for whom (the "why").

## Behavior
The normal path, plus the key edge/error cases.

## Acceptance criteria
- AC-1: WHEN <trigger> THE SYSTEM SHALL <observable response>
- AC-2: ...
(each one checkable by a test)
```

## Worked example — this repo's decision-record validator, in the shape
```
# Decision-record validator   (status: done)

## Objective
Make it impossible to record a malformed decision, so the decision standard is
enforced, not merely followed.

## Behavior
On commit and in CI, every docs/adr/*.md is checked against the MADR format; a
malformed record blocks the commit/build with a clear reason.

## Acceptance criteria
- AC-1: WHEN an ADR is missing a required section THE SYSTEM SHALL fail with a nonzero
  exit and name the missing section.
- AC-2: WHEN an ADR has an invalid status value THE SYSTEM SHALL fail and name the value.
- AC-3: WHEN all ADRs are well-formed THE SYSTEM SHALL pass (exit 0).
```
Tests: `scripts/check-adr.ps1`, proven to bite (see ADR-0002 Confirmation).

---
Standard locked per ADR-0003. Current-2026 basis: GitHub Spec Kit, AWS Kiro (EARS),
Microsoft "SDD: AI-native engineering" (all mid-2026).
