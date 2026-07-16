<#
  PCC owner milestone-update generator (comms spec channel 1 / ADR-0009 category 1).

  Structure->machinery: assembles the FIXED owner milestone-update block set and computes what can be
  computed deterministically -- the phase '% complete' (done slices / total, from the declared phase
  manifest) and the git context (commit subjects + changed-file count since a ref). It leaves ONLY the
  plain-English JUDGMENT slots for the LLM to fill (emitted as explicit "<<fill: ...>>" placeholders).

  Anti-fake-green: the % is computed from the manifest and is NEVER invented. A manifest that is missing,
  malformed, wrong-schema, empty, or marks any slice done WITHOUT evidence yields pct = "UNKNOWN" (with a
  plain reason), never a fabricated number and never a silent 0. Spec: docs/specs/milestone-update-generator.md.

  Deterministic: JSON read + git, no LLM, read-only, always exits 0.

  Params:
    -Milestone <name>     : the milestone's short name (goes in the header). Default a placeholder.
    -Since <ref>          : git base for the "what changed" context (default 'origin/main').
    -ManifestPath <path>  : phase manifest (default '.cockpit/state/phase-manifest.json'); overridable for tests.
    -Json                 : machine-readable output (computed fields + the rendered text).
#>
param(
  [string]$Milestone = '<<fill: milestone name>>',
  [string]$Since = 'origin/main',
  [string]$ManifestPath = '.cockpit/state/phase-manifest.json',
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# The canonical principles yardstick (ADR-0009), printed for reference in the Principles check block.
$yardstick = @(
  '1 reduce babysitting  2 lean/no over-governance  3 local-first (LLM only for judgment)',
  '4 honesty/anti-fake-green  5 verify-don''t-trust  6 truth-in-files  7 protect-data/reversibility',
  '8 prior-art-first  9 plain-language  10 parity'
) -join "`n"

# ---- Read + validate the manifest, compute pct (or UNKNOWN) ---------------------------------------
$pct = 'UNKNOWN'
$done = 0
$total = 0
$phaseName = '<<unknown phase>>'
$phaseId = ''
$notProven = ''

if (-not (Test-Path -LiteralPath $ManifestPath)) {
  $notProven = "phase manifest not found at '$ManifestPath' -- % is UNKNOWN, not invented"
} else {
  $raw = Get-Content -LiteralPath $ManifestPath -Raw -ErrorAction SilentlyContinue
  $m = $null
  try { $m = $raw | ConvertFrom-Json -ErrorAction Stop } catch { $m = $null }
  if ($null -eq $m) {
    $notProven = "phase manifest is not valid JSON -- % is UNKNOWN"
  } elseif ($m.schema -ne 'phase-manifest/v1') {
    $notProven = "phase manifest has wrong schema (got '$($m.schema)', want 'phase-manifest/v1') -- % is UNKNOWN"
  } elseif ($null -eq $m.slices -or $m.slices -isnot [Array]) {
    # 'slices' must be a JSON ARRAY. ConvertFrom-Json (PS7) turns a JSON array into [Object[]] (an
    # [Array]); a single JSON object stays a [PSCustomObject] and a string stays [string] -- neither is
    # an [Array]. Reject those so a single-object or scalar 'slices' can't be wrapped into a phantom
    # 1-slice count and yield a fabricated pct.
    $notProven = "phase manifest 'slices' must be a JSON array -- % is UNKNOWN"
  } elseif (@($m.slices).Count -eq 0) {
    $notProven = "phase manifest declares no slices -- % is UNKNOWN"
  } else {
    if ($m.phase) { if ($m.phase.name) { $phaseName = [string]$m.phase.name }; if ($m.phase.id) { $phaseId = [string]$m.phase.id } }
    $slices = @($m.slices)
    $total = $slices.Count
    # Structural validation (fail closed): each slice must be a real object with a non-empty id and a
    # genuine boolean 'done'. This blocks the fabricated-number traps: 'slices' being a scalar/string
    # (would count as 1), or 'done' being the JSON STRING "false" (any non-empty string casts to $true
    # in PowerShell). A non-boolean/missing 'done' or a non-object slice => UNKNOWN, never a made-up %.
    $structErr = @()
    $badDone = @()
    $doneCount = 0
    foreach ($s in $slices) {
      if ($s -isnot [System.Management.Automation.PSCustomObject]) { $structErr += 'a slice is not an object'; continue }
      $idProp = $s.PSObject.Properties['id']
      $id = if ($idProp) { [string]$idProp.Value } else { '' }
      if ([string]::IsNullOrWhiteSpace($id)) { $structErr += 'a slice is missing a non-empty id'; continue }
      $doneProp = $s.PSObject.Properties['done']
      if (-not $doneProp -or ($doneProp.Value -isnot [bool])) { $structErr += "slice '$id' has a missing or non-boolean 'done'"; continue }
      $evProp = $s.PSObject.Properties['evidence']
      $ev = if ($evProp) { [string]$evProp.Value } else { '' }
      $isDone = [bool]$doneProp.Value
      $hasEvidence = -not [string]::IsNullOrWhiteSpace($ev)
      if ($isDone -and -not $hasEvidence) { $badDone += $id }
      elseif ($isDone -and $hasEvidence) { $doneCount++ }
    }
    if ($structErr.Count -gt 0) {
      $pct = 'UNKNOWN'
      $notProven = "phase manifest has malformed slice(s): $((($structErr | Select-Object -Unique) -join '; ')) -- % is UNKNOWN"
    } elseif ($badDone.Count -gt 0) {
      $pct = 'UNKNOWN'
      $notProven = "slice(s) marked done without evidence: $($badDone -join ', ') -- refusing to count; % is UNKNOWN until each cites a checkable artifact"
    } else {
      $done = $doneCount
      $pct = [int][math]::Round(($done / $total) * 100)
    }
  }
}

# ---- Git context (raw material for the judgment slots; never blocks) ------------------------------
$gitAvailable = $false
$gitReason = ''
$commits = @()
$changedFiles = 0
$refOk = & git rev-parse --verify --quiet "$Since^{commit}" 2>$null
if ($LASTEXITCODE -eq 0 -and -not [string]::IsNullOrWhiteSpace($refOk)) {
  $gitAvailable = $true
  $subjects = & git log --format='%s' "$Since..HEAD" 2>$null
  if ($subjects) { $commits = @($subjects | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }) }
  $names = & git diff --name-only "$Since..HEAD" 2>$null
  if ($names) { $changedFiles = @($names | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count }
} else {
  $gitReason = "ref '$Since' not resolvable (git unavailable or ref missing) -- context omitted, blocks still emitted"
}

# ---- Render the fixed block set (paste-ready markdown) --------------------------------------------
$pctText = if ($pct -eq 'UNKNOWN') { 'UNKNOWN% complete' } else { "$pct% complete" }
$header = "**🏁 $Milestone** · **$phaseName** · **$pctText** ($done/$total slices)"
if ($pct -eq 'UNKNOWN') { $header += "  ⟨% UNKNOWN — $notProven⟩" }

$ctxLine = if ($gitAvailable) {
  $subjLines = if ($commits.Count -gt 0) { ($commits | ForEach-Object { "   - $_" }) -join "`n" } else { '   - (no commits since ' + $Since + ')' }
  "_git context since ``$Since``: $($commits.Count) commit(s), $changedFiles file(s) changed_`n$subjLines"
} else {
  "_git context unavailable: ${gitReason}_"
}

$blockOrder = @('header','what_just_happened','where_it_fits','why_its_better','principles_check','needs_you')

$text = @"
$header

**What just happened** — <<fill: plain English, 1-2 lines>>

**Where it fits** — <<fill: this phase / the whole project, 1-2 lines>>

**Why it's better** — <<fill: the concrete improvement, 1-2 lines>>

**Principles check** — <<fill: confirm adherence; FLAG any strained principle>>
   _yardstick: $($yardstick -replace "`n", ' / ')_

**Needs you** — <<fill: anything to verify/decide/approve, surfaced; or "nothing">>

$ctxLine
"@

# ---- Output --------------------------------------------------------------------------------------
if ($Json) {
  $git = if ($gitAvailable) {
    [pscustomobject]@{ available = $true; since = $Since; commits = $commits; changed_files = $changedFiles }
  } else {
    [pscustomobject]@{ available = $false; since = $Since; reason = $gitReason }
  }
  $obj = [pscustomobject]@{
    schema      = 'milestone-update/v1'
    milestone   = $Milestone
    phase       = $phaseName
    phase_id    = $phaseId
    pct         = $pct
    done        = $done
    total       = $total
    block_order = $blockOrder
    git         = $git
    not_proven  = $notProven
    text        = $text
  }
  $obj | ConvertTo-Json -Depth 6
} else {
  Write-Output $text
}

exit 0
