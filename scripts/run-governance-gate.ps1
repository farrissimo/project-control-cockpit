<#
  run-governance-gate.ps1 — the governor's TEETH at the commit boundary (ADR-0006 "Gate").

  It blocks a commit ONLY when a tagged-crucial (T0/T1) change lacks a valid, diff-bound
  verification receipt. T2/T3/T4 changes pass untouched (proportional by construction — the
  anti-CCB guardrail). It is a THIN CONSUMER: it re-uses scripts/classify-stakes.ps1 for the
  tier and scripts/lib/change-identity.ps1 for the binding; it never re-derives "what changed"
  or "is it verified," and runs no LLM.

  Policy:
    tier UNKNOWN        -> BLOCK  (fail closed: an unclassifiable change is treated as crucial)
    tier T2 / T3 / T4   -> PASS   (not gated at commit; normal proof is enforced by CI + PR)
    tier T0 / T1        -> require a valid receipt (scripts/write-verification-receipt.ps1):
        present + schema-valid + bound to the current base/head/diff_id + not expired +
        verdict PASS + non-empty verifier + covers a tier >= this one  -> PASS
        otherwise                                                       -> BLOCK

  A used bypass is a durable, structured exception bound to the exact diff_id
  (.cockpit/state/governance-gate-exceptions.json) — never invisible; it is disclosed in the
  run receipt. `git commit --no-verify` remains an escape hatch, but GitHub branch protection
  (CI + PR) is the un-bypassable server-side backstop no local bypass can escape.

  Exit: 0 = allow the commit, 1 = block. (A BLOCK is fail-closed; never allow on error.)

  Params: -Baseline <ref> (default 'main'), -Json (machine-readable run receipt to stdout).
#>
param(
  [string]$Baseline = 'main',
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
. (Join-Path $PSScriptRoot 'lib/change-identity.ps1')

$rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0; 'UNKNOWN' = 5 }
$receiptPath = '.cockpit/evidence/verification-receipt.json'
$receiptSchema = 'schemas/verification-receipt.schema.json'
$exceptionsPath = '.cockpit/state/governance-gate-exceptions.json'
$runReceiptPath = '.cockpit/evidence/governance-gate.json'

# Expiry compared as UTC INSTANTS. ConvertFrom-Json turns an ISO string into a UTC-kind
# [datetime]; stringifying then re-parsing it would silently reinterpret it as local time and
# shift the instant. So compare the parsed value directly against UtcNow instead. A PRESENT but
# unparseable expires_at is treated as EXPIRED (fail closed) — never accepted as "no expiry".
function Test-TimestampExpired($val) {
  if ($null -eq $val -or "$val".Trim() -eq '') { return $false }  # absent => no expiry
  try {
    if ($val -is [datetime]) { return ($val.ToUniversalTime() -lt [datetime]::UtcNow) }
    $eo = [datetimeoffset]::Parse([string]$val, [System.Globalization.CultureInfo]::InvariantCulture, [System.Globalization.DateTimeStyles]::AssumeUniversal)
    return ($eo.UtcDateTime -lt [datetime]::UtcNow)
  } catch { return $true }  # present but garbage => fail closed (treat as expired)
}

$id = Get-ChangeIdentity -Baseline $Baseline

# --- tier of the EXACT staged change (the classifier is the single authority; consume it) ---
$tierInfo = Get-ChangeTier -Identity $id -RepoRoot $repo
$tier = $tierInfo.tier
$classifyOk = ($tier -ne 'UNKNOWN' -or $tierInfo.empty)

$reasons = @()
$verdict = $null      # 'PASS' | 'BLOCK'
$receiptState = 'not_required'

function Read-Receipt {
  if (-not (Test-Path -LiteralPath $receiptPath -PathType Leaf)) { return @{ ok = $false; reason = "no verification receipt at $receiptPath"; state = 'missing' } }
  $schemaValid = $false
  try { $schemaValid = Test-Json -Path $receiptPath -SchemaFile $receiptSchema -ErrorAction Stop } catch { $schemaValid = $false }
  if (-not $schemaValid) { return @{ ok = $false; reason = 'receipt does not match verification-receipt.schema.json'; state = 'schema_invalid' } }
  $r = $null
  try { $r = Get-Content -Raw -LiteralPath $receiptPath | ConvertFrom-Json } catch { return @{ ok = $false; reason = 'receipt is unreadable JSON'; state = 'unreadable' } }

  if ("$($r.diff_id)" -ne "$($id.diff_id)") { return @{ ok = $false; reason = "receipt diff_id does not match this change (stale — written for a different diff)"; state = 'stale_diff'; receipt = $r } }
  if ("$($r.base)" -ne "$($id.base)") { return @{ ok = $false; reason = 'receipt base commit does not match this change'; state = 'stale_base'; receipt = $r } }
  if ("$($r.head)" -ne "$($id.head)") { return @{ ok = $false; reason = 'receipt head commit does not match this change'; state = 'stale_head'; receipt = $r } }
  if ("$($r.verdict)" -ne 'PASS') { return @{ ok = $false; reason = "receipt verdict is '$($r.verdict)', not PASS"; state = 'not_pass'; receipt = $r } }
  if ([string]::IsNullOrWhiteSpace("$($r.verifier)")) { return @{ ok = $false; reason = 'receipt has no verifier identity'; state = 'no_verifier'; receipt = $r } }
  if (Test-TimestampExpired $r.expires_at) { return @{ ok = $false; reason = "receipt expired at $($r.expires_at)"; state = 'expired'; receipt = $r } }
  $rTierRank = if ($rank.ContainsKey("$($r.tier)")) { $rank["$($r.tier)"] } else { -1 }
  $curRank = $rank[$tier]
  if ($rTierRank -lt $curRank) { return @{ ok = $false; reason = "receipt covers tier $($r.tier), below this change's tier $tier"; state = 'lower_tier'; receipt = $r } }
  return @{ ok = $true; reason = "valid receipt: verifier '$($r.verifier)' PASS, bound to this diff"; state = 'valid'; receipt = $r }
}

