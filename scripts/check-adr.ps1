# Validates PCC's Architecture Decision Records (docs/adr/*.md) against the locked
# MADR-based format (DECISION-115 / ADR-0000). Each ADR must carry YAML front matter
# with a valid `status` + `date`, an `# ADR-NNNN:` title, and the five required
# sections — including the two PCC-specific ones (Confirmation, Engagement) that make
# every decision prove it works and reach every actor (DECISION-117).
#
# Like check-schemas.ps1 this is a reporting tool: it prints [PASS]/[FAIL] per file
# and its OWN exit code reflects whether all ADRs are well-formed, so a caller
# (doctor.ps1 = report; CI / pre-commit = hard gate) can decide how to treat it.

param()

$ErrorActionPreference = "Continue"

$adrDir = "docs/adr"
$requiredSections = @(
  '## Context and Problem',
  '## Decision',
  '## Consequences',
  '## Confirmation',
  '## Engagement'
)
$validStatus = @('Proposed', 'Accepted', 'Deprecated')  # 'Superseded by ADR-NNNN' also allowed

if (-not (Test-Path -LiteralPath $adrDir -PathType Container)) {
  Write-Output "[PASS] no $adrDir yet — nothing to validate."
  exit 0
}

$files = Get-ChildItem -LiteralPath $adrDir -Filter '*.md' -File |
  Where-Object { $_.Name -notmatch '^(TEMPLATE|_)' } | Sort-Object Name

if ($files.Count -eq 0) {
  Write-Output "[PASS] no ADR files in $adrDir — nothing to validate."
  exit 0
}

$anyFailed = $false

foreach ($f in $files) {
  $text = Get-Content -LiteralPath $f.FullName -Raw
  $problems = [System.Collections.Generic.List[string]]::new()

  # --- YAML front matter: the block between the first two --- fences ---
  $fm = $null
  $m = [regex]::Match($text, '(?s)\A\s*---\s*\r?\n(.*?)\r?\n---\s*\r?\n')
  if (-not $m.Success) {
    $problems.Add('missing YAML front matter (--- ... --- block at top)')
  } else {
    $fm = $m.Groups[1].Value
    $statusMatch = [regex]::Match($fm, '(?m)^\s*status:\s*(.+?)\s*$')
    if (-not $statusMatch.Success) {
      $problems.Add('front matter missing "status:"')
    } else {
      $status = $statusMatch.Groups[1].Value.Trim()
      $okStatus = ($validStatus -contains $status) -or ($status -match '^Superseded by ADR-\d+')
      if (-not $okStatus) {
        $problems.Add("invalid status '$status' (expected Proposed/Accepted/Deprecated/'Superseded by ADR-NNNN')")
      }
    }
    if ($fm -notmatch '(?m)^\s*date:\s*\d{4}-\d{2}-\d{2}\s*$') {
      $problems.Add('front matter missing a valid "date: YYYY-MM-DD"')
    }
  }

  # --- title ---
  if ($text -notmatch '(?m)^#\s+ADR-\d+:') {
    $problems.Add('missing "# ADR-NNNN: <title>" heading')
  }

  # --- required sections ---
  foreach ($s in $requiredSections) {
    if ($text -notmatch ('(?m)^' + [regex]::Escape($s) + '\s*$')) {
      $problems.Add("missing required section '$s'")
    }
  }

  if ($problems.Count -gt 0) {
    Write-Output "[FAIL] $($f.Name): $([string]::Join('; ', $problems))"
    $anyFailed = $true
  } else {
    Write-Output "[PASS] $($f.Name)"
  }
}

if ($anyFailed) { exit 1 } else { exit 0 }
