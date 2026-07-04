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

# This is the non-PASS mirror of scripts/close-out-verified-task.ps1, fielding
# the asymmetry docs/BRR_POLICY.md's "Inadequate-Work Return Path" section
# named as future work (pcc-brr3-004, DECISION-049): before this script,
# closing out a FAIL/INSUFFICIENT/BLOCKED/OUT_OF_SCOPE cycle correctly meant
# calling scripts/advance-cockpit-state.ps1 and scripts/log-event.ps1 as
# separate manual steps, with no archived record unless the verifier
# remembered to make one. That extra friction on exactly the path that is
# supposed to be routine could unintentionally bias behavior toward PASS
# simply because PASS was easier to execute correctly. This script makes the
# non-PASS path exactly as convenient as the PASS path — same four steps,
# same order, same safety properties — and nothing more.

$taskStatePath = ".cockpit/state/task-state.json"
$verificationPath = ".cockpit/result/verification-result.json"

$taskState = Read-Json $taskStatePath
$verification = Read-Json $verificationPath

$nonPassVerdicts = @("FAIL", "INSUFFICIENT", "BLOCKED", "OUT_OF_SCOPE")

if ($verification.verdict -eq "PASS") {
  Fail "Refusing to run: verification-result.json verdict is 'PASS'. Use scripts/close-out-verified-task.ps1 for a PASS verdict instead."
}
if ($verification.verdict -notin $nonPassVerdicts) {
  Fail "Unrecognized verdict '$($verification.verdict)' in $verificationPath."
}
if ($verification.task_id -ne $taskState.task_id) {
  Fail "Refusing to return this cycle: verification-result.json task_id '$($verification.task_id)' does not match active task-state.json task_id '$($taskState.task_id)'. Reconcile state before returning this cycle."
}

$taskId = $taskState.task_id
$directiveArchivePath = ".cockpit/handoff/archive/$taskId-worker-directive.md"
$resultArchivePath = ".cockpit/result/archive/$taskId-worker-result.md"
$verificationArchivePath = ".cockpit/result/archive/$taskId-verification-result.json"

# Bug fix (found during pcc-postbrr-001's real resubmission, 2026-07-04):
# these paths were keyed on task_id alone, so a task_id returned more than
# once (e.g. FAIL then INSUFFICIENT on separate attempts) would collide
# with its own prior archive. If any plain path already exists, suffix with
# the current attempt number so each returned cycle's history is preserved
# distinctly. A normal first-return cycle is unaffected and keeps the
# existing plain naming.
if ((Test-Path -LiteralPath $directiveArchivePath) -or (Test-Path -LiteralPath $resultArchivePath) -or (Test-Path -LiteralPath $verificationArchivePath)) {
  $attemptSuffix = [int]$taskState.attempts
  $directiveArchivePath = ".cockpit/handoff/archive/$taskId-attempt$attemptSuffix-worker-directive.md"
  $resultArchivePath = ".cockpit/result/archive/$taskId-attempt$attemptSuffix-worker-result.md"
  $verificationArchivePath = ".cockpit/result/archive/$taskId-attempt$attemptSuffix-verification-result.json"
}

foreach ($archivePath in @($directiveArchivePath, $resultArchivePath, $verificationArchivePath)) {
  if (Test-Path -LiteralPath $archivePath) {
    Fail "Refusing to return this cycle: archive path '$archivePath' already exists. This script never overwrites archived history; if this cycle was already returned, there is nothing more to do."
  }
}

# --- Step 1/4: archive first, before any state advance. A non-PASS cycle
# gets exactly the same durable record a PASS cycle gets — its evidence and
# verdict are not lost just because the outcome was not PASS. ---
Copy-Item -LiteralPath ".cockpit/handoff/worker-directive.md" -Destination $directiveArchivePath
Copy-Item -LiteralPath ".cockpit/result/worker-result.md" -Destination $resultArchivePath
Copy-Item -LiteralPath $verificationPath -Destination $verificationArchivePath
Write-Output "Step 1/4: archived directive, result, and verification for task '$taskId' (verdict: $($verification.verdict))."

# --- Step 2/4: advance state via the same shared script PASS uses.
# scripts/advance-cockpit-state.ps1 already maps every verdict (not only
# PASS) to a task_status and refreshes both live handoff artifacts
# unconditionally — this script does not duplicate that mapping, it calls
# the same one path PASS already relies on. ---
& pwsh -NoProfile -File "scripts/advance-cockpit-state.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Return aborted: scripts/advance-cockpit-state.ps1 failed. Cycle artifacts are archived but state was not advanced; review before retrying."
}
Write-Output "Step 2/4: state advanced (task_status now reflects the $($verification.verdict) verdict) and both live handoff artifacts refreshed."

# --- Step 3/4: post-return health check, same as close-out-verified-task.ps1. ---
$doctorOutput = & pwsh -NoProfile -File "scripts/doctor.ps1" 2>&1
$doctorOutput | ForEach-Object { Write-Output $_ }
if ($doctorOutput -match "\[ISSUE\]") {
  Fail "Return aborted: scripts/doctor.ps1 reported at least one [ISSUE] after returning this cycle. See the report above."
}
Write-Output "Step 3/4: post-return health check clean."

# --- Step 4/4: log the event from the (still-live, now also archived)
# verification result. scripts/log-event.ps1 already maps every verdict to
# its own event type (verified_fail/verified_insufficient/verified_blocked/
# verified_out_of_scope) — this script does not add a new event type. ---
& pwsh -NoProfile -File "scripts/log-event.ps1" -FromVerificationResult
if ($LASTEXITCODE -ne 0) {
  Fail "Return aborted: scripts/log-event.ps1 failed to record the event."
}
Write-Output "Step 4/4: event logged to .cockpit/logs/routing-log.jsonl."

Write-Output ""

# Commit is the one remaining repo-sync duty this script performs only when
# explicitly requested — same as scripts/close-out-verified-task.ps1.
# DECISION-020 authorizes the verifier to commit the cycle's own verified
# (or, here, correctly-stopped) changes. Per DECISION-065 (standing owner
# authorization, not time-boxed), a successful -Commit is followed
# automatically by a push of the current branch to origin.
if ($Commit) {
  & git add -A
  if ($LASTEXITCODE -ne 0) {
    Fail "Return aborted: 'git add -A' failed."
  }
  $commitMessage = "Return inadequate work for task '$taskId': verdict $($verification.verdict)`n`n$($verification.summary)"
  & git commit -m $commitMessage
  if ($LASTEXITCODE -ne 0) {
    Fail "Return aborted: 'git commit' failed. Files are staged; review before retrying."
  }
  Write-Output "Committed the returned cycle for task '$taskId'."

  $currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
  & git push origin $currentBranch
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[PUSH WARNING] 'git push origin $currentBranch' failed. The commit above succeeded and is safe locally; retry the push manually when ready."
  } else {
    Write-Output "Pushed '$currentBranch' to origin (DECISION-065: automatic push on commit, standing owner authorization)."
  }
} else {
  Write-Output "Repo is in a clean, recorded state for task '$taskId' (verdict: $($verification.verdict)). Committing was not requested (-Commit was not passed); the verifier's remaining manual duty is to review and run 'git add' / 'git commit' (or re-run this script with -Commit, which now also pushes automatically per DECISION-065)."
}
