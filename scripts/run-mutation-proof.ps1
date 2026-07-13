<#
  run-mutation-proof.ps1 — Phase 4 Slice 1: TARGETED MUTATION PROOF.

  Produces repeatable evidence that PCC's most important tests actually FAIL when a
  specific integrity-critical behavior is deliberately broken. It is a thin orchestrator
  over a DECLARATIVE manifest (scripts/mutation-manifest.json) — it does not invent
  mutations; each is an exact single-site edit named by a human, paired with the EXISTING
  focused test that must catch it.

  ISOLATION — it never modifies real DATA or tracked source. The app's real source files,
  node_modules, and project data (chats.json, PROJECT.md, .cockpit/state, and any tracked
  file) are only ever READ. Its ONLY writes are to two git-ignored, DESIGNATED output
  locations: an ephemeral scratch COPY of app/ nested at app/.pcc-mut-tmp/<id> (created per
  run and deleted at the end unless -KeepTemp is passed, like test-results/), and the
  commit-bound receipt under .cockpit/evidence/
  (same convention as the release gate). node_modules is NEVER copied or linked — a detector
  resolves it by Node's normal upward resolution to the real app/node_modules (the scratch
  sits one level below it), so there is no junction and nothing a test could write through.
  Every mutation is applied, tested, and RESTORED inside the scratch copy; the scratch (which
  contains no links) is deleted at the end unless -KeepTemp is passed to retain it for debugging.

  PER MUTATION (honest classification):
    1. the `find` string must occur EXACTLY once in the copied file      (else INVALID)
    2. BASELINE: the detector test must PASS on the un-mutated copy       (else INVALID)
    3. apply the one-site mutation; `node --check` must still parse       (else INVALID)
    4. MUTATED: run the detector
         - it reports a real test FAILURE  -> KILLED
         - it still PASSES                 -> SURVIVED  (a real test-confidence finding)
         - timeout / crash / no test ran   -> INVALID   (NEVER counted as KILLED)
    5. RESTORE the original bytes; the detector must PASS again           (else INVALID)

  A timeout, harness error, or setup failure is NEVER converted into KILLED.

  Emits a git-ignored, commit-bound receipt (.cockpit/evidence/mutation-proof.json) and,
  with -Json, the same summary to stdout. Exit 0 ONLY if every mutation is KILLED.

  Local, deterministic, no network, no added dependency.
#>
[CmdletBinding()]
param(
  [string]$AppDir,                                   # default: <repo>/app
  [string]$ManifestPath,                             # default: <repo>/scripts/mutation-manifest.json
  [string]$ReceiptPath,                              # default: <repo>/.cockpit/evidence/mutation-proof.json
  [int]$TimeoutSec = 180,
  [switch]$Json,
  [switch]$KeepTemp
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $AppDir)       { $AppDir       = Join-Path $repoRoot 'app' }
if (-not $ManifestPath) { $ManifestPath = Join-Path $PSScriptRoot 'mutation-manifest.json' }
if (-not $ReceiptPath)  { $ReceiptPath  = Join-Path $repoRoot '.cockpit/evidence/mutation-proof.json' }

$AppDir = (Resolve-Path $AppDir).Path

