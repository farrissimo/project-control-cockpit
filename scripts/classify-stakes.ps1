<#
  PCC stakes classifier (ADR-0006). Given a change, report its stakes TIER — decided by
  WHICH FILES it touches (a git fact), read from the declared manifest
  (.cockpit/state/stakes-manifest.json), never from an LLM's self-rating.

  Deterministic: glob matching + git, no LLM, read-only, always exits 0. This slice only
  CLASSIFIES; mapping a tier to its required proof, and gating on it, are later slices.

  Input:
    -Files / -Added / -Deleted : explicit path lists (newline- or comma-separated) — used by
        tests to classify a synthetic change with no git. When -Files is given, git is NOT read.
    (no lists)                  : compute the change from git (baseline..HEAD + uncommitted).
    -Baseline <ref>             : comparison base for the git path (default 'main').
    -Json                       : machine-readable output.

  Output shape: { schema, tier, base_tier, reasons[], files[], escalations[], not_proven }.
#>
param(
  [switch]$Json,
  [string]$Files,
  [string]$Added,
  [string]$Deleted,
  [string]$Baseline = 'main'
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$manifestPath = '.cockpit/state/stakes-manifest.json'
$rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0 }
$tierForRank = @{ 4 = 'T0'; 3 = 'T1'; 2 = 'T2'; 1 = 'T3'; 0 = 'T4' }

# Fill a List[string] IN PLACE with the non-empty trimmed tokens of $s. A List is used so
# .Count is never fooled by PowerShell's array/scalar quirks (an unbound [string] param is ''
# — not $null — and '' -split ... yields a phantom empty element). We fill in place and never
# RETURN a collection, because returning an IEnumerable gets enumerated/unwrapped on the way out.
function Add-Tokens($list, $s) {
  if ($null -eq $s) { return }
  foreach ($p in (([string]$s) -split "[`r`n,]")) { $t = "$p".Trim(); if ($t.Length -gt 0) { [void]$list.Add($t) } }
}
# Add ONE already-delimited path verbatim. Used for rename status lines, whose old/new paths are
# split on TAB by git and must NOT be re-split on commas the way an operator-supplied -Files list is
# (a tracked path may legitimately contain a comma; splitting it would invent two fake paths).
function Add-Path($list, $s) {
  $t = "$s".Trim()
  if ($t.Length -gt 0) { [void]$list.Add($t) }
}
function Convert-GlobToRegex([string]$glob) {
  $e = [regex]::Escape($glob)
  $e = $e -replace '\\\*\\\*', '.*'   # ** -> any chars incl. /
  $e = $e -replace '\\\*', '[^/]*'    # *  -> any chars except /
  return '^' + $e + '$'
}
function Test-AnyGlob([string]$path, $globs) {
  foreach ($g in @($globs)) { if ($path -match (Convert-GlobToRegex "$g")) { return $true } }
  return $false
}

# --- load manifest (fail closed: unreadable manifest => UNKNOWN tier, never a low one) ---
if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  $out = [ordered]@{ schema = 'stakes-classification/v1'; tier = 'UNKNOWN'; base_tier = 'UNKNOWN'
    reasons = @("no stakes manifest at $manifestPath — cannot classify honestly"); files = @(); escalations = @()
    not_proven = 'The stakes of this change — the manifest is missing.' }
  if ($Json) { $out | ConvertTo-Json -Depth 6 } else { Write-Host "TIER: UNKNOWN (no manifest)" }
  exit 0
}
$manifest = $null
try { $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json } catch {}
if (-not $manifest -or -not $manifest.tiers) {
  $out = [ordered]@{ schema = 'stakes-classification/v1'; tier = 'UNKNOWN'; base_tier = 'UNKNOWN'
    reasons = @("stakes manifest is unreadable or malformed"); files = @(); escalations = @()
    not_proven = 'The stakes of this change — the manifest could not be parsed.' }
  if ($Json) { $out | ConvertTo-Json -Depth 6 } else { Write-Host "TIER: UNKNOWN (bad manifest)" }
  exit 0
}
$defaultTier = if ($manifest.default_tier) { "$($manifest.default_tier)" } else { 'T3' }

