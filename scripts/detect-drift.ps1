<#
  PCC detection: out-of-scope / drift (COCKPIT_ROADMAP #10).

  Catches when work has changed files OUTSIDE the declared allowed boundary for
  the current lane -- the "did the AI wander off the job" smoke alarm from
  DECISION-102.

  This is only honest because it checks against a REAL boundary, not a guess:
  .cockpit/state/app-build-scope.json lists the globs this lane is allowed to
  change. Files changed on the branch that match none of those globs are
  flagged. If that boundary file is missing, the detector reports 'unknown' and
  refuses to guess (per the owner's decision: no drift on guesses).

  Deterministic: git + glob matching, no LLM, read-only, always exits 0. A
  SIGNAL, never a gate. -Json for the app; -WriteFile drops truth to
  .cockpit/result/detections/scope-drift.json. Works with app/ deleted.
#>
param(
  [switch]$Json,
  [switch]$WriteFile
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$checkedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
$scopePath = '.cockpit/state/app-build-scope.json'

function New-Result([string]$signal, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector   = 'scope-drift'
    roadmap    = 'P2 #10'
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

# Convert a simple glob (supporting ** and *) to an anchored regex. ** matches
# across directories; * matches within a single path segment.
function Convert-GlobToRegex([string]$glob) {
  $e = [regex]::Escape($glob)
  $e = $e -replace '\\\*\\\*', '.*'      # ** -> any chars incl. /
  $e = $e -replace '\\\*', '[^/]*'       # *  -> any chars except /
  return '^' + $e + '$'
}

# --- Load the boundary ---
if (-not (Test-Path -LiteralPath $scopePath -PathType Leaf)) {
  $r = New-Result 'unknown' @() `
    "No scope boundary found at $scopePath." `
    'The drift signal has nothing honest to check against, so it will not guess.' `
    'Whether any changes are out of scope -- this check did not run.' `
    "Create $scopePath (its allowed_globs list is the declared boundary), then re-run."
} else {
  $scope = $null
  try { $scope = Get-Content -Raw -LiteralPath $scopePath | ConvertFrom-Json } catch { }
  $globs = @()
  if ($scope -and $scope.allowed_globs) { $globs = @($scope.allowed_globs) }
  $baseline = if ($scope -and $scope.compare_baseline) { $scope.compare_baseline } else { 'main' }

  if ($globs.Count -eq 0) {
    $r = New-Result 'unknown' @() `
      "$scopePath has no allowed_globs list." `
      'The boundary is empty, so drift cannot be judged honestly.' `
      'Whether any changes are out of scope.' `
      "Fill in allowed_globs in $scopePath, then re-run."
  } else {
    $regexes = $globs | ForEach-Object { Convert-GlobToRegex $_ }

    # Changed files = branch commits since the baseline UNION uncommitted
    # tracked changes. Untracked files are the separate untracked detector.
    $baseErr = ''
    $committed = @()
    & git rev-parse --verify --quiet $baseline > $null 2>&1
    if ($LASTEXITCODE -eq 0) {
      $committed = & git diff --name-only "$baseline...HEAD" 2>&1
    } else {
      $baseErr = "Baseline ref '$baseline' not found; compared working tree to HEAD only."
    }
    $uncommitted = & git diff --name-only HEAD 2>&1

    $changed = @($committed) + @($uncommitted) |
      Where-Object { $_ -and $_.Trim() } |
      ForEach-Object { $_.Trim() } |
      Sort-Object -Unique

    $outside = @()
    foreach ($f in $changed) {
      $allowed = $false
      foreach ($rx in $regexes) { if ($f -match $rx) { $allowed = $true; break } }
      if (-not $allowed) { $outside += $f }
    }

    if ($outside.Count -eq 0) {
      $observed = "All $($changed.Count) changed file(s) on this branch fall inside the declared scope (baseline '$baseline')."
      if ($baseErr) { $observed += " $baseErr" }
      $r = New-Result 'clear' @() $observed `
        'The work has stayed on the job it was scoped to.' `
        'Whether the scope list itself is complete/correct -- drift only checks changes against the list as written.' `
        'Nothing needed for this signal.'
    } else {
      $observed = "$($outside.Count) changed file(s) fall OUTSIDE the declared scope (baseline '$baseline')."
      if ($baseErr) { $observed += " $baseErr" }
      $r = New-Result 'notice' $outside $observed `
        'Either real drift -- work touching files this lane was not scoped to change -- OR the scope boundary is out of date because the work legitimately grew. This detector cannot tell which.' `
        'Whether these changes are wrong. Intent is not observable; the boundary is a declared list, not a judgment of correctness.' `
        "Review each file. If it does not belong to this lane, revert or move it. If it is legitimately part of the work, add it to allowed_globs in $scopePath -- on purpose, not reflexively."
    }
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 5) | Out-File -FilePath (Join-Path $dir 'scope-drift.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - out-of-scope / drift ($checkedAt)"
  Write-Output "Signal: $($r.signal) ($($r.count) outside scope)"
  Write-Output ''
  Write-Output "OBSERVED:           $($r.observed)"
  if ($r.count -gt 0) { foreach ($it in $r.items) { Write-Output "                      - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $($r.might_mean)"
  Write-Output "WHAT'S NOT PROVEN:  $($r.not_proven)"
  Write-Output "WHAT TO DO:         $($r.what_to_do)"
}
