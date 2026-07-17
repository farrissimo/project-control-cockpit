# Verification-evidence range integrity   (status: active)

## Objective
`scripts/verify-evidence.ps1` tells the independent verifier (Codex, via `verify-work.ps1`)
exactly what range of commits it is reviewing. Today it trusts `VERIFIED_SHA` (a free-text
marker in the git-ignored `app/last-verification.txt`, updated only when someone runs
`verify-work.ps1 -WriteFile`) as long as it is *any* ancestor of HEAD — with no bound on how
stale that ancestor is. Reproduced live on `main` (HEAD `2f93ec9`, 2026-07-17): the recorded
`VERIFIED_SHA` was `e8a19b0`, a commit from 2026-07-09. The tool silently selected a
165-commit / 204-file range spanning ~20 unrelated PRs, instead of the one commit
(`aa211d0`, the owner-directed restore) actually submitted for review. A verifier told to
review that range would produce a verdict that looks authoritative but was never bound to
the intended change — a proof-integrity defect, not a cosmetic one.

This fix makes the range prefer the most precise, tamper-evident signal this repo already
has for "what a specific commit's change was verified against": the commit's own
`Verified-Receipt:` trailer (ADR-0007), re-derived and checked, not merely trusted at face
value. `VERIFIED_SHA` remains a fallback for commits that carry no trailer (T2-T4 tier, or
older history) — its existing ancestry-safety behavior is unchanged for that case.

## Behavior
On each run, `verify-evidence.ps1` picks the review range from the FIRST of these that
resolves, in priority order:

1. **HEAD's own attested trailer.** Find the most recent non-merge commit reachable from
   HEAD (`git rev-list --no-merges -1 HEAD` — the same convention `audit-verification-
   trailers.ps1` already uses). If it carries a well-formed `Verified-Receipt:` trailer
   whose `diff_id` re-derives correctly from its own `base=` (via the shared
   `Get-CommitDiffId` helper, `scripts/lib/change-identity.ps1`) AND that `base` is an
   ancestor of HEAD, use `base..HEAD`. This is the most trustworthy signal: it is exactly
   what THIS commit's own verification was bound to, cryptographically checkable, not a
   separately-drifting global marker.
2. **`VERIFIED_SHA` (today's existing behavior, unchanged).** No trailer found, malformed,
   or diff_id mismatch (tampered/corrupted) -> fall back to the recorded `VERIFIED_SHA`,
   still requiring it to be a real, ancestor-of-HEAD commit object (existing safety checks
   preserved exactly as-is).
3. **Last commit (`HEAD~1..HEAD`), or no range for a single-commit repo.** Existing
   fallback, unchanged.

Non-goals (explicitly out of scope for this fix, per the intake report's caution against
redesigning the whole verification system): staged-but-uncommitted work is not scoped by
this tool today and stays that way; the governor's own `-Baseline main` default (a
separate, already-identified finding) is untouched; no change to what counts as
"crucial" (that's `classify-stakes.ps1`).

## Acceptance criteria
- AC-1: WHEN HEAD's most recent non-merge commit carries a valid `Verified-Receipt:`
  trailer (diff_id re-derives, base is an ancestor of HEAD) THE SYSTEM SHALL use the
  trailer's `base` as the range start, regardless of how stale `VERIFIED_SHA` is.
- AC-2: WHEN the trailer's `diff_id` does NOT re-derive from its own `base` (forged or
  corrupted) THE SYSTEM SHALL ignore the trailer and fall back to `VERIFIED_SHA` — never
  trust an unverifiable trailer any more than today's unverified free-text marker.
- AC-3: WHEN no trailer is present on the latest non-merge commit THE SYSTEM SHALL fall
  back to the existing `VERIFIED_SHA` behavior, unchanged (regression: the 12 existing
  tests in `verify-evidence.spec.js` continue to pass unmodified).
- AC-4: WHEN neither a trailer nor a valid `VERIFIED_SHA` is available THE SYSTEM SHALL
  fall back to `HEAD~1..HEAD` exactly as today.
- AC-5 (red-proof, this defect specifically): WHEN `VERIFIED_SHA` is a real, valid ancestor
  of HEAD but far older than HEAD's own attested trailer base THE SYSTEM SHALL prefer the
  trailer's narrower, more precise range over the wide `VERIFIED_SHA..HEAD` range.

Tests: `app/tests/scripts/verify-evidence.spec.js` (extended). Special proof rule (intake
report section 3, Finding A): because the range-selection mechanism itself is under repair,
independent verification of this fix is scoped manually via `new-verification-request.ps1
-Channel codex -Base <exact base>`, not by running the (previously defective) auto-range
tool on itself.