# --- gather the change (explicit lists for tests; else git). All three are List[string]. ---
$changedFiles = [System.Collections.Generic.List[string]]::new()
$addedFiles = [System.Collections.Generic.List[string]]::new()
$deletedFiles = [System.Collections.Generic.List[string]]::new()
$fromGit = $false
$baseErr = ''
if (-not $Files -and -not $Added -and -not $Deleted) {
  $fromGit = $true
  & git rev-parse --verify --quiet $Baseline > $null 2>&1
  $haveBase = ($LASTEXITCODE -eq 0)
  # -M forces rename detection ON regardless of this machine's `diff.renames` config, so the
  # verdict is deterministic (lib/change-identity.ps1 pins --no-renames for the same reason: git
  # config must never decide an answer). Git reports a rename as `R` — which is NEITHER A NOR D —
  # so --diff-filter=A/D alone silently misses one, and the manifest's `delete_or_rename` rule
  # could never fire for the rename half of its own name. Read R explicitly below.
  if ($haveBase) {
    $mArr = @(& git diff -M --name-only "$Baseline...HEAD" 2>$null) + @(& git diff -M --name-only HEAD 2>$null)
    $aArr = @(& git diff -M --name-only --diff-filter=A "$Baseline...HEAD" 2>$null) + @(& git diff -M --name-only --diff-filter=A HEAD 2>$null)
    $dArr = @(& git diff -M --name-only --diff-filter=D "$Baseline...HEAD" 2>$null) + @(& git diff -M --name-only --diff-filter=D HEAD 2>$null)
    $rArr = @(& git diff -M --name-status --diff-filter=R "$Baseline...HEAD" 2>$null) + @(& git diff -M --name-status --diff-filter=R HEAD 2>$null)
  } else {
    $baseErr = "baseline '$Baseline' not found; used working-tree vs HEAD only"
    $mArr = @(& git diff -M --name-only HEAD 2>$null)
    $aArr = @(& git diff -M --name-only --diff-filter=A HEAD 2>$null)
    $dArr = @(& git diff -M --name-only --diff-filter=D HEAD 2>$null)
    $rArr = @(& git diff -M --name-status --diff-filter=R HEAD 2>$null)
  }
  # Add-Path, NOT Add-Tokens: git already emits exactly one path per line, so these must be taken
  # verbatim. Comma-splitting them would turn a tracked path that legitimately contains a comma
  # into two invented paths — which inflates the touched-file/area counts (and so could trip
  # large_cross_cutting) and could glob-match something the real path never would. Add-Tokens'
  # comma splitting exists for the OPERATOR-supplied -Files/-Added/-Deleted lists below, whose
  # documented contract IS comma-separated; it does not belong on git output.
  foreach ($f in $mArr) { Add-Path $changedFiles "$f" }
  foreach ($f in $aArr) { Add-Path $addedFiles "$f" }
  foreach ($f in $dArr) { Add-Path $deletedFiles "$f" }
  # A rename is a removal AND an addition. Each R line is "R<score>`t<old path>`t<new path>":
  # the OLD path is gone (delete_or_rename must fire), the NEW path is added. --name-only already
  # reports the new path, so only the old path is otherwise invisible.
  foreach ($ln in $rArr) {
    $parts = "$ln" -split "`t"
    if ($parts.Count -ge 3 -and $parts[0] -match '^R') {
      Add-Path $deletedFiles $parts[1]
      Add-Path $addedFiles $parts[2]
    }
  }
} else {
  Add-Tokens $changedFiles $Files
  Add-Tokens $addedFiles $Added
  Add-Tokens $deletedFiles $Deleted
}
$allTouched = [System.Collections.Generic.List[string]]::new()
$allTouched.AddRange($changedFiles); $allTouched.AddRange($addedFiles); $allTouched.AddRange($deletedFiles)
$touched = @($allTouched | Sort-Object -Unique)

# --- classify each touched file to its highest matching tier (default if unmatched) ---
$fileTiers = @()
$maxRank = -1
foreach ($p in $touched) {
  # Highest EXPLICIT glob match wins (so a T4/noise path can sit BELOW the default). Only a
  # file that matches NO glob falls back to default_tier — which is why an unknown new file is
  # never noise (default is T3, above T4).
  $matched = $null
  $matchedRank = -1
  foreach ($tierName in @('T0', 'T1', 'T2', 'T3', 'T4')) {
    $t = $manifest.tiers.$tierName
    if ($t -and $t.globs -and (Test-AnyGlob $p $t.globs)) {
      if ($rank[$tierName] -gt $matchedRank) { $matched = $tierName; $matchedRank = $rank[$tierName] }
    }
  }
  $best = if ($null -eq $matched) { $defaultTier } else { $matched }
  $fileTiers += [ordered]@{ path = $p; tier = $best }
  if ($rank[$best] -gt $maxRank) { $maxRank = $rank[$best] }
}
if ($maxRank -lt 0) { $maxRank = $rank[$defaultTier] }  # empty change => default
$baseTier = $tierForRank[$maxRank]

