<#
  PCC release gate (docs/HARDENING_RELEASE_GATE.md) — SLICE 1, fresh-run only.

  ONE fresh-run command. It evaluates the CURRENT commit by COLLECTING facts from the authorities
  that already own them, then combining them under one small policy. It does NOT re-derive sync, CI,
  detection, or evidence-validation logic; it invokes the real tools and consumes their answers.

  The generated .cockpit/evidence/release-gate.json is a HISTORICAL RECEIPT of one run. It is never
  read back as live proof. To know current release readiness, run the gate again. (There is no
  -EvaluateFile mode by design.)

  Facts (each tied to the exact starting SHA):
    1. git         — commit, branch, clean tree (captured at start AND again at end).
    2. backup/sync — scripts/detect-repo-sync.ps1 (the existing PCC authority), signal consumed.
    3. remote head — git ls-remote origin refs/heads/<branch>, compared to the local SHA.
    4. CI          — scripts/ci-status.ps1 for the exact SHA (GitHub named 'test' check).
    5. local exec  — npm run test:unit ; npm test ; npm audit --audit-level=high (exit codes).
    6. detectors   — scripts/detect-bloat.ps1 / detect-drift.ps1 / detect-stale-docs.ps1, signals.
    7. structure   — the record is validated against schemas/release-gate.schema.json (Test-Json).

  The ONLY policy the gate owns:
    any required FAIL => FAIL ; else any required UNKNOWN => UNKNOWN ; else PASS.
    A changed HEAD or dirty tree => FAIL. Missing network truth (remote head, CI) => UNKNOWN, never
    PASS. Invalid generated evidence => FAIL. The accepted bloat notice is a disclosed, exact,
    fail-closed exception (.cockpit/state/release-gate-exceptions.json). The "Never says no?"
    sycophancy nudge is chat content, not release health, and is excluded. No LLM at runtime.

  Exit codes: 0 = PASS, 1 = FAIL, 2 = UNKNOWN. -Json prints the receipt to stdout.
#>
param([switch]$Json, [switch]$Quiet)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function GitOut([string[]]$argv) { $o = & git @argv 2>$null; return "$o".Trim() }
function IsClean { return (([string](GitOut @('status', '--porcelain'))) -eq '') }

# Invoke a sibling script and parse its JSON. $null on missing/unparseable (-> UNKNOWN downstream:
# a check we could not read is never treated as an all-clear).
function Invoke-JsonScript([string]$name, [string[]]$argv) {
  $p = Join-Path $PSScriptRoot $name
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { return $null }
  try { $out = & pwsh -NoProfile -File $p @argv 2>$null; return ("$out" | ConvertFrom-Json) }
  catch { return $null }
}

# --- fact collectors ---
function Get-RemoteHead([string]$branch, [string]$localSha) {
  $r = [ordered]@{ state = 'unavailable'; local_sha = $localSha; remote_sha = $null; detail = '' }
  if (-not (GitOut @('remote', 'get-url', 'origin'))) { $r.detail = 'no origin remote'; return $r }
  $out = & git ls-remote origin "refs/heads/$branch" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not "$out".Trim()) { $r.detail = 'ls-remote failed or branch missing on remote'; return $r }
  $remoteSha = (("$out".Trim()) -split '\s+')[0]
  if ($remoteSha -notmatch '^[0-9a-f]{40}$') { $r.detail = 'remote head not a full sha'; return $r }
  $r.remote_sha = $remoteSha
  $r.state = if ($remoteSha -eq $localSha) { 'match' } else { 'mismatch' }
  $r.detail = "remote head $($remoteSha.Substring(0,9))"
  return $r
}

