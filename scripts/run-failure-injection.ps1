<#
  run-failure-injection.ps1 — Phase 5 Slice 1: TARGETED FAILURE INJECTION.

  Repeatable evidence that PCC FAILS CLOSED or RECOVERS when a real dependency /
  persistence boundary fails — not merely when source logic is mutated (that is Phase 4).
  A thin orchestrator over a DECLARATIVE manifest (scripts/failure-injection-manifest.json);
  it does not inject failures itself — each case is a self-contained SCENARIO script that
  runs the REAL production code in a throwaway temp dir/repo and prints ONE JSON result.

  PER-CASE PROTOCOL (enforced by the scenario; classified here):
    the scenario must report: baselineOk (a passing baseline BEFORE injection),
    injectionTriggered (proof the intended fault actually fired), expected
    (RECOVERED|CONTAINED), and checks[] (the post-injection safety assertions —
    canonical data, prior good data, unrelated files, and a re-run baseline after
    cleanup). The scenario uses ONLY temp dirs/repos; real data is never touched.

  CLASSIFICATION (honest; a harness problem is NEVER a success):
    INVALID   — scenario timed out, crashed (nonzero exit), unparseable/short output,
                missing fields, baseline not established, injection not triggered, or no
                assertions. (timeout/harness-failure/injection-not-triggered => INVALID.)
    EXPOSED   — baseline ok + injection fired, but a safety check FAILED (a real defect).
    RECOVERED / CONTAINED — baseline ok + injection fired + ALL checks ok, matching the
                case's declared expected safe result.

  Emits a git-ignored, commit-bound receipt (.cockpit/evidence/failure-injection.json).
  Exit 0 ONLY if every case reached its expected safe result (no EXPOSED, no INVALID).
  Local, deterministic, no network beyond real git against temp repos, no added dependency.
#>
[CmdletBinding()]
param(
  [string]$ManifestPath,
  [string]$ReceiptPath,
  [int]$TimeoutSec = 120,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $ManifestPath) { $ManifestPath = Join-Path $PSScriptRoot 'failure-injection-manifest.json' }
if (-not $ReceiptPath)  { $ReceiptPath  = Join-Path $repoRoot '.cockpit/evidence/failure-injection.json' }

# CANONICAL BOUNDED ENTRYPOINT. Unless already inside the guard, re-invoke THIS script through
# scripts/run-guarded.ps1 so `pwsh scripts/run-failure-injection.ps1` can never hang unbounded. The
# guard sets PCC_GUARDED=1 for its child, so the re-exec'd inner run falls through and does the work.
# Per-case emission (below) makes each completed scenario an EVIDENCE tick for the guard's stall clock.
if ($env:PCC_GUARDED -ne '1') {
  $guard = Join-Path $PSScriptRoot 'run-guarded.ps1'
  if (Test-Path -LiteralPath $guard -PathType Leaf) {
    # Forward the SAME bound params via a base64 -EncodedCommand (see run-mutation-proof.ps1 for the
    # full rationale): the encoded token carries no shell metacharacters, so param values with spaces,
    # quotes, or & | > ^ % can never break quoting or inject a command.
    $pairs = foreach ($kv in $PSBoundParameters.GetEnumerator()) {
      $k = $kv.Key; $v = $kv.Value
      if ($v -is [System.Management.Automation.SwitchParameter]) { "$k = `$$([bool]$v.IsPresent)" }
      elseif ($v -is [int]) { "$k = $v" }
      else { "$k = '$([string]$v -replace "'", "''")'" }
    }
    $innerPs = "`$p = @{ $($pairs -join '; ') }; & '$($PSCommandPath -replace "'", "''")' @p"
    $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerPs))
    # In -Json mode the guard runs -Quiet (its progress goes to the child log, keeping our stdout pure)
    # and we re-emit the receipt the inner run wrote — clean JSON, now bounded. Human mode streams live.
    $guardArgs = @('-NoProfile', '-File', $guard, '-Label', 'failure-injection', '-StallSec', '300', '-MaxSec', '1800')
    if ($Json) { $guardArgs += '-Quiet' }
    $guardArgs += @('-Command', "pwsh -NoProfile -EncodedCommand $enc")
    & pwsh @guardArgs
    $code = $LASTEXITCODE
    if ($Json -and (Test-Path -LiteralPath $ReceiptPath)) { Get-Content -Raw -LiteralPath $ReceiptPath }
    exit $code
  }
  [Console]::Error.WriteLine('[failure-injection] WARNING: scripts/run-guarded.ps1 not found — running UNGUARDED.')
}

