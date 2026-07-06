param(
  [string]$ProjectStatePath = ".cockpit/state/project-state.json",
  [string]$TaskStatePath = ".cockpit/state/task-state.json",
  [string]$VerificationResultPath = ".cockpit/result/verification-result.json",
  [string]$WorkerResultPath = ".cockpit/result/worker-result.md",
  [string]$RoutingLogPath = ".cockpit/logs/routing-log.jsonl",
  [string]$ClassifyRoutingScriptPath = "scripts/classify-routing.ps1",
  [int]$RoutingHistoryTailCount = 10,
  [string]$OutputPath = "dashboard/index.html"
)

$ErrorActionPreference = "Stop"

# PCC Dashboard: Owner Control Board, Directive, Verification, Local Tools,
# and Routing History panels (archive/PCC Original Project Scope.md §11;
# pcc-pathD-001..003, Category D Phase D1 per docs/PATH_A_PLAN.md).
#
# This is a READ-ONLY, self-contained local dashboard generator: the finished-
# state UI form decided in DECISION-087 (a pure consumer of the .cockpit/ file
# bridge) and the local-deterministic execution discipline of DECISION-088
# (plain PowerShell + static HTML, zero LLM dependency, zero external runtime).
#
# Current, accurate contract:
#   - reads .cockpit/state/project-state.json, .cockpit/state/task-state.json,
#     .cockpit/result/verification-result.json, and .cockpit/logs/routing-log.jsonl,
#   - treats -WorkerResultPath as a display-only pointer (its path is shown,
#     its content is never opened or parsed -- avoids a markdown-parsing
#     dependency for content the owner can just open directly),
#   - invokes exactly one other script as an explicit subprocess:
#     scripts/classify-routing.ps1, capturing its stdout as display-only text
#     for the Local Tools Panel (pcc-pathD-003). This mirrors
#     scripts/doctor.ps1's already-audited composition pattern (explicit
#     subprocess + stdout consumption, no hidden shared state,
#     DECISION-074/077 extractability). If that one call fails, the panel
#     shows a clear "unavailable" message rather than crashing the whole
#     dashboard, consistent with the advisory being non-gating by its own
#     contract (DECISION-075). No other script is invoked.
#   - writes only the given -OutputPath (a static HTML file outside .cockpit/),
#   - never mutates any .cockpit/ file.
#
# The Directive Panel is sourced entirely from task-state.json fields already
# in hand (boundaries, required_evidence, completion_criteria,
# current_directive_path) rather than parsing worker-directive.md's freeform
# markdown -- simpler and no parser dependency for the same information.
#
# Regeneration is manual: re-run this script. scripts/watch-dashboard.ps1
# (pcc-pathD-004, Phase D2) polls the same inputs and re-invokes this script
# when they change, without altering this script's own contract.

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

function Encode-Html {
  param([AllowNull()][string]$Text)
  if ([string]::IsNullOrEmpty($Text)) { return "(none)" }
  return [System.Web.HttpUtility]::HtmlEncode($Text)
}

function Format-ListOrNone {
  param($Items)
  if (-not $Items -or $Items.Count -eq 0) { return "(none)" }
  return ($Items -join "; ")
}

function Build-Table {
  param([System.Collections.Specialized.OrderedDictionary]$Rows)
  return (($Rows.GetEnumerator() | ForEach-Object {
    "      <tr><th>$(Encode-Html $_.Key)</th><td>$(Encode-Html ([string]$_.Value))</td></tr>"
  }) -join "`n")
}

function Get-RoutingHistoryHtml {
  param([string]$Path, [int]$TailCount)

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    return "    <p>(no routing history: $(Encode-Html $Path) not found)</p>"
  }

  $lines = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue
  if (-not $lines -or $lines.Count -eq 0) {
    return "    <p>(routing history is empty)</p>"
  }

  $entries = New-Object System.Collections.Generic.List[object]
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
      $entries.Add((ConvertFrom-Json -InputObject $line))
    } catch {
      # Skip malformed individual lines rather than failing the whole
      # dashboard -- routing-log.jsonl is append-only operational history,
      # not a hard contract this read-only panel enforces.
      continue
    }
  }

  if ($entries.Count -eq 0) {
    return "    <p>(no readable routing history entries)</p>"
  }

  $tail = $entries | Select-Object -Last $TailCount
  $rowsHtml = ($tail | ForEach-Object {
    $routeOrEvent = if ($_.event_type) { $_.event_type } else { $_.route }
    $detailOrReason = if ($_.detail) { $_.detail } else { $_.reason }
    "      <tr><td>$(Encode-Html ([string]$_.timestamp))</td><td>$(Encode-Html ([string]$_.task_id))</td><td>$(Encode-Html ([string]$routeOrEvent))</td><td>$(Encode-Html ([string]$detailOrReason))</td></tr>"
  }) -join "`n"

  return @"
    <table>
      <tr><th>Timestamp</th><th>Task</th><th>Route / Event</th><th>Detail</th></tr>
$rowsHtml
    </table>
"@
}

