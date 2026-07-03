param(
  [string]$OutputPath = ".cockpit/handoff/advisor-restart-brief.md"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Read-Json {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "Missing required file: $Path"
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Fail "Invalid JSON in $Path :: $($_.Exception.Message)"
  }
}

function Format-Bullets {
  param([string[]]$Items)
  if (-not $Items -or $Items.Count -eq 0) {
    return "* (none specified)"
  }
  return (($Items | ForEach-Object { "* $_" }) -join "`n")
}

$projectStatePath = ".cockpit/state/project-state.json"
$taskStatePath = ".cockpit/state/task-state.json"
$verificationPath = ".cockpit/result/verification-result.json"

$projectState = Read-Json $projectStatePath
$taskState = Read-Json $taskStatePath
$verification = Read-Json $verificationPath

foreach ($field in @("project_name", "project_goal", "current_phase")) {
  if ([string]::IsNullOrWhiteSpace($projectState.$field)) {
    Fail "project-state.json field '$field' is empty. Cannot draft a restart brief without it."
  }
}
foreach ($field in @("task_id", "task_title", "task_status")) {
  if ([string]::IsNullOrWhiteSpace($taskState.$field)) {
    Fail "task-state.json field '$field' is empty. Cannot draft a restart brief without it."
  }
}

if ($projectState.current_task_id -ne $taskState.task_id) {
  Fail "State drift: project-state current_task_id '$($projectState.current_task_id)' does not match task-state task_id '$($taskState.task_id)'. Reconcile state before drafting a restart brief."
}
if (($null -ne $projectState.last_verification_verdict) -and ($null -ne $verification.verdict) -and ($projectState.last_verification_verdict -ne $verification.verdict)) {
  Fail "Verification drift: project-state last_verification_verdict '$($projectState.last_verification_verdict)' does not match verification-result verdict '$($verification.verdict)'. Reconcile state before drafting a restart brief."
}

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

# ConvertFrom-Json auto-parses ISO-8601-looking strings into [datetime], which
# then loses the original timezone offset under default ToString formatting.
# Force back to the original ISO shape so the brief doesn't silently reformat it.
$verifiedAt = if ($verification.verified_at -is [datetime]) {
  $verification.verified_at.ToString("yyyy-MM-ddTHH:mm:sszzz")
} else {
  $verification.verified_at
}

# Open issues are read from state and the last verification result only.
# Chat-only concerns that never made it into a state file or evidence
# artifact are, by design, invisible here (STATE_MODEL.md truth priority).
$openIssues = New-Object System.Collections.Generic.List[string]
if ($projectState.current_blocker) { $openIssues.Add("Project blocker: $($projectState.current_blocker)") }
if ($taskState.current_blocker) { $openIssues.Add("Task blocker: $($taskState.current_blocker)") }
if ($verification.risks) {
  foreach ($r in $verification.risks) {
    $openIssues.Add("Risk from last verification of '$($verification.task_id)': $r")
  }
}
if ($openIssues.Count -eq 0) { $openIssues.Add("None recorded.") }

$readFirst = New-Object System.Collections.Generic.List[string]
$readFirst.Add($projectStatePath)
$readFirst.Add($taskStatePath)
if ($taskState.current_directive_path) { $readFirst.Add($taskState.current_directive_path) }
if ($taskState.worker_result_path -and (Test-Path -LiteralPath $taskState.worker_result_path)) {
  $readFirst.Add($taskState.worker_result_path)
}
$readFirst.Add($verificationPath)
$readFirst.Add("docs/DECISIONS.md")
$readFirst.Add("docs/REPO_GOVERNANCE.md")

$brief = @"
# Advisor Restart Brief

Generated $timestamp from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

$($projectState.project_name): $($projectState.project_goal)

Current phase: $($projectState.current_phase)

## Active Task

* Task ID: $($taskState.task_id)
* Title: $($taskState.task_title)
* Status: $($taskState.task_status)
* Objective: $($taskState.task_objective)

## Last Verified

* Verdict: $($verification.verdict) for task '$($verification.task_id)', verified at $verifiedAt
* Summary: $($verification.summary)
* Last verified handoff: $($projectState.last_verified_handoff)

## Open Issues

$(Format-Bullets $openIssues)

## Read First

$(Format-Bullets $readFirst)

## What Happens Next

* Task-level: $($taskState.next_action)
* Project-level: $($projectState.next_expected_action)
"@

Set-Content -LiteralPath $OutputPath -Value ($brief + "`n") -NoNewline
Write-Output "Drafted advisor restart brief for task '$($taskState.task_id)' at $OutputPath"
