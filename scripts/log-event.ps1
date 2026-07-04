param(
  [ValidateSet("next_task_drafted", "verified_pass", "verified_fail", "verified_insufficient", "verified_blocked", "verified_out_of_scope", "correction_applied")]
  [string]$EventType,

  [string]$TaskId,
  [string]$Detail,

  [switch]$FromVerificationResult,
  [string]$VerificationResultPath = ".cockpit/result/verification-result.json",
  [string]$LogPath = ".cockpit/logs/routing-log.jsonl"
)

# This is a recording tool, not an enforcement tool: it never blocks or gates
# anything, and it is strictly append-only (Add-Content never reads or
# rewrites prior lines, so existing history cannot be altered by this
# script's own mechanics, not merely by convention).

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

# Verdict values (VERIFICATION_RESULT_SPEC.md) map onto this script's small
# explicit event-type set, so a verifier records a real verification event by
# describing what happened (the verdict) rather than typing free-form JSON.
$verdictToEventType = @{
  "PASS"         = "verified_pass"
  "FAIL"         = "verified_fail"
  "INSUFFICIENT" = "verified_insufficient"
  "BLOCKED"      = "verified_blocked"
  "OUT_OF_SCOPE" = "verified_out_of_scope"
}

if ($FromVerificationResult) {
  if (-not (Test-Path -LiteralPath $VerificationResultPath -PathType Leaf)) {
    Fail "Missing required file: $VerificationResultPath"
  }
  try {
    $verification = Get-Content -Raw -LiteralPath $VerificationResultPath | ConvertFrom-Json
  } catch {
    Fail "Invalid JSON in $VerificationResultPath :: $($_.Exception.Message)"
  }
  if (-not $verdictToEventType.ContainsKey($verification.verdict)) {
    Fail "Unrecognized verdict '$($verification.verdict)' in $VerificationResultPath. Cannot derive an event type."
  }
  $TaskId = $verification.task_id
  $EventType = $verdictToEventType[$verification.verdict]
  if ([string]::IsNullOrWhiteSpace($Detail)) {
    $Detail = $verification.summary
  }
} else {
  if ([string]::IsNullOrWhiteSpace($EventType)) {
    Fail "EventType is required unless -FromVerificationResult is used."
  }
}

if ([string]::IsNullOrWhiteSpace($TaskId)) {
  Fail "TaskId is required (either passed directly or derived via -FromVerificationResult)."
}
if ([string]::IsNullOrWhiteSpace($Detail)) {
  Fail "Detail is required (either passed directly or derived from verification-result.json's summary)."
}

$entry = [ordered]@{
  timestamp  = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  task_id    = $TaskId
  event_type = $EventType
  detail     = $Detail
}

# Round-trip through ConvertFrom-Json before writing, so a malformed line is
# caught here rather than silently corrupting the append-only log.
$jsonLine = $entry | ConvertTo-Json -Compress -Depth 5
$null = $jsonLine | ConvertFrom-Json

Add-Content -LiteralPath $LogPath -Value $jsonLine

Write-Output "Logged event '$EventType' for task '$TaskId' to $LogPath."
