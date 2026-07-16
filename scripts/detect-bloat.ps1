<#
  PCC detection: project bloat (COCKPIT_ROADMAP #16).

  Threshold-based, not mind-reading (per the owner and the research): flags the
  objective, cleanly-measurable bloat signals - large source files and too many
  dependencies - against a declared, adjustable thresholds file
  (.cockpit/state/bloat-thresholds.json). It reports size/count FACTS; it does
  not claim the growth is bad.

  Duplication and dead code (the other research-named signals) are deliberately
  NOT guessed here: they need language-specific tooling and produce false
  alarms, which would break PCC's no-fake-certainty rule.

  Deterministic: git + file line counts + JSON parse, no LLM, read-only, exits 0.
  -Json for the app; -WriteFile drops truth to
  .cockpit/result/detections/bloat.json. Works with app/ deleted.
#>
param(
  [switch]$Json,
  [switch]$WriteFile
)

$ErrorActionPreference = 'Continue'
# Emit UTF-8 so non-ASCII survives a redirected pipe (else PowerShell writes
# OEM-codepage bytes that make the JSON invalid and the app silently drops it).
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$checkedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$cfgPath = '.cockpit/state/bloat-thresholds.json'

function New-Result([string]$signal, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector = 'bloat'; roadmap = 'P3 #16'; checked_at = $checkedAt
    signal = $signal; count = @($items).Count; items = @($items)
    observed = $observed; might_mean = $mightMean; not_proven = $notProven; what_to_do = $whatToDo
  }
}

function Convert-GlobToRegex([string]$glob) {
  $e = [regex]::Escape($glob)
  $e = $e -replace '\\\*\\\*', '.*'
  $e = $e -replace '\\\*', '[^/]*'
  return '^' + $e + '$'
}

if (-not (Test-Path -LiteralPath $cfgPath -PathType Leaf)) {
  $r = New-Result 'unknown' @() "No bloat thresholds found at $cfgPath." `
    'Nothing can be checked without declared thresholds.' 'Whether the project is bloating.' `
    "Create $cfgPath, then re-run."
} else {
  $cfg = $null
  try { $cfg = Get-Content -Raw -LiteralPath $cfgPath | ConvertFrom-Json } catch { }
  if ($null -eq $cfg) {
    # Present but unusable (malformed JSON, or an empty/null file). Reporting 'clear'
    # here would be a false all-clear over a project we never actually scanned - the
    # exact green-over-unchecked bug the sibling config-driven detectors (drift,
    # stale-docs, high-stakes) already guard against. Match the badge to the truth.
    $r = New-Result 'unknown' @() "$cfgPath is present but could not be read as valid JSON." `
      'A malformed thresholds file cannot be used to check anything.' 'Whether the project is bloating.' `
      "Fix the JSON in $cfgPath (or delete it to fall back to defaults), then re-run."
  } else {
    $maxLines = if ($cfg.max_source_file_lines) { [int]$cfg.max_source_file_lines } else { 600 }
    $maxDeps  = if ($cfg.max_dependencies) { [int]$cfg.max_dependencies } else { 20 }
    # Filter out nulls: @($cfg.source_globs) when the key is ABSENT yields @($null) —
    # a 1-element array in PowerShell, not empty — which would defeat the empty-config
    # guard below. Where-Object drops the phantom null so "no globs declared" is Count 0.
    $srcGlobs = @($cfg.source_globs | Where-Object { $_ })
    $manifests = @($cfg.dependency_manifests | Where-Object { $_ })
    # Soak fix F10: exclude_globs lets a project scope bloat to ITS OWN code and skip
    # the copied PCC cockpit engine (app/, scripts/, schemas/) and vendored deps. Without
    # this, a scaffolded project's bloat scan flagged PCC's own renderer.js as if it were
    # the owner's product. Absent exclude_globs = no exclusions (PCC's own config).
    $excludeGlobs = @($cfg.exclude_globs)

    if ($srcGlobs.Count -eq 0 -and $manifests.Count -eq 0) {
      # Nothing declared to scan - neither source globs nor dependency manifests. A
      # 'clear' would paint green over zero files checked (same false all-clear class
      # as a malformed config above); fail closed to 'unknown' instead.
      $r = New-Result 'unknown' @() "$cfgPath declares no source_globs and no dependency_manifests." `
        'With nothing declared to scan, a "clear" would be a green over an unchecked project.' 'Whether the project is bloating.' `
        "Add source_globs (and/or dependency_manifests) to $cfgPath, then re-run."
    } else {
      $items = @()

      # --- Large source files (from tracked files matching the source globs) ---
  $tracked = @(& git ls-files 2>$null | ForEach-Object { "$_".Trim() } | Where-Object { $_ })
  $srcRegexes = $srcGlobs | ForEach-Object { Convert-GlobToRegex $_ }
  $excludeRegexes = $excludeGlobs | ForEach-Object { Convert-GlobToRegex $_ }
  $sourceFiles = @($tracked | Where-Object { $f = $_; ($srcRegexes | Where-Object { $f -match $_ }).Count -gt 0 })
  if ($excludeRegexes.Count -gt 0) {
    $sourceFiles = @($sourceFiles | Where-Object { $f = $_; ($excludeRegexes | Where-Object { $f -match $_ }).Count -eq 0 })
  }
  foreach ($f in $sourceFiles) {
    if (Test-Path -LiteralPath $f -PathType Leaf) {
      $lc = @(Get-Content -LiteralPath $f).Count
      if ($lc -gt $maxLines) { $items += "large file: $f ($lc lines > $maxLines)" }
    }
  }

  # --- Dependency count (deps + devDeps across declared manifests) ---
  $depTotal = 0
  foreach ($mf in $manifests) {
    if (Test-Path -LiteralPath $mf -PathType Leaf) {
      try {
        $pkg = Get-Content -Raw -LiteralPath $mf | ConvertFrom-Json
        foreach ($k in 'dependencies', 'devDependencies') {
          if ($pkg.$k) { $depTotal += @($pkg.$k.PSObject.Properties).Count }
        }
      } catch { }
    }
  }
  if ($depTotal -gt $maxDeps) { $items += "dependencies: $depTotal across manifests > $maxDeps" }

  $summary = "$($sourceFiles.Count) source file(s) checked, $depTotal dependenc(ies) declared."
  if ($items.Count -eq 0) {
    $r = New-Result 'clear' @() "No bloat thresholds exceeded. $summary" `
      'The project is within the size/count limits you set.' `
      'This checks only file size and dependency count - not duplication or dead code (those need language tooling).' `
      'Nothing needed for this signal.'
      } else {
        $r = New-Result 'notice' $items "Bloat threshold(s) exceeded. $summary" `
          'Growth past the limits you set - could be genuine bloat, or legitimate growth that warrants raising the threshold.' `
          'Whether the growth is actually a problem; size/count are facts, not verdicts.' `
          "Review the flagged items: split large files or prune dependencies if warranted; otherwise raise the limits in $cfgPath on purpose."
      }
    }
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 5) | Out-File -FilePath (Join-Path $dir 'bloat.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - project bloat ($checkedAt)"
  Write-Output "Signal: $($r.signal) ($($r.count) threshold(s) exceeded)"
  Write-Output ''
  Write-Output "OBSERVED:           $($r.observed)"
  if ($r.count -gt 0) { foreach ($it in $r.items) { Write-Output "                      - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $($r.might_mean)"
  Write-Output "WHAT'S NOT PROVEN:  $($r.not_proven)"
  Write-Output "WHAT TO DO:         $($r.what_to_do)"
}
