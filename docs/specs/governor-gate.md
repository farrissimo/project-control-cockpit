# Governor Gate — the diff-bound verification receipt + commit gate   (status: active)

## Objective
Give the governor **teeth** at the one boundary a chat cannot silently dodge — the commit.
At commit time, block **only** a tagged-crucial (T0/T1) change that lacks a valid,
**diff-bound verification receipt**. Everything else (T2/T3/T4) sails through untouched.
This is the "Gate" touchpoint of ADR-0006 and the slice that actually moves the baseline:
~100% of recent non-trivial commits carry no checkable, diff-bound receipt → drive that
toward ~0% for T0/T1, **without** adding friction to normal work.

It **consumes** existing authorities — it re-uses `scripts/classify-stakes.ps1` for the tier
and never re-derives "what changed" or "is it verified." It adds no LLM at runtime.

## The receipt = a hard contract (ADR-0006 §10.1)
A verification receipt (`schemas/verification-receipt.schema.json`, written to the git-ignored
`.cockpit/evidence/verification-receipt.json`) is bound to the **exact change**:
- `repo`, `base` commit, `head` commit, and a `diff_id` = SHA-256 over the **staged index diff vs
  base** (`git diff --cached <base>`) — exactly what the pending commit introduces. The bypass
  ledger is the one path excluded from `diff_id` (see §Behavior 6), so a staged bypass entry does
  not change the identity it names.
- `tree_dirty`, the classified `tier`, the `required_checks`, each check's `result`, the
  `verifier` identity, the overall `verdict`, `generated_at`, and an optional `expires_at`.
- **Any subsequent relevant change invalidates it.** Edit one more tracked line after the
  receipt is written and `diff_id` changes → the receipt no longer matches → the gate blocks.
  Yesterday's green can never be reused on today's diff.

The receipt is written by `scripts/write-verification-receipt.ps1`, which records the
verifier's verdict + checks **bound to the current diff**. The gate never re-runs the verifier
— it consumes the receipt (one-authority-per-domain).

## Behavior
`scripts/run-governance-gate.ps1` (deterministic, no app launch), run at pre-commit:
1. Compute the change identity (`base`, `head`, `diff_id`, `tree_dirty`) via the shared
   `scripts/lib/change-identity.ps1` — the **same** helper the receipt writer uses, so the two
   can never drift.
2. Classify the tier via `scripts/classify-stakes.ps1 -Json` (git mode, baseline `main`).
3. **T2/T3/T4 → PASS** at the commit gate: proportional by construction. Normal proof for
   these tiers is enforced elsewhere (CI + branch protection on the PR), not by local friction.
4. **UNKNOWN → BLOCK** (fail closed — an unclassifiable change is treated as crucial).
5. **T0/T1 → require a valid receipt.** The receipt must: validate against its schema; bind to
   the current `base`, `head`, and `diff_id`; not be expired; carry `verdict: PASS`; carry a
   non-empty `verifier`; and cover a tier at least as high as the current one. Valid → PASS;
   missing / stale / mismatched / expired / non-PASS → **BLOCK** with a plain reason.
6. **Bypass is a durable, structured exception — never invisible.** A used bypass is recorded in
   `.cockpit/state/governance-gate-exceptions.json` bound to the exact `diff_id` (exact match,
   fail-closed). The gate reads the ledger from the **staged index** (`git show :<path>`), not the
   working tree — so a bypass only counts once it is **staged (i.e. committed with the change)**,
   landing it in git history where it is auditable; an unstaged/working-tree-only ledger grants
   nothing. To avoid a chicken-and-egg (staging the ledger would otherwise change the `diff_id` it
   names), the ledger is the single path excluded from `diff_id`. The gate discloses any applied
   bypass in its run receipt. `git commit --no-verify` remains the escape hatch, but branch
   protection (CI + PR) is the un-bypassable server-side backstop that no local bypass can escape.
7. Emit a machine-readable run receipt to `.cockpit/evidence/governance-gate.json` (git-ignored).
   Exit 0 = allow, 1 = block.

## Honest residue (not pretended solved)
- The local receipt is **worker-attested**: `write-verification-receipt.ps1` records the verdict
  it is handed. A dishonest worker could write a PASS receipt without truly verifying. This slice
  raises the floor — it makes the silent-skip default *impossible* (you cannot commit a T0/T1
  change without producing a diff-bound receipt) — but the **un-bypassable** proof of "verified"
  remains CI + GitHub branch protection, not the local gate. This is the ADR §6.1 bypass residue,
  surfaced here rather than hidden.
- Binding is to the **staged index** (`git diff --cached <base>`), so it reflects exactly what will
  be committed — partial staging is honoured. Residual: the bypass ledger is excluded from `diff_id`
  (to allow a staged bypass to name its own change), so a ledger-only mutation is not itself covered
  by the receipt's `diff_id`; a real ledger edit is still classified T0 (`governor_self_edit`), so
  the change as a whole still requires proof.

## Acceptance criteria
- AC-1: WHEN a change classifies T2, T3, or T4 THE SYSTEM SHALL PASS the commit gate with no
  receipt required.
- AC-2: WHEN a change classifies T0 or T1 AND no receipt is present THE SYSTEM SHALL BLOCK
  (exit 1) with a reason naming the missing receipt.
- AC-3: WHEN a change classifies T0/T1 AND a valid receipt bound to the exact current
  `base`+`head`+`diff_id` with `verdict: PASS` is present THE SYSTEM SHALL PASS.
- AC-4: WHEN a receipt exists but its `diff_id` (or `base`/`head`) does not match the current
  change THE SYSTEM SHALL treat it as stale and BLOCK (yesterday's green, today's diff).
- AC-5: WHEN a receipt is expired, non-PASS, schema-invalid, or covers a lower tier than the
  current change THE SYSTEM SHALL BLOCK.
- AC-6: IF the classifier returns UNKNOWN (e.g. missing/malformed manifest) THE SYSTEM SHALL
  fail closed and BLOCK, never allow.
- AC-7: WHEN a structured bypass exception bound to the exact `diff_id` is present THE SYSTEM
  SHALL allow the commit AND disclose the applied exception in the run receipt.
- AC-8: THE receipt writer and the gate SHALL compute change identity from one shared helper so
  a receipt written immediately before an unchanged-tree commit always matches.

## Tests
- `app/tests/scripts/governance-gate.spec.js` — drives the real gate + writer in throwaway git
  repos with a seeded manifest and fake changes: AC-1 (T3/T4 pass, no receipt); AC-2 (T0 blocked,
  no receipt); AC-3 (writer → gate passes on the exact diff); AC-4 (edit one more line → stale →
  blocked); AC-5 (expired / non-PASS / lower-tier receipt blocked); AC-6 (no manifest → UNKNOWN →
  blocked); AC-7 (exact-diff_id exception → allowed + disclosed); AC-8 (writer+gate identity agree).
- `app/tests/scripts/classify-stakes.spec.js` (existing) — the tier authority the gate consumes.
