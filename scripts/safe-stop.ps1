param()

# Safe-stop is a read-only convenience check for ending a session cleanly.
# It confirms the repo is in a resumable state and prints what a fresh
# session should read and do next. It never advances task_status, never
# writes a verification verdict, and never gates anything - that remains the
# verifier's exclusive job (DECISION-006) and scripts/enforce-handoff-
# restart-safety.ps1's exclusive job (DECISION-020), respectively. This
# script always exits 0.

$ErrorActionPreference = "Continue"

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Strip-AnsiAndCollapse {
  param([string[]]$Lines)
  $esc = [char]27
  $joined = ($Lines -join " ") -replace "$esc\[[0-9;]*m", ""
  $joined = $joined -replace "\s+", " "
  return $joined.Trim()
}

$issues = New-Object System.Collections.Generic.List[string]

# --- Check 1: state consistency ---
$stateOutput = & pwsh -NoProfile -File "scripts/validate-cockpit-state.ps1" 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Output "[OK] State consistency: $(Strip-AnsiAndCollapse $stateOutput)"
} else {
  $detail = Strip-AnsiAndCollapse $stateOutput
  Write-Output "[ISSUE] State consistency: $detail"
  $issues.Add("State consistency check failed: $detail")
}

# --- Check 2: restart safety (advisor brief + worker directive content) ---
$restartOutput = & pwsh -NoProfile -File "scripts/verify-dual-restart-safety.ps1" 2>&1
if ($LASTEXITCODE -eq 0) {
  Write-Output "[OK] Restart safety (advisor + worker): fresh sessions can resume from canonical repo truth."
} else {
  $detail = Strip-AnsiAndCollapse $restartOutput
  Write-Output "[ISSUE] Restart safety (advisor + worker): $detail"
  $issues.Add("Restart safety check failed: $detail")
}

# --- Check 3: next_action is present and current (read-only; does not rewrite it) ---
$taskState = Read-JsonSafe ".cockpit/state/task-state.json"
$projectState = Read-JsonSafe ".cockpit/state/project-state.json"

$taskNextAction = if ($taskState) { $taskState.next_action } else { $null }
$projectNextAction = if ($projectState) { $projectState.next_expected_action } else { $null }

if ([string]::IsNullOrWhiteSpace($taskNextAction) -or [string]::IsNullOrWhiteSpace($projectNextAction)) {
  Write-Output "[ISSUE] Next action: missing or empty in canonical state. A fresh session would not know what to do next."
  $issues.Add("task-state.json next_action or project-state.json next_expected_action is missing/empty.")
} else {
  Write-Output "[OK] Next action: present in both task-state.json and project-state.json."
}

# --- Summary: what to read first, what to do next ---
Write-Output ""
Write-Output "PCC Safe-Stop Summary"
Write-Output "(Read-only. Does not advance task status, write a verdict, or gate anything.)"
Write-Output ""
Write-Output "Resume by reading:"
Write-Output "  .cockpit/state/project-state.json"
Write-Output "  .cockpit/state/task-state.json"
if ($taskState -and $taskState.current_directive_path) {
  Write-Output "  $($taskState.current_directive_path)"
}
if ($taskState -and $taskState.verification_result_path -and (Test-Path -LiteralPath $taskState.verification_result_path)) {
  Write-Output "  $($taskState.verification_result_path)"
}
Write-Output "  .cockpit/handoff/advisor-restart-brief.md"
Write-Output ""

if ($taskState) {
  Write-Output "Active task: $($taskState.task_id) (status: $($taskState.task_status))"
  Write-Output "Task-level next action: $taskNextAction"
}
if ($projectState) {
  Write-Output "Project-level next action: $projectNextAction"
}
Write-Output ""

if ($issues.Count -eq 0) {
  Write-Output "Safe to stop: YES. Canonical state and handoff artifacts are consistent and restart-safe."
} else {
  Write-Output "Safe to stop: NOT CLEANLY. $($issues.Count) issue(s) found above - a fresh session may need extra context until these are resolved."
}

# Always exits 0: this is informational only, never a gate.
exit 0