# CANONICAL BOUNDED ENTRYPOINT. Unless already inside the guard, re-invoke THIS script through
# scripts/run-guarded.ps1 so the canonical command `pwsh scripts/run-mutation-proof.ps1` can never
# hang unbounded. The guard sets PCC_GUARDED=1 for its child, so the re-exec'd inner run falls through
# and does the real work. Per-case emission (below) makes each completed mutation an EVIDENCE tick, so
# a healthy run resets the guard's stall clock at every case; a wedge is aborted at the stall bound.
if ($env:PCC_GUARDED -ne '1') {
  $guard = Join-Path $PSScriptRoot 'run-guarded.ps1'
  if (Test-Path -LiteralPath $guard -PathType Leaf) {
    # Re-invoke THIS script through the guard, forwarding the SAME bound params. We build a PowerShell
    # scriptblock that splats a rebuilt hashtable and hand it to pwsh as -EncodedCommand (base64
    # UTF-16LE). The encoded token is only [A-Za-z0-9+/=] — no cmd.exe/PowerShell metacharacters — so
    # forwarding is immune to quoting or injection no matter what a param value contains (spaces,
    # quotes, & | > ^ %, ...). Switch/int/string values are emitted as PowerShell literals, not shell
    # tokens. The inner run sees PCC_GUARDED=1 (set by the guard) and falls through to do the real work.
    $pairs = foreach ($kv in $PSBoundParameters.GetEnumerator()) {
      $k = $kv.Key; $v = $kv.Value
      if ($v -is [System.Management.Automation.SwitchParameter]) { "$k = `$$([bool]$v.IsPresent)" }
      elseif ($v -is [int]) { "$k = $v" }
      else { "$k = '$([string]$v -replace "'", "''")'" }
    }
    $innerPs = "`$p = @{ $($pairs -join '; ') }; & '$($PSCommandPath -replace "'", "''")' @p"
    $enc = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($innerPs))
    # In -Json mode the guard runs -Quiet (its progress goes to the child log, keeping our stdout pure)
    # and we re-emit the receipt the inner run wrote — so a machine caller still gets clean JSON, now
    # bounded. In human mode the guard streams live so the operator sees real motion.
    $guardArgs = @('-NoProfile', '-File', $guard, '-Label', 'mutation-proof', '-StallSec', '300', '-MaxSec', '1800')
    if ($Json) { $guardArgs += '-Quiet' }
    $guardArgs += @('-Command', "pwsh -NoProfile -EncodedCommand $enc")
    & pwsh @guardArgs
    $code = $LASTEXITCODE
    if ($Json -and (Test-Path -LiteralPath $ReceiptPath)) { Get-Content -Raw -LiteralPath $ReceiptPath }
    exit $code
  }
  [Console]::Error.WriteLine('[mutation-proof] WARNING: scripts/run-guarded.ps1 not found — running UNGUARDED.')
}

function GitOut([string[]]$argv, [string]$cwd) {
  try { Push-Location $cwd; $o = & git @argv 2>$null; return "$o".Trim() } catch { return '' } finally { Pop-Location }
}

# Run a child process with a hard wall-clock timeout. Returns @{ exit; out; timedOut }.
# stdout+stderr are captured together; a timeout kills the whole process tree and is
# reported as timedOut (the caller must classify it INVALID, never KILLED).
function Invoke-WithTimeout([string[]]$Cmd, [string]$WorkDir, [int]$Sec) {
  $outF = [System.IO.Path]::GetTempFileName()
  $errF = [System.IO.Path]::GetTempFileName()
  try {
    $args = @('/c') + $Cmd
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $args -WorkingDirectory $WorkDir `
         -NoNewWindow -PassThru -RedirectStandardOutput $outF -RedirectStandardError $errF
    if (-not $p.WaitForExit($Sec * 1000)) {
      try { $p.Kill($true) } catch {}
      try { $p.WaitForExit(5000) | Out-Null } catch {}
      $partial = ((Get-Content $outF -Raw -ErrorAction SilentlyContinue), (Get-Content $errF -Raw -ErrorAction SilentlyContinue)) -join "`n"
      return @{ exit = $null; out = $partial; timedOut = $true }
    }
    $out = ((Get-Content $outF -Raw -ErrorAction SilentlyContinue), (Get-Content $errF -Raw -ErrorAction SilentlyContinue)) -join "`n"
    return @{ exit = $p.ExitCode; out = $out; timedOut = $false }
  } finally { Remove-Item $outF, $errF -Force -ErrorAction SilentlyContinue }
}

# Detector command per runner (relative testFile, run with cwd = temp app copy).
function Get-DetectorCmd([string]$runner, [string]$testFile) {
  # Reporters are PINNED so classification is deterministic regardless of TTY/Node version:
  # node:test -> TAP ('# tests N' / '# fail N' / 'not ok'); playwright -> line ('N passed' / 'N failed').
  switch ($runner) {
    'node-test'  { return @('node', '--test', '--test-reporter=tap', $testFile) }
    'playwright' { return @('npx', 'playwright', 'test', '--reporter=line', $testFile) }
    default      { return $null }
  }
}

# Classify a detector run into 'pass' | 'failed' | 'error'. 'failed' REQUIRES proof that
# tests actually ran and reported a failure — a load/syntax error or timeout is 'error',
# never 'failed', so it can never be mistaken for a KILL.
function Get-DetectorOutcome([string]$runner, [hashtable]$res) {
  if ($res.timedOut) { return 'error' }
  $o = [string]$res.out
  if ($runner -eq 'node-test') {
    $ran = $o -match '(?m)^#\s+tests\s+\d+'
    if ($res.exit -eq 0 -and $ran) { return 'pass' }
    if ($res.exit -ne 0 -and $ran -and ($o -match '(?m)^#\s+fail\s+[1-9]' -or $o -match '(?m)^not ok ')) { return 'failed' }
    return 'error'
  }
  if ($runner -eq 'playwright') {
    $ranPass = $o -match '(?m)\d+\s+passed'
    $ranFail = $o -match '(?m)(\d+)\s+failed'
    if ($res.exit -eq 0 -and $ranPass -and -not $ranFail) { return 'pass' }
    if ($res.exit -ne 0 -and $ranFail) { return 'failed' }
    return 'error'
  }
  return 'error'
}

