param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("self_promote", "self_accept")]
  [string]$Action,

  [string]$TaskStatePath = ".cockpit/state/task-state.json"
)

$ErrorActionPreference = "Stop"

function Read-Json {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Write-Error "Missing required file: $Path"
    exit 1
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Write-Error "Invalid JSON in $Path :: $($_.Exception.Message)"
    exit 1
  }
}

# BRR self-gate on PCC's own autonomous path (docs/BRR_POLICY.md, DECISION-042).
#
# THIS IS THE ONE GATE ON PCC'S AUTONOMOUS PATH - AND ONLY THAT PATH.
# It is invoked exclusively when PCC would self-promote the next task or
# self-accept/self-continue a step WITHOUT the owner directing it. Owner-directed
# work does not call this script and is therefore never gated by it: none of
# the owner-path scripts (finalize-worker-handback, close-out-verified-task,
# verify-handback-guardrails, doctor, advance-cockpit-state,
# enforce-handoff-restart-safety) call it. That is what keeps it narrow rather
# than a broad blocker (owner's constraint 1; DECISION-040/041).
#
# It does not redesign the stop model or the acceptance boundary - it composes
# the already-defined ones:
#   * scripts/check-stop-conditions.ps1 must report CLEAR (no mechanically
#     detectable stop; a fork/owner decision would populate owner_decision_request,
#     which that check catches, which blocks here); and
#   * for self-acceptance, the task's class must permit it (Class A only;
#     Class B must not self-accept - Acceptance Boundary Rules, DECISION-041).
#
# Unlike check-stop-conditions.ps1 (advisory, always exits 0), THIS gate is
# allowed to block: exit 0 = PROCEED, any non-zero = DO NOT PROCEED. It is
# fail-closed by design - if it cannot confirm PROCEED for any reason, PCC does
# not take the autonomous step. Building this gate does NOT start unattended
# operation; the first actual gated autonomous run is the supervised pilot
# (pcc-brr2-012).

$taskState = Read-Json $TaskStatePath
$taskId = $taskState.task_id

$blocks = New-Object System.Collections.Generic.List[string]

# --- Composed condition A: the stop-condition check must be CLEAR. ---
$stopOutput = & pwsh -NoProfile -File "scripts/check-stop-conditions.ps1" 2>&1
if ($stopOutput -match "STOP recommended") {
  $stopReasons = ($stopOutput | Select-String -Pattern "^\s*-\s" | ForEach-Object { $_.Line.Trim() }) -join " | "
  $blocks.Add("check-stop-conditions.ps1 did not report CLEAR: $stopReasons")
}

# --- Composed condition B: acceptance boundary, only for self-acceptance. ---
if ($Action -eq "self_accept") {
  if ($taskState.task_safety_class -ne "A") {
    $blocks.Add("Self-acceptance is not permitted for a Class $($taskState.task_safety_class) task. Only Class A may be self-accepted unattended; Class B requires independent review or owner override (Acceptance Boundary Rules, DECISION-041).")
  }
}

Write-Output "BRR autonomous gate - action '$Action' for task '$taskId' (gates PCC's own autonomous path only; owner-directed work is never gated)."
Write-Output ""

if ($blocks.Count -gt 0) {
  Write-Output "GATE: BLOCKED. PCC must not take this autonomous step. Reason(s):"
  foreach ($b in $blocks) { Write-Output "  - $b" }
  Write-Output ""
  Write-Output "Stop and surface via the Owner-Decision Capture Flow (owner_decision_request) or resolve the condition. Do not rationalize a fork into continuation."
  exit 3
}

Write-Output "GATE: PROCEED. No mechanically-detectable stop and the acceptance boundary permits action '$Action'."
Write-Output ""
Write-Output "Reminder: PROCEED is a floor, not a guarantee - a CLEAR stop-check means 'no mechanically-detectable stop', not 'safe in every sense'. Judgment conditions (fork/more-than-one-defensible-path, north-star alignment, whether a new owner decision is required) remain outside automatic detection (DECISION-008); if any is present, stop and surface it regardless of this gate."