function Invoke-Suite([string[]]$npmArgs, [switch]$Guard) {
  # The required suites (fact source 5) ARE the app's npm scripts, so running them references app/.
  # This is a SOFT dependency by design: if app/ is absent the suite is 'unavailable' -> UNKNOWN
  # (never a crash, never a PASS), so the script still RUNS with app/ deleted (extractability holds).
  $cmd = "npm $($npmArgs -join ' ')"
  $appDir = Join-Path $repo 'app'
  if (-not (Test-Path -LiteralPath (Join-Path $appDir 'package.json') -PathType Leaf)) {
    return [ordered]@{ command = $cmd; exit = $null; status = 'unavailable' }
  }
  # The long Playwright suite is the exact run that once wedged for ~7h. When the forward-progress
  # guard is present (scripts/run-guarded.ps1), route it THROUGH the guard so even a DIRECT gate run
  # (not just one wrapped from outside) can never hang silently: the guard reaps stale test electrons
  # first, aborts on no forward progress within its stall window, and writes a machine-readable
  # heartbeat/verdict. -Quiet keeps the guard off stdout so the -Json receipt stays pure; the guard's
  # exit code (0 pass / nonzero incl. HUNG=3, CAP=4) maps to the same passed/failed policy below.
  # Fallback to a direct run when the guard script is absent (extractability + copies without it).
  $guardScript = Join-Path $PSScriptRoot 'run-guarded.ps1'
  if ($Guard -and (Test-Path -LiteralPath $guardScript -PathType Leaf)) {
    try {
      & pwsh -NoProfile -File $guardScript -Label 'gate-full-suite' -Quiet -WorkDir $appDir -Command "npm $($npmArgs -join ' ')" *>&1 | Out-Null
      $code = $LASTEXITCODE
    } catch { return [ordered]@{ command = $cmd; exit = $null; status = 'unavailable'; guard = 'active' } }
    # Map the guard's own exit codes to the gate's honest policy, NOT "nonzero => failed":
    #   0 = suite passed. 2 = guard setup error (couldn't start / no evidence dir) -> 'unavailable'
    #   -> UNKNOWN, exactly like the direct-npm catch path, so infrastructure trouble never masquerades
    #   as a real test FAIL. 1 = tests failed; 3 = HUNG; 4 = CAP -> all genuine 'failed'.
    $status = switch ($code) { 0 { 'passed' } 2 { 'unavailable' } default { 'failed' } }
    return [ordered]@{ command = $cmd; exit = $code; status = $status; guard = 'active' }
  }
  # Direct run. For the unit/audit suites (no -Guard) this is correct and fast (guard = 'n/a'). For the
  # FULL suite (-Guard) reaching here means scripts/run-guarded.ps1 is MISSING — a degraded copy where
  # the canonical MANDATORY hang guard is unavailable. A release gate must FAIL CLOSED: it may not
  # certify a clean green when it could not have caught a hang. So we still run the suite
  # (extractability), disclose loudly on stderr AND durably in the receipt (guard = 'absent'), and force
  # the suite result to 'unavailable' -> UNKNOWN so the overall verdict can never be a green PASS when
  # the guard was missing. (A hang, had it occurred, would have gone undetected — that is exactly the
  # degraded assurance UNKNOWN exists to surface.)
  $guardMark = if (-not $Guard) { 'n/a' } elseif (Test-Path -LiteralPath $guardScript -PathType Leaf) { 'active' } else { 'absent' }
  if ($guardMark -eq 'absent') {
    [Console]::Error.WriteLine("[release-gate] WARNING: scripts/run-guarded.ps1 not found — the full suite ran UNGUARDED (no hang protection). Marking suite 'unavailable' so the gate is UNKNOWN, never a false green.")
  }
  Push-Location $appDir
  try { & npm @npmArgs *>&1 | Out-Null; $code = $LASTEXITCODE }
  catch { Pop-Location; return [ordered]@{ command = $cmd; exit = $null; status = 'unavailable'; guard = $guardMark } }
  Pop-Location
  # guard='absent' => 'unavailable' (fail closed). Otherwise (unit/audit, guard='n/a') pass/fail on exit.
  $status = if ($guardMark -eq 'absent') { 'unavailable' } elseif ($code -eq 0) { 'passed' } else { 'failed' }
  [ordered]@{ command = $cmd; exit = $code; status = $status; guard = $guardMark }
}

