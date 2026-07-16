# Validates PCC's canonical runtime JSON files against schemas/*.schema.json
# using PowerShell's built-in Test-Json. This requires pwsh (PowerShell 6+) -
# Test-Json does not exist in Windows PowerShell 5.1 - so this script must be
# run under pwsh, same as the other schema/state checks it sits alongside.
#
# Its exit code reflects whether every file matched its schema; each caller decides
# how to treat it (like check-adr.ps1). doctor.ps1 = REPORT: it labels the finding and
# always exits 0 regardless. The worker-handback path = HARD GATE: both
# scripts/finalize-worker-handback.ps1 and scripts/verify-handback-guardrails.ps1 abort
# the handback on a non-zero exit (a schema violation against the returned state). So a
# caller CAN and does halt on it — it is not merely a report.

param()

$ErrorActionPreference = "Continue"

$checks = @(
  @{ Path = ".cockpit/state/project-state.json"; Schema = "schemas/project-state.schema.json" },
  @{ Path = ".cockpit/state/task-state.json"; Schema = "schemas/task-state.schema.json" },
  @{ Path = ".cockpit/result/verification-result.json"; Schema = "schemas/verification-result.schema.json" }
)

$anyFailed = $false

foreach ($c in $checks) {
  if (-not (Test-Path -LiteralPath $c.Path -PathType Leaf)) {
    Write-Output "[FAIL] $($c.Path): file not found."
    $anyFailed = $true
    continue
  }
  if (-not (Test-Path -LiteralPath $c.Schema -PathType Leaf)) {
    Write-Output "[FAIL] $($c.Path): schema file $($c.Schema) not found."
    $anyFailed = $true
    continue
  }

  $valid = $false
  $reason = $null
  try {
    $valid = Test-Json -Path $c.Path -SchemaFile $c.Schema -ErrorAction Stop
  } catch {
    $valid = $false
    $reason = $_.Exception.Message
  }

  if ($valid) {
    Write-Output "[PASS] $($c.Path) matches $($c.Schema)."
  } else {
    $detail = if ($reason) { $reason } else { "does not match its schema (no further detail available)." }
    Write-Output "[FAIL] $($c.Path): $detail"
    $anyFailed = $true
  }
}

if ($anyFailed) { exit 1 } else { exit 0 }
