param(
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

# BRR Phase 2 item 4, Automatic Stop Triggers (docs/BRR_POLICY.md, DECISION-040).
# This detects the DETERMINISTICALLY-CHECKABLE stop conditions and SURFACES
# them. It is advisory and non-gating on purpose: it ALWAYS exits 0 and never
# blocks any script, task, or owner-directed action. A reported STOP is a
# recommendation to stop instead of guess, not an automatic halt of the whole
# system (docs/BRR_PLAN.md Phase 2 caution: "controlled forward motion, not
# friction"). scripts/enforce-handoff-restart-safety.ps1 remains the only
# script permitted to gate a handoff.
#
# It deliberately does NOT try to auto-detect the judgment-based stop
# conditions - whether there is more than one defensible next step (a fork),
# whether a task aligns with the north star, or whether a new owner-level
# decision is required. Those are not mechanically decidable and this script
# does not pretend otherwise (DECISION-008: no fake intelligence). They remain
# a matter of judgment, surfaced through the Owner-Decision Capture Flow
# (owner_decision_request, DECISION-037).

$taskState = Read-Json $TaskStatePath
$taskId = $taskState.task_id

# Approved-lane sources named in the Safe Next-Task Drafting Rules
# (docs/BRR_POLICY.md): an owner-approved phase plan, or owner-ranked backlog
# priority. A self-promotion's recorded lane should reference one of these.
$approvedLaneSources = @("BRR_PLAN", "backlog/IDEAS.md", "IDEAS.md", "phase plan", "phase-plan")

# task_status values that mean "do not autonomously continue - this needs
# attention", as opposed to normal in-flight states.
$attentionStatuses = @("blocked", "verified_fail", "insufficient_evidence", "out_of_scope")

$stops = New-Object System.Collections.Generic.List[string]

# --- Detectable condition 1: an owner decision is pending. ---
if ($taskState.owner_decision_request) {
  $stops.Add("An owner decision is pending on task '$taskId' (owner_decision_request is populated). Do not proceed autonomously until the owner decides: $($taskState.owner_decision_request.question)")
}

# --- Detectable condition 2: the task is in an attention-needed status. ---
if ($taskState.task_status -in $attentionStatuses) {
  $stops.Add("Task '$taskId' status is '$($taskState.task_status)', which needs attention rather than autonomous continuation.")
}

# --- Detectable condition 3: repo health reports a real [ISSUE]. ---
$doctorOutput = & pwsh -NoProfile -File "scripts/doctor.ps1" 2>&1
if ($doctorOutput -match "\[ISSUE\]") {
  $issueLines = ($doctorOutput | Select-String -Pattern "\[ISSUE\]" | ForEach-Object { $_.Line.Trim() }) -join " | "
  $stops.Add("Repo health check (doctor.ps1) reports at least one [ISSUE]: $issueLines")
}

# --- Detectable condition 4: a self-promoted task whose recorded lane does
# not reference a recognized approved-lane source. This checks the FORM of
# the justification (that it points at a real approved-lane source), not its
# semantic truth - confirming the cited lane/priority is actually correct
# remains the verifier's job. ---
if ($taskState.promotion_basis) {
  $lane = "$($taskState.promotion_basis.lane)"
  $referencesApprovedSource = $false
  foreach ($src in $approvedLaneSources) {
    if ($lane -like "*$src*") { $referencesApprovedSource = $true; break }
  }
  if (-not $referencesApprovedSource) {
    $stops.Add("Task '$taskId' was self-promoted (promotion_basis present) but its recorded lane does not reference a recognized approved-lane source (expected one of: $($approvedLaneSources -join ', ')). Lane recorded: '$lane'. Cannot confirm this promotion is in-lane.")
  }
}

Write-Output "Automatic Stop Triggers - advisory check for task '$taskId' (non-gating; always exits 0)."
Write-Output ""

if ($stops.Count -gt 0) {
  Write-Output "STOP recommended. Detected stop condition(s):"
  foreach ($s in $stops) { Write-Output "  - $s" }
  Write-Output ""
  Write-Output "This is a recommendation to stop instead of guess, not an automatic halt. Surface these to the owner (owner_decision_request) or resolve them before autonomous continuation."
} else {
  Write-Output "CLEAR TO PROCEED on the deterministically-checkable stop conditions."
}

Write-Output ""
Write-Output "Not auto-checked (remain judgment, per DECISION-008; surface via owner_decision_request if present): whether more than one defensible next step exists (a fork), whether the work aligns with the north star, and whether a new owner-level decision is required. This check certifies only the mechanical conditions above, not the judgment-based ones."
