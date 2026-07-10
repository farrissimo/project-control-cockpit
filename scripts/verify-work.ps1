<#
  PCC independent verification (DECISION-102 verification layer).

  Primary verifier: Codex CLI (`codex exec`, read-only sandbox) - it can run
  git and project checks itself. Fallback: Antigravity CLI (`agy -p`) reviewing
  the git diff embedded in the prompt (used when Codex is unavailable / out of
  usage). agy ignores stdin and hangs if asked to run tools itself in headless
  print mode, so the diff is passed inline in the prompt (capped for the
  Windows command-line length limit); agy reviews it as text only.

  Prints the verdict to stdout. With -WriteFile it also writes a timestamped
  copy to app/last-verification.txt (used by the scheduled after-10am-MT test).

  The worker (Claude Code) never grades its own work; this is an independent
  second agent, per the proven PCC advisor/verifier split.
#>
param(
  [int]$CodexTimeoutSec = 120,
  [switch]$WriteFile
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# Evidence bundle (roadmap #4): the exact commit range + diff stat + live CI state, assembled
# deterministically so the verifier is told PRECISELY what "the most recent work" means instead
# of guessing (a real ambiguity the old vague prompt had). Best-effort: if assembly fails for any
# reason, fall back to the original generic prompt rather than blocking verification.
$evidence = $null
try {
  $ej = & pwsh -NoProfile -File (Join-Path $PSScriptRoot 'verify-evidence.ps1') -Json 2>$null
  if ($ej) { $evidence = $ej | ConvertFrom-Json }
} catch { $evidence = $null }

if ($evidence -and $evidence.range) {
  $rangeNote = "Review EXACTLY this commit range: $($evidence.range) ($($evidence.range_kind))."
  $ciNote = switch ($evidence.ci_state) {
    'passed'  { 'CI already ran and PASSED for the current commit -- you may cite this as execution evidence, but still read the diff yourself for logic/reasoning issues.' }
    'failed'  { 'CI ran and FAILED for the current commit -- treat this as a strong signal against PASS.' }
    'pending' { 'CI is still running for the current commit -- note this as NOT PROVEN rather than assuming a result.' }
    default   { 'Live CI status is not available for this repo/commit right now.' }
  }
  $prompt = "Independently verify the work in this repository. $rangeNote $ciNote Inspect the diff yourself and run any obvious project checks. Output VERDICT on one line as one of PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE, then EVIDENCE as 2-4 bullets of what you actually checked, then NOT PROVEN listing anything you could not verify. Be honest; never PASS without evidence. Do not make any changes."
} else {
  $prompt = 'Independently verify the most recent work in this repository. Inspect the git diff and run any obvious project checks. Output VERDICT on one line as one of PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE, then EVIDENCE as 2-4 bullets of what you actually checked, then NOT PROVEN listing anything you could not verify. Be honest; never PASS without evidence. Do not make any changes.'
}

function Invoke-Codex {
  # Run in a job so an out-of-usage hang can be timed out and fall back.
  $job = Start-Job -ScriptBlock {
    param($p, $dir)
    Set-Location $dir
    $o = & codex exec --sandbox read-only $p 2>&1 | Out-String
    [pscustomobject]@{ code = $LASTEXITCODE; out = $o }
  } -ArgumentList $prompt, $repo
  if (Wait-Job $job -Timeout $CodexTimeoutSec) {
    $r = Receive-Job $job; Remove-Job $job -Force -ErrorAction SilentlyContinue
    if ($r.code -eq 0 -and $r.out.Trim()) { return "VERIFIER: Codex`n`n" + $r.out.Trim() }
  } else {
    Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue
  }
  return $null
}

function Invoke-Agy {
  $agy = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
  if (-not (Test-Path $agy)) { return $null }
  # Use the SAME evidence-derived range/diff as the primary path (roadmap #4), so both verifiers
  # see the correctly-scoped work instead of agy always defaulting to just the last commit.
  $rangeLabel = 'HEAD~1..HEAD'; $diff = $null
  if ($evidence -and $evidence.range) { $rangeLabel = $evidence.range; $diff = $evidence.diff }
  # $null means "no evidence bundle to use" (fall back to the old default). An EMPTY STRING is a
  # legitimate value (the "no new commits since last verification" case) and must NOT be
  # overwritten with the wrong commit's diff -- PowerShell's `-not ""` is $true, so a plain
  # truthiness check here was the bug: it silently substituted HEAD~1's diff while the range
  # label still said "no new commits". Only fall back when $diff was never assigned at all.
  if ($null -eq $diff) { $diff = (& git diff HEAD~1 HEAD 2>&1 | Out-String) }
  if (-not $diff.Trim()) { $diff = '(no committed diff found)' }
  # agy takes the diff inline (it ignores stdin). Cap it well under the Windows
  # command-line arg limit (~32 KB); note truncation honestly if it happens.
  $max = 20000
  $truncNote = ''
  if ($diff.Length -gt $max) { $diff = $diff.Substring(0, $max); $truncNote = "`n[diff truncated at $max chars]" }
  $instruction = @"
You are an independent verifier. The git diff of the work being reviewed is included below. You cannot run tests or commands, so you must state that functionality is not proven by you. Output VERDICT on one line (one of PASS, FAIL, INSUFFICIENT, BLOCKED, OUT_OF_SCOPE), then EVIDENCE as 2-4 bullets of what the diff actually shows, then NOT PROVEN listing what you could not verify. Be honest; never PASS without evidence. Make no changes.

=== GIT DIFF ($rangeLabel) ===
$diff$truncNote
"@
  $out = & $agy -p $instruction 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -and $out.Trim()) { return "VERIFIER: Antigravity/agy (fallback, diff-only)`n`n" + $out.Trim() }
  return $null
}

$result = Invoke-Codex
if (-not $result) { $result = Invoke-Agy }
if (-not $result) { $result = 'Both verifiers unavailable (Codex and agy). Try again when usage is available.' }

Write-Output $result

if ($WriteFile) {
  $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
  $path = Join-Path $repo 'app/last-verification.txt'
  # Declare TYPE so the record is typed for the phase-close gate and the proof taxonomy.
  # An independent agent reading the code (read-only sandbox) is review_only: it did not
  # execute the product on a clean machine. The Overview shows it amber ("reviewed, not
  # run"), never CI's executed-green.
  # VERIFIED_SHA anchors the NEXT run's evidence range ("since the last recorded verification").
  # Purely informational for evidence-scoping (roadmap #4) -- it is NOT a TYPE:/VERDICT: line, so
  # it plays no part in any pass/fail or trust decision (the origin seam, roadmap #3, is untouched).
  $headForRecord = & git rev-parse HEAD 2>$null
  $evidenceNote = if ($evidence) { "`n=== Evidence provided to the verifier ===`nRange reviewed: $($evidence.range_kind) ($(if ($evidence.range) { $evidence.range } else { 'HEAD only' }))`nCI state for HEAD: $($evidence.ci_state)$(if ($evidence.ci_detail) { " ($($evidence.ci_detail))" })`nDiff stat:`n$($evidence.diff_stat)`n" } else { '' }
  "=== Verification run $stamp ===`nVERIFIED_SHA: $headForRecord`nTYPE: review_only`n$result`n$evidenceNote" | Out-File -FilePath $path -Encoding utf8
}
