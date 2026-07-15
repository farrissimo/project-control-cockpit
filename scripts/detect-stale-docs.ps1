<#
  PCC detection: stale docs (COCKPIT_ROADMAP #11).

  Narrow and honest: "changed code but the doc that should track it was not
  touched." It checks only an explicit, declared rule list
  (.cockpit/state/doc-freshness-map.json). If no rule matches the changes, it
  stays QUIET rather than guess. If the map is missing, it reports 'unknown'.

  Deterministic: git + glob matching, no LLM, read-only, always exits 0. A
  SIGNAL, never a gate. -Json for the app; -WriteFile drops truth to
  .cockpit/result/detections/stale-docs.json. Works with app/ deleted.
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
$mapPath = '.cockpit/state/doc-freshness-map.json'

function New-Result([string]$signal, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector   = 'stale-docs'
    roadmap    = 'P2 #11'
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

# Simple glob (supporting ** and *) to anchored regex. ** crosses directories;
# * stays within one path segment.
function Convert-GlobToRegex([string]$glob) {
  $e = [regex]::Escape($glob)
  $e = $e -replace '\\\*\\\*', '.*'
  $e = $e -replace '\\\*', '[^/]*'
  return '^' + $e + '$'
}
function Test-AnyGlob([string]$path, $globs) {
  foreach ($g in $globs) { if ($path -match (Convert-GlobToRegex $g)) { return $true } }
  return $false
}

if (-not (Test-Path -LiteralPath $mapPath -PathType Leaf)) {
  $r = New-Result 'unknown' @() `
    "No stale-docs rule map found at $mapPath." `
    'There is no declared list of which docs track which code, so nothing can be checked honestly.' `
    'Whether any doc is stale -- this check did not run.' `
    "Create $mapPath (a small, explicit rule list), then re-run."
} else {
  $map = $null
  try { $map = Get-Content -Raw -LiteralPath $mapPath | ConvertFrom-Json } catch { }
  $rules = @()
  if ($map -and $map.rules) { $rules = @($map.rules) }
  $baseline = if ($map -and $map.compare_baseline) { $map.compare_baseline } else { 'main' }

  if ($rules.Count -eq 0) {
    # No declared rules means NOTHING was checked -- that is 'unknown', never 'clear'.
    # A green badge over an empty rule set is a false all-clear (same bug class as the
    # F9 missing-baseline fix below): the card text said "nothing is being checked" while
    # the badge still read clear/green. Match the badge to the honest text.
    $r = New-Result 'unknown' @() `
      "$mapPath defines no rules yet, so nothing was checked." `
      'No doc-freshness rules are declared, so staleness cannot be judged here -- this is unknown, not a passing check.' `
      'Whether any doc is stale -- there are no rules to check against.' `
      "Add rules to $mapPath as real misses show up."
  } else {
    # The baseline ref must exist (soak fix F9): a missing baseline previously
    # fell back to "working tree vs HEAD" and STILL reported clear/notice -- a
    # false green on scaffolded projects (on 'master', no 'main'). Degrade to
    # 'unknown' instead of guessing from an incomplete comparison.
    & git rev-parse --verify --quiet $baseline > $null 2>&1
    if ($LASTEXITCODE -ne 0) {
      $r = New-Result 'unknown' @() `
        "Baseline ref '$baseline' does not exist in this repo, so changed files cannot be compared against it." `
        'The stale-docs signal has no baseline to measure against, so it will not guess. Common on a freshly-scaffolded project (on ''master'' with no ''main'').' `
        'Whether any doc is stale -- this check could not run against the intended baseline.' `
        "Set compare_baseline in $mapPath to a ref that exists (e.g. the branch this work started from, or the initial commit), then re-run."
    } else {
      # Changed files = branch commits since baseline UNION uncommitted tracked
      # changes (the doc should move within the same body of work).
      $committed = & git diff --name-only "$baseline...HEAD" 2>$null
      $uncommitted = & git diff --name-only HEAD 2>$null
    # Coerce to string before trimming: git can emit non-string warnings and an
    # empty diff yields nothing, neither of which has a .Trim() method.
    $changed = @($committed) + @($uncommitted) |
      ForEach-Object { "$_".Trim() } |
      Where-Object { $_ } |
      Sort-Object -Unique
    $changedSet = @{}
    foreach ($c in $changed) { $changedSet[$c] = $true }

    $misses = @()
    foreach ($rule in $rules) {
      $triggered = $false
      foreach ($c in $changed) { if (Test-AnyGlob $c @($rule.when_changed)) { $triggered = $true; break } }
      if (-not $triggered) { continue }

      $expected = @($rule.expect_updated)
      $present = @($expected | Where-Object { $changedSet.ContainsKey($_) })
      $mode = if ($rule.satisfied_by) { $rule.satisfied_by } else { 'any' }
      $satisfied = if ($mode -eq 'all') { $present.Count -eq $expected.Count } else { $present.Count -ge 1 }

      if (-not $satisfied) {
        $missingDocs = @($expected | Where-Object { -not $changedSet.ContainsKey($_) })
        $misses += "[$($rule.id)] code matched but not updated: $($missingDocs -join ', ') (needs: $mode of $($expected -join ', '))"
      }
    }

    if ($misses.Count -eq 0) {
      $observed = "Every triggered doc rule was satisfied on this branch (baseline '$baseline', $($rules.Count) rule(s) checked)."
      $r = New-Result 'clear' @() $observed `
        'The docs the starter rules care about were updated alongside the code.' `
        'Only the declared rules are checked; docs outside them, and whether the updates are actually correct, are not judged here.' `
        'Nothing needed for this signal.'
    } else {
      $observed = "$($misses.Count) doc rule(s) fired: code changed but the doc that should track it was not updated (baseline '$baseline')."
      $r = New-Result 'notice' $misses $observed `
        'Either a doc genuinely fell behind the code, OR the rule is too broad for this change. This is a starter rule list, adjustable.' `
        'Whether the doc truly needs updating for this specific change. The rule is a declared heuristic, not proof.' `
        "Update the named doc(s) if they are actually behind; or, if the rule is over-firing, loosen/remove it in $mapPath."
      }
    }
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 5) | Out-File -FilePath (Join-Path $dir 'stale-docs.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - stale docs ($checkedAt)"
  Write-Output "Signal: $($r.signal) ($($r.count) rule(s) fired)"
  Write-Output ''
  Write-Output "OBSERVED:           $($r.observed)"
  if ($r.count -gt 0) { foreach ($it in $r.items) { Write-Output "                      - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $($r.might_mean)"
  Write-Output "WHAT'S NOT PROVEN:  $($r.not_proven)"
  Write-Output "WHAT TO DO:         $($r.what_to_do)"
}
