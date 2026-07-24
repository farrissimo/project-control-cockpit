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
  (CI + PR) is the server-side backstop. That backstop is un-bypassable ONLY IF branch protection
  is active + required, work enters via PR (not a direct push), and the PR does not weaken the audit
  machinery — none of which this script self-verifies. Absent those, a determined local actor can
  still escape.

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
. (Join-Path $PSScriptRoot 'lib/receipt-check.ps1')

$rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0; 'UNKNOWN' = 5 }
$receiptPath = '.cockpit/evidence/verification-receipt.json'
$receiptSchema = 'schemas/verification-receipt.schema.json'
$exceptionsPath = '.cockpit/state/governance-gate-exceptions.json'
$runReceiptPath = '.cockpit/evidence/governance-gate.json'

$id = Get-ChangeIdentity -Baseline $Baseline

# --- tier of the EXACT staged change (the classifier is the single authority; consume it) ---
$tierInfo = Get-ChangeTier -Identity $id -RepoRoot $repo
$tier = $tierInfo.tier
$classifyOk = ($tier -ne 'UNKNOWN' -or $tierInfo.empty)

$reasons = @()
$verdict = $null      # 'PASS' | 'BLOCK'
$receiptState = 'not_required'

# --- exact-diff_id bypass (loud, disclosed; never a silent escape). Shared lookup: reads the ledger
# from the STAGED INDEX only, so a bypass counts only once committed (auditable). ---
$exceptionApplied = $null

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
  $rc = Test-ReceiptValid -Id $id -Tier $tier -ReceiptPath $receiptPath -SchemaPath $receiptSchema
  $receiptState = $rc.state
  if ($rc.ok) { $verdict = 'PASS'; $reasons += $rc.reason }
  else { $verdict = 'BLOCK'; $reasons += "T0/T1 change without valid proof: $($rc.reason)" }
}

# --- canonical-constraint LAND check (ADR-0020). A change at T0-T3 must carry a valid, digest-bound
# preflight (Phase Land). This is one policy mechanism invoked at its second lifecycle point — the same
# checker the PreToolUse hook uses at Phase Preflight — NOT a second gate. BOOTSTRAP: the mechanism does
# not govern its own introduction. If the checker does not yet exist in the BASELINE, skip (the
# introducing PR is proven by tests + independent review + CI, per the owner's correction 7). ---
$canonState = 'not_applicable'
if ($tier -ne 'NONE' -and $rank[$tier] -ge $rank['T3'] -and $rank[$tier] -le $rank['T0']) {
  $checkerInBase = $false
  try { git cat-file -e "$($Baseline):scripts/check-canonical-constraints.ps1" 2>$null; $checkerInBase = ($LASTEXITCODE -eq 0) } catch { $checkerInBase = $false }
  if (-not $checkerInBase) {
    $canonState = 'bootstrap_skipped'
    $reasons += 'canonical-constraint enforcement not present in baseline — introducing change is not governed by its own new gate (bootstrap)'
  } else {
    $cc = & pwsh -NoProfile -File (Join-Path $repo 'scripts/check-canonical-constraints.ps1') -Phase Land -Baseline $Baseline -Json 2>$null | ConvertFrom-Json
    $canonState = if ($cc) { $cc.state } else { 'checker_error' }
    if (-not $cc -or -not $cc.ok) {
      $verdict = 'BLOCK'
      $reasons += "canonical-constraint LAND check failed ($canonState): " + (($cc.reasons) -join '; ')
    } else {
      $reasons += "canonical-constraint LAND check PASS (preflight $($cc.task_id))"
    }
  }
}

# a bypass can only turn a BLOCK into an allow, and only for THIS exact diff
if ($verdict -eq 'BLOCK') {
  $exceptionApplied = Get-StagedBypass -DiffId $id.diff_id -LedgerPath $exceptionsPath
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
  canonical     = $canonState
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
