#requires -Version 7
<#
  check-canonical-constraints.ps1 — ONE checker for PCC's canonical cross-cutting constraints
  (ADR-0020 canonical-constraint enforcement). Invoked at TWO lifecycle points, never as two gates:

    -Phase Preflight   Called by the PreToolUse hook BEFORE a build worker mutates anything. Validates
                       that a VALID preflight plan exists and governs the current work. No final diff yet.
    -Phase Land        Called by the governance gate at commit. Validates the STAGED preflight, its
                       content digest, and (when a receipt exists) that the receipt binds that same
                       digest and the final diff_id.

  Policy source: .cockpit/state/canonical-constraints.json (schema-validated + drift-checked here).
  FAIL CLOSED: any missing/invalid/ambiguous input returns not-ok. Output: [PASS]/[FAIL] + exit 0/1,
  or -Json for a machine-readable object. Pure enough to dot-source in tests (functions have no side
  effects until Invoke-Main runs under `-Phase`).
#>
[CmdletBinding()]
param(
  [ValidateSet('Preflight', 'Land')][string]$Phase,
  [string]$RepoRoot,
  [string]$Baseline = 'main',
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

$RegistryPath = Join-Path $RepoRoot '.cockpit/state/canonical-constraints.json'
$RegistrySchema = Join-Path $RepoRoot 'schemas/canonical-constraints.schema.json'
$PreflightSchema = Join-Path $RepoRoot 'schemas/task-preflight.schema.json'
$PreflightDir = Join-Path $RepoRoot '.cockpit/preflight'
$LockPath = Join-Path $PreflightDir '.active-lock.json'
$ReceiptPath = Join-Path $RepoRoot '.cockpit/evidence/verification-receipt.json'

# Whitespace-normalize the way drift detection compares: collapse every run of whitespace (incl. line
# wraps) to a single space and trim. Wording changes fail; reflowing a paragraph does not.
function Get-CanonNormalized([string]$s) { return (($s -replace '\s+', ' ').Trim()) }

function Get-Sha256Hex([string]$text) {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return (($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') }) -join '') }
  finally { $sha.Dispose() }
}

# The immutable content digest of a preflight: full 64-char sha256 over its content with line endings
# normalized to LF, so a CRLF/LF flip between Windows and CI never changes the digest. Text and path
# variants share the SAME math so a working-tree digest and a staged/committed digest of identical content
# agree — which is what lets the receipt, the trailer, and the CI audit all reconcile.
function Get-PreflightDigestFromText([string]$text) { return (Get-Sha256Hex ($text -replace "`r`n", "`n")) }
function Get-PreflightDigest([string]$path) { return (Get-PreflightDigestFromText ([System.IO.File]::ReadAllText($path))) }

# The STAGED content of a path (git index), as it will actually be committed — NOT the working tree, which
# an attacker could keep valid while staging something else. $null if the path is not in the index.
function Get-StagedText([string]$relPath) {
  Push-Location $RepoRoot
  try {
    $raw = & git show ":$relPath" 2>$null
    if ($LASTEXITCODE -ne 0) { return $null }
    return (($raw -join "`n"))
  } finally { Pop-Location }
}

function Test-JsonAgainst([string]$path, [string]$schema) {
  if (-not (Test-Path $path)) { return $false }
  try { return [bool](Test-Json -Path $path -SchemaFile $schema -ErrorAction Stop) } catch { return $false }
}

# Load + schema-validate the registry. Throws (fail-closed) on any problem.
function Get-CanonRegistry {
  if (-not (Test-Path $RegistryPath)) { throw "canonical-constraints registry missing: $RegistryPath" }
  if (-not (Test-JsonAgainst $RegistryPath $RegistrySchema)) { throw "canonical-constraints registry fails its schema" }
  return (Get-Content -Raw $RegistryPath | ConvertFrom-Json)
}

# Drift check: every cited canonical statement must still exist verbatim in its source doc, and the
# registry's stored hash must match the stored statement (tamper check). Fail closed on any mismatch.
function Test-CanonDrift($registry) {
  $reasons = @()
  foreach ($c in $registry.constraints) {
    $src = Join-Path $RepoRoot $c.source_path
    if (-not (Test-Path $src)) { $reasons += "$($c.id): source $($c.source_path) missing"; continue }
    $normStmt = Get-CanonNormalized $c.statement
    if ((Get-Sha256Hex $normStmt) -ne $c.statement_sha256) { $reasons += "$($c.id): registry statement hash mismatch (tampered registry)"; continue }
    $docRaw = Get-Content -Raw $src
    $region = $docRaw
    if ($c.section) {
      # Narrow to the cited section: from its heading to the next heading of the same-or-higher level.
      $lines = $docRaw -split "`n"
      $level = ($c.section -replace '[^#].*$', '').Length
      $start = -1
      for ($i = 0; $i -lt $lines.Count; $i++) { if ((Get-CanonNormalized $lines[$i]) -eq (Get-CanonNormalized $c.section)) { $start = $i; break } }
      if ($start -lt 0) { $reasons += "$($c.id): section '$($c.section)' not found in $($c.source_path)"; continue }
      $end = $lines.Count
      for ($i = $start + 1; $i -lt $lines.Count; $i++) {
        $m = [regex]::Match($lines[$i], '^(#{1,6})\s')
        if ($m.Success -and $m.Groups[1].Value.Length -le $level) { $end = $i; break }
      }
      $region = ($lines[$start..($end - 1)] -join "`n")
    }
    if (-not (Get-CanonNormalized $region).Contains($normStmt)) {
      $reasons += "$($c.id): canonical statement not found under '$($c.section ?? 'document')' in $($c.source_path) — the rule was reworded/removed without updating the registry"
    }
  }
  return @{ ok = ($reasons.Count -eq 0); reasons = $reasons }
}

# The constraint ids that must be applied for a change, minus any with a recorded owner-authorized exception.
function Get-RequiredConstraintIds($registry, $preflight) {
  $required = @($registry.constraints | Where-Object { $registry.default_on } | ForEach-Object { $_.id })
  $exempted = @()
  if ($preflight -and $preflight.exceptions) {
    foreach ($e in $preflight.exceptions) { if ($e.owner_authorization) { $exempted += $e.constraint_id } }
  }
  return @($required | Where-Object { $exempted -notcontains $_ })
}

# Validate one preflight file's content (schema + constraint coverage). Digest binding is checked by the
# phase functions. Returns @{ ok; reasons; preflight }.
function Test-PreflightContent([string]$path, $registry) {
  $reasons = @()
  if (-not (Test-Path $path)) { return @{ ok = $false; reasons = @("preflight file missing: $path"); preflight = $null } }
  if (-not (Test-JsonAgainst $path $PreflightSchema)) { return @{ ok = $false; reasons = @("preflight fails task-preflight schema: $path"); preflight = $null } }
  $pf = Get-Content -Raw $path | ConvertFrom-Json
  $need = Get-RequiredConstraintIds $registry $pf
  $have = @($pf.constraints_applied)
  foreach ($id in $need) { if ($have -notcontains $id) { $reasons += "missing required constraint in constraints_applied: $id" } }
  # TOKEN_THRIFT: if a matched benchmark is required, the usage_plan must say so truthfully.
  if (($have -contains 'TOKEN_THRIFT_LOCAL_FIRST') -and $pf.usage_plan.matched_benchmark_required -and (-not $pf.usage_plan.matched_benchmark_reason)) {
    $reasons += 'usage_plan.matched_benchmark_required is true but no matched_benchmark_reason is recorded'
  }
  return @{ ok = ($reasons.Count -eq 0); reasons = $reasons; preflight = $pf }
}

function Get-StagedFiles {
  Push-Location $RepoRoot
  try { return @(git diff --cached --no-renames --name-only $Baseline -- . 2>$null | Where-Object { $_ }) }
  finally { Pop-Location }
}

# ---- Phase PREFLIGHT: is there a VALID active preflight governing current work? (hook consumer) ----
function Invoke-Preflight($registry) {
  $reasons = @()
  if (-not (Test-Path $LockPath)) { return @{ ok = $false; reasons = @('no active preflight lock — record a preflight first'); state = 'no_lock' } }
  $lock = $null
  try { $lock = Get-Content -Raw $LockPath | ConvertFrom-Json } catch { return @{ ok = $false; reasons = @('active-lock is unreadable'); state = 'bad_lock' } }
  if (-not $lock.task_id -or -not $lock.preflight_digest) { return @{ ok = $false; reasons = @('active-lock missing task_id or preflight_digest'); state = 'bad_lock' } }
  $pfPath = Join-Path $PreflightDir ($lock.task_id + '.json')
  $content = Test-PreflightContent $pfPath $registry
  if (-not $content.ok) { return @{ ok = $false; reasons = $content.reasons; state = 'invalid_preflight' } }
  $digest = Get-PreflightDigest $pfPath
  if ($digest -ne $lock.preflight_digest) {
    $reasons += 'preflight content changed after the lock was taken (digest mismatch) — establish a new task/preflight'
    return @{ ok = $false; reasons = $reasons; state = 'digest_mismatch' }
  }
  return @{ ok = $true; reasons = @(); state = 'valid'; task_id = $lock.task_id; preflight_digest = $digest }
}

# ---- Phase LAND: validate the STAGED preflight + digest/diff binding at commit (gate consumer) ----
function Invoke-Land($registry) {
  $reasons = @()
  $staged = Get-StagedFiles
  $pfStaged = @($staged | Where-Object { $_ -match '^\.cockpit/preflight/[^/]+\.json$' })
  if ($pfStaged.Count -eq 0) {
    # Allow the case where the governing preflight is already in HEAD (committed by an earlier commit of
    # the same task) by falling back to the active lock's task_id.
    if (Test-Path $LockPath) {
      try { $lock = Get-Content -Raw $LockPath | ConvertFrom-Json; $pfStaged = @('.cockpit/preflight/' + $lock.task_id + '.json') } catch {}
    }
  }
  if ($pfStaged.Count -eq 0) { return @{ ok = $false; reasons = @('no preflight staged or active for this change (canonical constraints require one for T0-T3)'); state = 'no_preflight' } }
  if ($pfStaged.Count -gt 1) { return @{ ok = $false; reasons = @("more than one preflight staged: $($pfStaged -join ', ')"); state = 'ambiguous' } }

  # Validate + digest the STAGED content (git index) — what will actually be committed — never the working
  # tree (which an attacker could keep valid while staging an invalid blob). codex-caught.
  $rel = $pfStaged[0]
  $stagedText = Get-StagedText $rel
  if ($null -eq $stagedText) { return @{ ok = $false; reasons = @("preflight $rel is not in the git index (stage it)"); state = 'no_preflight' } }
  $tmp = [System.IO.Path]::GetTempFileName()
  try {
    [System.IO.File]::WriteAllText($tmp, $stagedText)
    $content = Test-PreflightContent $tmp $registry
  } finally { Remove-Item -LiteralPath $tmp -ErrorAction SilentlyContinue }
  if (-not $content.ok) { return @{ ok = $false; reasons = $content.reasons; state = 'invalid_preflight' } }
  $digest = Get-PreflightDigestFromText $stagedText
  $task_id = $content.preflight.task_id

  # If a receipt is present (T0/T1 path), it MUST bind this preflight's digest — that is the durable,
  # CI-provable chain. Absent receipt (T2/T3) leaves a valid committed preflight as the bar.
  if (Test-Path $ReceiptPath) {
    try { $rc = Get-Content -Raw $ReceiptPath | ConvertFrom-Json } catch { $rc = $null }
    if ($rc -and $rc.preflight_digest) {
      if ($rc.preflight_digest -ne $digest) { $reasons += 'verification receipt binds a different preflight_digest than the staged preflight' }
      if ($rc.preflight_task_id -and $rc.preflight_task_id -ne $task_id) { $reasons += 'verification receipt binds a different preflight task_id' }
    }
  }
  if ($reasons.Count) { return @{ ok = $false; reasons = $reasons; state = 'receipt_mismatch' } }
  return @{ ok = $true; reasons = @(); state = 'valid'; task_id = $task_id; preflight_digest = $digest }
}

function Invoke-Main {
  $result = [ordered]@{ schema = 'canonical-constraints-check/v1'; phase = $Phase; ok = $false; state = ''; reasons = @() }
  try {
    $registry = Get-CanonRegistry
  } catch { $result.state = 'registry_error'; $result.reasons = @($_.Exception.Message); return $result }

  $drift = Test-CanonDrift $registry
  if (-not $drift.ok) { $result.state = 'drift'; $result.reasons = $drift.reasons; return $result }

  $phaseResult = if ($Phase -eq 'Preflight') { Invoke-Preflight $registry } else { Invoke-Land $registry }
  $result.ok = $phaseResult.ok
  $result.state = $phaseResult.state
  $result.reasons = $phaseResult.reasons
  if ($phaseResult.task_id) { $result.task_id = $phaseResult.task_id }
  if ($phaseResult.preflight_digest) { $result.preflight_digest = $phaseResult.preflight_digest }
  return $result
}

# Only run when executed directly (dot-sourcing for tests exposes the functions without side effects).
if ($MyInvocation.InvocationName -ne '.' -and $Phase) {
  $r = Invoke-Main
  if ($Json) { $r | ConvertTo-Json -Depth 6 }
  else {
    if ($r.ok) { Write-Host "[PASS] canonical-constraints $Phase — $($r.state)" }
    else { Write-Host "[FAIL] canonical-constraints $Phase — $($r.state)"; foreach ($x in $r.reasons) { Write-Host "  - $x" } }
  }
  exit ([int](-not $r.ok))
}
