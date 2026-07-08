<#
  PCC local product verification (soak fix F3).

  Runs the project's OWN declared product checks on THIS machine and records the
  result as a `local_execution` proof in app/last-verification.txt — real execution
  evidence for a local-first project that can't reach CI or an independent reviewer.

  Honest by construction:
   - It runs a DECLARED command (.cockpit/state/product-run.json -> "verify"), never a
     guessed one. If none is declared, it records NOTHING and says so (declare, don't
     guess). A missing command is 'unknown', not a fake PASS.
   - The recorded proof is typed `local_execution` and its NOT PROVEN line states
     plainly that it ran locally (not a clean-room CI box) and that no independent
     reviewer read the code — so it never wears the same green as CI or a review.

  Deterministic wrapper; the verdict comes from the command's real exit code.
  -Json for the app.
#>
param([switch]$Json)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$cfgPath = '.cockpit/state/product-run.json'
$verifyOut = 'app/last-verification.txt'

function Emit($obj) { if ($Json) { $obj | ConvertTo-Json -Depth 6 } else { $obj | ConvertTo-Json -Depth 6 } }

if (-not (Test-Path -LiteralPath $cfgPath -PathType Leaf)) {
  Emit ([ordered]@{ ok = $false; reason = 'no_config'; message = "No product-run config at $cfgPath. Declare a 'verify' command there, then re-run." })
  return
}
$cfg = $null
try { $cfg = Get-Content -Raw -LiteralPath $cfgPath | ConvertFrom-Json } catch {}
$verifyCmd = if ($cfg -and $cfg.verify) { [string]$cfg.verify } else { '' }
if ([string]::IsNullOrWhiteSpace($verifyCmd)) {
  Emit ([ordered]@{ ok = $false; reason = 'no_verify_command'; message = "No 'verify' command declared in $cfgPath. Set one (e.g. 'npm test --prefix product') so behavior can be proven locally. Nothing recorded (won't guess)." })
  return
}

# Run the declared command, capturing combined output + real exit code.
$output = & cmd /c $verifyCmd 2>&1 | Out-String
$code = $LASTEXITCODE
$verdict = if ($code -eq 0) { 'PASS' } else { 'FAIL' }

$headShort = ''
try { $headShort = (& git rev-parse --short HEAD 2>$null | Out-String).Trim() } catch {}
$stamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:sszzz')

# Keep a readable tail of the command output as evidence (not the whole log).
$tail = ($output -split "\r?\n" | Where-Object { $_ -ne '' } | Select-Object -Last 12) -join ' | '
if ($tail.Length -gt 900) { $tail = $tail.Substring(0, 900) + ' …' }

$record = @"
=== Verification run $stamp (local execution) ===
VERIFIER: local execution of the product's declared checks on this machine
TARGET: $repo @ $headShort
TYPE: local_execution
COMMAND: $verifyCmd (exit $code)

VERDICT: $verdict

EVIDENCE:
* Ran the declared product-verify command; it exited $code ($verdict).
* Output tail: $tail

NOT PROVEN:
* local_execution — these checks ran on THIS machine, not a clean-room CI box, and no
  independent reviewer read the code. It proves the product's own checks pass here; it
  does not replace an independent review or a clean-machine CI run.
"@
$dir = Split-Path -Parent $verifyOut
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -LiteralPath $verifyOut -Encoding utf8 -Value $record

Emit ([ordered]@{ ok = $true; verdict = $verdict; type = 'local_execution'; exit_code = $code; command = $verifyCmd; recorded = $verifyOut })
