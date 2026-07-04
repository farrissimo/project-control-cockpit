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
# Phase 4 Multi-Cycle Pilot run #2, cycle 2; extended by pcc-postbrr-002).
# Read-only: this script never writes to any file, mutates no state, and
# calls no other script. It reports raw counts of the event types already
# recorded by scripts/log-event.ps1, one named ratio, a review-trigger
# category breakdown, and a per-task breakdown -- nothing scored, nothing
# interpreted, nothing invented for the one metric that remains genuinely
# unmeasurable without fabricating a new signal (per DECISION-008).

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
  "retry_attempted",
  "repeated_failure_blocked"
)

# Review-trigger categories (pcc-postbrr-002). Each mapping is mechanically
# exact -- either a unique event type or a literal, fixed-format substring
# this codebase's own scripts write -- never a guess at free-text meaning.
$categoryKeys = @(
  "trigger4_repeated_failure",        # repeated_failure_blocked (exact: only ever logged by that one branch)
  "trigger3_insufficient_evidence",   # verified_insufficient (exact: INSUFFICIENT is that trigger's unique verdict)
  "trigger5_out_of_scope",            # verified_out_of_scope (exact: OUT_OF_SCOPE is that trigger's unique verdict)
  "autonomous_gate_blocked",          # gate_blocked (its own BRR Phase 2 mechanism, not one of the 7 numbered triggers)
  "stop_owner_decision_pending",      # stop_condition_fired sub-reason (check-stop-conditions.ps1 fixed wording)
  "stop_attention_needed_status",     # stop_condition_fired sub-reason
  "stop_repo_health_issue",           # stop_condition_fired sub-reason
  "stop_unrecognized_promotion_lane", # stop_condition_fired sub-reason
  "verified_blocked_trigger_ambiguous", # verified_blocked: could be triggers 1, 2, 6, or 7 -- not disambiguated
  "verified_fail_not_confirmed_repeated", # verified_fail: a bare FAIL is not necessarily a REPEATED failure
  "correction_applied_own_category"   # correction_applied: a distinct signal, not itself a stop trigger
)

function New-CountBucket {
  $bucket = [ordered]@{}
  foreach ($t in $knownEventTypes) { $bucket[$t] = 0 }
  return $bucket
}
function New-CategoryBucket {
  $bucket = [ordered]@{}
  foreach ($c in $categoryKeys) { $bucket[$c] = 0 }
  return $bucket
}

$counts = New-CountBucket
$categories = New-CategoryBucket
$perTaskCounts = [ordered]@{}
$perTaskCategories = [ordered]@{}
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

  $taskId = if ($entry.PSObject.Properties.Name -contains "task_id" -and $entry.task_id) { $entry.task_id } else { "(no task_id)" }
  if (-not $perTaskCounts.Contains($taskId)) {
    $perTaskCounts[$taskId] = New-CountBucket
    $perTaskCategories[$taskId] = New-CategoryBucket
  }

  if ($counts.Contains($entry.event_type)) {
    $counts[$entry.event_type] = $counts[$entry.event_type] + 1
    $perTaskCounts[$taskId][$entry.event_type] = $perTaskCounts[$taskId][$entry.event_type] + 1
  } else {
    $unrecognized++
  }

  $detail = if ($entry.PSObject.Properties.Name -contains "detail") { "$($entry.detail)" } else { "" }

  switch ($entry.event_type) {
    "repeated_failure_blocked" {
      $categories["trigger4_repeated_failure"]++
      $perTaskCategories[$taskId]["trigger4_repeated_failure"]++
    }
    "verified_insufficient" {
      $categories["trigger3_insufficient_evidence"]++
      $perTaskCategories[$taskId]["trigger3_insufficient_evidence"]++
    }
    "verified_out_of_scope" {
      $categories["trigger5_out_of_scope"]++
      $perTaskCategories[$taskId]["trigger5_out_of_scope"]++
    }
    "gate_blocked" {
      $categories["autonomous_gate_blocked"]++
      $perTaskCategories[$taskId]["autonomous_gate_blocked"]++
    }
    "verified_blocked" {
      $categories["verified_blocked_trigger_ambiguous"]++
      $perTaskCategories[$taskId]["verified_blocked_trigger_ambiguous"]++
    }
    "verified_fail" {
      $categories["verified_fail_not_confirmed_repeated"]++
      $perTaskCategories[$taskId]["verified_fail_not_confirmed_repeated"]++
    }
    "correction_applied" {
      $categories["correction_applied_own_category"]++
      $perTaskCategories[$taskId]["correction_applied_own_category"]++
    }
    "stop_condition_fired" {
      # A single stop_condition_fired event's detail is a " | "-joined list
      # of every deterministic condition that fired in that check (per
      # scripts/check-stop-conditions.ps1), so one event can legitimately
      # increment more than one sub-reason below. Matched by literal
      # substring against that script's own fixed-format sentences, never
      # against arbitrary free text.
      if ($detail -like "*owner decision is pending*") {
        $categories["stop_owner_decision_pending"]++
        $perTaskCategories[$taskId]["stop_owner_decision_pending"]++
      }
      if ($detail -like "*which needs attention rather than autonomous continuation*") {
        $categories["stop_attention_needed_status"]++
        $perTaskCategories[$taskId]["stop_attention_needed_status"]++
      }
      if ($detail -like "*reports at least one \[ISSUE\]*") {
        $categories["stop_repo_health_issue"]++
        $perTaskCategories[$taskId]["stop_repo_health_issue"]++
      }
      if ($detail -like "*does not reference a recognized approved-lane source*") {
        $categories["stop_unrecognized_promotion_lane"]++
        $perTaskCategories[$taskId]["stop_unrecognized_promotion_lane"]++
      }
    }
  }
}

