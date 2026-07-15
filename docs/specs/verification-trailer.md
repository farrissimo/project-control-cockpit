# Verification Trailer — durable, CI-audited proof of verification   (status: active)

## Objective
Make the Gate's verification proof **durable and after-the-fact-checkable** (ADR-0007). The Gate
(ADR-0006) blocks a T0/T1 commit without a valid diff-bound receipt, but that receipt is
git-ignored/transient — so history carries no checkable trace and the phase metric didn't move.
Record the proof as a **git commit trailer** and **audit it in CI**, so a crucial commit provably
carries its verification and a local skip is caught server-side.

## Behavior
1. **Emit** — `scripts/emit-verification-trailer.ps1` computes the change identity (shared
   `scripts/lib/change-identity.ps1`), validates the receipt against the exact staged diff (the
   SAME check the Gate uses — one shared authority, no drift), and prints exactly one trailer line
   when the receipt is valid + PASS:
   `Verified-Receipt: base=<40hex> diff_id=<64hex> verifier=<id> verdict=PASS`.
   It prints nothing (exit 0) when there is no valid receipt or nothing crucial is staged — the
   trailer is added only when it is truthful. It never encodes the commit's own SHA (unknowable
   pre-commit).
2. **Inject** — `.githooks/commit-msg` appends that trailer to the commit message if not already
   present (idempotent), so `git commit` records it automatically on a passing gate. No app launch.
3. **Audit** — `scripts/audit-verification-trailers.ps1 [-Range <a>..<b>]` walks each **non-merge**
   commit in the range; for every T0/T1 commit it requires a `Verified-Receipt` trailer whose
   `diff_id` **re-derives** from `git diff <base> <commit>` (ledger excluded) using the `base`
   **stored in the trailer** (never today's `main`). Reports per-commit PASS/FAIL + counts; exits
   non-zero if any T0/T1 commit lacks a valid trailer. T2/T3/T4 commits need none.
4. **Enforce** — CI (`.github/workflows/ci.yml`) runs the audit over the PR range; a T0/T1 commit
   missing/mismatched fails the `test` job, and branch protection blocks the merge. This is the
   un-bypassable layer (`--no-verify` or a forged local trailer is caught in CI).
5. **Re-measure** — the same audit script run over history IS the durable-receipt measurement.

## Honest residue (not pretended solved)
The trailer is **worker-attested**: it records a handed-in verdict. CI enforces trailer
**presence + binding** (the `diff_id` truly matches the committed code), not that the verification
was truthful. Confident-wrongness / self-certification remain LLM-native residue; CI + branch
protection stay the backstop. The trailer makes the claim and its exact diff scope permanently
auditable — a strict improvement over transient/prose proof.

**Forged PASS (accepted residue, owner-approved 2026-07-15).** A `verdict=PASS` trailer is honoured
on binding alone — a determined actor could `--no-verify` and hand-write one whose `diff_id`
re-derives. This is irreducible (the receipt, the only real proof, is transient by design) and is
accepted rather than hardened with disproportionate machinery: a forged PASS still must pass every
CI test and leaves a permanent, attributable false claim in history. Only **BYPASS** — whose proof
(a ledger entry) IS durable — is audited against the committed ledger. See ADR-0007 for the full
rationale.

## Acceptance criteria
- AC-1: WHEN a valid PASS receipt is bound to the exact staged T0/T1 diff THE emitter SHALL print a
  `Verified-Receipt` trailer carrying `base`, `diff_id`, `verifier`, `verdict` (no commit SHA).
- AC-2: WHEN there is no valid receipt (missing/stale/expired/non-PASS) OR nothing crucial is
  staged THE emitter SHALL print no trailer (and exit 0).
- AC-3: WHEN `git commit` runs with a passing gate THE commit-msg hook SHALL append the trailer
  exactly once (idempotent — a re-run/amend does not duplicate it).
- AC-4: THE audit SHALL PASS a T0/T1 commit whose trailer `diff_id` re-derives from
  `git diff <base> <commit>` (ledger excluded, base from the trailer).
- AC-5: THE audit SHALL FAIL (non-zero) a T0/T1 commit with no trailer, or whose trailer `diff_id`
  does not match the commit's actual diff (tampered code or forged trailer).
- AC-6: THE audit SHALL require NO trailer for T2/T3/T4 commits, and SHALL skip merge commits.
- AC-7: THE emitter and the Gate SHALL validate the receipt through one shared code path, and the
  emitter/audit SHALL compute `diff_id` through the shared identity helper, so a trailer written at
  commit time always re-derives at audit time.

## Tests
- `app/tests/scripts/verification-trailer.spec.js` — drives the real emitter, the commit-msg hook
  (via real `git commit`), and the audit in throwaway repos with the real manifest: AC-1 (trailer
  emitted for a verified T0 commit); AC-2 (no receipt → no trailer; T3 → no trailer); AC-3 (commit
  injects once, idempotent on amend); AC-4 (audit passes a real verified commit); AC-5 (audit fails
  a T0 commit with no trailer, and one whose code was amended so diff_id no longer matches); AC-6
  (T3 commit needs none; merge commit skipped); AC-7 (a trailer written at commit time re-derives at
  audit time — the round trip).
- `app/tests/scripts/governance-gate.spec.js` (existing) — the Gate + receipt the emitter consumes.
