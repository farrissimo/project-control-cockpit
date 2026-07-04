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

# Fields the Semi-Autonomy Ceiling's "archive before you chain" rule
# (docs/BRR_POLICY.md, DECISION-060) as an actual script, closing the gap
# DECISION-059 found: chaining into a next unattended cycle previously
# overwrote the prior cycle's live evidence before it was archived, with
# git history as the only fallback recovery path. This is deliberately NOT
# scripts/close-out-verified-task.ps1's twin: it preserves evidence for a
# cycle that is still HELD (self-verified but not yet accepted or closed)
# and does not advance task_status, call advance-cockpit-state.ps1, or treat
# the cycle as accepted in any way. It works for any verdict, since the
# point is preventing loss before a decision is made, not judging the
# decision itself.

$taskStatePath = ".cockpit/state/task-state.json"
$verificationPath = ".cockpit/result/verification-result.json"

$taskState = Read-Json $taskStatePath
$verification = Read-Json $verificationPath

if ($verification.task_id -ne $taskState.task_id) {
  Fail "Refusing to archive: verification-result.json task_id '$($verification.task_id)' does not match active task-state.json task_id '$($taskState.task_id)'. Reconcile state before archiving this held cycle."
}

$taskId = $taskState.task_id
$directiveArchivePath = ".cockpit/handoff/archive/$taskId-worker-directive.md"
$resultArchivePath = ".cockpit/result/archive/$taskId-worker-result.md"
$verificationArchivePath = ".cockpit/result/archive/$taskId-verification-result.json"

foreach ($archivePath in @($directiveArchivePath, $resultArchivePath, $verificationArchivePath)) {
  if (Test-Path -LiteralPath $archivePath) {
    Fail "Refusing to archive: archive path '$archivePath' already exists. This script never overwrites archived history; if this cycle was already archived (held or closed), there is nothing more to do."
  }
}

Copy-Item -LiteralPath ".cockpit/handoff/worker-directive.md" -Destination $directiveArchivePath
Copy-Item -LiteralPath ".cockpit/result/worker-result.md" -Destination $resultArchivePath
Copy-Item -LiteralPath $verificationPath -Destination $verificationArchivePath

Write-Output "Archived held cycle for task '$taskId' (verdict: $($verification.verdict), task_status unchanged: '$($taskState.task_status)')."
Write-Output "This is a preservation step only -- no state was advanced, no verdict was accepted. The cycle remains exactly as held as it was before this ran."

# Per DECISION-065 (standing owner authorization, not time-boxed), a
# successful -Commit is followed automatically by a push of the current
# branch to origin.
if ($Commit) {
  & git add -A
  if ($LASTEXITCODE -ne 0) {
    Fail "Archive succeeded but 'git add -A' failed."
  }
  $commitMessage = "Archive held cycle for task '$taskId' (verdict: $($verification.verdict), not yet accepted)"
  & git commit -m $commitMessage
  if ($LASTEXITCODE -ne 0) {
    Fail "Archive succeeded but 'git commit' failed. Files are staged; review before retrying."
  }
  Write-Output "Committed the archived evidence for task '$taskId'."

  $currentBranch = (& git rev-parse --abbrev-ref HEAD).Trim()
  & git push origin $currentBranch
  if ($LASTEXITCODE -ne 0) {
    Write-Output "[PUSH WARNING] 'git push origin $currentBranch' failed. The commit above succeeded and is safe locally; retry the push manually when ready."
  } else {
    Write-Output "Pushed '$currentBranch' to origin (DECISION-065: automatic push on commit, standing owner authorization)."
  }
} else {
  Write-Output "Committing was not requested (-Commit was not passed); run 'git add' / 'git commit' manually, or re-run this script with -Commit, which now also pushes automatically per DECISION-065, to also durably commit and sync the archived evidence rather than relying on it only existing on disk."
}
