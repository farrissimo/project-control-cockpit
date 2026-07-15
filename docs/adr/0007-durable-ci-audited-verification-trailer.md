---
status: Accepted
date: 2026-07-15
deciders: owner (product lead), Claude (worker), Codex (design advisor + independent verifier)
---

# ADR-0007: A durable, CI-audited verification trailer (the receipt's audit trace)

## Context and Problem

ADR-0006 shipped the governor "Gate": at commit, a tagged-crucial (T0/T1) change is blocked
unless a valid, diff-bound verification receipt exists. The receipt is written to
`.cockpit/evidence/verification-receipt.json` — which is **git-ignored**, so it is consumed at
commit time and leaves no after-the-fact trail.

Re-measuring the phase's success metric after the Gate shipped exposed the gap. The baseline
(governance-standardization proposal §9) is measured by a specific method: *look at commit X in
the repo — is there a checkable, diff-bound verification receipt for it?* Of the last 25 commits,
15 were T0/T1 and **0 carried a durable, diff-bound receipt — including the Gate's own verified
commit.** The Gate moved **enforcement** (silent skip is blocked at the commit boundary) but did
**not** move the **measured** number, because the proof is transient. By the owner's
measurable-change rule, "the Gate shipped" is not "the number moved." Redefining the metric to
"enforcement happened" was considered and **rejected as goalpost-moving** (Codex concurred): the
baseline is explicitly about durable, after-the-fact-checkable evidence.

## Decision

Make the verification proof **durable and server-side-enforced** by recording it as a **git commit
trailer** and auditing it in CI.

1. **The trailer.** When the Gate passes with a valid receipt, a `commit-msg` hook injects a
   trailer into the commit message:
   `Verified-Receipt: base=<40hex> diff_id=<64hex> verifier=<id> verdict=PASS`.
   It carries only what is knowable *before* the commit exists: `base`, `diff_id`, `verifier`,
   `verdict`. It deliberately does **not** encode the commit's own SHA (unknowable at
   `commit-msg` time — claiming it would be dishonest). Because it lives in the commit object it
   is immutable, travels with normal history, and is pushed with the commit.
2. **Re-derivable binding.** The `diff_id` is defined as base→commit-tree, ledger-excluded — the
   **same** computation `scripts/lib/change-identity.ps1` uses at commit time (index vs base).
   An auditor re-derives it from `git diff <base> <commit>` (ledger excluded) using the `base`
   **stored in the trailer** — never a base recomputed from today's `main`.
3. **CI audits the trailer (the teeth).** A deterministic script audits each non-merge T0/T1
   commit in a range: a valid `Verified-Receipt` trailer must be present AND its `diff_id` must
   re-derive from the commit's actual diff. CI runs it on the PR range; a T0/T1 commit missing a
   valid trailer **fails CI**, and branch protection blocks the merge. This closes the local
   fail-open (`--no-verify`, or a malformed / mismatched / invalid-BYPASS local trailer). It does
   NOT catch a correctly-bound *fabricated PASS* (accepted residue — see Consequences). The
   server-side check is un-bypassable ONLY IF branch protection is active + required, work enters via
   PR, and the PR does not weaken the audit machinery (the last is the subject of the planned
   ADR-0008 / Governance Hardening Sub-slice B — judge the PR from `origin/main`'s trusted copy).
4. **The audit script is the re-measurement.** Run over history it deterministically counts
   T0/T1 commits carrying a valid durable trailer — so the phase metric becomes continuously,
   mechanically checkable rather than a one-off manual pass.

## Consequences

- **Gain:** the proof is now durable and after-the-fact-checkable (moves the metric by its own
  definition); a local skip is caught in CI; "crucial changes are verified" becomes an auditable
  property of history, not a transient artifact.
- **Cost:** one trailer line per crucial commit; a CI step; a small audit script. Merge commits
  are skipped by the audit (they introduce no independently-reviewed diff).
- **Honest residue (unchanged, not pretended solved):** the trailer is **worker-attested** — it
  records a handed-in verdict. CI enforces trailer **presence + binding**, not that the
  verification was *truthful*. Confident-wrongness and self-certification remain LLM-native
  residue; CI + branch protection remain the backstop, and the durable trailer at least makes the
  claim and its exact diff scope permanently auditable.
- **Forged-PASS residue (explicitly accepted, 2026-07-15).** A `verdict=PASS` trailer is honoured
  on binding alone; someone could `--no-verify` and hand-write a PASS trailer whose `diff_id`
  re-derives, and CI would accept it. This is IRREDUCIBLE: the only durable proof of "a review
  happened" is the receipt, which is transient by design, so nothing durable exists for the audit
  to check beyond the binding. The two non-theatrical hardenings (cryptographic signing;
  committing a receipt file) are respectively disproportionate (CCB-style over-governance; the
  verifier does not sign) and equally forgeable. Per the leanness rule, this is accepted as
  documented residue rather than hardened: a forged PASS still (a) must pass every CI execution
  test on a clean machine, (b) leaves a permanent, name-attributable false claim in git history,
  and (c) is a known residual risk destined for the ADR-0006 residual-risk billboard. The
  asymmetric BYPASS hardening (a committed ledger entry IS required) is correct because BYPASS's
  proof is durable and PASS's is not. Owner-accepted 2026-07-15; signing deferred, built only if a
  real forgery ever occurs.

## Confirmation

Owner approved the direction; Codex (independent design advisor) returned ADJUST → the adjustments
(store `base`, drop the commit SHA, base→tree diff semantics, and the mandatory CI audit) are
folded into this decision. Confirmed **in this slice**: a regression suite proves the trailer is
injected, is re-derivable, and that the CI audit FAILS a T0/T1 commit lacking a valid trailer and
PASSES one carrying it; CI green on the exact commit; the slice is **dogfooded** — its own T0
commit carries a valid trailer that the new CI audit checks. Independent `codex exec` code-review
ran three rounds and found three real fail-opens — a working-tree/forgeable BYPASS, a root-commit
re-derivation asymmetry, and (round three) the forged-PASS residue above. The first two were fixed
with regression tests and Codex-confirmed closed; the forged-PASS finding was reviewed by the owner
and **accepted as documented residue** (see Consequences), the honest way to proceed past a
reviewer finding that names an irreducible limit rather than a fixable defect.
**Success metric:** the durable-receipt rate for T0/T1 commits moves from 0 (measured 2026-07-15)
upward for commits made after this lands; re-measured by the audit script. If it does not move, or
it adds friction to T2/T3/T4, it reverts.

## Engagement

- **Claude worker:** runs verification, writes the receipt; the `commit-msg` hook injects the
  trailer automatically on a passing gate.
- **Codex verifier:** role unchanged (code-review authority per ADR-0005/DECISION-105); CI is the
  execution + trailer-audit authority.
- **CI / branch protection:** the `test` job runs the trailer audit over the PR range; a missing
  or mismatched trailer on a T0/T1 commit fails the check, and branch protection blocks the merge.
- **Owner:** sees the re-measured number move; approves any deliberate bypass (still recorded).
- **Spawned projects:** the trailer hook + audit + CI step travel via the scaffolder
  (DECISION-113 parity, ADR-0004), so new projects inherit the same durable, audited proof.

## Supersedes / Related

Completes ADR-0006 (the receipt-as-contract, made durable + enforced). Builds on ADR-0005
(independent verification required for "done") and DECISION-105 (execution/code-review proofs
never wear the same green). Related: `docs/proposals/governance-standardization.md` §5.5/§9,
`docs/specs/verification-trailer.md`, and the GitHub branch-protection backstop.
