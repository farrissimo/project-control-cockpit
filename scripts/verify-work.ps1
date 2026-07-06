<#
  PCC independent verification (DECISION-102 verification layer).

  Primary verifier: Codex CLI (`codex exec`, read-only sandbox) - it can run
  git and project checks itself. Fallback: Gemini CLI (`gemini -p`) reviewing
  the git diff on stdin (used when Codex is unavailable / out of usage).

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

$prompt = 'Independently verify the most recent work in this repository. Inspect the git diff and run any obvious project checks. Output VERDICT on one line as one of PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE, then EVIDENCE as 2-4 bullets of what you actually checked, then NOT PROVEN listing anything you could not verify. Be honest; never PASS without evidence. Do not make any changes.'

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

function Invoke-Gemini {
  $diff = & git diff HEAD~1 HEAD 2>&1 | Out-String
  if (-not $diff.Trim()) { $diff = '(no committed diff found)' }
  $instruction = 'You are an independent verifier. The git diff of the latest work is provided on stdin. Output VERDICT on one line (PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE), then EVIDENCE as bullets of what the diff shows, then NOT PROVEN. You cannot run tests, so state that functionality is not proven by you. Be honest. Make no changes.'
  $out = $diff | & gemini --skip-trust -p $instruction 2>&1 | Out-String
  if ($LASTEXITCODE -eq 0 -and $out.Trim()) { return "VERIFIER: Gemini (fallback)`n`n" + $out.Trim() }
  return $null
}

$result = Invoke-Codex
if (-not $result) { $result = Invoke-Gemini }
if (-not $result) { $result = 'Both verifiers unavailable (Codex and Gemini). Try again when usage is available.' }

Write-Output $result

if ($WriteFile) {
  $stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss zzz')
  $path = Join-Path $repo 'app/last-verification.txt'
  "=== Verification run $stamp ===`n$result`n" | Out-File -FilePath $path -Encoding utf8
}
