param(
  [string]$ArchivedDirectivePath = $null,
  [string]$FinalNextAction = $null
)

$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot 'lib/atomic-write.ps1')  # Write-JsonAtomic (atomic + retained .prev)

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
  "PASS"         = "complete"
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

# A PASS verdict's verification.next_action is the verifier's own pre-close-out
# checklist (advance state, run doctor, archive, commit). That text describes
# steps which this very script run is in the middle of executing, so copying
# it verbatim goes stale the instant close-out finishes - the text ends up
# describing already-completed work as still pending (this happened for real
# in pcc-v1-011 and pcc-v1-012 and had to be corrected by hand both times).
# For PASS, default instead to a generic statement that stays true regardless
# of which close-out steps have run yet, unless the caller explicitly
# overrides it via -FinalNextAction. Non-PASS verdicts are not affected by
# this problem - FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE's next_action
# describes corrective work that genuinely still needs to happen, so it is
# left as verification.next_action, same as before.
if ($verification.verdict -eq "PASS") {
  $resolvedNextAction = if ($FinalNextAction) { $FinalNextAction } else {
    "Task '$($taskState.task_id)' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task."
  }
} else {
  $resolvedNextAction = $verification.next_action
}

$taskState.verification_verdict = $verification.verdict
$taskState.task_status = $verdictToTaskStatus[$verification.verdict]
$taskState.current_blocker = if ($verification.verdict -eq "PASS") { $null } else { $verification.summary }
$taskState.next_action = $resolvedNextAction
$taskState.updated_at = $timestamp

$projectState.last_verification_verdict = $verification.verdict
$projectState.current_blocker = if ($verification.verdict -eq "PASS") { $null } else { $verification.summary }
$projectState.next_expected_action = $resolvedNextAction
$projectState.updated_at = $timestamp
if ($verification.verdict -eq "PASS") {
  # last_verified_handoff should point at the immutable archived copy of the
  # verified directive, not the live path, which the next drafted task will
  # overwrite. If the caller has not archived yet (or chooses not to pass the
  # path), fall back to the previous behavior rather than failing, so callers
  # that have not adopted the new archive-then-advance order still work.
  $projectState.last_verified_handoff = if ($ArchivedDirectivePath) { $ArchivedDirectivePath } else { $taskState.current_directive_path }
}

# Persist both canonical state files atomically, each retaining its prior .prev.
# Per-file crash-safe + recoverable; the post-update validate-cockpit-state.ps1
# below is the cross-file consistency backstop (see finalize-worker-handback.ps1).
try {
  Write-JsonAtomic -Path $taskStatePath -Json ($taskState | ConvertTo-Json -Depth 10)
  Write-JsonAtomic -Path $projectStatePath -Json ($projectState | ConvertTo-Json -Depth 10)
} catch {
  Fail "Failed to persist canonical state atomically: $($_.Exception.Message)"
}

Write-Output "State advanced for task '$($taskState.task_id)': verdict $($verification.verdict) -> task_status '$($taskState.task_status)'."

$validator = "scripts/validate-cockpit-state.ps1"
if (Test-Path -LiteralPath $validator) {
  Write-Output "Running post-update validation ($validator)..."
  & pwsh -NoProfile -File $validator
  if ($LASTEXITCODE -ne 0) {
    Fail "Post-update validation failed. State files were written but are inconsistent; review immediately."
  }
}

# This status change just moved task_status (and, on PASS, current_phase-
# adjacent fields like last_verified_handoff) out from under both live
# handoff artifacts. Regenerating only one of them here previously caused a
# real, twice-recurring staleness defect (pcc-brr2-001, pcc-brr2-004); both
# are refreshed unconditionally through the one shared helper so any caller
# of this script gets the fix automatically rather than needing to remember it.
$refresher = "scripts/refresh-live-handoff-artifacts.ps1"
if (Test-Path -LiteralPath $refresher) {
  & pwsh -NoProfile -File $refresher
  if ($LASTEXITCODE -ne 0) {
    Fail "State was advanced and validated, but scripts/refresh-live-handoff-artifacts.ps1 failed while refreshing the live handoff artifacts. Review before treating this state as handoff-ready."
  }
}