function Get-DetectorFact([string]$detector) {
  $j = Invoke-JsonScript "detect-$detector.ps1" @('-Json')
  if ($null -eq $j -or -not ($j.signal -is [string])) { return [ordered]@{ detector = $detector; signal = 'unknown'; items = @() } }
  [ordered]@{ detector = $detector; signal = "$($j.signal)"; items = @($j.items) }
}

function Get-ApprovedBloatItems {
  $p = Join-Path $repo '.cockpit/state/release-gate-exceptions.json'
  if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { return @() }
  try { return @((Get-Content -Raw -LiteralPath $p | ConvertFrom-Json).bloat_notice_items) } catch { return @() }
}

# Exact, fail-closed bloat acceptance: signal 'notice' with items EXACTLY equal (as a set, full
# strings) to the approved list. No substring/regex. Any wording/count/line change => not covered.
function Test-BloatException($bloatFact, $approved) {
  if ("$($bloatFact.signal)" -ne 'notice') { return $false }
  $got = @($bloatFact.items | ForEach-Object { "$_" } | Sort-Object)
  $exp = @($approved | ForEach-Object { "$_" } | Sort-Object)
  if ($got.Count -ne $exp.Count -or $got.Count -eq 0) { return $false }
  for ($i = 0; $i -lt $got.Count; $i++) { if ($got[$i] -ne $exp[$i]) { return $false } }
  return $true
}

# --- schema validation (Test-Json; the one structural authority) ---
function Test-RecordSchema([string]$json) {
  $schema = Join-Path $repo 'schemas/release-gate.schema.json'
  if (-not (Test-Path -LiteralPath $schema -PathType Leaf)) { return @{ valid = $false; errors = @('schema file missing') } }
  try {
    $errs = @()
    $ok = Test-Json -Json $json -SchemaFile $schema -ErrorVariable errs -ErrorAction SilentlyContinue
    return @{ valid = [bool]$ok; errors = @($errs | ForEach-Object { "$_" }) }
  } catch { return @{ valid = $false; errors = @("$($_.Exception.Message)") } }
}

function New-Chk([string]$c, [string]$r, [string]$why) { [ordered]@{ check = $c; result = $r; reason = $why } }

# --- collect ---
$shaStart = GitOut @('rev-parse', 'HEAD')
$branch = GitOut @('rev-parse', '--abbrev-ref', 'HEAD')
$cleanStart = IsClean
if (-not $Quiet -and -not $Json) { Write-Host "Release gate: evaluating $shaStart on '$branch' ..." }

$backupSync = Invoke-JsonScript 'detect-repo-sync.ps1' @('-Json')
$backupSignal = if ($null -ne $backupSync -and ($backupSync.signal -is [string])) { "$($backupSync.signal)" } else { 'unknown' }
$remoteHead = Get-RemoteHead $branch $shaStart
$ciRaw = Invoke-JsonScript 'ci-status.ps1' @('-Sha', $shaStart)
$ci = if ($null -ne $ciRaw -and ($ciRaw.status -is [string])) {
  [ordered]@{ status = "$($ciRaw.status)"; sha = "$($ciRaw.sha)"; detail = "$($ciRaw.detail)" }
} else { [ordered]@{ status = 'unreachable'; sha = $null; detail = 'ci-status produced no result' } }

$suites = [ordered]@{
  unit  = (Invoke-Suite @('run', 'test:unit'))
  full  = (Invoke-Suite @('run', 'test:raw') -Guard)   # slow e2e suite via the RAW runner, wrapped in the guard here
  audit = (Invoke-Suite @('audit', '--audit-level=high'))
}
$detectors = @('bloat', 'drift', 'stale-docs' | ForEach-Object { Get-DetectorFact $_ })

# --- re-check HEAD + branch + tree AFTER all work (per spec: checked again after all work) ---
$shaEnd = GitOut @('rev-parse', 'HEAD')
$branchEnd = GitOut @('rev-parse', '--abbrev-ref', 'HEAD')
$cleanEnd = IsClean
$headStable = ($shaStart -eq $shaEnd)
$branchStable = ($branch -eq $branchEnd)

# --- combine (the only policy the gate owns) ---
$rs = New-Object System.Collections.ArrayList
$ex = New-Object System.Collections.ArrayList

