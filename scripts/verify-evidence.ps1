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

  Range chosen, first of (Finding A fix, 2026-07-17):
    1. HEAD's own attested Verified-Receipt trailer (ADR-0007): if the most recent non-merge
       commit reachable from HEAD carries a well-formed `Verified-Receipt:` trailer whose
       diff_id RE-DERIVES from its own base (scripts/lib/change-identity.ps1 Get-CommitDiffId --
       the same check the CI trailer audit performs) and that base is an ancestor of HEAD, use
       it. This is the most precise, tamper-evident signal available: exactly what THIS commit's
       own verification was bound to, not a separately-drifting marker. Fixes a reproduced
       2026-07-17 incident: a real, valid-ancestor but stale VERIFIED_SHA (weeks old, ~20
       unrelated PRs back) silently produced a huge wrong-scope range instead of the one commit
       actually under review -- a verdict that looked authoritative but was never bound to the
       intended change. See docs/specs/verification-evidence-range.md.
    2. "since the last recorded verification" (VERIFIED_SHA: line in app/last-verification.txt,
       written by verify-work.ps1) -- unchanged fallback for commits with no trailer (T2-T4
       tier, or older history): the honest sense of "the work being reviewed" for an ongoing
       branch, not "since the default branch" (which on a long-lived feature branch could be
       hundreds of commits -- the wrong kind of "richer").
    3. Falls back to the single last commit when neither is available, matching today's behavior.

  Deterministic: git + the single CI authority. No LLM, no Electron/app/ dependency (scripts/ must
  keep working with app/ deleted -- CLAUDE.md's extractability rule). The CI note is obtained by
  INVOKING scripts/ci-status.ps1 (the one place that parses the remote, calls GitHub, and
  interprets the named 'test' check) -- it is no longer re-implemented here. Always exits 0; every
  failure (including a missing ci-status.ps1) degrades to an honest note, never blocks verification.

  Usage: pwsh -File scripts/verify-evidence.ps1 [-Json]
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$changeIdentityLib = Join-Path $PSScriptRoot 'lib/change-identity.ps1'
if (Test-Path -LiteralPath $changeIdentityLib -PathType Leaf) { . $changeIdentityLib }

function GitOut([string[]]$argv) { $o = & git @argv 2>$null; return "$o".Trim() }

# --- 1. determine the range being reviewed ---
$headSha = GitOut @('rev-parse', 'HEAD')
$range = $null; $rangeKind = 'no prior commit'; $baseSha = $null

# --- 1a. HEAD's own attested Verified-Receipt trailer (highest-trust signal; Finding A fix) ---
# Same convention scripts/audit-verification-trailers.ps1 uses: the most recent NON-MERGE commit
# reachable from HEAD (a merge commit itself never carries a trailer). Trust it only if its
# diff_id re-derives (tamper/corruption check, via the SAME shared helper the CI audit uses) and
# its base is a real ancestor of HEAD -- never any more blindly than the VERIFIED_SHA fallback.
if (Get-Command Get-CommitDiffId -ErrorAction SilentlyContinue) {
  $tipSha = GitOut @('rev-list', '--no-merges', '-1', 'HEAD')
  if ($tipSha) {
    $tipMsg = (& git show -s --format=%B $tipSha 2>$null) -join "`n"
    $trailerLine = ($tipMsg -split "`n" | Where-Object { $_ -match '^Verified-Receipt:' } | Select-Object -First 1)
    if ($trailerLine) {
      $tm = [regex]::Match($trailerLine, '^Verified-Receipt:\s*base=(?<base>\S+)\s+diff_id=(?<diff>\S+)\s+verdict=(?<verdict>\S+)\s+verifier=(?<verifier>.*)$')
      if ($tm.Success) {
        $tBase = $tm.Groups['base'].Value
        $tDiff = $tm.Groups['diff'].Value
        & git cat-file -e "$tBase^{commit}" 2>$null
        if ($LASTEXITCODE -eq 0) {
          & git merge-base --is-ancestor $tBase HEAD 2>$null
          if ($LASTEXITCODE -eq 0) {
            $derived = Get-CommitDiffId $tBase $tipSha
            if ($derived -eq $tDiff) { $baseSha = $tBase; $rangeKind = "since HEAD's own attested Verified-Receipt trailer" }
          }
        }
      }
    }
  }
}

# --- 1b. VERIFIED_SHA (unchanged fallback for commits with no trailer) ---
if (-not $baseSha) {
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
        if ($LASTEXITCODE -eq 0) { $baseSha = $cand; $rangeKind = 'since the last recorded verification' }
      }
    }
  }
}

if ($baseSha) {
  if ($baseSha -eq $headSha) { $range = "$baseSha..HEAD"; $rangeKind = 'since the last verification (no new commits)' }
  else { $range = "$baseSha..HEAD" }
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

# --- 2. live CI state for HEAD via the single CI authority scripts/ci-status.ps1 (best-effort,
# read-only; NEVER blocks verification). Delegates ALL remote-parsing/GitHub/check interpretation
# to that one script; a missing/unreadable ci-status.ps1 degrades to an honest 'unavailable'. ---
$ciState = 'unavailable'; $ciDetail = ''
$ciScript = Join-Path $repo 'scripts/ci-status.ps1'
if (Test-Path -LiteralPath $ciScript -PathType Leaf) {
  try {
    $ciOut = & pwsh -NoProfile -File $ciScript -Sha $headSha 2>$null
    $ciExit = $LASTEXITCODE
    # Only the authority's known status vocabulary is trusted; anything else degrades to unavailable.
    $ciKnown = @('passed', 'failed', 'cancelled', 'skipped', 'pending', 'missing', 'ambiguous', 'unreachable', 'no_remote', 'not_github')
    $ciJson = if ($ciExit -eq 0) { "$ciOut" | ConvertFrom-Json } else { $null }
    if ($ciExit -ne 0) {
      # A nonzero exit means the helper run failed — never trust its stdout, even if it parsed.
      $ciState = 'unavailable'; $ciDetail = "ci-status exited $ciExit"
    } elseif ($ciJson -and ($ciJson.status -is [string]) -and ($ciKnown -contains "$($ciJson.status)") -and ("$($ciJson.sha)" -eq "$headSha")) {
      # exact-SHA binding + known vocabulary: only trust a recognised status for THIS HEAD.
      $ciState = "$($ciJson.status)"; $ciDetail = "$($ciJson.detail)"
    } elseif ($ciJson -and ($ciJson.status -is [string]) -and ("$($ciJson.sha)" -ne "$headSha")) {
      $ciState = 'unavailable'; $ciDetail = "ci-status returned a different sha ($($ciJson.sha)) than HEAD"
    } else {
      $ciState = 'unavailable'; $ciDetail = 'ci-status produced no usable result'
    }
  } catch { $ciState = 'unavailable'; $ciDetail = "$($_.Exception.Message)" }
} else { $ciState = 'unavailable'; $ciDetail = 'ci-status.ps1 not found' }

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
