<#
  PCC detection: high-stakes change -> consider a second opinion.

  Surfaces when the work on this branch touches something important enough that
  an independent Codex cross-check is worth considering before relying on it --
  decisions, standing rules, scope/lifecycle boundaries, the backup script, git
  hooks, or any file DELETION.

  Honest by construction: it checks a DECLARED list
  (.cockpit/state/high-stakes-rules.json), never a guess about what "feels"
  important (per the owner's rule: declare the boundary, do not guess). If that
  file is missing it reports 'unknown' and refuses to guess. A SIGNAL, never a
  gate -- it suggests a second opinion, it never forces one.

  Deterministic: git + glob matching, no LLM, read-only, always exits 0. -Json
  for the app; -WriteFile drops truth to
  .cockpit/result/detections/high-stakes.json. Works with app/ deleted.
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
$rulesPath = '.cockpit/state/high-stakes-rules.json'

function New-Result([string]$signal, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector   = 'high-stakes'
    roadmap    = 'feature (Claude<->Codex cross-check)'
    checked_at = $checkedAt
    signal     = $signal
    count      = @($items).Count
    items      = @($items)
    observed   = $observed
    might_mean = $mightMean
    not_proven = $notProven
    what_to_do = $whatToDo
  }
}

function Convert-GlobToRegex([string]$glob) {
  $e = [regex]::Escape($glob)
  $e = $e -replace '\\\*\\\*', '.*'      # ** -> any chars incl. /
  $e = $e -replace '\\\*', '[^/]*'       # *  -> any chars except /
  return '^' + $e + '$'
}

if (-not (Test-Path -LiteralPath $rulesPath -PathType Leaf)) {
  $r = New-Result 'unknown' @() `
    "No high-stakes rules found at $rulesPath." `
    'The second-opinion signal has nothing honest to check against, so it will not guess.' `
    'Whether the current work is high-stakes -- this check did not run.' `
    "Create $rulesPath (its high_stakes_globs list is the declared boundary), then re-run."
} else {
  $rules = $null
  try { $rules = Get-Content -Raw -LiteralPath $rulesPath | ConvertFrom-Json } catch { }
  $globs = @()
  if ($rules -and $rules.high_stakes_globs) { $globs = @($rules.high_stakes_globs) }
  $baseline = if ($rules -and $rules.compare_baseline) { $rules.compare_baseline } else { 'main' }
  $flagDeletions = -not ($rules -and $rules.PSObject.Properties['flag_deletions'] -and -not $rules.flag_deletions)

  $regexes = $globs | ForEach-Object { Convert-GlobToRegex $_ }

  # Changed files = branch commits since baseline UNION uncommitted tracked changes.
  $baseErr = ''
  $committed = @()
  $deletedCommitted = @()
  & git rev-parse --verify --quiet $baseline > $null 2>&1
  if ($LASTEXITCODE -eq 0) {
    $committed = & git diff --name-only "$baseline...HEAD" 2>$null
    $deletedCommitted = & git diff --name-only --diff-filter=D "$baseline...HEAD" 2>$null
  } else {
    $baseErr = "Baseline ref '$baseline' not found; compared working tree to HEAD only."
  }
  $uncommitted = & git diff --name-only HEAD 2>$null
  $deletedUncommitted = & git diff --name-only --diff-filter=D HEAD 2>$null

  $changed = @($committed) + @($uncommitted) | ForEach-Object { "$_".Trim() } | Where-Object { $_ } | Sort-Object -Unique
  $deleted = @($deletedCommitted) + @($deletedUncommitted) | ForEach-Object { "$_".Trim() } | Where-Object { $_ } | Sort-Object -Unique

  $items = @()
  foreach ($f in $changed) {
    foreach ($rx in $regexes) { if ($f -match $rx) { $items += "high-stakes: $f"; break } }
  }
  if ($flagDeletions) {
    foreach ($f in $deleted) { $items += "deleted: $f" }
  }
  $items = $items | Sort-Object -Unique

  if ($globs.Count -eq 0 -and -not $flagDeletions) {
    $r = New-Result 'unknown' @() `
      "$rulesPath has no high_stakes_globs and deletions are off." `
      'The boundary is empty, so nothing can be flagged honestly.' `
      'Whether the current work is high-stakes.' `
      "Fill in high_stakes_globs in $rulesPath, then re-run."
  } elseif ($items.Count -eq 0) {
    $observed = "No high-stakes changes on this branch (baseline '$baseline')."
    if ($baseErr) { $observed += " $baseErr" }
    $r = New-Result 'clear' @() $observed `
      'The work has not touched declared high-stakes areas, so a second opinion is not specifically prompted.' `
      'Whether the change is correct -- this only checks WHICH files changed against a declared list, not their content.' `
      'Nothing needed for this signal.'
  } else {
    $observed = "$($items.Count) high-stakes change(s) on this branch (baseline '$baseline')."
    if ($baseErr) { $observed += " $baseErr" }
    $r = New-Result 'notice' $items $observed `
      'The work touches something important enough (decisions, standing rules, scope/lifecycle boundaries, the backup script, git hooks, or a deletion) that a wrong call here is costly.' `
      'Whether the change is actually wrong -- this flags WHICH area was touched, not correctness. Importance is a declared list, not a judgment.' `
      "Consider an independent Codex cross-check before you rely on this: open the chat and use the 'Second opinion' button on the answer that produced the change."
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 5) | Out-File -FilePath (Join-Path $dir 'high-stakes.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - high-stakes change ($checkedAt)"
  Write-Output "Signal: $($r.signal) ($($r.count) high-stakes change(s))"
  Write-Output ''
  Write-Output "OBSERVED:           $($r.observed)"
  if ($r.count -gt 0) { foreach ($it in $r.items) { Write-Output "                      - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $($r.might_mean)"
  Write-Output "WHAT'S NOT PROVEN:  $($r.not_proven)"
  Write-Output "WHAT TO DO:         $($r.what_to_do)"
}
