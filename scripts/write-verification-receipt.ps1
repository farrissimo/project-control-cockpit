<#
  write-verification-receipt.ps1 — record a verification VERDICT bound to the exact change in
  flight (ADR-0006 §10.1). The governor gate (scripts/run-governance-gate.ps1) will only let a
  T0/T1 change commit if a valid receipt written by THIS script matches the current diff.

  It does NOT run the verifier and does NOT judge the work — it CONSUMES a verdict handed to it
  (from `codex exec`, the owner, or CI) and binds it to the change identity computed by the ONE
  shared helper (scripts/lib/change-identity.ps1), the same helper the gate uses. So a receipt
  written immediately before an unchanged-tree commit always matches; touch one more tracked
  line afterwards and the diff_id changes and the receipt no longer applies.

  HONEST SCOPE: the receipt is worker-attested. This script writes whatever verdict it is given.
  It raises the floor — a T0/T1 change can no longer be committed with NO diff-bound proof at all
  — but the un-bypassable proof of "verified" remains CI + GitHub branch protection, not this
  local artifact. See docs/specs/governor-gate.md "Honest residue."

  Params:
    -Verifier <string>   (required) who produced the verdict, e.g. 'codex exec', 'owner', 'ci'.
    -Verdict  <string>   (required) PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE.
    -Checks   <json>     (optional) JSON array of { name, result, detail } check records. If
                         omitted, a single 'independent_verification' check is derived from -Verdict.
    -ExpiresInHours <int>(optional) receipt expiry; omitted => no expiry.
    -Baseline <ref>      (default 'main') comparison base for the change identity + classifier.
    -Json                machine-readable output.
#>
param(
  [Parameter(Mandatory = $true)][string]$Verifier,
  [Parameter(Mandatory = $true)][ValidateSet('PASS', 'FAIL', 'INSUFFICIENT', 'BLOCKED', 'OUT_OF_SCOPE')][string]$Verdict,
  [string]$Checks,
  [int]$ExpiresInHours = 0,
  [string]$Baseline = 'main',
  [switch]$Json
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
. (Join-Path $PSScriptRoot 'lib/change-identity.ps1')
. (Join-Path $PSScriptRoot 'lib/atomic-write.ps1')

$id = Get-ChangeIdentity -Baseline $Baseline

# The tier this receipt covers, from the shipped classifier over the EXACT staged change
# (a git fact, not a self-rating) — the same computation the gate uses.
$tierInfo = Get-ChangeTier -Identity $id -RepoRoot $repo
$tier = $tierInfo.tier

# Checks: caller-supplied JSON array, or a single derived check from the verdict.
$checkList = @()
if ($Checks) {
  try { $checkList = @($Checks | ConvertFrom-Json) } catch { throw "-Checks is not valid JSON: $($_.Exception.Message)" }
} else {
  $res = if ($Verdict -eq 'PASS') { 'pass' } else { 'fail' }
  $checkList = @([ordered]@{ name = 'independent_verification'; result = $res; detail = "verifier '$Verifier' returned $Verdict" })
}

$repoId = (& git config --get remote.origin.url 2>$null)
if (-not $repoId) { $repoId = Split-Path -Leaf (& git rev-parse --show-toplevel 2>$null) }
if (-not $repoId) { $repoId = 'unknown-repo' }

$now = Get-Date
$expiresAt = $null
if ($ExpiresInHours -gt 0) { $expiresAt = $now.AddHours($ExpiresInHours).ToString('o') }

$receipt = [ordered]@{
  schema          = 'verification-receipt/v1'
  generated_at    = $now.ToString('o')
  repo            = "$repoId".Trim()
  base            = $id.base
  head            = $id.head
  tree            = $id.tree
  diff_id         = $id.diff_id
  tree_dirty      = [bool]$id.tree_dirty
  tier            = $tier
  required_checks = @('independent_verification')
  checks          = @($checkList)
  verifier        = $Verifier
  verdict         = $Verdict
  expires_at      = $expiresAt
  baseline        = $Baseline
  not_proven      = 'This binds a handed-in verdict to the exact diff. It does not itself prove the verification happened or was correct — the receipt is worker-attested; CI + branch protection are the un-bypassable proof.'
}

$outPath = '.cockpit/evidence/verification-receipt.json'
$jsonText = ($receipt | ConvertTo-Json -Depth 8)
Write-JsonAtomic -Path $outPath -Json $jsonText

if ($Json) { $jsonText }
else {
  Write-Host "Verification receipt written: $outPath"
  Write-Host "  tier=$tier  verdict=$Verdict  verifier=$Verifier"
  Write-Host "  base=$($id.base.Substring(0,[Math]::Min(12,$id.base.Length)))  head=$($id.head.Substring(0,[Math]::Min(12,$id.head.Length)))  diff_id=$($id.diff_id.Substring(0,12))…"
  if ($expiresAt) { Write-Host "  expires_at=$expiresAt" }
}
exit 0
