# Governor trusted-baseline resolution   (status: active)

## Objective
`scripts/lib/change-identity.ps1`'s `Get-ChangeIdentity` (shared by the commit gate,
the receipt writer, and the trailer emitter) computes `base = merge-base($Baseline,
HEAD)`, and every caller defaults `-Baseline` to the LOCAL branch `main` — a ref any
local operation (a reset, a rebase, an unpushed commit, a restore) can move. If local
`main` has silently drifted ahead of what is actually on the remote (real incident
context: during the 2026-07-17 owner-directed restore, local `main` temporarily
pointed at the restored result), the governor's `merge-base` collapses toward HEAD,
understating or emptying the diff it classifies and binds a receipt to — a change
could pass the gate, or get bound to a smaller-than-real diff_id, without anyone
choosing that outcome. This is the same class of risk ADR-0008 already fixed for the
CI-side auditor (judge from a trusted `origin/main` worktree, not the PR's own local
tree) — this closes the analogous gap on the LOCAL, pre-commit side.

## Behavior
`Get-ChangeIdentity -Baseline <name>` resolves the ACTUAL ref to diff against, in
this fixed priority order (a deterministic ref-existence check, never a heuristic):
1. `refs/remotes/origin/<name>` if it resolves (a fetched, network-anchored copy of
   the named branch — not movable by any local-only operation).
2. `<name>` (the local ref) if it resolves — unchanged, existing behavior. Covers
   local-only projects with no `origin` remote at all.
3. `refs/tags/pcc-baseline` if it resolves — the tag `scripts/bootstrap-project.ps1`
   already creates on every scaffolded project's first commit, for exactly this
   purpose ("a ref that actually exists" when there is no conventional trunk name
   yet). Reused, not invented.
4. Unresolved: falls back to HEAD exactly as today (`base_note` honestly reports it),
   never silently picks a convenient ref. No behavior change to this existing case.

This is purely a RESOLUTION change: which ref the existing `-Baseline main` (or any
other name) actually points at. No caller's `-Baseline` parameter or default value
changes; no global `main` -> `origin/main` replacement (that would break local-only
projects with no remote at all, which is why the priority list falls through to the
local ref, then to `pcc-baseline`, before giving up).

## Acceptance criteria
- AC-1: WHEN `origin/<Baseline>` exists AND local `<Baseline>` has diverged from it
  (via any local-only operation: unpushed commits, a reset, a restore) THE SYSTEM
  SHALL compute `base` from `origin/<Baseline>`, not the drifted local ref — the
  computed diff/tier reflects the FULL scope of change since the last network-
  verified point, not just what's staged on top of unreviewed local drift.
- AC-2: WHEN no `origin` remote exists (a local-only project) THE SYSTEM SHALL fall
  back to the local `<Baseline>` ref exactly as today — unchanged behavior, provable
  by the existing governance-gate.spec.js / verification-trailer.spec.js suites
  passing unmodified (they use no-remote throwaway repos).
- AC-3: WHEN neither `origin/<Baseline>` nor local `<Baseline>` resolves, but
  `pcc-baseline` tag exists THE SYSTEM SHALL use it.
- AC-4: WHEN nothing resolves THE SYSTEM SHALL fall back to HEAD with an honest
  `base_note`, exactly as today — no new failure mode, no silent convenient choice.
- AC-5: WHEN local and remote `<Baseline>` already agree (the common, synced case —
  true for every commit made by this project so far) THE SYSTEM SHALL produce the
  IDENTICAL result to today's code (no behavior change for the normal case).

## Test
New file `app/tests/scripts/change-identity.spec.js` — drives the real
`Get-ChangeIdentity` (via a small PowerShell harness script, dot-sourcing the real
`scripts/lib/change-identity.ps1`) against throwaway repos with a real local `origin`
remote, reproducing the actual drift scenario (unpushed local commits on `main`
understate the diff under today's code) red before the fix, green after.
