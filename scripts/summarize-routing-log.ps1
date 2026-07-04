param(
  [string]$LogPath = ".cockpit/logs/routing-log.jsonl"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

# BRR Phase 4 item 2, "BRR Metrics" (docs/BRR_PLAN.md; pcc-brr4-003, BRR
# Phase 4 Multi-Cycle Pilot run #2, cycle 2). Read-only: this script never
# writes to any file, mutates no state, and calls no other script. It
# reports raw counts of the event types already recorded by
# scripts/log-event.ps1 plus exactly one named ratio from docs/BRR_PLAN.md's
# own text -- nothing scored, nothing interpreted, nothing invented for the
# metrics that are not yet instrumented (per DECISION-056's scope).

if (-not (Test-Path -LiteralPath $LogPath -PathType Leaf)) {
  Fail "Missing log file: $LogPath"
}

$knownEventTypes = @(
  "next_task_drafted",
  "verified_pass",
  "verified_fail",
  "verified_insufficient",
  "verified_blocked",
  "verified_out_of_scope",
  "correction_applied",
  "stop_condition_fired",
  "gate_blocked",
  "retry_attempted"
)

$counts = [ordered]@{}
foreach ($t in $knownEventTypes) { $counts[$t] = 0 }
$unrecognized = 0
$legacyFormat = 0

$lines = Get-Content -LiteralPath $LogPath
foreach ($line in $lines) {
  if ([string]::IsNullOrWhiteSpace($line)) { continue }
  try {
    $entry = $line | ConvertFrom-Json
  } catch {
    Fail "Invalid JSON line in $LogPath :: $($_.Exception.Message)"
  }
  # Some early log entries predate scripts/log-event.ps1's current
  # {timestamp, task_id, event_type, detail} shape and instead use an older
  # {timestamp, task_id, route, reason, result} shape with no event_type
  # field at all. These are counted honestly as a distinct "legacy format"
  # bucket, not guessed at or mapped onto a current event type -- doing
  # that would be exactly the invented-interpretation this task's own
  # scope forbids.
  if (-not ($entry.PSObject.Properties.Name -contains "event_type")) {
    $legacyFormat++
    continue
  }
  if ($counts.Contains($entry.event_type)) {
    $counts[$entry.event_type] = $counts[$entry.event_type] + 1
  } else {
    $unrecognized++
  }
}

Write-Output "BRR Metrics Summary (docs/BRR_PLAN.md Phase 4 item 2) - read-only, from $LogPath"
Write-Output "(Raw counts of already-logged event types only. No scoring, no interpretation, no state mutation.)"
Write-Output ""
Write-Output "Event counts:"
foreach ($t in $knownEventTypes) {
  Write-Output ("  {0,-24} {1}" -f $t, $counts[$t])
}
if ($unrecognized -gt 0) {
  Write-Output ("  {0,-24} {1}" -f "(unrecognized event_type)", $unrecognized)
}
if ($legacyFormat -gt 0) {
  Write-Output ("  {0,-24} {1}" -f "(legacy pre-event_type format)", $legacyFormat)
}

$verifiedTotal = $counts["verified_pass"] + $counts["verified_fail"] + $counts["verified_insufficient"] + $counts["verified_blocked"] + $counts["verified_out_of_scope"]
Write-Output ""
if ($verifiedTotal -gt 0) {
  $rate = [math]::Round(($counts["verified_pass"] / $verifiedTotal) * 100, 1)
  Write-Output "Claimed-vs-verified completion rate: $($counts["verified_pass"]) / $verifiedTotal verified_* events = $rate% PASS"
} else {
  Write-Output "Claimed-vs-verified completion rate: no verified_* events recorded yet."
}

Write-Output ""
Write-Output "Not currently measurable from existing log data (docs/BRR_PLAN.md Phase 4 item 2 names these; no proxy is computed for them):"
Write-Output "  - owner interruptions per task (not instrumented)"
Write-Output "  - repeated instruction frequency (not instrumented)"
Write-Output "  - owner-review triggers by category (not instrumented)"
