#requires -Version 7
<#
  write-task-preflight.ps1 — the ONE narrow operation that blesses a task preflight and records the
  local digest lock. It is NOT general write authority: it validates the single artifact
  `.cockpit/preflight/<task_id>.json`, then writes `.cockpit/preflight/.active-lock.json` binding that
  task_id to the artifact's FULL sha256 digest. Fails closed on anything unexpected.

  Flow: a build worker (pre-implementation) writes .cockpit/preflight/<task_id>.json — the PreToolUse
  hook permits ONLY that path and this script — then runs this script to validate + lock. Once locked,
  the hook permits normal mutation. Hand-editing the preflight afterwards changes its digest, so the
  lock no longer matches and the hook blocks further mutation until this script re-locks it (or a new
  task_id is established).
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$TaskId,
  [string]$RepoRoot,
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
if (-not $RepoRoot) { $RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path }

. (Join-Path $PSScriptRoot 'check-canonical-constraints.ps1') -RepoRoot $RepoRoot 6>$null

$PreflightDir = Join-Path $RepoRoot '.cockpit/preflight'
$LockPath = Join-Path $PreflightDir '.active-lock.json'

function Fail([string]$msg) {
  if ($Json) { [ordered]@{ ok = $false; reason = $msg } | ConvertTo-Json }
  else { Write-Host "[FAIL] write-task-preflight — $msg" }
  exit 1
}

# Traversal / injection guard: task_id must be a bare slug, never a path fragment.
if ($TaskId -notmatch '^[a-z0-9][a-z0-9._-]{2,63}$') { Fail "invalid task_id '$TaskId' (must match ^[a-z0-9][a-z0-9._-]{2,63}$; no path separators)" }
if ($TaskId -match '\.\.' -or $TaskId -match '[\\/]') { Fail "task_id contains a path traversal or separator" }

$pfPath = Join-Path $PreflightDir ($TaskId + '.json')
# Resolve and confirm the target stays strictly inside the preflight dir (defence in depth).
$fullDir = [System.IO.Path]::GetFullPath($PreflightDir + [System.IO.Path]::DirectorySeparatorChar)
$fullPf = [System.IO.Path]::GetFullPath($pfPath)
if (-not $fullPf.StartsWith($fullDir, [System.StringComparison]::OrdinalIgnoreCase)) { Fail 'resolved preflight path escapes .cockpit/preflight' }
if (-not (Test-Path $pfPath)) { Fail "preflight artifact not found: .cockpit/preflight/$TaskId.json (write it first, then run this to lock it)" }

# Validate content via the same checker logic the gate uses (schema + required constraints + drift).
$registry = Get-CanonRegistry
$drift = Test-CanonDrift $registry
if (-not $drift.ok) { Fail ("canonical registry drift — refusing to lock: " + ($drift.reasons -join '; ')) }
$content = Test-PreflightContent $pfPath $registry
if (-not $content.ok) { Fail ("preflight invalid — " + ($content.reasons -join '; ')) }
if ($content.preflight.task_id -ne $TaskId) { Fail "preflight task_id ('$($content.preflight.task_id)') does not match the filename ('$TaskId')" }

$digest = Get-PreflightDigest $pfPath

# Write the lock atomically (temp + move), with the FULL 64-char digest — never truncated.
if (-not (Test-Path $PreflightDir)) { New-Item -ItemType Directory -Force $PreflightDir | Out-Null }
$lock = [ordered]@{
  lock_id          = 'canonical-preflight-lock-v1'
  task_id          = $TaskId
  preflight_digest = $digest
  base             = $content.preflight.base
}
$tmp = $LockPath + '.tmp'
Set-Content -Path $tmp -Value ($lock | ConvertTo-Json -Depth 5) -Encoding utf8 -NoNewline
Move-Item -Force $tmp $LockPath

if ($Json) { [ordered]@{ ok = $true; task_id = $TaskId; preflight_digest = $digest } | ConvertTo-Json }
else { Write-Host "[PASS] preflight locked: $TaskId @ $digest" }
exit 0
