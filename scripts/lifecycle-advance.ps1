<#
  PCC lifecycle advance (the ONE place the "you are here" pin moves).

  Moves lifecycle-state.json to a target stage, but ONLY if the move is legal in
  the declared model AND any entry gate on the target is satisfied. The gate that
  matters: a stage marked "entry_gate": "fresh_verification_pass" (phase_close)
  cannot be entered without an independent PASS newer than the latest commit --
  i.e. you cannot mark work "done" without a fresh verdict (DECISION-012).

  Deterministic: reads the model + state + the recorded verdict; no LLM. It never
  invents a transition outside the model. -Json for the app. Exits 0 with an
  {ok:false, reason} result when it refuses, so callers can react honestly.
#>
param(
  [Parameter(Mandatory = $true)][string]$To,
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$modelPath = '.cockpit/state/lifecycle-model.json'
$statePath = '.cockpit/state/lifecycle-state.json'
$verifyPath = 'app/last-verification.txt'

function Emit($obj) {
  if ($Json) { $obj | ConvertTo-Json -Depth 6 }
  else { Write-Output ($obj | ConvertTo-Json -Depth 6) }
}

$model = $null; $state = $null
if (Test-Path -LiteralPath $modelPath) { try { $model = Get-Content -Raw -LiteralPath $modelPath | ConvertFrom-Json } catch { } }
if (Test-Path -LiteralPath $statePath) { try { $state = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json } catch { } }

if (-not $model -or -not $model.stages) { Emit ([ordered]@{ ok = $false; reason = 'no_model'; message = "No lifecycle model at $modelPath." }); return }
if (-not $state -or -not $state.current_stage) { Emit ([ordered]@{ ok = $false; reason = 'no_state'; message = "No current stage in $statePath." }); return }

$stagesById = @{}
foreach ($s in $model.stages) { $stagesById[$s.id] = $s }
$from = $state.current_stage
$cur = $stagesById[$from]
$target = $stagesById[$To]

if (-not $target) { Emit ([ordered]@{ ok = $false; reason = 'unknown_stage'; from = $from; to = $To; message = "'$To' is not a stage in the model." }); return }
if (-not $cur -or @($cur.next) -notcontains $To) {
  Emit ([ordered]@{ ok = $false; reason = 'illegal_transition'; from = $from; to = $To;
      message = "'$To' is not a legal next step from '$from'. Legal: $(@($cur.next) -join ', ')." })
  return
}

# --- entry gate: fresh independent PASS ---
if ($target.entry_gate -eq 'fresh_verification_pass') {
  $verdict = $null; $fileEpoch = 0
  if (Test-Path -LiteralPath $verifyPath) {
    $txt = Get-Content -Raw -LiteralPath $verifyPath
    $m = [regex]::Match($txt, '\b(PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE)\b')
    if ($m.Success) { $verdict = $m.Groups[1].Value }
    $fileEpoch = [int][double]::Parse((Get-Item -LiteralPath $verifyPath).LastWriteTimeUtc.Subtract([datetime]'1970-01-01').TotalSeconds)
  }
  $headEpoch = 0
  $h = & git log -1 --format=%ct 2>$null
  if ($h) { $headEpoch = [int]$h }

  $fresh = ($fileEpoch -ge $headEpoch)
  if ($verdict -ne 'PASS' -or -not $fresh) {
    $why = if (-not $verdict) { 'no verdict is recorded yet' }
      elseif ($verdict -ne 'PASS') { "the last verdict was $verdict" }
      else { 'the last PASS is older than the latest commit (stale)' }
    Emit ([ordered]@{
        ok = $false; reason = 'needs_verification'; from = $from; to = $To
        verdict = $verdict; fresh = $fresh
        message = "Cannot advance to '$($target.label)': $why. Run an independent verification (a fresh PASS) first."
      })
    return
  }
}

# --- perform the move ---
$state.current_stage = $To
$state | Add-Member -NotePropertyName note -NotePropertyValue "Advanced $from -> $To via the app." -Force
$state | Add-Member -NotePropertyName updated_at -NotePropertyValue ((Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')) -Force
($state | ConvertTo-Json -Depth 6) | Out-File -FilePath $statePath -Encoding utf8

Emit ([ordered]@{ ok = $true; from = $from; to = $To; label = $target.label; message = "Advanced from '$from' to '$($target.label)'." })