if (-not $headStable) { [void]$rs.Add((New-Chk 'head_stable' 'fail' "HEAD changed during the run ($shaStart -> $shaEnd)")) } else { [void]$rs.Add((New-Chk 'head_stable' 'ok' '')) }
if (-not $branchStable) { [void]$rs.Add((New-Chk 'branch_stable' 'fail' "branch changed during the run ($branch -> $branchEnd)")) } else { [void]$rs.Add((New-Chk 'branch_stable' 'ok' '')) }
if (-not $cleanStart) { [void]$rs.Add((New-Chk 'tree_clean_start' 'fail' 'working tree was not clean at start')) } else { [void]$rs.Add((New-Chk 'tree_clean_start' 'ok' '')) }
if (-not $cleanEnd) { [void]$rs.Add((New-Chk 'tree_clean_end' 'fail' 'working tree was not clean at end')) } else { [void]$rs.Add((New-Chk 'tree_clean_end' 'ok' '')) }

switch ($backupSignal) {
  'clear'   { [void]$rs.Add((New-Chk 'backup_sync' 'ok' '')) }
  'notice'  { [void]$rs.Add((New-Chk 'backup_sync' 'fail' 'repo-sync reports work not fully backed up (uncommitted/unpushed)')) }
  default   { [void]$rs.Add((New-Chk 'backup_sync' 'unknown' 'repo-sync signal could not be read')) }
}

switch ("$($remoteHead.state)") {
  'match'    { [void]$rs.Add((New-Chk 'remote_head' 'ok' '')) }
  'mismatch' { [void]$rs.Add((New-Chk 'remote_head' 'fail' "remote branch head ($($remoteHead.remote_sha)) != local commit ($shaStart)")) }
  default    { [void]$rs.Add((New-Chk 'remote_head' 'unknown' "remote head not definitive: $($remoteHead.detail)")) }
}

# CI: passed (bound to this exact sha) => ok ; failed/cancelled/skipped => FAIL ; else UNKNOWN.
switch ("$($ci.status)") {
  'passed' {
    if ("$($ci.sha)" -ne "$shaStart") { [void]$rs.Add((New-Chk 'ci' 'fail' "CI pass is bound to $($ci.sha), not the tested commit $shaStart")) }
    else { [void]$rs.Add((New-Chk 'ci' 'ok' '')) }
  }
  'failed'    { [void]$rs.Add((New-Chk 'ci' 'fail' 'CI test check failed for this commit')) }
  'cancelled' { [void]$rs.Add((New-Chk 'ci' 'fail' 'CI test check was cancelled for this commit')) }
  'skipped'   { [void]$rs.Add((New-Chk 'ci' 'fail' 'CI test check was skipped for this commit')) }
  default     { [void]$rs.Add((New-Chk 'ci' 'unknown' "CI not definitive for this commit ($($ci.status))")) }
}

foreach ($k in @('unit', 'full', 'audit')) {
  switch ("$($suites.$k.status)") {
    'passed' { [void]$rs.Add((New-Chk "suite:$k" 'ok' '')) }
    'failed' { [void]$rs.Add((New-Chk "suite:$k" 'fail' "$($suites.$k.command) failed (exit $($suites.$k.exit))")) }
    default  { [void]$rs.Add((New-Chk "suite:$k" 'unknown' "$($suites.$k.command) did not run")) }
  }
}

$approvedBloat = Get-ApprovedBloatItems
foreach ($d in $detectors) {
  $name = "$($d.detector)"; $sig = "$($d.signal)"
  if ($sig -eq 'clear') { [void]$rs.Add((New-Chk "detector:$name" 'ok' '')); continue }
  if ($sig -eq 'notice') {
    if ($name -eq 'bloat' -and (Test-BloatException $d $approvedBloat)) {
      [void]$rs.Add((New-Chk "detector:$name" 'ok' ''))
      [void]$ex.Add([ordered]@{ detector = 'bloat'; items = @($d.items); reason = 'owner-accepted oversized files (exact-match exception)' })
    } else {
      [void]$rs.Add((New-Chk "detector:$name" 'fail' "unapproved '$name' notice (not an exact-match approved exception)"))
    }
    continue
  }
  [void]$rs.Add((New-Chk "detector:$name" 'unknown' "detector '$name' did not report a clear signal"))
}

