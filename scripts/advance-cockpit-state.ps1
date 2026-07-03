param()

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

$projectStatePath = ".cockpit/state/project-state.json"
$taskStatePath = ".cockpit/state/task-state.json"
$verificationPath = ".cockpit/result/verification-result.json"

$projectState = Read-Json $projectStatePath
$taskState = Read-Json $taskStatePath
$verification = Read-Json $verificationPath

if ($verification.task_id -ne $taskState.task_id) {
  Write-Output "No-op: verification-result task_id '$($verification.task_id)' does not match active task-state task_id '$($taskState.task_id)'. State left unchanged."
  exit 0
}

$verdictToTaskStatus = @{
  "PASS"         = "verified_pass"
  "FAIL"         = "verified_fail"
  "INSUFFICIENT" = "insufficient_evidence"
  "BLOCKED"      = "blocked"
  "OUT_OF_SCOPE" = "out_of_scope"
}

if (-not $verdictToTaskStatus.ContainsKey($verification.verdict)) {
  Fail "Unrecognized verdict '$($verification.verdict)' in $verificationPath."
}

if (($verification.verdict -eq "PASS") -ne [bool]$verification.state_update_allowed) {
  Fail "Verification result is internally inconsistent: verdict '$($verification.verdict)' but state_update_allowed is '$($verification.state_update_allowed)'. Refusing to advance state."
}

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

# verified_pass, not complete: this helper syncs verdict/next-action fields only.
# Moving a task to "complete" and drafting the next one is an advisor/verifier
# decision (STATE_MODEL.md transition sketch), not something this script should decide.
$taskState.verification_verdict = $verification.verdict
$taskState.task_status = $verdictToTaskStatus[$verification.verdict]
$taskState.current_blocker = if ($verification.verdict -eq "PASS") { $null } else { $verification.summary }
$taskState.next_action = $verification.next_action
$taskState.updated_at = $timestamp

$projectState.last_verification_verdict = $verification.verdict
$projectState.current_blocker = if ($verification.verdict -eq "PASS") { $null } else { $verification.summary }
$projectState.next_expected_action = $verification.next_action
$projectState.updated_at = $timestamp
if ($verification.verdict -eq "PASS") {
  $projectState.last_verified_handoff = $taskState.current_directive_path
}

$taskState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $taskStatePath
$projectState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $projectStatePath

Write-Output "State advanced for task '$($taskState.task_id)': verdict $($verification.verdict) -> task_status '$($taskState.task_status)'."

$validator = "scripts/validate-cockpit-state.ps1"
if (Test-Path -LiteralPath $validator) {
  Write-Output "Running post-update validation ($validator)..."
  & pwsh -NoProfile -File $validator
  if ($LASTEXITCODE -ne 0) {
    Fail "Post-update validation failed. State files were written but are inconsistent; review immediately."
  }
}
