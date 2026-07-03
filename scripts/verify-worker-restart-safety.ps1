param(
  [string]$DirectivePath = ".cockpit/handoff/worker-directive.md"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

if (-not (Test-Path -LiteralPath $DirectivePath -PathType Leaf)) {
  Fail "Missing required file: $DirectivePath"
}

$liveContent = Get-Content -Raw -LiteralPath $DirectivePath

# --- Check 1: the live directive is independently self-contained ---
# Runs on the live file directly, before any comparison to the generator, so a
# truncated or corrupted file is caught on its own terms rather than only
# ever failing indirectly through Check 2's content diff.
$requiredSections = @(
  "## Receiving Role",
  "## Project",
  "## Current Task",
  "## Current Truth",
  "## Objective",
  "## Exact Next Action",
  "## Allowed Scope",
  "## Forbidden Scope",
  "## Completion Criteria",
  "## Required Evidence",
  "## Expected Return Format",
  "## Blocked / Failure Instructions"
)

$missingSections = @()
foreach ($section in $requiredSections) {
  if ($liveContent -notmatch [regex]::Escape($section)) {
    $missingSections += $section
  }
}

if ($missingSections.Count -gt 0) {
  Fail "Restart-safety check FAILED: $DirectivePath is missing required section(s): $($missingSections -join ', '). A fresh worker session cannot resume without owner re-briefing if required sections are absent."
}

# --- Check 2: the live directive is exactly what canonical state would produce today ---
# This is the core restart-safety claim: a fresh worker reading only $DirectivePath is
# reading a byte-for-byte projection of .cockpit/state/*.json, not something stale or
# hand-edited out of band. If this check passes, the directive carries no information
# that canonical state doesn't already carry.
$scratchPath = Join-Path ([System.IO.Path]::GetTempPath()) "pcc-restart-safety-check-$([guid]::NewGuid()).md"
try {
  & pwsh -NoProfile -File "scripts/generate-worker-directive.ps1" -OutputPath $scratchPath
  if ($LASTEXITCODE -ne 0) {
    Fail "generate-worker-directive.ps1 failed while regenerating the directive for comparison. Canonical state cannot currently reproduce a valid directive, so restart safety cannot be confirmed."
  }

  $freshContent = Get-Content -Raw -LiteralPath $scratchPath

  if ($freshContent -ne $liveContent) {
    Fail "Restart-safety check FAILED: $DirectivePath does not match what generate-worker-directive.ps1 currently produces from canonical state. A fresh worker session would read stale or hand-edited content instead of canonical truth. Regenerate the directive from state before handing it to a worker."
  }
} finally {
  if (Test-Path -LiteralPath $scratchPath) {
    Remove-Item -LiteralPath $scratchPath -Force
  }
}

Write-Output "Restart safety OK: '$DirectivePath' contains all $($requiredSections.Count) required sections and matches canonical state. A fresh worker session can execute it without owner re-briefing."
