<#
  PCC babysitting-reduction metrics (COCKPIT_ROADMAP #19).

  Honest by construction: reports only OBSERVABLE proxies, never a made-up
  "productivity score." The headline is the number of manual watch-jobs PCC now
  runs for the owner automatically; the rest are plain repo facts. It explicitly
  states these are proxies and do NOT prove babysitting actually dropped.

  Deterministic: git + file counts, no LLM, read-only, always exits 0.
  -Json for the app.
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
# Emit UTF-8 so non-ASCII survives a redirected pipe (else PowerShell writes
# OEM-codepage bytes that make the JSON invalid and the app silently drops it).
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function GitOut([string[]]$argv) { $o = & git @argv 2>$null; return "$o".Trim() }

# Automated watchers = the deterministic detector scripts that replace a job the
# owner used to do by hand.
$detectorScripts = @(Get-ChildItem -LiteralPath (Join-Path $repo 'scripts') -Filter 'detect-*.ps1' -ErrorAction SilentlyContinue)
$scriptWatchers = $detectorScripts.Count
$inAppWatchers = 2            # chat-health/rollover + sycophancy nudge (computed in the app)
$watchers = $scriptWatchers + $inAppWatchers

$commitsTotal = [int](GitOut @('rev-list', '--count', 'HEAD'))
$commitsBranch = 0
& git rev-parse --verify --quiet main > $null 2>&1
if ($LASTEXITCODE -eq 0) { $commitsBranch = [int](GitOut @('rev-list', '--count', 'main..HEAD')) }

$firstCommitEpoch = [int](GitOut @('log', '--reverse', '--format=%ct', '--max-parents=0'))
$lastCommitEpoch = [int](GitOut @('log', '-1', '--format=%ct'))
$daysActive = if ($firstCommitEpoch -gt 0 -and $lastCommitEpoch -ge $firstCommitEpoch) {
  [math]::Round((($lastCommitEpoch - $firstCommitEpoch) / 86400.0), 1)
} else { 0 }

$result = [ordered]@{
  watchers            = $watchers
  detector_scripts    = $scriptWatchers
  in_app_watchers     = $inAppWatchers
  commits_total       = $commitsTotal
  commits_this_branch = $commitsBranch
  days_active         = $daysActive
  note               = 'These are observable proxies, not a productivity score. They do NOT prove babysitting actually dropped; they show what PCC now watches for you and that work is being snapshotted.'
}

if ($Json) {
  $result | ConvertTo-Json -Depth 4
} else {
  Write-Output 'PCC babysitting-reduction metrics (observable proxies, NOT a score)'
  Write-Output ''
  Write-Output "Automated watch-jobs now run for you: $watchers  ($scriptWatchers detector scripts + $inAppWatchers in-app)"
  Write-Output "Commits (snapshots so nothing is lost): $commitsTotal total, $commitsBranch on this branch"
  Write-Output "Days active (first to last commit): $daysActive"
  Write-Output ''
  Write-Output "NOT PROVEN: $($result.note)"
}