function Get-LocalToolsAdvisoryHtml {
  param([string]$ScriptPath, [string]$TaskStatePath)

  if (-not (Test-Path -LiteralPath $ScriptPath -PathType Leaf)) {
    return "    <p>(routing advisory unavailable: $(Encode-Html $ScriptPath) not found)</p>"
  }

  $output = & pwsh -NoProfile -File $ScriptPath -TaskStatePath $TaskStatePath 2>&1
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0) {
    return "    <p>(routing advisory unavailable: $(Encode-Html $ScriptPath) exited $exitCode)</p>"
  }

  $escaped = Encode-Html ([string]($output -join "`n"))
  return "    <pre>$escaped</pre>"
}

Add-Type -AssemblyName System.Web

$projectState = Read-Json $ProjectStatePath
$taskState = Read-Json $TaskStatePath
$verificationResult = Read-Json $VerificationResultPath

# Fixed two-role split (DECISION-012/023): the dashboard states the standing
# role split, not a per-task field, since project-state.json/task-state.json
# do not carry a "current role" field of their own.
$currentRole = "Worker: Claude Code / Advisor-Verifier: Codex (or disclosed fallback per DECISION-086)"

$ownerControlRows = [ordered]@{
  "Current Project"       = "$($projectState.project_name) ($($projectState.project_id))"
  "Current Task"          = "$($taskState.task_id) -- $($taskState.task_title)"
  "Current State"         = "$($taskState.task_status) (phase: $($projectState.current_phase))"
  "Next Expected Action"  = $projectState.next_expected_action
  "Current Role"          = $currentRole
  "Current Worker"        = $taskState.assigned_worker
  "Current Verdict"       = $taskState.verification_verdict
  "Current Blocker"       = $taskState.current_blocker
}

# Directive Panel (pcc-pathD-002): sourced from task-state.json fields already
# read above -- boundaries/required_evidence/completion_criteria are the same
# content the live worker-directive.md renders, without needing to parse it.
$directiveRows = [ordered]@{
  "Task ID / Title"       = "$($taskState.task_id) -- $($taskState.task_title)"
  "Task Safety Class"     = $taskState.task_safety_class
  "Allowed Scope"         = Format-ListOrNone $taskState.boundaries.allowed
  "Forbidden Scope"       = Format-ListOrNone $taskState.boundaries.forbidden
  "Completion Criteria"   = Format-ListOrNone $taskState.completion_criteria
  "Required Evidence"     = Format-ListOrNone $taskState.required_evidence
  "Handoff Target"        = $taskState.current_directive_path
}

# Verification Panel (pcc-pathD-002): sourced from verification-result.json.
# worker-result.md is referenced by path only (display pointer), not parsed --
# it is freeform markdown evidence meant to be read directly, not summarized.
$verificationRows = [ordered]@{
  "Verdict"               = $verificationResult.verdict
  "Summary"               = $verificationResult.summary
  "Missing Evidence"      = Format-ListOrNone $verificationResult.missing_evidence
  "Out-of-Scope Findings" = Format-ListOrNone $verificationResult.out_of_scope_findings
  "Risks"                 = Format-ListOrNone $verificationResult.risks
  "Next Action"           = $verificationResult.next_action
  "Evidence File"         = $WorkerResultPath
}

$generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

$ownerControlHtml = Build-Table $ownerControlRows
$directiveHtml = Build-Table $directiveRows
$verificationHtml = Build-Table $verificationRows
$localToolsHtml = Get-LocalToolsAdvisoryHtml -ScriptPath $ClassifyRoutingScriptPath -TaskStatePath $TaskStatePath
$routingHistoryHtml = Get-RoutingHistoryHtml -Path $RoutingLogPath -TailCount $RoutingHistoryTailCount

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PCC Dashboard</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  h1 { font-size: 1.3rem; }
  h2 { font-size: 1.05rem; color: #9cf; margin-top: 2rem; }
  table { border-collapse: collapse; width: 100%; max-width: 900px; }
  th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #333; vertical-align: top; }
  th { width: 220px; color: #9cf; }
  .meta { color: #888; font-size: 0.85rem; margin-top: 1rem; }
  pre { white-space: pre-wrap; background: #1a1a1a; padding: 1rem; border-radius: 4px; max-width: 900px; }
</style>
</head>
<body>
  <h1>PCC Dashboard</h1>

  <h2>Owner Control Board</h2>
  <table>
$ownerControlHtml
  </table>

  <h2>Directive Panel</h2>
  <table>
$directiveHtml
  </table>

  <h2>Verification Panel</h2>
  <table>
$verificationHtml
  </table>

  <h2>Local Tools Panel</h2>
$localToolsHtml

  <h2>Routing History</h2>
$routingHistoryHtml

  <p class="meta">Generated $generatedAt from canonical .cockpit/ state. Read-only: this page never writes to .cockpit/. Re-run scripts/generate-dashboard.ps1 to refresh.</p>
</body>
</html>
"@

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Set-Content -LiteralPath $OutputPath -Value $html -NoNewline
Write-Output "Generated dashboard at $OutputPath from $ProjectStatePath, $TaskStatePath, $VerificationResultPath, and $RoutingLogPath."
