<#
  PCC second opinion bridge.

  Pipe a prompt over stdin; get an INDEPENDENT take from the chosen reviewer.
  Codex keeps the existing Claude->Codex cross-check. Antigravity adds the new
  Codex->AG cross-check. Both are review-only: they inspect/respond, never edit.

  Prints the reviewer's reply to stdout. Deterministic plumbing; the judgment is
  the reviewer's.
#>
param(
  [ValidateSet('codex', 'ag')]
  [string]$Provider = 'codex',
  [int]$TimeoutSec = 120
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$prompt = [Console]::In.ReadToEnd()
if (-not $prompt -or -not $prompt.Trim()) { Write-Output 'No prompt provided.'; exit 1 }

function Invoke-CodexReview {
  param($p, $dir)
  $job = Start-Job -ScriptBlock {
    param($promptText, $workDir)
    Set-Location $workDir
    $o = & codex exec --sandbox read-only $promptText 2>&1 | Out-String
    [pscustomobject]@{ code = $LASTEXITCODE; out = $o }
  } -ArgumentList $p, $dir
  if (Wait-Job $job -Timeout $TimeoutSec) {
    $r = Receive-Job $job; Remove-Job $job -Force -ErrorAction SilentlyContinue
    if ($r.out -and $r.out.Trim()) { return $r.out.Trim() }
    return "Codex returned no output (exit $($r.code)). It may be out of usage."
  }
  Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue
  return 'Codex second opinion timed out (it may be out of usage right now).'
}

function Invoke-AgReview {
  param($p, $dir)
  $job = Start-Job -ScriptBlock {
    param($promptText, $workDir)
    Set-Location $workDir
    $agyCmd = Get-Command agy -ErrorAction SilentlyContinue
    $fakeJs = if ($agyCmd) { Join-Path (Split-Path -Parent $agyCmd.Source) 'agy.js' } else { $null }
    if ($env:PCC_TEST_MODE -and $fakeJs -and (Test-Path -LiteralPath $fakeJs -PathType Leaf)) {
      $o = & node $fakeJs --sandbox --print $promptText 2>&1 | Out-String
    } else {
      $agyExe = Join-Path $env:LOCALAPPDATA 'agy\bin\agy.exe'
      if (Test-Path -LiteralPath $agyExe -PathType Leaf) {
        $o = & $agyExe --sandbox --print $promptText 2>&1 | Out-String
      } else {
        $o = & agy --sandbox --print $promptText 2>&1 | Out-String
      }
    }
    [pscustomobject]@{ code = $LASTEXITCODE; out = $o }
  } -ArgumentList $p, $dir
  if (Wait-Job $job -Timeout $TimeoutSec) {
    $r = Receive-Job $job; Remove-Job $job -Force -ErrorAction SilentlyContinue
    if ($r.out -and $r.out.Trim()) { return $r.out.Trim() }
    return "Antigravity returned no output (exit $($r.code)). It may be unavailable or out of usage."
  }
  Stop-Job $job -ErrorAction SilentlyContinue; Remove-Job $job -Force -ErrorAction SilentlyContinue
  return 'Antigravity second opinion timed out (it may be unavailable right now).'
}

$result = if ($Provider -eq 'ag') { Invoke-AgReview $prompt $repo } else { Invoke-CodexReview $prompt $repo }
Write-Output $result
