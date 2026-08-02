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
feature: true          # OMIT unless this ADR introduces/changes a user-facing feature (ADR-0027)
---

# ADR-NNNN: <short present-tense title>

## Context and Problem
What was going on; what forced a choice.

## Decision
What we chose ("We will…").

## Consequences
What we gain — and what we GIVE UP (the honest trade-off).

## Expected-Behavior Map   [REQUIRED for feature ADRs — ADR-0027]
*(Only for `feature: true` ADRs; omit the whole section for process/meta decisions.)*
This is an addition to the existing governed workflow, not a replacement for scope. The ADR still
needs the normal Context/Problem, Decision, Consequences, Confirmation, Engagement, and any separate
feature spec required by `docs/specs/README.md`. Full idea scope comes first; this map is the testing
contract inside that scope.

The lean RTM: one row per behavior the feature should exhibit. Simple version:
`what the owner does -> what the app should visibly do -> how we prove it`. Map intent → the control
or interaction that triggers it → the visible/observable result the owner expects → where that
expectation comes from → its real status → the test/evidence that pins it. This is also the
click-through script for the final sign-off test.

| behavior | control / interaction (button/action) | expected visible / observable result | source | status | test / evidence |
|---|---|---|---|---|---|
| <what it does> | <what the owner does> | <what the owner should see or what observable output changes> | STATED chat-id / doc:line | A | <test file / evidence ref> |

- **source** — `STATED` (explicit in a chat/doc; cite it) · `INFERRED` (deduced; say so) ·
  `REFERENCE` (imported from an anchor, e.g. "mimic the Claude/Codex desktop chat" — one line that
  imports a whole behavior set: resize, auto-grow, stop button — without enumerating each).
- **status** — `A` built+tested+matches · `B` built+tested but *narrower/different* than expected
  (the shock class) · `C` built but *not* tested · `D` expected, not built, *not* rejected (a real gap)
  · `E` not built *because* explicitly rejected/deferred/superseded (not a gap) · `F` regressed.
- The map is **living**: map every *known* behavior now, name the reference anchors, and add rows as
  new expectations emerge (build, use, or audit). No fake precision, no invented rows — an unknown
  stays unknown. Keep it a small table, not aerospace RTM.
- **Teeth:** `check-adr.ps1` rejects a `feature: true` ADR with no map. When the ADR is **Accepted**
  (claimed done), no row may be status **C**, and every built row (A/B) must name a test — that is the
  Definition of Done, machine-enforced. The verifier checks the map row by row against evidence,
  with AG serving as the verification-first reviewer when Codex is the worker.

## Confirmation        [REQUIRED — Pillar 1]
How we proved it works AND didn't break what we have:
- proof at the right trust level (see TRUST_CALIBRATION.md) — for structural
  changes that's real tests + CI green on the exact commit + a live check;
- the existing test suite stayed green after the change (no regression);
- **an independent verifier (Codex) reviewed the change and returned a verdict.**
  A non-trivial change is NOT "done" on the worker's own checks alone —
  self-certification is not confirmation. The sequence is: **build → CI → verify → done.**
  (This requirement was added after the worker self-certified a batch of changes and
  only ran the independent verifier when the owner forced it. The gap is now in the rule.)

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
3. **Confirm** (fills the ADR's Confirmation field): the change passes at the right trust level, the existing suite stays green, **and an independent verifier (Codex) returns a verdict** — build → CI → verify → done. Don't self-certify.
4. **Engage** (fills the ADR's Engagement field): wire it into every actor's spot above.
5. **Baseline for later**: the "before" numbers are kept so the post-standardization before/after study (ProjectForensics Lens 16) can later prove the change was actually worth it — per the rule that every change must make a *measurable* improvement.

---

## Enforcement (so it's not "followed by discipline")

The ADR validator (run in doctor / CI / pre-commit) **rejects an Accepted ADR missing `Confirmation` or `Engagement`**. That's what turns this from a good intention into a guarantee — and it's the same validator that enforces the MADR format itself (DECISION-115). It also enforces the **Expected-Behavior Map** for `feature: true` ADRs (ADR-0027): no map ⇒ reject; Accepted with an untested behavior ⇒ reject. Green ≠ correct is why the map exists — the gates prove "the code does what its tests say"; the map is how we also check "the app does what the owner expects."

---

## Why this is the lean sweet spot

It adds **two fields and one habit**, and every part of it *reuses* something PCC already owns: the backup policy, the test suite, CI, the trust-calibration guide, the instruction files, and the scaffolder. No new pipeline, no new approval gates. The two things the owner insisted on — *prove it still works* and *everyone knows how to engage* — become two lines in a record we were already going to write.