Write-Output "BRR Metrics Summary (docs/BRR_PLAN.md Phase 4 item 2) - read-only, from $LogPath"
Write-Output "(Raw counts of already-logged event types only. No scoring, no interpretation, no state mutation.)"
Write-Output ""
Write-Output "Event counts (project-wide):"
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
Write-Output "Owner-review triggers by category (project-wide; docs/BRR_POLICY.md Stop-Instead-of-Guess Policy numbering where the mapping is exact):"
foreach ($c in $categoryKeys) {
  if ($categories[$c] -gt 0) {
    Write-Output ("  {0,-38} {1}" -f $c, $categories[$c])
  }
}
if (($categories.Values | Measure-Object -Sum).Sum -eq 0) {
  Write-Output "  (none recorded yet)"
}

Write-Output ""
Write-Output "Per-task breakdown (event counts and review-trigger categories, task_id where recorded):"
foreach ($taskId in $perTaskCounts.Keys) {
  $taskEventTotal = ($perTaskCounts[$taskId].Values | Measure-Object -Sum).Sum
  $taskCategoryTotal = ($perTaskCategories[$taskId].Values | Measure-Object -Sum).Sum
  Write-Output "  Task '$taskId':"
  foreach ($t in $knownEventTypes) {
    if ($perTaskCounts[$taskId][$t] -gt 0) {
      Write-Output ("    {0,-24} {1}" -f $t, $perTaskCounts[$taskId][$t])
    }
  }
  foreach ($c in $categoryKeys) {
    if ($perTaskCategories[$taskId][$c] -gt 0) {
      Write-Output ("    {0,-38} {1}" -f $c, $perTaskCategories[$taskId][$c])
    }
  }
  # This total is a disclosed PROXY for "owner interruptions per task" --
  # the count of system-detected review/stop touchpoints for this task. It
  # is explicitly NOT a measurement of actual owner chat interjections,
  # which no existing log signal captures.
  Write-Output "    -> review/stop touchpoints for this task (proxy for 'owner interruptions per task', NOT a count of actual owner chat interjections): $taskCategoryTotal"
}

Write-Output ""
Write-Output "Still not measurable from existing log data (fabricating a proxy would mean inventing a new signal, per DECISION-008):"
Write-Output "  - repeated instruction frequency: no log event captures raw owner chat interjections or instruction repetition at all. Measuring this honestly would require capturing conversational content into routing-log.jsonl, which is a new and invasive instrumentation change, not a read-only reporting extension. Deliberately and permanently declined (pcc-postbrr-002) rather than approximated."