# ---- load + validate the manifest ----
if (-not (Test-Path $ManifestPath)) { throw "manifest not found: $ManifestPath" }
$manifest = Get-Content -Raw $ManifestPath | ConvertFrom-Json
if (-not $manifest.mutations -or $manifest.mutations.Count -lt 1) { throw "manifest has no mutations: $ManifestPath" }

$headSha = GitOut @('rev-parse', 'HEAD') $AppDir
$dirty   = [bool](GitOut @('status', '--porcelain') $AppDir)

# ---- build the isolated scratch copy ----
# NESTED under the real app/ (which OWNS node_modules) so a playwright detector resolves
# @playwright/test upward to app/node_modules WITHOUT any junction or copy of node_modules.
# The scratch contains NO links, so its recursive delete can never escape into real data.
$repoApp   = Join-Path $repoRoot 'app'
$tmpParent = Join-Path $repoApp '.pcc-mut-tmp'
$tmpApp    = Join-Path $tmpParent ($PID.ToString() + "-" + ([System.Guid]::NewGuid().ToString('N').Substring(0,8)))
New-Item -ItemType Directory -Path $tmpApp -Force | Out-Null

# robocopy mirrors bytes; /XD excludes node_modules (resolved upward), derived + the scratch
# dir itself. Exit codes 0-7 are success.
& robocopy $AppDir $tmpApp /MIR /XD node_modules test-results .pcc-mut-tmp /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -ge 8) { throw "robocopy failed to mirror app source (code $LASTEXITCODE)" }
$global:LASTEXITCODE = 0

$results = @()
$caseIdx = 0
$caseTotal = @($manifest.mutations).Count
try {
  foreach ($m in $manifest.mutations) {
    # Case-boundary progress -> stderr (keeps -Json stdout pure) so each completed mutation is an
    # explicit EVIDENCE tick the guard sees as forward progress, not a grep guess over prose.
    $caseIdx++
    [Console]::Error.WriteLine("[mutation-proof] case $caseIdx/$caseTotal start: $($m.id)")
    $rel = $m.file -replace '^app[\\/]', ''         # manifest paths are repo-relative (app/...)
    $tmpFile = Join-Path $tmpApp $rel
    $r = [ordered]@{
      id = $m.id; priority = $m.priority; file = $m.file; runner = $m.runner;
      testFile = $m.testFile; detector = $m.detector; productBehavior = $m.productBehavior;
      classification = 'INVALID'; reason = ''; baseline = ''; mutated = ''; restored = ''
    }

    if (-not (Test-Path $tmpFile)) { $r.reason = 'target file not found in copy'; $results += ,([pscustomobject]$r); continue }

    $origRaw = [System.IO.File]::ReadAllText($tmpFile)
    $orig    = $origRaw -replace "`r`n", "`n"          # normalize for matching (temp copy only)
    $occurrences = ([regex]::Matches($orig, [regex]::Escape($m.find))).Count
    if ($occurrences -ne 1) { $r.reason = "find string occurs $occurrences times (need exactly 1)"; $results += ,([pscustomobject]$r); continue }

    $cmd = Get-DetectorCmd $m.runner $m.testFile
    if (-not $cmd) { $r.reason = "unknown runner '$($m.runner)'"; $results += ,([pscustomobject]$r); continue }

    # 2. baseline must be green
    $b = Invoke-WithTimeout $cmd $tmpApp $TimeoutSec
    $r.baseline = (Get-DetectorOutcome $m.runner $b)
    if ($r.baseline -ne 'pass') { $r.reason = "baseline not green ($($r.baseline)); cannot trust a kill"; $results += ,([pscustomobject]$r); continue }

    # 3. apply the one-site mutation (literal replace on normalized text), write LF
    $mutatedText = $orig.Replace($m.find, $m.replace)
    [System.IO.File]::WriteAllText($tmpFile, $mutatedText, (New-Object System.Text.UTF8Encoding($false)))

    $chk = Invoke-WithTimeout @('node', '--check', $tmpFile) $tmpApp 60
    if ($chk.exit -ne 0) {
      $r.reason = 'mutation produced a syntax error (node --check failed) — inconclusive, not a kill'
      [System.IO.File]::WriteAllText($tmpFile, $origRaw, (New-Object System.Text.UTF8Encoding($false)))
      $results += ,([pscustomobject]$r); continue
    }

    # 4. run detector on the mutated copy
    $mo = Invoke-WithTimeout $cmd $tmpApp $TimeoutSec
    $r.mutated = (Get-DetectorOutcome $m.runner $mo)

    # 5. restore + confirm determinism
    [System.IO.File]::WriteAllText($tmpFile, $origRaw, (New-Object System.Text.UTF8Encoding($false)))
    $ro = Invoke-WithTimeout $cmd $tmpApp $TimeoutSec
    $r.restored = (Get-DetectorOutcome $m.runner $ro)

    if ($r.restored -ne 'pass') { $r.classification = 'INVALID'; $r.reason = "detector did not pass after restore ($($r.restored)) — determinism unproven" }
    elseif ($r.mutated -eq 'failed') { $r.classification = 'KILLED';   $r.reason = 'the focused test failed on the mutant, passed when restored' }
    elseif ($r.mutated -eq 'pass')   { $r.classification = 'SURVIVED'; $r.reason = 'the focused test still passed with the behavior broken — test-confidence gap' }
    else                             { $r.classification = 'INVALID';  $r.reason = "mutated run inconclusive ($($r.mutated)) — not counted as a kill" }

    $results += ,([pscustomobject]$r)
  }
}
finally {
  if (-not $KeepTemp) {
    # The scratch tree contains no reparse points (node_modules was never linked/copied),
    # and the guard confirms we only ever recurse under app/.pcc-mut-tmp/ — so this can
    # never follow a link into real data.
    if ($tmpApp -and $tmpApp.StartsWith($tmpParent, [System.StringComparison]::OrdinalIgnoreCase)) {
      Remove-Item -Recurse -Force $tmpApp -ErrorAction SilentlyContinue
    }
    try { if ((Test-Path $tmpParent) -and -not (Get-ChildItem $tmpParent -Force -ErrorAction SilentlyContinue)) { Remove-Item -Force $tmpParent -ErrorAction SilentlyContinue } } catch {}
  }
}

