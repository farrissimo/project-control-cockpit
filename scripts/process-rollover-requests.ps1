param(
  [string]$RequestDir = ".cockpit/request",
  [string]$SafeStopScriptPath = "scripts/safe-stop.ps1"
)

$ErrorActionPreference = "Stop"

# Rollover request consumer (pcc-pathD-008, Category D Phase D3).
#
# This is "the existing safe-stop/handoff path" the plan (docs/PATH_A_PLAN.md
# section 6) refers to: it does NOT invent any new automated rollover/reset
# behavior. For each pending 'rollover' request file in .cockpit/request/, it
# runs the existing, unmodified, already read-only/always-exit-0
# scripts/safe-stop.ps1 as an explicit subprocess, records its report into
# the request, marks it processed, and moves it to .cockpit/request/processed/.
# Malformed or unreadable files are left in place with a clear warning rather
# than crashing the batch or being silently discarded.

function Write-Warning2 {
  param([string]$Message)
  Write-Output "[WARNING] $Message"
}

if (-not (Test-Path -LiteralPath $RequestDir -PathType Container)) {
  Write-Output "No request directory at $RequestDir; nothing to process."
  exit 0
}

$processedDir = Join-Path $RequestDir "processed"
if (-not (Test-Path -LiteralPath $processedDir -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $processedDir | Out-Null
}

$candidateFiles = Get-ChildItem -LiteralPath $RequestDir -Filter "*.json" -File -ErrorAction SilentlyContinue

if (-not $candidateFiles -or $candidateFiles.Count -eq 0) {
  Write-Output "No pending request files found in $RequestDir. Nothing to process."
  exit 0
}

$processedCount = 0
$skippedCount = 0

foreach ($file in $candidateFiles) {
  $raw = $null
  try {
    $raw = Get-Content -Raw -LiteralPath $file.FullName
    $req = $raw | ConvertFrom-Json
  } catch {
    Write-Warning2 "Skipping $($file.Name): could not parse as JSON ($($_.Exception.Message)). Left in place."
    $skippedCount++
    continue
  }

  $requiredFields = @("request_id", "request_type", "created_at", "source", "status", "payload")
  $missing = $requiredFields | Where-Object { -not ($req.PSObject.Properties.Name -contains $_) }
  if ($missing.Count -gt 0) {
    Write-Warning2 "Skipping $($file.Name): missing required field(s) $($missing -join ', '). Left in place."
    $skippedCount++
    continue
  }

  if ($req.request_type -ne "rollover") {
    # Not this consumer's concern -- another consumer (e.g. pcc-pathD-009's
    # communication_prefs_update handler) is responsible for other types.
    continue
  }

  if ($req.status -ne "pending") {
    continue
  }

  Write-Output "Processing rollover request '$($req.request_id)' from $($file.Name)..."

  $safeStopOutput = & pwsh -NoProfile -File $SafeStopScriptPath 2>&1
  $reportText = ($safeStopOutput -join "`n")

  $req.status = "processed"
  if (-not ($req.payload.PSObject.Properties.Name -contains "safe_stop_report")) {
    $req.payload | Add-Member -MemberType NoteProperty -Name "safe_stop_report" -Value $reportText
  } else {
    $req.payload.safe_stop_report = $reportText
  }

  $destPath = Join-Path $processedDir $file.Name
  $req | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $destPath
  Remove-Item -LiteralPath $file.FullName -Force

  Write-Output "Recorded safe-stop report and moved '$($req.request_id)' to $destPath."
  $processedCount++
}

Write-Output ""
Write-Output "Done. Processed: $processedCount. Skipped (malformed/unreadable): $skippedCount."
