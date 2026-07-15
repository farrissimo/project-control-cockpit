<#
  receipt-check.ps1 — dot-sourced. The ONE validator for "is there a valid verification receipt
  bound to THIS change?", shared by the Gate (scripts/run-governance-gate.ps1) and the trailer
  emitter (scripts/emit-verification-trailer.ps1) so they can never disagree about what "valid"
  means. Consumes the receipt (ADR-0006/0007); never re-runs the verifier.

  Test-TimestampExpired($val): UTC-instant comparison. Absent/blank => not expired. A PRESENT but
  unparseable value => EXPIRED (fail closed) — never silently accepted as "no expiry". (ConvertFrom-Json
  yields a UTC-kind [datetime]; stringify+reparse would reinterpret it as local and shift the instant.)

  Test-ReceiptValid -Id <change-identity> -Tier <T0..T4> -ReceiptPath <path> -SchemaPath <path>:
    returns @{ ok=<bool>; reason=<string>; state=<slug>; receipt=<obj|null> }. ok=$true only when the
    receipt exists, matches its schema, binds to the current base+head+diff_id, is not expired, has
    verdict PASS + a non-empty verifier, and covers a tier >= the current one.
#>

function Test-TimestampExpired($val) {
  if ($null -eq $val -or "$val".Trim() -eq '') { return $false }
  try {
    if ($val -is [datetime]) { return ($val.ToUniversalTime() -lt [datetime]::UtcNow) }
    $eo = [datetimeoffset]::Parse([string]$val, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal)
    return ($eo.UtcDateTime -lt [datetime]::UtcNow)
  } catch { return $true }
}

function Test-ReceiptValid {
  param(
    [Parameter(Mandatory = $true)]$Id,
    [Parameter(Mandatory = $true)][string]$Tier,
    [Parameter(Mandatory = $true)][string]$ReceiptPath,
    [Parameter(Mandatory = $true)][string]$SchemaPath
  )
  $rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0; 'UNKNOWN' = 5 }
  if (-not (Test-Path -LiteralPath $ReceiptPath -PathType Leaf)) { return @{ ok = $false; reason = "no verification receipt at $ReceiptPath"; state = 'missing'; receipt = $null } }
  $schemaValid = $false
  try { $schemaValid = Test-Json -Path $ReceiptPath -SchemaFile $SchemaPath -ErrorAction Stop } catch { $schemaValid = $false }
  if (-not $schemaValid) { return @{ ok = $false; reason = 'receipt does not match verification-receipt.schema.json'; state = 'schema_invalid'; receipt = $null } }
  $r = $null
  try { $r = Get-Content -Raw -LiteralPath $ReceiptPath | ConvertFrom-Json } catch { return @{ ok = $false; reason = 'receipt is unreadable JSON'; state = 'unreadable'; receipt = $null } }

  if ("$($r.diff_id)" -ne "$($Id.diff_id)") { return @{ ok = $false; reason = 'receipt diff_id does not match this change (stale — written for a different diff)'; state = 'stale_diff'; receipt = $r } }
  if ("$($r.base)" -ne "$($Id.base)") { return @{ ok = $false; reason = 'receipt base commit does not match this change'; state = 'stale_base'; receipt = $r } }
  if ("$($r.head)" -ne "$($Id.head)") { return @{ ok = $false; reason = 'receipt head commit does not match this change'; state = 'stale_head'; receipt = $r } }
  if ("$($r.verdict)" -ne 'PASS') { return @{ ok = $false; reason = "receipt verdict is '$($r.verdict)', not PASS"; state = 'not_pass'; receipt = $r } }
  if ([string]::IsNullOrWhiteSpace("$($r.verifier)")) { return @{ ok = $false; reason = 'receipt has no verifier identity'; state = 'no_verifier'; receipt = $r } }
  if (Test-TimestampExpired $r.expires_at) { return @{ ok = $false; reason = "receipt expired at $($r.expires_at)"; state = 'expired'; receipt = $r } }
  $rTierRank = if ($rank.ContainsKey("$($r.tier)")) { $rank["$($r.tier)"] } else { -1 }
  $curRank = if ($rank.ContainsKey($Tier)) { $rank[$Tier] } else { 5 }
  if ($rTierRank -lt $curRank) { return @{ ok = $false; reason = "receipt covers tier $($r.tier), below this change's tier $Tier"; state = 'lower_tier'; receipt = $r } }
  return @{ ok = $true; reason = "valid receipt: verifier '$($r.verifier)' PASS, bound to this diff"; state = 'valid'; receipt = $r }
}

# Parse a ledger JSON blob and return the matching, non-expired exception for $DiffId (or $null).
# Shared so the Gate/emitter (index ledger) and the audit (a commit's ledger) apply IDENTICAL rules.
function Find-BypassInLedgerText([string]$jsonText, [string]$DiffId) {
  if ([string]::IsNullOrWhiteSpace($jsonText)) { return $null }
  $ex = $null
  try { $ex = $jsonText | ConvertFrom-Json } catch { return $null }
  if (-not $ex -or -not $ex.exceptions) { return $null }
  foreach ($e in @($ex.exceptions)) {
    if ("$($e.diff_id)" -eq "$DiffId") {
      if (Test-TimestampExpired $e.expires_at) { continue }
      return $e
    }
  }
  return $null
}

# The disclosed-bypass lookup for the Gate + emitter: reads the ledger from the STAGED INDEX
# (`git show :<path>`) — never the working tree — so a bypass only counts once staged (committed,
# auditable). Returns the matching, non-expired exception for $DiffId, or $null.
function Get-StagedBypass {
  param([Parameter(Mandatory = $true)][string]$DiffId, [Parameter(Mandatory = $true)][string]$LedgerPath)
  $raw = & git show ":$LedgerPath" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
  return Find-BypassInLedgerText (($raw -join "`n")) $DiffId
}

# The disclosed-bypass lookup for the AUDIT: reads the ledger AS OF a specific commit
# (`git show <commit>:<path>`) so a `verdict=BYPASS` trailer is honoured ONLY when that commit
# actually carries the matching disclosed exception in history — a hand-written BYPASS trailer with
# no committed ledger entry does NOT pass.
function Get-CommitBypass {
  param([Parameter(Mandatory = $true)][string]$Commit, [Parameter(Mandatory = $true)][string]$DiffId, [Parameter(Mandatory = $true)][string]$LedgerPath)
  $raw = & git show "${Commit}:$LedgerPath" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
  return Find-BypassInLedgerText (($raw -join "`n")) $DiffId
}