# --- escalation rules (raise the tier regardless of path) ---
$escalations = @()
function Add-Escalation([string]$id, [string]$minTier, [string]$detail) {
  $script:escalations += [ordered]@{ id = $id; min_tier = $minTier; detail = $detail }
  if ($rank[$minTier] -gt $script:maxRank) { $script:maxRank = $rank[$minTier] }
}
$rules = @()
if ($manifest.escalation_rules -and $manifest.escalation_rules.rules) { $rules = @($manifest.escalation_rules.rules) }
function Rule([string]$id) { return ($rules | Where-Object { $_.id -eq $id } | Select-Object -First 1) }
function MinTier([string]$id, [string]$fallback) { $r = Rule $id; if ($r -and $r.min_tier) { return "$($r.min_tier)" } else { return $fallback } }

$depGlobs = @('**/package.json', '**/package-lock.json')
$schemaGlobs = @('schemas/**')
$ciGlobs = @('.github/**', '.githooks/**', 'app/tools/guarded-test.js')
$govGlobs = @('.cockpit/state/stakes-manifest.json', 'scripts/classify-stakes.ps1', 'scripts/run-governance-gate.ps1', 'scripts/write-verification-receipt.ps1', 'scripts/emit-verification-trailer.ps1', 'scripts/audit-verification-trailers.ps1', 'scripts/lib/change-identity.ps1', 'scripts/lib/receipt-check.ps1', '.cockpit/state/governance-gate-exceptions.json')
$testGlobs = @('**/tests/**', '**/*.spec.js', '**/*.test.js')
$histGlobs = @('archive/**', 'docs/DECISIONS.md', '.cockpit/result/archive/**')

if ($deletedFiles.Count -gt 0) { Add-Escalation 'delete_or_rename' (MinTier 'delete_or_rename' 'T1') "$($deletedFiles.Count) file(s) deleted/renamed: $([string]::Join(', ', ($deletedFiles | Select-Object -First 5)))" }
if (@($touched | Where-Object { Test-AnyGlob $_ $depGlobs }).Count -gt 0) { Add-Escalation 'dependency_or_lockfile' (MinTier 'dependency_or_lockfile' 'T1') 'a dependency manifest or lockfile changed' }
if (@($touched | Where-Object { Test-AnyGlob $_ $govGlobs }).Count -gt 0) { Add-Escalation 'governor_self_edit' (MinTier 'governor_self_edit' 'T0') 'the stakes manifest or the classifier itself changed' }
if (@($touched | Where-Object { Test-AnyGlob $_ $ciGlobs }).Count -gt 0) { Add-Escalation 'ci_or_hooks' (MinTier 'ci_or_hooks' 'T0') 'CI, git hooks, or the canonical test entrypoint changed' }
if (@($touched | Where-Object { Test-AnyGlob $_ $schemaGlobs }).Count -gt 0) { Add-Escalation 'schema_change' (MinTier 'schema_change' 'T1') 'a schema changed' }
if (@($deletedFiles | Where-Object { Test-AnyGlob $_ $testGlobs }).Count -gt 0) { Add-Escalation 'weakened_tests' (MinTier 'weakened_tests' 'T1') 'a test file was deleted' }
$areas = @($touched | ForEach-Object { ($_ -split '/')[0] } | Sort-Object -Unique)
if ($touched.Count -gt 25 -or $areas.Count -ge 3) { Add-Escalation 'large_cross_cutting' (MinTier 'large_cross_cutting' 'T1') "$($touched.Count) files across $($areas.Count) area(s)" }
if (@($deletedFiles | Where-Object { Test-AnyGlob $_ $histGlobs }).Count -gt 0) { Add-Escalation 'destructive_history_edit' (MinTier 'destructive_history_edit' 'T2') 'historical/archived evidence was deleted' }

$finalTier = $tierForRank[$maxRank]

# --- reasons ---
$reasons = @()
$reasons += "path tier: $baseTier (highest of $($touched.Count) touched file(s))"
foreach ($e in $escalations) { $reasons += "escalated to >= $($e.min_tier): $($e.id) — $($e.detail)" }
if ($fromGit -and $baseErr) { $reasons += "note: $baseErr" }
if ($touched.Count -eq 0) { $reasons = @("no files in this change — default tier $defaultTier") }

$result = [ordered]@{
  schema      = 'stakes-classification/v1'
  tier        = $finalTier
  base_tier   = $baseTier
  reasons     = @($reasons)
  files       = @($fileTiers)
  escalations = @($escalations)
  source      = if ($fromGit) { 'git' } else { 'explicit' }
  not_proven  = 'This classifies WHICH files a change touches against a declared list — not whether the change is correct. Assertion-level test weakening (as opposed to test deletion) is not auto-detected here.'
}

if ($Json) { $result | ConvertTo-Json -Depth 6 }
else {
  Write-Host "TIER: $finalTier   (base $baseTier; $($touched.Count) file(s); $($escalations.Count) escalation(s))"
  foreach ($r in $reasons) { Write-Host "  - $r" }
}
exit 0