$killed   = @($results | Where-Object { $_.classification -eq 'KILLED' }).Count
$survived = @($results | Where-Object { $_.classification -eq 'SURVIVED' }).Count
$invalid  = @($results | Where-Object { $_.classification -eq 'INVALID' }).Count
$allKilled = ($survived -eq 0 -and $invalid -eq 0 -and $killed -eq $results.Count -and $results.Count -gt 0)

$receipt = [ordered]@{
  tool = 'run-mutation-proof.ps1'
  schemaVersion = 1
  sha = $headSha
  dirtyWorkingTree = $dirty
  generatedAt = (Get-Date).ToString('o')
  manifest = (Resolve-Path $ManifestPath).Path
  summary = [ordered]@{ total = $results.Count; killed = $killed; survived = $survived; invalid = $invalid; allKilled = $allKilled }
  results = $results
  proves = 'Each KILLED result proves the named EXISTING test fails when that ONE integrity behavior is broken, and passes when restored.'
  doesNotProve = 'Not a mutation score and not exhaustive: only the hand-picked sites in the manifest are exercised. Says nothing about untested code or other mutations.'
}

if ($ReceiptPath) {
  $rp = $ReceiptPath
  $rpDir = Split-Path -Parent $rp
  if ($rpDir -and -not (Test-Path $rpDir)) { New-Item -ItemType Directory -Path $rpDir -Force | Out-Null }
  ($receipt | ConvertTo-Json -Depth 8) | Set-Content -Path $rp -Encoding UTF8
}

if ($Json) {
  ($receipt | ConvertTo-Json -Depth 8)
} else {
  Write-Host ""
  Write-Host "Targeted mutation proof — sha $headSha$(if($dirty){' (DIRTY tree)'})"
  foreach ($x in $results) {
    $tag = switch ($x.classification) { 'KILLED' { '[KILLED]  ' } 'SURVIVED' { '[SURVIVED]' } default { '[INVALID] ' } }
    Write-Host ("  {0} {1,-34} {2}" -f $tag, $x.id, $x.reason)
  }
  Write-Host ("  -> {0} killed / {1} survived / {2} invalid of {3}" -f $killed, $survived, $invalid, $results.Count)
}

exit ($(if ($allKilled) { 0 } else { 1 }))
