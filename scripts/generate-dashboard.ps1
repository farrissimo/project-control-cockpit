param(
  [string]$ProjectStatePath = ".cockpit/state/project-state.json",
  [string]$TaskStatePath = ".cockpit/state/task-state.json",
  [string]$OutputPath = "dashboard/index.html"
)

$ErrorActionPreference = "Stop"

# Owner Control Board dashboard (archive/PCC Original Project Scope.md §11;
# pcc-pathD-001, the first Category D task per docs/PATH_A_PLAN.md, Phase D1).
#
# This is a READ-ONLY, self-contained local dashboard generator: the finished-
# state UI form decided in DECISION-087 (a pure consumer of the .cockpit/ file
# bridge) and the local-deterministic execution discipline of DECISION-088
# (plain PowerShell + static HTML, zero LLM dependency, zero external runtime).
# It:
#   - reads only .cockpit/state/project-state.json and .cockpit/state/task-state.json,
#   - writes only the given -OutputPath (a static HTML file outside .cockpit/),
#   - never mutates any .cockpit/ file,
#   - calls no other script.
# Regeneration is manual: re-run this script. Auto-refresh (Phase D2) is out of
# scope here.

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

Add-Type -AssemblyName System.Web

$projectState = Read-Json $ProjectStatePath
$taskState = Read-Json $TaskStatePath

# Fixed two-role split (DECISION-012/023): the dashboard states the standing
# role split, not a per-task field, since project-state.json/task-state.json
# do not carry a "current role" field of their own.
$currentRole = "Worker: Claude Code / Advisor-Verifier: Codex (or disclosed fallback per DECISION-086)"

$rows = [ordered]@{
  "Current Project"       = "$($projectState.project_name) ($($projectState.project_id))"
  "Current Task"          = "$($taskState.task_id) -- $($taskState.task_title)"
  "Current State"         = "$($taskState.task_status) (phase: $($projectState.current_phase))"
  "Next Expected Action"  = $projectState.next_expected_action
  "Current Role"          = $currentRole
  "Current Worker"        = $taskState.assigned_worker
  "Current Verdict"       = $taskState.verification_verdict
  "Current Blocker"       = $taskState.current_blocker
}

$generatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

$rowsHtml = ($rows.GetEnumerator() | ForEach-Object {
  "      <tr><th>$(Encode-Html $_.Key)</th><td>$(Encode-Html ([string]$_.Value))</td></tr>"
}) -join "`n"

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>PCC Owner Control Board</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; background: #111; color: #eee; }
  h1 { font-size: 1.3rem; }
  table { border-collapse: collapse; width: 100%; max-width: 900px; }
  th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #333; vertical-align: top; }
  th { width: 220px; color: #9cf; }
  .meta { color: #888; font-size: 0.85rem; margin-top: 1rem; }
</style>
</head>
<body>
  <h1>PCC Owner Control Board</h1>
  <table>
$rowsHtml
  </table>
  <p class="meta">Generated $generatedAt from canonical .cockpit/ state. Read-only: this page never writes to .cockpit/. Re-run scripts/generate-dashboard.ps1 to refresh.</p>
</body>
</html>
"@

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and -not (Test-Path -LiteralPath $outputDir)) {
  New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
}

Set-Content -LiteralPath $OutputPath -Value $html -NoNewline
Write-Output "Generated dashboard at $OutputPath from $ProjectStatePath and $TaskStatePath."
