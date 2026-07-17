# Rename classification convergence   (status: active)

## Objective
The stakes classifier escalates a change to `delete_or_rename` (>= T1) when it sees
files under both the added and deleted lists. Those lists are computed independently
in three places, using two DIFFERENT git commands with DIFFERENT default rename-
detection behavior on the SAME machine, SAME config, SAME git version (verified
empirically, not assumed):
- `git diff --name-only --diff-filter=A/D` (used by `scripts/lib/change-identity.ps1`'s
  `StagedNames`, feeding the commit gate + receipt writer, AND by
  `scripts/classify-stakes.ps1`'s own standalone git-mode) detects a tracked rename as
  a single `R` entry by DEFAULT — it never appears under `--diff-filter=A` or `=D`, so
  `delete_or_rename` never fires.
- `git diff-tree --no-commit-id --name-only -r --root --diff-filter=A/D` (used by
  `scripts/audit-verification-trailers.ps1`'s `Classify-Commit`, the CI-side audit)
  does NOT detect renames by default — a rename shows as a plain delete + add, so
  `delete_or_rename` DOES fire.
Consequence: for ANY tracked rename, the LOCAL gate (both the live "Change stakes"
Signals-tab card and the pre-commit gate) reports a LOWER tier and never demands a
receipt, while the CI audit demands one for the SAME commit — a rename could pass the
local workflow and then fail CI with no way to have satisfied it locally. This is
structural (guaranteed every time), not merely config-dependent drift.

## Behavior
Every git command that computes added/deleted file lists for classification purposes
explicitly pins `--no-renames`, so rename detection can never differ by which git
plumbing command happens to be used, or by any local `diff.renames` config — matching
the SAME reasoning already applied (but only to diff_id/content hashing, not
classification) in `change-identity.ps1`'s `$diffArgs`.

## Acceptance criteria
- AC-1: WHEN a tracked rename is staged THE SYSTEM SHALL report it under BOTH the
  added and deleted file lists computed by `Get-ChangeIdentity` (`StagedNames`),
  triggering `delete_or_rename` escalation locally — matching what the CI audit
  already sees, closing the gap.
- AC-2: WHEN a tracked rename is staged/committed and classified via
  `classify-stakes.ps1`'s own standalone git-mode (no explicit `-Files`, e.g. the live
  Signals-tab card) THE SYSTEM SHALL likewise see it under both added and deleted.
- AC-3: WHEN a tracked rename is committed THE SYSTEM SHALL classify identically
  whether computed via `git diff` (local paths, after this fix) or `git diff-tree`
  (`audit-verification-trailers.ps1`, already correct by default -- pinned explicitly
  too, for defense against a future git default change, with no behavior change today
  (confirmed empirically identical before/after).
- AC-4: A plain content edit (no rename) THE SYSTEM SHALL classify unchanged (no
  regression to the non-rename case).

## Test
New file `app/tests/scripts/rename-classification.spec.js` — stages/commits a REAL
tracked rename in a throwaway repo and drives the actual `Get-ChangeIdentity`,
`classify-stakes.ps1` (standalone mode), and `audit-verification-trailers.ps1`'s
classification path, proving all three agree.
