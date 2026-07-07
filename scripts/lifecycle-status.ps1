<#
  PCC lifecycle status (COCKPIT_ROADMAP #6).

  Reads the declared lifecycle model (the map) and lifecycle-state.json (the
  "you are here" pin) and reports the current stage's "what to do now", how to
  exit it, and ONLY the legal next stages. It never invents a next step outside
  the map and never auto-advances.

  Deterministic: reads two state files, no LLM, read-only, always exits 0.
  -Json for the app; -WriteFile drops truth to
  .cockpit/result/detections/lifecycle.json. Works with app/ deleted.
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
$modelPath = '.cockpit/state/lifecycle-model.json'
$statePath = '.cockpit/state/lifecycle-state.json'

function New-Result([string]$signal, [string]$observed, $stage, $nextStages, $allStages, $activeTask) {
  [ordered]@{
    detector    = 'lifecycle'
    roadmap     = 'P1 #6'
    checked_at  = $checkedAt
    signal      = $signal          # ok | unknown
    observed    = $observed
    active_task = $activeTask       # the human-readable current task, if the pin declares one
    current     = $stage
    next        = $nextStages
    all_stages  = $allStages
  }
}

$model = $null; $state = $null
if (Test-Path -LiteralPath $modelPath -PathType Leaf) { try { $model = Get-Content -Raw -LiteralPath $modelPath | ConvertFrom-Json } catch { } }
if (Test-Path -LiteralPath $statePath -PathType Leaf) { try { $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json } catch { } }

if (-not $model -or -not $model.stages) {
  $r = New-Result 'unknown' "No lifecycle model found at $modelPath." $null @() @() $null
} elseif (-not $state -or -not $state.current_stage) {
  $r = New-Result 'unknown' "No current stage recorded in $statePath." $null @() @(
    $model.stages | ForEach-Object { [ordered]@{ id = $_.id; label = $_.label } }
  ) $state.active_task
} else {
  $stagesById = @{}
  foreach ($s in $model.stages) { $stagesById[$s.id] = $s }
  $curId = $state.current_stage
  $cur = $stagesById[$curId]

  $allStages = $model.stages | ForEach-Object {
    [ordered]@{ id = $_.id; label = $_.label; is_current = ($_.id -eq $curId) }
  }

  if (-not $cur) {
    $r = New-Result 'unknown' "Current stage '$curId' is not in the model." $null @() $allStages $state.active_task
  } else {
    $nextStages = @()
    foreach ($nid in @($cur.next)) {
      $ns = $stagesById[$nid]
      if ($ns) { $nextStages += [ordered]@{ id = $ns.id; label = $ns.label; what_to_do = $ns.what_to_do; description = $ns.description } }
    }
    $stageOut = [ordered]@{
      id = $cur.id; label = $cur.label; description = $cur.description
      what_to_do = $cur.what_to_do; exit_criteria = $cur.exit_criteria
    }
    $observed = "You are at: $($cur.label). $($cur.what_to_do)"
    $r = New-Result 'ok' $observed $stageOut $nextStages $allStages $state.active_task
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 6) | Out-File -FilePath (Join-Path $dir 'lifecycle.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 6
} else {
  Write-Output "PCC lifecycle status ($checkedAt)"
  if ($r.signal -ne 'ok') { Write-Output $r.observed; return }
  Write-Output ''
  Write-Output "YOU ARE HERE:  $($r.current.label) - $($r.current.description)"
  Write-Output "WHAT TO DO:    $($r.current.what_to_do)"
  Write-Output "EXIT WHEN:     $($r.current.exit_criteria)"
  Write-Output ''
  Write-Output "LEGAL NEXT STAGES:"
  foreach ($n in $r.next) { Write-Output "  -> $($n.label): $($n.what_to_do)" }
  Write-Output ''
  $mapStr = ($r.all_stages | ForEach-Object { if ($_.is_current) { "[$($_.label)]" } else { $_.label } }) -join ' -> '
  Write-Output "FULL MAP: $mapStr"
}
