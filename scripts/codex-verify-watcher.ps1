param(
  [int]$PollIntervalSeconds = 60,
  [switch]$Once,
  [string]$CodexCommand = "codex",
  [string]$RepoPath = (Get-Location).Path,
  [string]$LockPath = ".cockpit/state/codex-watcher.lock"
)

$ErrorActionPreference = "Stop"

# Fields DECISION-066's restored two-role split (Claude Code worker, Codex
# advisor/verifier) as a real, low-cost mechanism, per the owner's explicit
# cost constraint: Codex's weekly session budget must never be spent just
# checking for work. Only this script's own file reads (free) run on every
# poll; scripts/codex-verify-watcher.ps1 invokes the actual `codex` command
# exactly once per task that genuinely needs verification -- the same rate
# a manually-run Codex session already runs at today, not more. This script
# is never started automatically by any other script; the owner runs it
# (or schedules it) deliberately.

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return $null
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Invoke-OneCheck {
  $taskStatePath = Join-Path $RepoPath ".cockpit/state/task-state.json"
  $verificationPath = Join-Path $RepoPath ".cockpit/result/verification-result.json"
  $fullLockPath = Join-Path $RepoPath $LockPath

  $taskState = Read-JsonSafe $taskStatePath
  if (-not $taskState) {
    Write-Output "[watcher] No task-state.json found or unreadable; nothing to do."
    return
  }

  $verification = Read-JsonSafe $verificationPath
  $lock = Read-JsonSafe $fullLockPath

  $taskId = $taskState.task_id
  $needsVerification = ($taskState.task_status -eq "returned_for_verification") -and
    ((-not $verification) -or ($verification.task_id -ne $taskId))

  if (-not $needsVerification) {
    # Nothing to do. Clear a stale lock if the task has moved on.
    if ($lock -and $lock.task_id -ne $taskId) {
      Remove-Item -LiteralPath $fullLockPath -Force -ErrorAction SilentlyContinue
    }
    if ($verification -and $verification.task_id -eq $taskId -and $lock -and $lock.task_id -eq $taskId) {
      Write-Output "[watcher] Task '$taskId' already verified (verdict: $($verification.verdict)). Clearing lock."
      Remove-Item -LiteralPath $fullLockPath -Force -ErrorAction SilentlyContinue
    } else {
      Write-Output "[watcher] No new verification work (task_status: '$($taskState.task_status)')."
    }
    return
  }

  if ($lock -and $lock.task_id -eq $taskId) {
    Write-Output "[watcher] Task '$taskId' already handed to Codex at $($lock.invoked_at); still waiting for verification-result.json to update. Not re-invoking."
    return
  }

  # New work detected. Write the lock BEFORE invoking Codex, so a second
  # poll landing while Codex is still running never double-invokes it.
  $lockEntry = [ordered]@{
    task_id     = $taskId
    invoked_at  = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
  }
  ($lockEntry | ConvertTo-Json) | Set-Content -LiteralPath $fullLockPath

  Write-Output "[watcher] New verification work for task '$taskId'. Invoking '$CodexCommand exec'..."

  $prompt = @"
You are the PCC advisor/verifier (DECISION-012/DECISION-023/DECISION-066).
Read .cockpit/handoff/advisor-restart-brief.md for full current-task context.
Follow docs/VERIFICATION_RESULT_SPEC.md and docs/REPO_GOVERNANCE.md's Task
Process step 11 exactly: independently re-run
scripts/verify-handback-guardrails.ps1, review the evidence the brief
points you to, and write your verdict to
.cockpit/result/verification-result.json in the exact required JSON shape.
Do not advance state and do not run any close-out script yourself -- only
produce the verification result.
"@

  & $CodexCommand exec -C $RepoPath -s workspace-write $prompt
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Output "[watcher] '$CodexCommand exec' exited with code $exitCode. Lock left in place; will not re-invoke until this clears or is investigated."
  } else {
    Write-Output "[watcher] '$CodexCommand exec' completed for task '$taskId'. Lock will clear once verification-result.json is confirmed updated on the next poll."
  }
}

Push-Location $RepoPath
try {
  if ($Once) {
    Invoke-OneCheck
  } else {
    Write-Output "[watcher] Starting poll loop (interval: ${PollIntervalSeconds}s). Press Ctrl+C to stop."
    while ($true) {
      Invoke-OneCheck
      Start-Sleep -Seconds $PollIntervalSeconds
    }
  }
} finally {
  Pop-Location
}