# --- exact-diff_id bypass (loud, disclosed; never a silent escape) ---
# The ledger is read from the STAGED INDEX (`git show :<path>`), NOT the working tree — so a bypass
# only counts once it is staged (i.e. committed with the change), landing it in git history where
# it is auditable. An unstaged/untracked ledger edit returns the committed version (or nothing) and
# grants no bypass. This closes the hole where a working-tree-only ledger could authorize invisibly.
$exceptionApplied = $null
function Find-Exception {
  $raw = & git show ":$exceptionsPath" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $raw) { return $null }
  $ex = $null
  try { $ex = ($raw -join "`n") | ConvertFrom-Json } catch { return $null }
  if (-not $ex -or -not $ex.exceptions) { return $null }
  foreach ($e in @($ex.exceptions)) {
    if ("$($e.diff_id)" -eq "$($id.diff_id)") {
      if (Test-TimestampExpired $e.expires_at) { continue }
      return $e
    }
  }
  return $null
}

# --- decide ---
if ($tier -eq 'NONE') {
  $verdict = 'PASS'; $receiptState = 'not_required'
  $reasons += 'nothing staged for commit — nothing to gate'
} elseif (-not $classifyOk -or $tier -eq 'UNKNOWN') {
  $verdict = 'BLOCK'; $receiptState = 'na'
  $reasons += 'change tier is UNKNOWN (classifier missing/malformed or manifest absent) — failing closed'
} elseif ($rank[$tier] -lt $rank['T1']) {
  $verdict = 'PASS'; $receiptState = 'not_required'
  $reasons += "tier $tier — not gated at commit (proportional); normal proof is enforced by CI + PR"
} else {
  $rc = Read-Receipt
  $receiptState = $rc.state
  if ($rc.ok) { $verdict = 'PASS'; $reasons += $rc.reason }
  else { $verdict = 'BLOCK'; $reasons += "T0/T1 change without valid proof: $($rc.reason)" }
}

# a bypass can only turn a BLOCK into an allow, and only for THIS exact diff
if ($verdict -eq 'BLOCK') {
  $exceptionApplied = Find-Exception
  if ($exceptionApplied) {
    $verdict = 'PASS'
    $reasons += "BYPASS APPLIED (disclosed): $($exceptionApplied.reason) — authorized_by '$($exceptionApplied.authorized_by)'"
  }
}

# --- run receipt (git-ignored evidence of this gate run) ---
$run = [ordered]@{
  schema        = 'governance-gate/v1'
  generated_at  = (Get-Date).ToString('o')
  baseline      = $Baseline
  base          = $id.base
  head          = $id.head
  tree          = $id.tree
  diff_id       = $id.diff_id
  tree_dirty    = [bool]$id.tree_dirty
  tier          = $tier
  receipt_state = $receiptState
  bypass        = if ($exceptionApplied) { [ordered]@{ diff_id = "$($exceptionApplied.diff_id)"; reason = "$($exceptionApplied.reason)"; authorized_by = "$($exceptionApplied.authorized_by)" } } else { $null }
  verdict       = $verdict
  reasons       = @($reasons)
}
try {
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $runReceiptPath) | Out-Null
  ($run | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath $runReceiptPath -Encoding UTF8
} catch {}

# --- output ---
if ($Json) { $run | ConvertTo-Json -Depth 8 }
else {
  if ($verdict -eq 'PASS') {
    Write-Host "[governor] PASS — tier $tier."
    foreach ($r in $reasons) { Write-Host "  - $r" }
  } else {
    Write-Host "[governor] BLOCK — tier $tier change is missing its required proof."
    foreach ($r in $reasons) { Write-Host "  - $r" }
    Write-Host ""
    Write-Host "  To proceed, either:"
    Write-Host "    1) verify this exact change and record it:"
    Write-Host "         pwsh -NoProfile -File scripts/write-verification-receipt.ps1 -Verifier 'codex exec' -Verdict PASS"
    Write-Host "       (run your independent verification FIRST; the receipt binds to this exact diff)"
    Write-Host "    2) record a disclosed bypass in $exceptionsPath (bound to this diff_id), or"
    Write-Host "    3) git commit --no-verify  (loud, and CI + branch protection still gate the PR)"
  }
}

if ($verdict -eq 'PASS') { exit 0 } else { exit 1 }
