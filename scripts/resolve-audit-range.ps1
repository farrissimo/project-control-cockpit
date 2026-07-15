<#
  resolve-audit-range.ps1 (Governance Hardening T1) — compute the git range the CI trailer audit
  (scripts/audit-verification-trailers.ps1) should inspect, from the CI event context. Deterministic,
  git-only, no LLM. It exists to close a latent hole: the old CI step used
  `base=$(git merge-base origin/main HEAD); "$base..HEAD"`, which collapses to `HEAD..HEAD` (EMPTY)
  on a `push` event to the default branch (the pushed commit IS origin/main) — so the audit passed
  without inspecting the pushed commit. Masked today only by branch protection blocking direct pushes.

  Rules:
    pull_request           -> merge-base(<BaseRef>, HEAD)..HEAD   (the PR's own commits)
    push to DefaultBranch  -> <Before>..<Sha>  (the push's real range). FAIL CLOSED (exit 3) if that
                              range is empty/unusable (zero Before, or an EMPTY range = zero TOTAL
                              commits, e.g. Before == Sha) — never emit an empty range that would pass
                              the audit vacuously. Emptiness is the TOTAL commit count, not the
                              non-merge count, so a legitimate merge-only push still passes.
    push to other branch   -> <Before>..<Sha> when Before is real, else merge-base(<BaseRef>,HEAD)..HEAD
    anything else          -> merge-base(<BaseRef>, HEAD)..HEAD   (workflow_dispatch / re-measure)

  On success: prints the range (e.g. `abc123..def456`) to stdout, exit 0.
  On fail-closed: prints a diagnostic to stderr, exit 3 (a push to the default branch must never audit
  nothing).

  Params mirror the GitHub Actions context the caller passes in:
    -EventName      github.event_name       (push | pull_request | workflow_dispatch | ...)
    -Before         github.event.before     (push only; '' or 40 zeros when absent/new-branch)
    -Sha            github.sha              (the checked-out commit)
    -BaseRef        the trusted base ref to merge-base against (default 'origin/main')
    -DefaultBranch  the repo default branch name (default 'main')
    -RefName        github.ref_name         (the branch being pushed / PR head ref)
#>
param(
  [string]$EventName = '',
  [string]$Before = '',
  [string]$Sha = '',
  [string]$BaseRef = 'origin/main',
  [string]$DefaultBranch = 'main',
  [string]$RefName = ''
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$NULL_SHA = '0000000000000000000000000000000000000000'

function Fail-Closed([string]$msg) {
  [Console]::Error.WriteLine("[resolve-audit-range] FAIL CLOSED: $msg")
  exit 3
}
function Is-RealSha([string]$s) {
  $s = "$s".Trim()
  return ($s.Length -gt 0 -and $s -ne $NULL_SHA)
}
function MergeBaseRange() {
  # merge-base(<BaseRef>, HEAD)..HEAD — the PR / dispatch range. If BaseRef is unresolved (e.g. a
  # brand-new repo with no origin/main), fall back to the whole history (root..HEAD via -Last is the
  # caller's job); here we just emit HEAD's merge-base or, failing that, an empty base so the caller's
  # audit still runs over reachable history.
  & git rev-parse --verify --quiet $BaseRef > $null 2>&1
  if ($LASTEXITCODE -eq 0) {
    $mb = (& git merge-base $BaseRef HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $mb) { return "$("$mb".Trim())..HEAD" }
  }
  # No trusted base ref: audit from the root so nothing is silently skipped.
  $root = (& git rev-list --max-parents=0 HEAD 2>$null | Select-Object -First 1)
  if ($root) { return "$("$root".Trim())..HEAD" }
  return 'HEAD'
}
function RangeCommitCount([string]$range) {
  # TOTAL commits in the range (merges included). Emptiness is measured on the total, NOT on the
  # non-merge count: a legitimate merge-only push to the default branch (the merge commit introduces
  # no new NON-merge commits, e.g. a fully-rebased branch merged with --no-ff) must still PASS — the
  # audit skips merge commits and correctly finds nothing crucial. Only a genuinely EMPTY range
  # (before == sha, or sha an ancestor of before) means the push audits nothing and must fail closed.
  $c = @(& git rev-list $range 2>$null | Where-Object { $_ })
  return $c.Count
}

$evt = "$EventName".Trim().ToLowerInvariant()
$isDefaultBranch = ("$RefName".Trim() -eq "$DefaultBranch".Trim() -and "$RefName".Trim().Length -gt 0)

if ($evt -eq 'push') {
  if ($isDefaultBranch) {
    # Direct push to the default branch: audit the push's REAL range, and NEVER pass vacuously.
    if (-not (Is-RealSha $Before)) {
      Fail-Closed "push to default branch '$DefaultBranch' with no usable 'before' ($Before) — cannot bound the audit range; refusing to audit nothing."
    }
    $range = "$("$Before".Trim())..$("$Sha".Trim())"
    if ((RangeCommitCount $range) -lt 1) {
      Fail-Closed "push to default branch '$DefaultBranch' resolved to an empty range ($range) — refusing to pass the audit vacuously."
    }
    Write-Output $range
    exit 0
  }
  # Push to a feature branch: prefer the push's real range; else fall back to the merge-base range.
  if (Is-RealSha $Before) { Write-Output "$("$Before".Trim())..$("$Sha".Trim())"; exit 0 }
  Write-Output (MergeBaseRange); exit 0
}

# pull_request / workflow_dispatch / anything else: the PR (or re-measure) range. An empty range here
# is acceptable — the PR audit is the gate, not these events.
Write-Output (MergeBaseRange)
exit 0
