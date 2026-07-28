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
  $isFeature = $false          # ADR-0027: front matter `feature: true` marks a feature ADR
  $status = $null

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
    if ($fm -match '(?m)^\s*feature:\s*true\s*$') { $isFeature = $true }
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

  # --- ADR-0027: feature ADRs carry an Expected-Behavior Map (RTM) ---
  # A feature-tagged ADR (`feature: true`) must contain the map section with a real table.
  # When the ADR is Accepted (= claimed done), the Definition-of-Done bites: no behavior may
  # be status C (built-but-untested), and every built row (A/B) must name a test reference.
  if ($isFeature) {
    $lines = $text -split "\r?\n"
    $hIdx = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
      if ($lines[$i] -match '^\s*##\s+Expected-Behavior Map\b') { $hIdx = $i; break }
    }
    if ($hIdx -lt 0) {
      $problems.Add("feature ADR missing required section '## Expected-Behavior Map'")
    } else {
      # Gather the contiguous markdown table under the heading (skip blank lines first).
      $j = $hIdx + 1
      while ($j -lt $lines.Count -and $lines[$j].Trim() -eq '') { $j++ }
      $tableRows = [System.Collections.Generic.List[string]]::new()
      while ($j -lt $lines.Count -and $lines[$j] -match '^\s*\|') { $tableRows.Add($lines[$j]); $j++ }
      # Data rows = table rows that aren't the header or the |---|---| separator.
      $dataRows = @($tableRows | Where-Object { $_ -notmatch '^\s*\|[\s:|-]*\|?\s*$' })
      if ($tableRows.Count -lt 2 -or $dataRows.Count -lt 1) {
        $problems.Add("Expected-Behavior Map has no behavior rows (needs a table with at least one row)")
      } else {
        # Locate the 'status' and 'test' columns from the header row (robust to reordering).
        $header = $tableRows[0]
        $cols = @($header.Trim('|').Split('|') | ForEach-Object { $_.Trim().ToLower() })
        $statusCol = -1; $testCol = -1
        for ($c = 0; $c -lt $cols.Count; $c++) {
          if ($statusCol -lt 0 -and $cols[$c] -match 'status')       { $statusCol = $c }
          if ($testCol   -lt 0 -and $cols[$c] -match 'test')         { $testCol   = $c }
        }
        $isAccepted = ($status -eq 'Accepted')
        if ($isAccepted -and ($statusCol -lt 0 -or $testCol -lt 0)) {
          $problems.Add("Expected-Behavior Map (Accepted) must have 'status' and 'test' columns to prove done-ness")
        }
        if ($isAccepted -and $statusCol -ge 0 -and $testCol -ge 0) {
          $empties = @('', '-', '--', '—', '–', 'n/a', 'na', 'none', 'tbd', '?', 'todo')
          # 2nd row is the |---| separator; data rows start at index >= 1 among non-separator rows.
          foreach ($row in $dataRows[1..($dataRows.Count - 1)]) {
            $cells = @($row.Trim().Trim('|').Split('|') | ForEach-Object { $_.Trim() })
            if ($cells.Count -le [Math]::Max($statusCol, $testCol)) { continue }
            $st = ($cells[$statusCol] -replace '[^A-Za-z]', '').ToUpper()
            $stClass = if ($st.Length -gt 0) { $st.Substring(0,1) } else { '' }
            $testRef = $cells[$testCol].ToLower()
            if ($stClass -eq 'C') {
              $problems.Add("Accepted feature ADR has a behavior built-but-untested (status C) — Definition of Done requires a passing test")
            } elseif (($stClass -eq 'A' -or $stClass -eq 'B') -and ($empties -contains $testRef)) {
              $problems.Add("Accepted feature ADR has a built behavior (status $stClass) with no test reference — Definition of Done requires a test")
            }
          }
        }
      }
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
