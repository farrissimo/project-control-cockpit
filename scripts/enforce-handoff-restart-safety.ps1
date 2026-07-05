param(
  [string]$TaskStatePath = ".cockpit/state/task-state.json",
  [string]$GateStatePath = ".cockpit/state/handoff-gate.json"
)

$ErrorActionPreference = "Stop"

function Read-Json {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Error "Missing required file: $Path"
    exit 1
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Write-Error "Invalid JSON in $Path :: $($_.Exception.Message)"
    exit 1
  }
}

function Write-GateState {
  param(
    [string]$Result,
    [string]$Reason,
    [string]$TaskId
  )
  $gate = [ordered]@{
    task_id     = $TaskId
    gate_result = $Result
    reason      = $Reason
    checked_at  = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    checked_via = "scripts/enforce-handoff-restart-safety.ps1"
  }
  ($gate | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $GateStatePath
}

function Fail {
  param([string]$Message, [string]$TaskId)
  Write-GateState -Result "FAIL" -Reason $Message -TaskId $TaskId
  Write-Error $Message
  exit 1
}

$taskState = Read-Json $TaskStatePath
$taskId = $taskState.task_id

# --- Gate 1: the active task must actually be in a handoff-ready status. ---
# This is the specific failure this task exists to prevent: a stale or
# already-completed task's handoff artifacts (directive/brief) being handed
# to a fresh session and mistaken for new, actionable work. Restart-safety
# content checks alone cannot catch this, because a stale directive can still
# be byte-identical to what its own generator would produce for that same
# (already-finished) task.
if ($taskState.task_status -ne "ready_for_worker") {
  Fail "Handoff gate FAILED: task-state.json task_status is '$($taskState.task_status)', not 'ready_for_worker'. Fresh-session handoff artifacts for task '$taskId' must not be treated as ready to hand off while the active task is in this status." $taskId
}

# --- Automatic pre-task backup for risky tasks or core-file work. Not just a
# class check: Class B/C captures judgment-heavy/risky work, while the scope
# scan catches bounded Class A tasks that still touch PCC's control machinery
# (scripts, schemas, canonical docs, or live .cockpit files). ---
$scopeTextParts = New-Object System.Collections.Generic.List[string]
if ($taskState.task_objective) { $scopeTextParts.Add("$($taskState.task_objective)") }
foreach ($item in $taskState.completion_criteria) { $scopeTextParts.Add("$item") }
foreach ($item in $taskState.boundaries.allowed) { $scopeTextParts.Add("$item") }
$scopeText = ($scopeTextParts -join "`n")

$coreScopePatterns = @(
  "scripts/",
  "scripts\",
  "schemas/",
  "schemas\",
  ".cockpit/state/",
  ".cockpit\state\",
  ".cockpit/handoff/",
  ".cockpit\handoff\",
  ".cockpit/result/",
  ".cockpit\result\",
  "docs/"
)

$touchesCoreScope = $false
foreach ($pattern in $coreScopePatterns) {
  if ($scopeText.IndexOf($pattern, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    $touchesCoreScope = $true
    break
  }
}

$requiresBackup = ($taskState.task_safety_class -in @("B", "C")) -or $touchesCoreScope
if ($requiresBackup) {
  $alreadyBackedUp = $false
  if (Test-Path -LiteralPath ".cockpit/backups" -PathType Container) {
    foreach ($manifestPath in (Get-ChildItem -LiteralPath ".cockpit/backups" -Filter "manifest.json" -Recurse -File -ErrorAction SilentlyContinue)) {
      try {
        $m = Get-Content -Raw -LiteralPath $manifestPath.FullName | ConvertFrom-Json
        if ($m.task_id -eq $taskId) { $alreadyBackedUp = $true; break }
      } catch { }
    }
  }
  if (-not $alreadyBackedUp) {
    & pwsh -NoProfile -File "scripts/backup-protected-files.ps1" -Action Backup
    if ($LASTEXITCODE -ne 0) {
      Fail "Handoff gate FAILED: task '$taskId' requires a pre-task backup (Class $($taskState.task_safety_class), touches_core_scope: $touchesCoreScope), but scripts/backup-protected-files.ps1 -Action Backup failed." $taskId
    }
  }
}

# --- Gate 2: restart-safety content checks must pass. ---
# Reuses the existing dual-restart proof rather than duplicating its logic;
# that proof already confirms the live advisor brief and worker directive are
# structurally complete and match what canonical state would produce today.
& pwsh -NoProfile -File "scripts/verify-dual-restart-safety.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Handoff gate FAILED: scripts/verify-dual-restart-safety.ps1 reported a restart-safety problem for task '$taskId'. See its output above for detail." $taskId
}

Write-GateState -Result "PASS" -Reason "Task status is 'ready_for_worker' and the dual-restart proof passed." -TaskId $taskId
Write-Output "Handoff gate PASSED: task '$taskId' handoff artifacts are restart-safe and ready for fresh-session use. Gate recorded at $GateStatePath."
