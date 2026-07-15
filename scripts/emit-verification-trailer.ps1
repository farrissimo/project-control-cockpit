<#
  emit-verification-trailer.ps1 (ADR-0007) — print the durable `Verified-Receipt:` trailer for the
  EXACT staged change, or nothing. Called by .githooks/commit-msg, so the proof of verification is
  recorded IN the commit (immutable, pushed with history, re-derivable by the CI audit).

  It reuses the SAME authorities the Gate uses (scripts/lib/change-identity.ps1 for identity/tier,
  scripts/lib/receipt-check.ps1 for receipt validity + disclosed bypass), so a trailer is emitted
  exactly when the Gate would allow a crucial commit — never out of step with it.

  Emits (T0/T1 only — T2/T3/T4 need no trailer and get none):
    valid PASS receipt bound to this diff -> `Verified-Receipt: base=<b> diff_id=<d> verdict=PASS verifier=<v>`
    disclosed staged bypass for this diff -> `Verified-Receipt: base=<b> diff_id=<d> verdict=BYPASS verifier=<authorized_by>`
  Field order is fixed (base, diff_id, verdict, verifier) and `verifier` is the LAST field so it may
  contain spaces without breaking the audit parser. Prints NOTHING (exit 0) otherwise; emitting a
  trailer is never a gate — the Gate already decided whether the commit may proceed.

  Params: -Baseline <ref> (default 'main').
#>
param([string]$Baseline = 'main')

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
. (Join-Path $PSScriptRoot 'lib/change-identity.ps1')
. (Join-Path $PSScriptRoot 'lib/receipt-check.ps1')

$receiptPath = '.cockpit/evidence/verification-receipt.json'
$receiptSchema = 'schemas/verification-receipt.schema.json'
$exceptionsPath = '.cockpit/state/governance-gate-exceptions.json'
$rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0; 'UNKNOWN' = 5 }

$id = Get-ChangeIdentity -Baseline $Baseline
$tierInfo = Get-ChangeTier -Identity $id -RepoRoot $repo
$tier = $tierInfo.tier

# Only crucial (T0/T1) commits carry a trailer — the same set the CI audit requires one for.
if (-not $rank.ContainsKey($tier) -or $rank[$tier] -lt $rank['T1']) { exit 0 }

function Format-Verifier([string]$v) {
  $v = "$v" -replace '[\r\n]', ' '
  $v = $v.Trim()
  if ($v.Length -eq 0) { $v = 'unknown' }
  return $v
}

$rc = Test-ReceiptValid -Id $id -Tier $tier -ReceiptPath $receiptPath -SchemaPath $receiptSchema
if ($rc.ok) {
  $v = Format-Verifier "$($rc.receipt.verifier)"
  Write-Output "Verified-Receipt: base=$($id.base) diff_id=$($id.diff_id) verdict=PASS verifier=$v"
  exit 0
}

# No valid receipt — but a disclosed, staged bypass for this exact diff is itself a durable, recorded
# exception; carry it into the commit (and thus to CI) as verdict=BYPASS so it stays auditable.
$bypass = Get-StagedBypass -DiffId $id.diff_id -LedgerPath $exceptionsPath
if ($bypass) {
  $v = Format-Verifier "$($bypass.authorized_by)"
  Write-Output "Verified-Receipt: base=$($id.base) diff_id=$($id.diff_id) verdict=BYPASS verifier=$v"
}
exit 0
