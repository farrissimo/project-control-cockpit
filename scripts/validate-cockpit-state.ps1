param()

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Ensure-File {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "Missing required file: $Path"
  }
}

function Read-Json {
  param([string]$Path)
  Ensure-File $Path
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

if ($projectState.current_task_id -ne $taskState.task_id) {
  Fail "State drift: project-state current_task_id '$($projectState.current_task_id)' does not match task-state task_id '$($taskState.task_id)'."
}

foreach ($path in @(
  $projectState.active_repo_path,
  $projectState.last_verified_handoff,
  $taskState.current_directive_path,
  $taskState.worker_result_path,
  $taskState.verification_result_path
)) {
  if ($null -ne $path -and $path -ne "") {
    if (-not (Test-Path -LiteralPath $path)) {
      Fail "Referenced path does not exist: $path"
    }
  }
}

if ($verification.state_update_allowed -and $verification.verdict -ne "PASS") {
  Fail "Verification drift: state_update_allowed is true but verdict is '$($verification.verdict)'."
}

if (($projectState.last_verification_verdict -ne $null) -and ($projectState.last_verification_verdict -ne $verification.verdict)) {
  Fail "Verification drift: project-state last_verification_verdict '$($projectState.last_verification_verdict)' does not match verification-result verdict '$($verification.verdict)'."
}

if (($taskState.verification_verdict -ne $null) -and ($taskState.verification_verdict -ne $verification.verdict) -and ($taskState.task_id -eq $verification.task_id)) {
  Fail "Task drift: task-state verification_verdict '$($taskState.verification_verdict)' does not match verification-result verdict '$($verification.verdict)' for task '$($taskState.task_id)'."
}

Write-Output "PCC state validation OK"
