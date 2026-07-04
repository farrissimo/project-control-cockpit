# Validates PCC's canonical runtime JSON files against schemas/*.schema.json
# using PowerShell's built-in Test-Json. This requires pwsh (PowerShell 6+) -
# Test-Json does not exist in Windows PowerShell 5.1 - so this script must be
# run under pwsh, same as the other schema/state checks it sits alongside.
#
# This is a reporting tool, not a gate: its own exit code reflects whether
# every file matched its schema, purely so a caller (doctor.ps1) can decide
# how to label the finding. Nothing in this repo treats that exit code as a
# reason to halt or block a cycle - doctor.ps1 always exits 0 regardless.

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