# Run a child process with a hard wall-clock timeout. Returns @{ exit; out; timedOut }.
function Invoke-WithTimeout([string[]]$Cmd, [string]$WorkDir, [int]$Sec) {
  $outF = [System.IO.Path]::GetTempFileName()
  $errF = [System.IO.Path]::GetTempFileName()
  try {
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList (@('/c') + $Cmd) -WorkingDirectory $WorkDir `
         -NoNewWindow -PassThru -RedirectStandardOutput $outF -RedirectStandardError $errF
    if (-not $p.WaitForExit($Sec * 1000)) {
      try { $p.Kill($true) } catch {}
      try { $p.WaitForExit(5000) | Out-Null } catch {}
      return @{ exit = $null; out = ((Get-Content $outF -Raw -EA SilentlyContinue), (Get-Content $errF -Raw -EA SilentlyContinue)) -join "`n"; timedOut = $true }
    }
    return @{ exit = $p.ExitCode; out = ((Get-Content $outF -Raw -EA SilentlyContinue), (Get-Content $errF -Raw -EA SilentlyContinue)) -join "`n"; timedOut = $false }
  } finally { Remove-Item $outF, $errF -Force -EA SilentlyContinue }
}

# Extract the LAST top-level JSON object from mixed stdout (scenarios may log before it).
function Read-LastJsonObject([string]$text) {
  if (-not $text) { return $null }
  $depth = 0; $start = -1; $last = $null
  for ($i = 0; $i -lt $text.Length; $i++) {
    $ch = $text[$i]
    if ($ch -eq '{') { if ($depth -eq 0) { $start = $i }; $depth++ }
    elseif ($ch -eq '}') { $depth--; if ($depth -eq 0 -and $start -ge 0) { $last = $text.Substring($start, $i - $start + 1) } }
  }
  if (-not $last) { return $null }
  try { return $last | ConvertFrom-Json } catch { return $null }
}

function Get-ScenarioCmd([string]$runner, [string]$scenarioPath) {
  switch ($runner) {
    'node' { return @('node', $scenarioPath) }
    'pwsh' { return @('pwsh', '-NoProfile', '-File', $scenarioPath) }
    default { return $null }
  }
}

if (-not (Test-Path $ManifestPath)) { throw "manifest not found: $ManifestPath" }
$manifest = Get-Content -Raw $ManifestPath | ConvertFrom-Json
if (-not $manifest.cases -or $manifest.cases.Count -lt 1) { throw "manifest has no cases: $ManifestPath" }

$headSha = ''
try { Push-Location $repoRoot; $headSha = "$(& git rev-parse HEAD 2>$null)".Trim() } catch {} finally { Pop-Location }

