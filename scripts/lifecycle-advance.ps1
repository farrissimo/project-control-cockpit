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
  $verdict = $null; $vtype = $null; $fileEpoch = 0; $hasRecord = $false
  if (Test-Path -LiteralPath $verifyPath) {
    $hasRecord = $true
    $txt = Get-Content -Raw -LiteralPath $verifyPath
    # Parse STRUCTURED fields, not a loose token scan. An independent review found the
    # old gate accepted ANY fresh file containing the word "PASS" anywhere — a stray
    # or hand-edited "PASS" in prose could clear "done". Now the verdict must be on its
    # own VERDICT: line, and the record must declare a recognized TYPE: (what KIND of
    # proof it is — review_only|local_execution|ci_execution|live_boundary). A "PASS"
    # buried in a sentence, or an untyped record, no longer counts. This is structural
    # validation of a TRUSTED record — it is not, and does not claim to be, proof
    # against a deliberate forgery of a well-formed record (the file is the record).
    $mv = [regex]::Match($txt, '(?im)^[ \t]*VERDICT:[ \t]*(PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE)\b')
    if ($mv.Success) { $verdict = $mv.Groups[1].Value.ToUpper() }
    $mt = [regex]::Match($txt, '(?im)^[ \t]*TYPE:[ \t]*(review_only|local_execution|ci_execution|live_boundary)\b')
    if ($mt.Success) { $vtype = $mt.Groups[1].Value.ToLower() }
    $fileEpoch = [int][double]::Parse((Get-Item -LiteralPath $verifyPath).LastWriteTimeUtc.Subtract([datetime]'1970-01-01').TotalSeconds)
  }
  # Freshness: the recorded PASS must be at least as new as HEAD's commit. If git
  # cannot report HEAD's commit time we CANNOT prove freshness, so fail CLOSED
  # (treat as not fresh). The old code defaulted $headEpoch = 0 on any git failure,
  # which made $fresh = ($fileEpoch -ge 0) TRIVIALLY TRUE — a git-timestamp failure
  # silently defeated the staleness half of the DECISION-012 gate (false green).
  $headEpoch = $null
  try {
    $h = & git log -1 --format=%ct 2>$null
    if ($LASTEXITCODE -eq 0 -and $h) {
      $val = [long]0
      if ([long]::TryParse((([string]($h | Select-Object -First 1)).Trim()), [ref]$val)) { $headEpoch = $val }
    }
  } catch { $headEpoch = $null }
  $headKnown = ($null -ne $headEpoch)
  $fresh = $headKnown -and ($fileEpoch -ge $headEpoch)

  if (-not $hasRecord -or $verdict -ne 'PASS' -or -not $vtype -or -not $fresh) {
    $why = if (-not $hasRecord) { 'no verification record exists yet' }
      elseif (-not $verdict) { 'the record has no structured "VERDICT:" line' }
      elseif ($verdict -ne 'PASS') { "the last verdict was $verdict" }
      elseif (-not $vtype) { 'the record has no recognized "TYPE:" line (review_only | local_execution | ci_execution | live_boundary)' }
      elseif (-not $headKnown) { "git could not report HEAD's commit time, so the PASS's freshness cannot be proven (failing closed)" }
      else { 'the last PASS is older than the latest commit (stale)' }
    Emit ([ordered]@{
        ok = $false; reason = 'needs_verification'; from = $from; to = $To
        verdict = $verdict; type = $vtype; fresh = $fresh; head_time_known = $headKnown
        message = "Cannot advance to '$($target.label)': $why. Run an independent verification (a fresh, typed PASS) first."
      })
    return
  }

  # Owner policy (DECISION): "Review-only evidence can complete review work. Executable
  # phases require execution proof before they can be marked done." A review_only PASS (a
  # reviewer read the code, ran nothing) is NOT enough to close a phase that changed
  # executable behavior — that needs a real run. Only a phase EXPLICITLY declared
  # review/docs/planning may close on a review_only pass. phase_kind is declared in
  # lifecycle-state.json; absent = executable (the safe, strict default).
  # ORIGIN SEAM: this record file is hand-editable, so the ONLY execution proof it can be
  # trusted to claim is local_execution (verify-product.ps1's real app-run). A clean-room/CI
  # proof (ci_execution / live_boundary) must come from a LIVE observation, never a TYPE: line
  # a human or the worker could type — and no legitimate writer ever puts those in this file,
  # so trusting them here was pure forgery surface. They are deliberately NOT accepted.
  $phaseKind = if ($state.PSObject.Properties.Name -contains 'phase_kind' -and $state.phase_kind) { ([string]$state.phase_kind).ToLower() } else { 'executable' }
  $executedTypes = @('local_execution')
  if ($phaseKind -eq 'executable' -and ($executedTypes -notcontains $vtype)) {
    Emit ([ordered]@{
        ok = $false; reason = 'needs_execution_proof'; from = $from; to = $To
        verdict = $verdict; type = $vtype; fresh = $fresh; phase_kind = $phaseKind
        message = "Cannot advance to '$($target.label)': this phase changes executable behavior, and the only fresh proof is '$vtype' (a review, nothing was run). Review-only evidence can complete review work; executable phases require execution proof — a local test run, CI, or app-run verification. Use 'Verify product behavior' (or CI) for a fresh execution PASS. If this is genuinely a review/docs/planning phase, mark it as such first."
      })
    return
  }
}

# --- soft advisory: vision unconfirmed when moving into planning (soak fix F2) ---
# Not a hard gate (only phase_close blocks). But the owner should be told, at the
# moment they leave setup for planning/building, if the north-star vision promises
# were never confirmed as their real intent -- so "is this what I meant to build?"
# is asked, not silently skipped.
$visionWarning = $null
if ($To -eq 'plan') {
  $vpPath = '.cockpit/state/vision-promises.json'
  if (Test-Path -LiteralPath $vpPath) {
    try {
      $vp = Get-Content -Raw -LiteralPath $vpPath | ConvertFrom-Json
      $reviewed = ($vp.review_status -eq 'reviewed') -and $vp.last_reviewed
      if (-not $reviewed) {
        $visionWarning = "Heads up: your vision promises aren't confirmed yet. You can keep going, but review them in the Overview (Vision) so the build has a north star to check against."
      }
    } catch { }
  }
}

# --- perform the move ---
$state.current_stage = $To
# Starting a new work phase resets phase_kind to the safe/strict default (executable),
# so a prior "review/docs" declaration can't silently carry over and let real code close
# on a review-only pass. The owner re-declares a review phase deliberately each cycle.
if ($To -eq 'work') { $state | Add-Member -NotePropertyName phase_kind -NotePropertyValue 'executable' -Force }
$state | Add-Member -NotePropertyName note -NotePropertyValue "Advanced $from -> $To via the app." -Force
$state | Add-Member -NotePropertyName updated_at -NotePropertyValue ((Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')) -Force
($state | ConvertTo-Json -Depth 6) | Out-File -FilePath $statePath -Encoding utf8

Emit ([ordered]@{ ok = $true; from = $from; to = $To; label = $target.label; message = "Advanced from '$from' to '$($target.label)'."; vision_unconfirmed = ($null -ne $visionWarning); warning = $visionWarning })
