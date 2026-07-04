param(
  [string]$TaskStatePath = ".cockpit/state/task-state.json"
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

# This script gives the verifier one deterministic, read-only path to
# independently confirm repo health before issuing a verdict, rather than
# trusting the worker's own report of those checks (DECISION-031). It never
# writes to state, never issues a verdict itself, and never decides task
# correctness - it only certifies that the applicable local guardrails are
# clean against the state actually being reviewed. Verdict judgment remains
# the verifier's own.

$taskState = Read-Json $TaskStatePath
$taskId = $taskState.task_id
$taskStatus = $taskState.task_status

Write-Output "Verifying repo-health guardrails for task '$taskId' at status '$taskStatus'..."
Write-Output ""

$failures = New-Object System.Collections.Generic.List[string]

# --- Always applicable: cross-file consistency. ---
& pwsh -NoProfile -File "scripts/validate-cockpit-state.ps1"
if ($LASTEXITCODE -ne 0) {
  $failures.Add("scripts/validate-cockpit-state.ps1 reported a consistency problem.")
} else {
  Write-Output "[OK] State consistency confirmed."
}

# --- Always applicable: schema conformance. ---
& pwsh -NoProfile -File "scripts/check-schemas.ps1"
if ($LASTEXITCODE -ne 0) {
  $failures.Add("scripts/check-schemas.ps1 reported a schema violation.")
} else {
  Write-Output "[OK] Schema conformance confirmed."
}

# --- Always applicable: composed advisory health report. ---
$doctorOutput = & pwsh -NoProfile -File "scripts/doctor.ps1" 2>&1
$doctorOutput | ForEach-Object { Write-Output $_ }
if ($doctorOutput -match "\[ISSUE\]") {
  $failures.Add("scripts/doctor.ps1 reported at least one [ISSUE]. See the report above.")
} else {
  Write-Output "[OK] doctor.ps1 reported no [ISSUE] findings."
}

# --- Status-specific: only applicable when a fresh task is being handed to a
# new worker session. Not applicable once a worker has already returned a
# task for verification - running it there would fail by design, not because
# of a real defect (docs/HANDOFF_PACKET_SPEC.md, DECISION-031). Skipped
# explicitly, with the reason printed, rather than silently omitted. ---
if ($taskStatus -eq "ready_for_worker") {
  & pwsh -NoProfile -File "scripts/enforce-handoff-restart-safety.ps1"
  if ($LASTEXITCODE -ne 0) {
    $failures.Add("scripts/enforce-handoff-restart-safety.ps1 reported a handoff-gate failure.")
  } else {
    Write-Output "[OK] Handoff restart-safety gate confirmed for a fresh ready_for_worker handoff."
  }
} else {
  Write-Output "[SKIP] scripts/enforce-handoff-restart-safety.ps1: not applicable at task_status '$taskStatus' (that gate only applies to a fresh 'ready_for_worker' handoff, per docs/HANDOFF_PACKET_SPEC.md)."
}

Write-Output ""
if ($failures.Count -gt 0) {
  Fail "Guardrail check FAILED for task '$taskId':`n$(($failures | ForEach-Object { "- $_" }) -join "`n")`nDo not issue PASS based on this state; resolve the above first."
}

Write-Output "Guardrails confirmed clean for task '$taskId' at status '$taskStatus'. This certifies repo health only - the verdict itself (PASS/FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE) remains the verifier's own judgment against the task's completion criteria."
