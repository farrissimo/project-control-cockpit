# Decision & Change Standard (v1)

*One lean, enforced way to record a decision AND roll a change out safely — so nothing breaks what already works, and every actor knows how to use the change. This is NOT a new governance system: it's the ADR format plus two required fields and one habit, all reusing machinery PCC already has.*

**Leanness guardrail (read first):** if any step here ever feels heavier than the change it guards, cut it. The cure must not exceed the disease. This standard exists to prevent breakage and confusion, not to add ceremony.

---

## Part A — The record: one ADR per decision/change (MADR-based)

Each significant decision or change = one file `docs/adr/NNNN-title.md`. Format:

```
---
status: Proposed | Accepted | Deprecated | Superseded by ADR-NNNN
date: YYYY-MM-DD
deciders: owner (+ verifier if used)
---

# ADR-NNNN: <short present-tense title>

## Context and Problem
What was going on; what forced a choice.

## Decision
What we chose ("We will…").

## Consequences
What we gain — and what we GIVE UP (the honest trade-off).

## Confirmation        [REQUIRED — Pillar 1]
How we proved it works AND didn't break what we have:
- proof at the right trust level (see TRUST_CALIBRATION.md) — for structural
  changes that's real tests + CI green on the exact commit + a live check;
- the existing test suite stayed green after the change (no regression).

## Engagement          [REQUIRED — Pillar 2]
Where the change is wired so every actor knows how to use it:
- Owner: the plain-English "what changed / how to use it" line.
- Claude worker: the rule in CLAUDE.md / AGENTS.md.
- Codex verifier: the standard in AGENTS.md's verifier protocol.
- Future chats: durable docs (PROJECT.md / the standard doc).
- Spawned projects: seeded by the scaffolder (bootstrap-project.ps1).
(Mark N/A where an actor genuinely isn't affected — but say so explicitly.)

## Supersedes / Related
```

Minimal decisions may leave optional MADR sections out, but **Confirmation and Engagement are never optional** — they are the two things the owner asked to guarantee.

---

## Part B — The habit: protect what works (before you touch anything)

1. **Restore point + green baseline.** Take a backup (`scripts/backup-protected-files.ps1`) and confirm the current system works (CI green on HEAD, app launches). Now the change is reversible and we have a documented "before."
2. **Build the change** — one change at a time (small batches beat big ones).
3. **Confirm** (fills the ADR's Confirmation field): the change passes at the right trust level, and the existing suite stays green.
4. **Engage** (fills the ADR's Engagement field): wire it into every actor's spot above.
5. **Baseline for later**: the "before" numbers are kept so the post-standardization before/after study (ProjectForensics Lens 16) can later prove the change was actually worth it — per the rule that every change must make a *measurable* improvement.

---

## Enforcement (so it's not "followed by discipline")

The ADR validator (run in doctor / CI / pre-commit) **rejects an Accepted ADR missing `Confirmation` or `Engagement`**. That's what turns this from a good intention into a guarantee — and it's the same validator that enforces the MADR format itself (DECISION-115).

---

## Why this is the lean sweet spot

It adds **two fields and one habit**, and every part of it *reuses* something PCC already owns: the backup policy, the test suite, CI, the trust-calibration guide, the instruction files, and the scaffolder. No new pipeline, no new approval gates. The two things the owner insisted on — *prove it still works* and *everyone knows how to engage* — become two lines in a record we were already going to write.
