param(
  [string]$TaskId = $null,
  [string]$NextAction = $null
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

# This script exists to remove the exact sequencing gap surfaced by
# pcc-brr2-001: a worker regenerating handoff artifacts before the final
# returned-for-verification state change, so the artifact handed back was
# stale at the moment it mattered. Calling this script IS the correct order -
# it performs the state change first, regenerates artifacts second, and runs
# health checks last, so the worker does not have to remember or reconstruct
# that sequence by hand each cycle.

$taskStatePath = ".cockpit/state/task-state.json"
$projectStatePath = ".cockpit/state/project-state.json"

$taskState = Read-Json $taskStatePath
$projectState = Read-Json $projectStatePath

if ($TaskId -and ($TaskId -ne $taskState.task_id)) {
  Fail "Refusing to act: given -TaskId '$TaskId' does not match active task-state.json task_id '$($taskState.task_id)'."
}

# Only a task that is actually being worked can be handed back. This also
# makes the script safe to call twice by accident - a second call against an
# already-returned task fails loudly instead of silently re-stamping state.
$allowedFromStatus = @("ready_for_worker", "in_progress")
if ($taskState.task_status -notin $allowedFromStatus) {
  Fail "Refusing to hand back task '$($taskState.task_id)': task_status is '$($taskState.task_status)', not one of $($allowedFromStatus -join ', '). This script only finalizes a worker-to-verifier handback, not other transitions."
}

$timestamp = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
$resolvedNextAction = if ($NextAction) { $NextAction } else {
  "Worker evidence is in .cockpit/result/worker-result.md. Codex reviews evidence and issues a verification verdict per docs/VERIFICATION_RESULT_SPEC.md."
}

# --- Step 1: the final state update happens first. ---
$taskState.task_status = "returned_for_verification"
$taskState.current_blocker = $null
$taskState.next_action = $resolvedNextAction
$taskState.updated_at = $timestamp

$projectState.current_blocker = $null
$projectState.next_expected_action = "Worker evidence for task '$($taskState.task_id)' is in .cockpit/result/worker-result.md. Codex reviews and issues a verification verdict."
$projectState.updated_at = $timestamp

$taskState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $taskStatePath
$projectState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $projectStatePath
Write-Output "Step 1/4: task '$($taskState.task_id)' set to 'returned_for_verification'."

# --- Step 2: cross-file consistency, checked immediately after the write. ---
& pwsh -NoProfile -File "scripts/validate-cockpit-state.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Handback aborted: scripts/validate-cockpit-state.ps1 failed immediately after the state update. State files were written but are inconsistent; review before retrying."
}
Write-Output "Step 2/4: state consistency confirmed."

# --- Step 3: regenerate the live handoff artifacts from the state just
# written, via the one shared helper every status-mutating path now uses
# (scripts/refresh-live-handoff-artifacts.ps1) rather than re-implementing
# "call both generators" here. ---
& pwsh -NoProfile -File "scripts/refresh-live-handoff-artifacts.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Handback aborted: scripts/refresh-live-handoff-artifacts.ps1 failed while regenerating the live handoff artifacts from the post-handback state."
}
Write-Output "Step 3/4: live handoff artifacts regenerated from the actual returned-for-verification state."

# --- Step 4: final health checks, run last, against the exact state being handed back. ---
# scripts/enforce-handoff-restart-safety.ps1 is deliberately not run here: it
# gates the opposite direction (a fresh ready_for_worker task being handed to
# a new worker session) and fails by design once task_status has moved to
# returned_for_verification. It is not applicable to this handback path.
& pwsh -NoProfile -File "scripts/check-schemas.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Handback aborted: scripts/check-schemas.ps1 reported a schema violation against the post-handback state."
}

$doctorOutput = & pwsh -NoProfile -File "scripts/doctor.ps1" 2>&1
$doctorOutput | ForEach-Object { Write-Output $_ }
# doctor.ps1 itself always exits 0 and never gates anything (by design, per
# DECISION-020/docs/HANDOFF_PACKET_SPEC.md) - it stays a read-only report for
# every other caller. This script does not change that. It only refuses to
# certify *this* handback as clean if doctor's report contains a real ISSUE,
# since certifying a clean handback is this script's one job.
if ($doctorOutput -match "\[ISSUE\]") {
  Fail "Handback aborted: scripts/doctor.ps1 reported at least one [ISSUE] against the post-handback state. See the report above."
}
Write-Output "Step 4/4: check-schemas.ps1 and doctor.ps1 both clean against the actual returned-for-verification state."

Write-Output ""
Write-Output "Handback finalized for task '$($taskState.task_id)': state, artifacts, and health checks all agree. Safe to write .cockpit/result/worker-result.md now."