$overallFrom = {
  param($checks)
  if (@($checks | Where-Object { $_.result -eq 'fail' }).Count -gt 0) { return 'FAIL' }
  if (@($checks | Where-Object { $_.result -eq 'unknown' }).Count -gt 0) { return 'UNKNOWN' }
  return 'PASS'
}

# --- assemble record with a placeholder verdict, validate structure, then finalise ---
$record = [ordered]@{
  schema           = 'release-gate/v1'
  generated_at     = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
  commit           = $shaStart
  commit_at_end    = $shaEnd
  branch           = $branch
  branch_at_end    = $branchEnd
  head_stable      = $headStable
  branch_stable    = $branchStable
  tree_clean_start = $cleanStart
  tree_clean_end   = $cleanEnd
  backup_sync      = [ordered]@{ signal = $backupSignal; source = 'detect-repo-sync.ps1' }
  remote_head      = $remoteHead
  ci               = $ci
  suites           = $suites
  detectors        = @($detectors)
  exceptions_applied = @($ex)
  evidence_valid   = $true
  verdict          = [ordered]@{ overall = 'UNKNOWN'; reasons = @(); checks = @($rs) }
}

$schemaCheck = Test-RecordSchema ($record | ConvertTo-Json -Depth 8)
if (-not $schemaCheck.valid) {
  [void]$rs.Add((New-Chk 'evidence_schema' 'fail' ('generated evidence failed schema validation: ' + (@($schemaCheck.errors) -join '; '))))
}
$record.evidence_valid = [bool]$schemaCheck.valid

$overall = & $overallFrom @($rs)
$record.verdict = [ordered]@{
  overall = $overall
  reasons = @($rs | Where-Object { $_.result -ne 'ok' } | ForEach-Object { "[$($_.check)] $($_.reason)" })
  checks  = @($rs)
}

$outDir = Join-Path $repo '.cockpit/evidence'
$outPath = Join-Path $outDir 'release-gate.json'
# The receipt MUST persist. If the write fails (locked path, denied, full disk), the gate cannot
# claim a valid release record -> force FAIL rather than exiting green with no/partial evidence.
$writeOk = $true
try {
  if (-not (Test-Path -LiteralPath $outDir)) { New-Item -ItemType Directory -Path $outDir -Force -ErrorAction Stop | Out-Null }
  ($record | ConvertTo-Json -Depth 8) | Out-File -FilePath $outPath -Encoding utf8 -ErrorAction Stop
} catch { $writeOk = $false }
if (-not $writeOk -or -not (Test-Path -LiteralPath $outPath -PathType Leaf)) {
  $overall = 'FAIL'
  $record.verdict.overall = 'FAIL'
  $record.verdict.reasons = @(@($record.verdict.reasons) + '[evidence_write] failed to persist the release-gate receipt')
}

# --- report ---
if ($Json) {
  ($record | ConvertTo-Json -Depth 8)
} elseif (-not $Quiet) {
  Write-Host ''
  Write-Host "=== RELEASE GATE: $($record.verdict.overall) ==="
  Write-Host "commit: $shaStart   branch: $branch"
  if (@($record.verdict.reasons).Count -gt 0) {
    Write-Host 'Reasons (every non-PASS result):'
    foreach ($r in $record.verdict.reasons) { Write-Host "  - $r" }
  } else { Write-Host 'Every required result is positively proven for this exact commit.' }
  if (@($record.exceptions_applied).Count -gt 0) {
    Write-Host 'Disclosed approved exceptions applied:'
    foreach ($e in $record.exceptions_applied) { Write-Host "  - $($e.detector): $($e.reason)" }
  }
  Write-Host "receipt: $outPath"
}

switch ("$overall") { 'PASS' { exit 0 } 'FAIL' { exit 1 } default { exit 2 } }
