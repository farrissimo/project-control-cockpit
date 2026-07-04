param(
  [switch]$Commit
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

# This script gives the verifier one deterministic path for the post-PASS
# close-out sequence already recommended in docs/HANDOFF_PACKET_SPEC.md
# ("Recommended Close-Out Order"): archive first, advance state with the
# archived path, run the post-close-out health check, log the event, and
# leave the repo in a clean, commit-ready state. It never decides a verdict
# and never runs for anything other than an already-written PASS.

$taskStatePath = ".cockpit/state/task-state.json"
$verificationPath = ".cockpit/result/verification-result.json"

$taskState = Read-Json $taskStatePath
$verification = Read-Json $verificationPath

if ($verification.verdict -ne "PASS") {
  Fail "Refusing to close out: verification-result.json verdict is '$($verification.verdict)', not 'PASS'. This script only performs the post-PASS close-out sequence."
}
if ($verification.task_id -ne $taskState.task_id) {
  Fail "Refusing to close out: verification-result.json task_id '$($verification.task_id)' does not match active task-state.json task_id '$($taskState.task_id)'. Reconcile state before closing out."
}

$taskId = $taskState.task_id
$directiveArchivePath = ".cockpit/handoff/archive/$taskId-worker-directive.md"
$resultArchivePath = ".cockpit/result/archive/$taskId-worker-result.md"
$verificationArchivePath = ".cockpit/result/archive/$taskId-verification-result.json"

foreach ($archivePath in @($directiveArchivePath, $resultArchivePath, $verificationArchivePath)) {
  if (Test-Path -LiteralPath $archivePath) {
    Fail "Refusing to close out: archive path '$archivePath' already exists. This script never overwrites archived history; if this task was already closed out, there is nothing more to do."
  }
}

# --- Step 1/4: archive first, before any state advance. ---
Copy-Item -LiteralPath ".cockpit/handoff/worker-directive.md" -Destination $directiveArchivePath
Copy-Item -LiteralPath ".cockpit/result/worker-result.md" -Destination $resultArchivePath
Copy-Item -LiteralPath $verificationPath -Destination $verificationArchivePath
Write-Output "Step 1/4: archived directive, result, and verification for task '$taskId'."

# --- Step 2/4: advance state, pointing last_verified_handoff at the archive.
# scripts/advance-cockpit-state.ps1 now refreshes both live handoff artifacts
# itself immediately after writing state (scripts/refresh-live-handoff-artifacts.ps1),
# so this script no longer duplicates that call - one shared invariant, one
# call site, rather than every status-mutating path re-implementing it. ---
& pwsh -NoProfile -File "scripts/advance-cockpit-state.ps1" -ArchivedDirectivePath $directiveArchivePath
if ($LASTEXITCODE -ne 0) {
  Fail "Close-out aborted: scripts/advance-cockpit-state.ps1 failed. Cycle artifacts are archived but state was not advanced; review before retrying."
}
Write-Output "Step 2/4: state advanced (last_verified_handoff points at the archived directive) and both live handoff artifacts refreshed."

# --- Step 3/4: post-close-out health check. ---
$doctorOutput = & pwsh -NoProfile -File "scripts/doctor.ps1" 2>&1
$doctorOutput | ForEach-Object { Write-Output $_ }
if ($doctorOutput -match "\[ISSUE\]") {
  Fail "Close-out aborted: scripts/doctor.ps1 reported at least one [ISSUE] after close-out. See the report above."
}
Write-Output "Step 3/4: post-close-out health check clean."

# --- Step 4/4: log the event from the (still-live, now also archived) verification result. ---
& pwsh -NoProfile -File "scripts/log-event.ps1" -FromVerificationResult
if ($LASTEXITCODE -ne 0) {
  Fail "Close-out aborted: scripts/log-event.ps1 failed to record the event."
}
Write-Output "Step 4/4: event logged to .cockpit/logs/routing-log.jsonl."

Write-Output ""

# Commit is the one remaining repo-sync duty this script performs only when
# explicitly requested. DECISION-020 already authorizes the verifier to
# commit the cycle's own verified changes; it does not authorize this script
# to decide that moment automatically on every run. Per DECISION-065 (a
# standing, non-time-boxed owner authorization, not time-boxed like the
# earlier DECISION-036 exception), a successful -Commit is followed
# automatically by a push of the current branch to origin -- no separate
# push approval is required per-cycle anymore.
if ($Commit) {
  & git add -A
  if ($LASTEXITCODE -ne 0) {
    Fail "Close-out aborted: 'git add -A' failed."
  }
  $commitMessage = "Close out task '$taskId': verified PASS`n`n$($verification.summary)"
  & git commit -m $commitMessage
  if ($LASTEXITCODE -ne 0) {
    Fail "Close-out aborted: 'git commit' failed. Files are staged; review before retrying."
  }
  Write-Output "Committed the verified cycle for task '$taskId'."

  $currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
  & git push origin $currentBranch
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[PUSH WARNING] 'git push origin $currentBranch' failed. The commit above succeeded and is safe locally; retry the push manually when ready."
  } else {
    Write-Output "Pushed '$currentBranch' to origin (DECISION-065: automatic push on commit, standing owner authorization)."
  }
} else {
  Write-Output "Repo is in a clean commit-ready state for task '$taskId'. Committing was not requested (-Commit was not passed); the verifier's remaining manual duty is to review and run 'git add' / 'git commit' (or re-run this script with -Commit, which now also pushes automatically per DECISION-065)."
}
