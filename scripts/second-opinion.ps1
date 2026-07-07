<#
  PCC second opinion (Claude<->Codex cross-check).

  Pipe a prompt over stdin; get an INDEPENDENT take from Codex CLI running in a
  read-only sandbox (it can inspect the repo but changes nothing). The app's
  "Second opinion" button uses this to have Codex review Claude's answer — a
  different model, so it is a genuine cross-check, not self-agreement.

  Prints Codex's reply to stdout. Deterministic plumbing; the judgment is Codex's.
#>
$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$prompt = [Console]::In.ReadToEnd()
if (-not $prompt -or -not $prompt.Trim()) { Write-Output 'No prompt provided.'; exit 1 }

# Run in a job so an out-of-usage hang can be timed out (mirrors verify-work.ps1).
$job = Start-Job -ScriptBlock {
  param($p, $dir)
  Set-Location $dir
  $o = & codex exec --sandbox read-only $p 2>&1 | Out-String
  [pscustomobject]@{ code = $LASTEXITCODE; out = $o }
} -ArgumentList $prompt, $repo

if (Wait-Job $job -Timeout 120) {
  $r = Receive-Job $job; Remove-Job $job -Force -ErrorAction SilentlyContinue
  if ($r.out -and $r.out.Trim()) { Write-Output $r.out.Trim() }
  else { Write-Output "Codex returned no output (exit $($r.code)). It may be out of usage." }
} else {
  Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue
  Write-Output 'Codex second opinion timed out (it may be out of usage right now).'
}
