<#
  Verification evidence bundle (roadmap #4 / IDEA-013 "richer evidence during verification").

  Assembles a small, DETERMINISTIC bundle of facts for scripts/verify-work.ps1 to hand the
  verifier, instead of the vague "inspect the most recent work" instruction: the EXACT commit
  range being reviewed, its commit list + diff stat + diff, and (best-effort) the live CI state
  for HEAD. This grounds the verifier's judgment in explicit facts it doesn't have to guess or
  re-derive, and gives a durable record of what was actually reviewed.

  NON-GATING: nothing reads this bundle to make a pass/fail or trust decision — it only enriches
  what the verifier is shown and what gets recorded alongside the verdict. The verification-origin
  seam (roadmap #3) is untouched: executed-proof trust still comes ONLY from local_execution
  (a real local run) or the live CI check, never from anything in this bundle.

  Range chosen: "since the last recorded verification" (VERIFIED_SHA: line in
  app/last-verification.txt, written by verify-work.ps1) -- the honest sense of "the work being
  reviewed" for an ongoing branch, not "since the default branch" (which on a long-lived feature
  branch could be hundreds of commits -- the wrong kind of "richer"). Falls back to the single
  last commit when no prior verification is recorded, matching today's behavior.

  Deterministic: git + one optional read-only GitHub API call. No LLM, no Electron/app/
  dependency (scripts/ must keep working with app/ deleted -- CLAUDE.md's extractability rule),
  so the CI check re-implements app/ci-status.js's same named-check-only logic independently in
  pure PowerShell. Always exits 0; every failure degrades to an honest note, never blocks
  verification from running.

  Usage: pwsh -File scripts/verify-evidence.ps1 [-Json]
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function GitOut([string[]]$argv) { $o = & git @argv 2>$null; return "$o".Trim() }

# --- 1. determine the range being reviewed ---
$headSha = GitOut @('rev-parse', 'HEAD')
$range = $null; $rangeKind = 'no prior commit'; $baseSha = $null

$lvPath = Join-Path $repo 'app/last-verification.txt'
if (Test-Path -LiteralPath $lvPath -PathType Leaf) {
  $lvText = Get-Content -Raw -LiteralPath $lvPath
  $m = [regex]::Match($lvText, '(?im)^[ \t]*VERIFIED_SHA:[ \t]*([0-9a-f]{7,40})\b')
  if ($m.Success) {
    $cand = $m.Groups[1].Value
    # Must be BOTH a real commit object AND an ancestor of HEAD (or HEAD itself). cat-file -e alone
    # only proves the object exists somewhere in the repo's database -- a stray sha from an
    # unrelated/orphan branch would still pass that check but produce a nonsensical range.
    # --is-ancestor treats a commit as its own ancestor, so cand == HEAD correctly still qualifies.
    & git cat-file -e "$cand^{commit}" 2>$null
    if ($LASTEXITCODE -eq 0) {
      & git merge-base --is-ancestor $cand HEAD 2>$null
      if ($LASTEXITCODE -eq 0) { $baseSha = $cand }
    }
  }
}

if ($baseSha) {
  if ($baseSha -eq $headSha) { $range = "$baseSha..HEAD"; $rangeKind = 'since the last verification (no new commits)' }
  else { $range = "$baseSha..HEAD"; $rangeKind = 'since the last recorded verification' }
} else {
  $hasPrior = & git rev-parse --verify --quiet 'HEAD~1' 2>$null
  if ($LASTEXITCODE -eq 0) { $range = 'HEAD~1..HEAD'; $rangeKind = 'last commit (no prior verification recorded)' }
}

$commits = if ($range) { GitOut @('log', '--oneline', $range) } else { GitOut @('log', '--oneline', '-1') }
$diffStat = if ($range) { GitOut @('diff', '--stat', $range) } else { '(single commit; no prior commit to diff against)' }
if ($range -and -not $commits) { $diffStat = '(no new commits since the last verification)' }
$diffFull = if ($range -and $commits) { GitOut @('diff', $range) } else { '' }
$maxDiff = 20000
$diffTrunc = $false
if ($diffFull.Length -gt $maxDiff) { $diffFull = $diffFull.Substring(0, $maxDiff); $diffTrunc = $true }

# --- 2. live CI state for HEAD (best-effort, read-only; NEVER blocks verification) ---
# Mirrors app/ci-status.js's decideCiStatus: tied to OUR named 'test' check only -- an
# unrelated successful check (a bot, CodeQL) must never read as "the test suite passed".
# Re-implemented here (not required from app/) so this script has no app/ dependency.
$ciState = 'unavailable'; $ciDetail = ''
try {
  $remoteUrl = GitOut @('remote', 'get-url', 'origin')
  if (-not $remoteUrl) { $ciState = 'no_remote' }
  else {
    $m2 = [regex]::Match($remoteUrl, '(?:github\.com[:/])([^/]+)/([^/.]+?)(?:\.git)?/?$')
    if (-not $m2.Success) { $ciState = 'not_github' }
    else {
      $owner = $m2.Groups[1].Value; $repoName = $m2.Groups[2].Value
      $uri = "https://api.github.com/repos/$owner/$repoName/commits/$headSha/check-runs"
      $resp = Invoke-RestMethod -Uri $uri -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'PCC-Cockpit' } -TimeoutSec 6 -ErrorAction Stop
      $mine = @($resp.check_runs | Where-Object { $_.name -eq 'test' })
      if ($mine.Count -eq 0) { $ciState = 'none' }
      elseif (@($mine | Where-Object { $_.status -ne 'completed' }).Count -gt 0) { $ciState = 'pending' }
      elseif (@($mine | Where-Object { $_.conclusion -in @('failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure') }).Count -gt 0) { $ciState = 'failed' }
      elseif (@($mine | Where-Object { $_.conclusion -eq 'success' }).Count -gt 0) { $ciState = 'passed' }
      else { $ciState = 'none' }
      $ciDetail = "$owner/$repoName@$($headSha.Substring(0, [Math]::Min(9,$headSha.Length)))"
    }
  }
} catch { $ciState = 'unreachable'; $ciDetail = $_.Exception.Message }

$evidence = [ordered]@{
  head_sha       = $headSha
  range          = $range
  range_kind     = $rangeKind
  commits        = $commits
  diff_stat      = $diffStat
  diff           = $diffFull
  diff_truncated = $diffTrunc
  ci_state       = $ciState
  ci_detail      = $ciDetail
}

if ($Json) { $evidence | ConvertTo-Json -Depth 4; exit 0 }

Write-Output '=== Evidence provided to the verifier ==='
Write-Output "Range reviewed: $rangeKind ($(if ($range) { $range } else { 'HEAD only' }))"
Write-Output ''
Write-Output 'Commits:'
Write-Output $(if ($commits) { $commits } else { '(none)' })
Write-Output ''
Write-Output 'Diff stat:'
Write-Output $diffStat
Write-Output ''
Write-Output "CI state for HEAD: $ciState$(if ($ciDetail) { " ($ciDetail)" })"