$results = @()
$caseIdx = 0
$caseTotal = @($manifest.cases).Count
foreach ($c in $manifest.cases) {
  # Case-boundary progress -> stderr (keeps -Json stdout pure) so each completed scenario is an
  # explicit EVIDENCE tick the guard reads as forward progress, not a grep guess over prose.
  $caseIdx++
  [Console]::Error.WriteLine("[failure-injection] case $caseIdx/$caseTotal start: $($c.id)")
  $r = [ordered]@{
    id = $c.id; priority = $c.priority; boundary = $c.boundary; expected = $c.expected;
    classification = 'INVALID'; reason = ''; injectedFault = $c.injectedFault;
    baselineOk = $false; injectionTriggered = $false; observed = ''; checks = @()
  }
  $scenarioPath = if ([System.IO.Path]::IsPathRooted($c.scenario)) { $c.scenario } else { Join-Path $repoRoot $c.scenario }
  if (-not (Test-Path $scenarioPath)) { $r.reason = "scenario not found: $($c.scenario)"; $results += ,([pscustomobject]$r); continue }
  $cmd = Get-ScenarioCmd $c.runner $scenarioPath
  if (-not $cmd) { $r.reason = "unknown runner '$($c.runner)'"; $results += ,([pscustomobject]$r); continue }

  $run = Invoke-WithTimeout $cmd $repoRoot $TimeoutSec
  if ($run.timedOut) { $r.reason = 'scenario timed out'; $results += ,([pscustomobject]$r); continue }
  if ($run.exit -ne 0) { $r.reason = "scenario crashed (exit $($run.exit)) — harness failure, not a result"; $r.observed = ($run.out.Trim() -split "`n" | Select-Object -Last 3) -join ' | '; $results += ,([pscustomobject]$r); continue }

  $obj = Read-LastJsonObject $run.out
  if ($null -eq $obj) { $r.reason = 'scenario produced no parseable JSON result'; $results += ,([pscustomobject]$r); continue }

  $r.baselineOk = [bool]$obj.baselineOk
  $r.injectionTriggered = [bool]$obj.injectionTriggered
  $r.observed = "$($obj.observed)"
  $r.checks = @($obj.checks)

  if (-not $r.baselineOk) { $r.reason = 'baseline not established before injection'; $results += ,([pscustomobject]$r); continue }
  if (-not $r.injectionTriggered) { $r.reason = 'the intended fault was NOT proven to trigger'; $results += ,([pscustomobject]$r); continue }
  if ($r.checks.Count -lt 1) { $r.reason = 'scenario made no safety assertions'; $results += ,([pscustomobject]$r); continue }

  $failed = @($r.checks | Where-Object { -not $_.ok })
  if ($failed.Count -gt 0) {
    $r.classification = 'EXPOSED'
    $r.reason = 'a safety check FAILED after injection: ' + (($failed | ForEach-Object { "$($_.name): $($_.detail)" }) -join ' ; ')
  } else {
    $r.classification = "$($c.expected)"  # RECOVERED or CONTAINED — the declared safe result, all checks passed
    $r.reason = "reached the expected safe result; $($r.checks.Count) checks passed"
  }
  $results += ,([pscustomobject]$r)
}

$byClass = @{ RECOVERED = 0; CONTAINED = 0; EXPOSED = 0; INVALID = 0 }
foreach ($x in $results) { $byClass[$x.classification]++ }
$allSafe = ($byClass.EXPOSED -eq 0 -and $byClass.INVALID -eq 0 -and $results.Count -gt 0 -and
            ($byClass.RECOVERED + $byClass.CONTAINED) -eq $results.Count)

$receipt = [ordered]@{
  tool = 'run-failure-injection.ps1'; schemaVersion = 1; sha = $headSha
  generatedAt = (Get-Date).ToString('o')
  manifest = (Resolve-Path $ManifestPath).Path
  summary = [ordered]@{ total = $results.Count; recovered = $byClass.RECOVERED; contained = $byClass.CONTAINED; exposed = $byClass.EXPOSED; invalid = $byClass.INVALID; allSafe = $allSafe }
  results = $results
  proves = 'Each RECOVERED/CONTAINED proves the REAL production boundary fails closed or recovers under a real injected dependency/persistence failure, with prior good data intact and no false success/green. Baseline established before and re-run after.'
  doesNotProve = 'Not exhaustive fault coverage and not a chaos framework: only the hand-picked boundaries/faults in the manifest. Says nothing about untested boundaries, and (FI-4) proves handling of the injected filesystem-call failure only — NOT universal power-loss durability across every OS/filesystem.'
}

if ($ReceiptPath) {
  $rpDir = Split-Path -Parent $ReceiptPath
  if ($rpDir -and -not (Test-Path $rpDir)) { New-Item -ItemType Directory -Path $rpDir -Force | Out-Null }
  ($receipt | ConvertTo-Json -Depth 9) | Set-Content -Path $ReceiptPath -Encoding UTF8
}

if ($Json) {
  ($receipt | ConvertTo-Json -Depth 9)
} else {
  Write-Host ""
  Write-Host "Targeted failure injection — sha $headSha"
  foreach ($x in $results) {
    $tag = switch ($x.classification) { 'RECOVERED' { '[RECOVERED]' } 'CONTAINED' { '[CONTAINED]' } 'EXPOSED' { '[EXPOSED] ' } default { '[INVALID]  ' } }
    Write-Host ("  {0} {1,-40} (exp {2}) {3}" -f $tag, $x.id, $x.expected, $x.reason)
  }
  Write-Host ("  -> {0} recovered / {1} contained / {2} exposed / {3} invalid of {4}" -f $byClass.RECOVERED, $byClass.CONTAINED, $byClass.EXPOSED, $byClass.INVALID, $results.Count)
}

exit ($(if ($allSafe) { 0 } else { 1 }))
