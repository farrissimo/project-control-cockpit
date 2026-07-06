param(
  [string]$ProjectStatePath = ".cockpit/state/project-state.json",
  [string]$TaskStatePath = ".cockpit/state/task-state.json",
  [string]$VerificationResultPath = ".cockpit/result/verification-result.json",
  [string]$RoutingLogPath = ".cockpit/logs/routing-log.jsonl",
  [string]$GenerateDashboardScriptPath = "scripts/generate-dashboard.ps1",
  [int]$PollIntervalSeconds = 3,
  [int]$MaxIterations = 0
)

$ErrorActionPreference = "Stop"

# Auto-refresh / watch mode (pcc-pathD-004, Category D Phase D2 per
# docs/PATH_A_PLAN.md). Polls the .cockpit/ files scripts/generate-dashboard.ps1
# already reads and re-invokes that script (as its one explicit subprocess
# call, the same composition pattern already used and verified for
# classify-routing.ps1 in pcc-pathD-003) whenever any tracked file's mtime has
# changed since the last render.
#
# This script writes no file directly itself: the only output,
# dashboard/index.html, is produced by the delegated call to
# scripts/generate-dashboard.ps1, which is itself already read-only over the
# .cockpit/ bridge. This script mutates no .cockpit/ file.
#
# -MaxIterations 0 (default) runs until interrupted (Ctrl+C). A positive value
# runs exactly that many poll cycles then exits -- used for non-interactive
# functional testing, not part of normal interactive use.
#
# If a single render cycle's call to generate-dashboard.ps1 fails (non-zero
# exit), that failure is printed clearly and the loop continues polling on the
# next interval rather than crashing.

function Get-TrackedMTimes {
  param([string[]]$Paths)
  $times = @{}
  foreach ($p in $Paths) {
    if (Test-Path -LiteralPath $p -PathType Leaf) {
      $times[$p] = (Get-Item -LiteralPath $p).LastWriteTimeUtc
    } else {
      $times[$p] = $null
    }
  }
  return $times
}

function Test-MTimesChanged {
  param([hashtable]$Previous, [hashtable]$Current)
  foreach ($key in $Current.Keys) {
    if ($Previous[$key] -ne $Current[$key]) { return $true }
  }
  return $false
}

$trackedPaths = @($ProjectStatePath, $TaskStatePath, $VerificationResultPath, $RoutingLogPath)

Write-Output "Watching $($trackedPaths -join ', ') every ${PollIntervalSeconds}s. Re-renders via $GenerateDashboardScriptPath on change. Ctrl+C to stop."

$lastMTimes = @{}
$iteration = 0

while ($true) {
  $iteration++
  $currentMTimes = Get-TrackedMTimes -Paths $trackedPaths
  $changed = ($iteration -eq 1) -or (Test-MTimesChanged -Previous $lastMTimes -Current $currentMTimes)

  if ($changed) {
    & pwsh -NoProfile -File $GenerateDashboardScriptPath
    if ($LASTEXITCODE -ne 0) {
      Write-Output "[WATCH WARNING] $GenerateDashboardScriptPath exited $LASTEXITCODE on iteration $iteration. Continuing to poll; dashboard/index.html was not updated this cycle."
    } else {
      Write-Output "[WATCH] Re-rendered on iteration $iteration (change detected)."
    }
    $lastMTimes = $currentMTimes
  }

  if ($MaxIterations -gt 0 -and $iteration -ge $MaxIterations) {
    Write-Output "Reached -MaxIterations $MaxIterations; stopping."
    break
  }

  Start-Sleep -Seconds $PollIntervalSeconds
}
