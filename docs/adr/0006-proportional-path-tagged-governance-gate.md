---
status: Accepted
date: 2026-07-14
deciders: owner (product lead), Claude (worker), GPT (secondary advisor)
---

# ADR-0006: A proportional, path-tagged governance gate (the "governor")

## Context and Problem

PCC has real safeguards — verification, tests, doctor, detectors, CI — but they fire
**inconsistently**: sometimes, in some modes, by whichever chat happens to remember. For
ad-hoc work, independent verification is **prose, not machinery** (ADR-0005 admits this),
and a chat can skip it silently. Baseline measured 2026-07-14: of the last ~25 commits,
~20 were non-trivial and **0 carried a checkable, diff-bound verification receipt** — the
skip rate for *checkable* verification is effectively 100%.

The fix must not become CCB's over-governance (blanket, up-front, unmeasured friction that
bred ceremony and task-count theater). It must be **proportional**: same work → same
checks, weight matched to stakes. Full assessment:
`docs/proposals/governance-standardization.md`. Importance classification (two independent
blind passes, reconciled): `docs/proposals/stakes-classification-reconciled.md`.

## Decision

Adopt a single, thin **governor** that makes the right checks fire deterministically,
proportional to what a change touches:

1. **Stakes as data.** A short, owner-legible manifest maps path globs → tiers (T0..T4),
   seeded from the reconciled classification, plus deterministic **escalation rules**
   (deletions/renames, dependency/lockfile/CI/schema/authority edits, edits to the
   governor or manifest itself, weakened/removed tests, unknown new paths, unusually large
   cross-cutting diffs). Stakes are decided by the **diff**, not the chat's self-rating.
2. **One consuming engine.** It reads the changed files, looks up the tier, determines the
   required proof, and checks whether the receipts exist. It **consumes** the existing
   authorities (CI, release gate, doctor, verifier, detectors) — it never re-derives them.
3. **Two touchpoints, one engine.** (a) *Surface*: PCC shows the governor's verdict live
   while working — never blocks. (b) *Gate*: at the commit/push boundary, fail closed
   **only** when a tagged-crucial (T0/T1) change lacks its required proof. T2/T3 get normal
   proof; T4 is free.
4. **Receipt = hard contract.** The verification receipt is bound to exact repo/base/diff
   identity, carries per-check results + verifier identity + expiry, and is **invalidated
   by any subsequent relevant change** (yesterday's green can't be reused on today's diff).
5. **Backstop already in place.** GitHub branch protection on `main` (enabled 2026-07-14,
   requires the `test` check) is the un-bypassable server-side layer; the governor makes
   the local/CI checks feeding it honest and proportional.
6. **Two modes.** *Change-governance* (classify the diff) **and** *runtime-integrity*
   (validate live `.cockpit` state + receipts), because canonical state can change outside
   a commit.

**Scope discipline (the anti-CCB guardrail):** the manifest stays a short path→tier list +
a handful of escalation rules — never a policy engine. Tiny/noise work stays frictionless.
Build the **minimum** that moves the baseline number; defer everything else until proven
needed. Extractable per DECISION-074 (a script over the `.cockpit/` bridge, declared I/O,
no hidden shared state). This ADR decides the **shape** and commits to building it in
small, independently-verified slices (manifest → engine → surface → gate), each its own
CI-green + independently-verified change.

## Consequences

- **Gain:** safeguards fire predictably and proportionally; verification stops being prose;
  "`main` is CI-green" and "crucial changes are verified" become machinery, not memory. A
  non-coder can trust the app's behavior without reading code.
- **Cost:** a little friction at the commit boundary for T0/T1 changes only; a manifest to
  maintain (kept short and owner-legible).
- **Risk:** tier-creep (everything rated crucial) or manifest bloat would recreate CCB —
  mitigated by the leanness rule and the measurable kill-switch below.
- **Honest residue:** the governor guards *process*, not correctness of *intent*.
  LLM-native failures (confident-wrongness, shared blind spots, "was it the RIGHT thing")
  remain and are surfaced on a permanent "known residual risks" billboard, not pretended
  solved.

## Confirmation

- This is an accepted **direction** (owner approved the plan); the machinery is not built
  yet, so there is no execution proof at the ADR level. It is confirmed **slice by slice**:
  each slice ships with a regression test, CI-green on the exact commit, and independent
  verification (`codex exec`) per ADR-0005.
- **Success metric** (owner's 2026-07-14 measurable-change rule): the baseline skip rate —
  ~100% of recent non-trivial changes lacking a checkable, diff-bound verification receipt —
  must move toward ~0% for tagged-crucial (T0/T1) changes, **without** adding friction to
  T2/T3/T4 work. Re-measured after the gate ships. If it doesn't move the number, or it
  touches normal work, it reverts.
- The design rests on evidence: two independent blind importance passes converged on the
  same T0 integrity floor (`docs/proposals/stakes-classification-reconciled.md`).

## Engagement

- **Claude worker:** consults the manifest; the commit/push gate is wired into the guarded
  flow; the verdict is surfaced live in-app.
- **Codex verifier:** role unchanged; each governor slice is independently verified per
  ADR-0005.
- **Owner:** approves this ADR (Proposed → Accepted) **before** any machinery is built;
  owns the manifest's tier list (short, legible); sees the live surface + the residual-risk
  billboard.
- **Spawned projects:** the manifest + governor + a per-project extension manifest travel
  via the scaffolder (DECISION-113 parity, ADR-0004), so new projects inherit the same
  proportional gate; unknown project paths default to a middle tier, never trivial.

## Supersedes / Related

Builds on ADR-0005 (independent verification required for "done"). Related:
`docs/proposals/governance-standardization.md`,
`docs/proposals/stakes-classification-reconciled.md`, DECISION-074 (extractability),
DECISION-113 (parity), and the GitHub branch-protection backstop (enabled 2026-07-14).
