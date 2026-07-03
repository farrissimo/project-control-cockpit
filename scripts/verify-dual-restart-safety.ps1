$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Normalize-GeneratedTimestamp {
  param([string]$Text)
  # The brief embeds a live "Generated <timestamp> from canonical repo truth" line
  # that changes on every regeneration. Comparing it verbatim would make the
  # freshness check fail almost always, even when nothing meaningful changed -
  # so it is normalized out before comparing content.
  return ($Text -replace "Generated \S+ from canonical repo truth", "Generated <timestamp> from canonical repo truth")
}

$advisorBriefPath = ".cockpit/handoff/advisor-restart-brief.md"
$requiredAdvisorSections = @(
  "## What This Project Is",
  "## Active Task",
  "## Last Verified",
  "## Open Issues",
  "## Read First",
  "## What Happens Next"
)

if (-not (Test-Path -LiteralPath $advisorBriefPath -PathType Leaf)) {
  Fail "Missing required file: $advisorBriefPath. Generate it first with scripts/generate-advisor-restart-brief.ps1."
}
$liveAdvisorContent = Get-Content -Raw -LiteralPath $advisorBriefPath

$missingAdvisorSections = @()
foreach ($section in $requiredAdvisorSections) {
  if ($liveAdvisorContent -notmatch [regex]::Escape($section)) { $missingAdvisorSections += $section }
}
if ($missingAdvisorSections.Count -gt 0) {
  Fail "Dual-restart proof FAILED (advisor side): $advisorBriefPath is missing required section(s): $($missingAdvisorSections -join ', ')."
}

$advisorScratch = Join-Path ([System.IO.Path]::GetTempPath()) "pcc-dual-restart-advisor-$([guid]::NewGuid()).md"
try {
  & pwsh -NoProfile -File "scripts/generate-advisor-restart-brief.ps1" -OutputPath $advisorScratch
  if ($LASTEXITCODE -ne 0) {
    Fail "Dual-restart proof FAILED (advisor side): generate-advisor-restart-brief.ps1 could not regenerate a brief from canonical state."
  }
  $freshAdvisorContent = Get-Content -Raw -LiteralPath $advisorScratch
  if ((Normalize-GeneratedTimestamp $freshAdvisorContent) -ne (Normalize-GeneratedTimestamp $liveAdvisorContent)) {
    Fail "Dual-restart proof FAILED (advisor side): $advisorBriefPath does not match what generate-advisor-restart-brief.ps1 currently produces from canonical state (ignoring the generation timestamp). A fresh advisor session would read stale content."
  }
} finally {
  if (Test-Path -LiteralPath $advisorScratch) { Remove-Item -LiteralPath $advisorScratch -Force }
}

Write-Output "Advisor restart check passed: $advisorBriefPath is complete and fresh."

# Worker side: reuse the existing check rather than duplicating its logic.
& pwsh -NoProfile -File "scripts/verify-worker-restart-safety.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "Dual-restart proof FAILED (worker side): scripts/verify-worker-restart-safety.ps1 reported a problem with .cockpit/handoff/worker-directive.md. See its output above for detail."
}

Write-Output "Dual-restart proof OK: a fresh advisor session and a fresh worker session can both resume from canonical repo truth and complete one PCC cycle without owner re-briefing."
