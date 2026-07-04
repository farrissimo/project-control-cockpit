param()

# Doctor is a read-only, advisory report. It composes PCC's existing
# deterministic checks into one summary answering "is this repo safe to
# trust and hand off right now?" It never gates anything and always exits 0 -
# consuming its output to block a cycle would defeat the whole point of
# keeping this separate from scripts/enforce-handoff-restart-safety.ps1,
# which is the one script allowed to be a hard gate.

$ErrorActionPreference = "Continue"

$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
  param(
    [string]$Check,
    [ValidateSet("OK", "WARN", "ISSUE")]
    [string]$Status,
    [string]$Detail
  )
  $findings.Add([ordered]@{ check = $Check; status = $Status; detail = $Detail })
}

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Strip-AnsiAndLastLine {
  # Composed child scripts write their failure detail via Write-Error, which
  # PowerShell renders with ANSI color codes and a multi-line pointer block
  # when captured as text. Doctor only needs the plain-text failure message
  # on one line for a readable report.
  param([string[]]$Lines)
  # Use an explicit [char]27 rather than the "`e" escape token: this script
  # must also run correctly under Windows PowerShell 5.1 (powershell.exe),
  # which does not support "`e" (added in PowerShell 6+) and would otherwise
  # silently treat it as a literal "e", leaving ANSI codes in the report.
  $esc = [char]27
  $joined = ($Lines -join " ") -replace "$esc\[[0-9;]*m", ""
  $joined = $joined -replace "\s+", " "
  return $joined.Trim()
}

# --- Check 1: state consistency (schema/state alignment) ---
try {
  $output = & pwsh -NoProfile -File "scripts/validate-cockpit-state.ps1" 2>&1
  if ($LASTEXITCODE -eq 0) {
    Add-Finding -Check "State consistency" -Status "OK" -Detail (Strip-AnsiAndLastLine $output)
  } else {
    Add-Finding -Check "State consistency" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $output)
  }
} catch {
  Add-Finding -Check "State consistency" -Status "ISSUE" -Detail "Could not run scripts/validate-cockpit-state.ps1: $($_.Exception.Message)"
}

# --- Check 2: dual restart-safety (advisor brief + worker directive content) ---
try {
  $output = & pwsh -NoProfile -File "scripts/verify-dual-restart-safety.ps1" 2>&1
  if ($LASTEXITCODE -eq 0) {
    Add-Finding -Check "Restart safety (advisor + worker)" -Status "OK" -Detail "Fresh advisor and worker sessions can both resume from canonical repo truth."
  } else {
    Add-Finding -Check "Restart safety (advisor + worker)" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $output)
  }
} catch {
  Add-Finding -Check "Restart safety (advisor + worker)" -Status "ISSUE" -Detail "Could not run scripts/verify-dual-restart-safety.ps1: $($_.Exception.Message)"
}

# --- Check 3: last known handoff-gate verdict (informational only - does not re-run the gate) ---
$gatePath = ".cockpit/state/handoff-gate.json"
$taskStatePath = ".cockpit/state/task-state.json"
$gate = Read-JsonSafe $gatePath
$taskState = Read-JsonSafe $taskStatePath

if ($null -eq $gate) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "No $gatePath found yet. The enforcement gate (scripts/enforce-handoff-restart-safety.ps1) has not been run this cycle."
} elseif ($null -ne $taskState -and $gate.task_id -ne $taskState.task_id) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded gate result was for task '$($gate.task_id)' ($($gate.gate_result)), but the active task is now '$($taskState.task_id)'. Re-run scripts/enforce-handoff-restart-safety.ps1 before treating this task's handoff as gated."
} elseif ($gate.gate_result -eq "PASS") {
  Add-Finding -Check "Handoff gate (last known)" -Status "OK" -Detail "Last recorded result: PASS for task '$($gate.task_id)' at $($gate.checked_at)."
} else {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded result: $($gate.gate_result) for task '$($gate.task_id)' at $($gate.checked_at). Reason: $($gate.reason)"
}

# --- Check 4: active task context (informational only, not a pass/fail judgment) ---
if ($null -eq $taskState) {
  Add-Finding -Check "Active task" -Status "WARN" -Detail "$taskStatePath is missing or unreadable."
} else {
  Add-Finding -Check "Active task" -Status "OK" -Detail "Task '$($taskState.task_id)' status is '$($taskState.task_status)' (verification_verdict: $($taskState.verification_verdict))."
}

# --- Report ---
Write-Output "PCC Doctor Report - $((Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz'))"
Write-Output "(Advisory only. Read-only. Does not gate or block any task cycle.)"
Write-Output ""

foreach ($f in $findings) {
  Write-Output "[$($f.status)] $($f.check): $($f.detail)"
}

$issueCount = @($findings | Where-Object { $_.status -eq "ISSUE" }).Count
$warnCount = @($findings | Where-Object { $_.status -eq "WARN" }).Count

Write-Output ""
if ($issueCount -gt 0) {
  Write-Output "Overall: $issueCount issue(s), $warnCount warning(s) found. Review above before trusting current state."
} elseif ($warnCount -gt 0) {
  Write-Output "Overall: no issues, $warnCount warning(s) found. Repo is usable; warnings are informational."
} else {
  Write-Output "Overall: OK. No issues or warnings found."
}

# Always exits 0: doctor reports, it never gates. Use
# scripts/enforce-handoff-restart-safety.ps1 for a deliberate blocking check.
exit 0
