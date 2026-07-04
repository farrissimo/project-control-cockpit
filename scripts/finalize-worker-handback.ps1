param(
  [string]$TaskId = $null,
  [string]$NextAction = $null,
  [int]$MaxAttemptsBeforeBlock = 2
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

# IDEA-008's "retry" half (pcc-brr4-002, BRR Phase 4 Multi-Cycle Pilot run
# #2): a handback is a retry, not a first attempt, exactly when this same
# task_id already carries a prior non-PASS verdict from an earlier cycle
# (attempts already > 0 AND verification_verdict already set to something
# other than PASS). This must be read BEFORE attempts is incremented below,
# since incrementing first would make every handback look like "attempts > 0".
$wasRetry = ($taskState.attempts -gt 0) -and $taskState.verification_verdict -and ($taskState.verification_verdict -ne "PASS")

# IDEA-009 (pcc-postbrr-001): a repeated failure -- the one retry policy
# already allows has ALSO come back non-PASS -- must stop instead of handing
# back a third time, per docs/BRR_POLICY.md's Stop-Instead-of-Guess trigger 4
# / Owner Review Matrix row 9 ("repeated failure with no new evidence...
# further unattended retries stop") and its FAIL verdict mapping ("repeated
# failure with nothing new is... Class D (BLOCKED), not another unattended
# attempt"). This is read BEFORE attempts is incremented, same reasoning as
# $wasRetry above: pre-increment attempts already at or past the threshold
# means the retry that just happened is itself the second failure.
$repeatedFailure = $wasRetry -and ([int]$taskState.attempts -ge $MaxAttemptsBeforeBlock)

if ($repeatedFailure) {
  # --- Repeated-failure path: stop instead of handing back a third time. ---
  # attempts is deliberately NOT incremented -- this handback did not happen.
  $taskState.task_status = "blocked"
  $taskState.current_blocker = "Task '$($taskState.task_id)' has failed $($taskState.attempts) time(s) (last verdict: '$($taskState.verification_verdict)') with no new evidence; further unattended retries stop per docs/BRR_POLICY.md trigger 4 / Owner Review Matrix row 9."
  $taskState.owner_decision_request = [ordered]@{
    question      = "Task '$($taskState.task_id)' has failed $($taskState.attempts) time(s) (last verdict: '$($taskState.verification_verdict)'). How should we proceed?"
    reason        = "docs/BRR_POLICY.md Stop-Instead-of-Guess trigger 4 / Owner Review Matrix row 9: repeated failure with no new evidence means the task itself needs the owner to change approach, scope, or evidence before it may proceed again, not another unattended attempt."
    options       = @("Retry with a genuinely different approach or new evidence", "Reduce or re-scope the task", "Abandon the task")
    blocked_until = "Owner reviews the failure history and decides how to proceed."
  }
  $taskState.next_action = "Task '$($taskState.task_id)' is blocked after repeated failure. Owner decision required (see owner_decision_request); do not attempt another unattended handback."
  $taskState.updated_at = $timestamp

  $projectState.current_blocker = $taskState.current_blocker
  $projectState.next_expected_action = "Task '$($taskState.task_id)' is blocked after repeated failure. Owner decision required."
  $projectState.updated_at = $timestamp

  $taskState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $taskStatePath
  $projectState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $projectStatePath
  Write-Output "Step 1/4: task '$($taskState.task_id)' set to 'blocked' (repeated failure at attempt $($taskState.attempts); no further unattended handback)."

  # A logging failure here must never abort or change the outcome of an
  # otherwise-successful handback -- it is surfaced visibly, not fatal.
  & pwsh -NoProfile -File "scripts/log-event.ps1" -EventType "repeated_failure_blocked" -TaskId $taskState.task_id -Detail "Task '$($taskState.task_id)' blocked after $($taskState.attempts) attempt(s); last verdict '$($taskState.verification_verdict)'. Owner decision required before further work."
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[LOGGING WARNING] Failed to record repeated_failure_blocked event (scripts/log-event.ps1 exited $LASTEXITCODE). The block above is still valid and unaffected."
  }
} else {
  $taskState.attempts = [int]$taskState.attempts + 1

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
  Write-Output "Step 1/4: task '$($taskState.task_id)' set to 'returned_for_verification' (attempt $($taskState.attempts))."

  if ($wasRetry) {
    # A logging failure here must never abort or change the outcome of an
    # otherwise-successful handback -- it is surfaced visibly, not fatal.
    & pwsh -NoProfile -File "scripts/log-event.ps1" -EventType "retry_attempted" -TaskId $taskState.task_id -Detail "Task '$($taskState.task_id)' handed back for verification again after a prior '$($taskState.verification_verdict)' verdict. This is attempt $($taskState.attempts)."
    if ($LASTEXITCODE -ne 0) {
      Write-Output "[LOGGING WARNING] Failed to record retry_attempted event (scripts/log-event.ps1 exited $LASTEXITCODE). The handback above is still valid and unaffected."
    }
  }
}

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
if ($repeatedFailure) {
  Write-Output "Task '$($taskState.task_id)' is blocked after repeated failure: state, artifacts, and health checks all agree. Do not write .cockpit/result/worker-result.md or attempt another handback -- an owner decision is required first (see owner_decision_request)."
} else {
  Write-Output "Handback finalized for task '$($taskState.task_id)': state, artifacts, and health checks all agree. Safe to write .cockpit/result/worker-result.md now."
}
