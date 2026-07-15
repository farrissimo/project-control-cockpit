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
