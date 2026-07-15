<#
  audit-verification-trailers.ps1 (ADR-0007) — the durable, server-side check (and the phase's
  re-measurement tool). For each NON-MERGE commit in a range, if the commit is tagged-crucial
  (T0/T1) it MUST carry a `Verified-Receipt:` trailer whose diff_id RE-DERIVES from the commit's
  actual content. A local `--no-verify` skip, or a malformed / mismatched / invalid-BYPASS trailer,
  is caught here. It does NOT catch a correctly-bound *fabricated PASS* (a hand-written PASS trailer
  whose diff_id re-derives) — that is irreducible worker-attestation, accepted as documented residue
  (ADR-0007). Hence the measure below is *attestation* coverage: a valid, diff-bound CLAIM of
  verification, not proof that verification truthfully happened.

  Re-derivation (the honest part): diff_id is recomputed as base -> commit-tree, ledger excluded,
  where `base` comes from the COMMIT'S OWN TRAILER — never a base recomputed from today's main
  (that would silently change the diff scope). Uses the SAME shared formula as commit-time
  (scripts/lib/change-identity.ps1 Get-CommitDiffId), so a trailer written at commit time re-derives
  here byte-for-byte.

  A trailer with verdict=PASS is an ATTESTED commit (a valid, diff-bound claim of verification);
  verdict=BYPASS is a disclosed exception carried into history (still bound to the exact diff). Either
  satisfies the audit; a T0/T1 commit with no trailer, a non-{PASS,BYPASS} verdict, or a diff_id that
  does not match its content FAILS.

  Params:
    -Range <a>..<b>  audit commits in this git range (e.g. 'origin/main..HEAD' in CI).
    -Last <n>        when no -Range, audit the last n non-merge commits (default 25) — the
                     re-measurement mode.
    -Json            machine-readable report.
  Exit: 0 = all crucial commits carry a valid trailer; 1 = at least one FAILED; 2 = could not run.
#>
param(
  [string]$Range,
  [int]$Last = 25,
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
. (Join-Path $PSScriptRoot 'lib/change-identity.ps1')
. (Join-Path $PSScriptRoot 'lib/receipt-check.ps1')

$rank = @{ 'T0' = 4; 'T1' = 3; 'T2' = 2; 'T3' = 1; 'T4' = 0; 'UNKNOWN' = 5 }
$classifier = Join-Path $PSScriptRoot 'classify-stakes.ps1'
$exceptionsPath = '.cockpit/state/governance-gate-exceptions.json'

function Classify-Commit([string]$c) {
  # The files THIS commit introduced (vs its first parent; --root handles the initial commit).
  $files = @(& git diff-tree --no-commit-id --name-only -r --root $c 2>$null | Where-Object { $_ })
  if ($files.Count -eq 0) { return 'NONE' }
  $added = @(& git diff-tree --no-commit-id --name-only -r --root --diff-filter=A $c 2>$null | Where-Object { $_ })
  $deleted = @(& git diff-tree --no-commit-id --name-only -r --root --diff-filter=D $c 2>$null | Where-Object { $_ })
  $raw = & pwsh -NoProfile -File $classifier -Json -Files ($files -join "`n") -Added ($added -join "`n") -Deleted ($deleted -join "`n") 2>$null
  $obj = $null; try { $obj = $raw | ConvertFrom-Json } catch {}
  if ($obj -and $obj.tier) { return "$($obj.tier)" }
  return 'UNKNOWN'
}

# --- resolve the commit list ---
if ($Range) { $commits = @(& git rev-list --no-merges $Range 2>$null | Where-Object { $_ }) }
else { $commits = @(& git rev-list --no-merges -n $Last HEAD 2>$null | Where-Object { $_ }) }

$results = @()
$fails = 0; $attested = 0; $bypassed = 0; $notRequired = 0; $crucial = 0
$trailerRe = '^Verified-Receipt:\s*base=(?<base>\S+)\s+diff_id=(?<diff>\S+)\s+verdict=(?<verdict>\S+)\s+verifier=(?<verifier>.*)$'

foreach ($c in $commits) {
  $short = $c.Substring(0, [Math]::Min(9, $c.Length))
  $subject = "$(& git show -s --format=%s $c 2>$null)"
  $tier = Classify-Commit $c
  if (-not $rank.ContainsKey($tier) -or $rank[$tier] -lt $rank['T1']) {
    $notRequired++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'not_required'; detail = ''; subject = $subject }
    continue
  }
  $crucial++
  # find the trailer in the commit message. Join with newlines — "$(...)" would collapse the
  # multi-line message to one space-joined line and the '^Verified-Receipt:' anchor would never hit.
  $msg = (& git show -s --format=%B $c 2>$null) -join "`n"
  $line = ($msg -split "`n" | Where-Object { $_ -match '^Verified-Receipt:' } | Select-Object -First 1)
  if (-not $line) {
    $fails++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'FAIL'; detail = 'T0/T1 commit has no Verified-Receipt trailer'; subject = $subject }
    continue
  }
  $m = [regex]::Match($line, $trailerRe)
  if (-not $m.Success) {
    $fails++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'FAIL'; detail = 'malformed Verified-Receipt trailer'; subject = $subject }
    continue
  }
  $tBase = $m.Groups['base'].Value; $tDiff = $m.Groups['diff'].Value; $tVerdict = $m.Groups['verdict'].Value
  if ($tVerdict -ne 'PASS' -and $tVerdict -ne 'BYPASS') {
    $fails++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'FAIL'; detail = "trailer verdict '$tVerdict' is not PASS or BYPASS"; subject = $subject }
    continue
  }
  # re-derive diff_id from base (in the trailer) -> this commit, ledger excluded
  $derived = Get-CommitDiffId $tBase $c
  if ($derived -ne $tDiff) {
    $fails++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'FAIL'; detail = 'trailer diff_id does not match the commit content (tampered or forged)'; subject = $subject }
    continue
  }
  # A BYPASS trailer is only honoured when the commit ACTUALLY carries the matching disclosed
  # exception in its committed ledger — otherwise a hand-written `verdict=BYPASS` (via --no-verify)
  # would sail through. The exception is verified against the ledger AS OF this commit.
  if ($tVerdict -eq 'BYPASS') {
    $bp = Get-CommitBypass -Commit $c -DiffId $tDiff -LedgerPath $exceptionsPath
    if (-not $bp) {
      $fails++
      $results += [ordered]@{ commit = $short; tier = $tier; status = 'FAIL'; detail = 'BYPASS trailer has no matching disclosed exception in the committed ledger (forged bypass)'; subject = $subject }
      continue
    }
    $bypassed++
    $results += [ordered]@{ commit = $short; tier = $tier; status = 'bypass'; detail = "disclosed bypass, authorized_by '$($bp.authorized_by)'"; subject = $subject }
    continue
  }
  $attested++
  $results += [ordered]@{ commit = $short; tier = $tier; status = 'attested'; detail = 'trailer valid (PASS attestation — bound claim, not proof it happened)'; subject = $subject }
}

$overall = if ($fails -gt 0) { 'FAIL' } else { 'PASS' }
$report = [ordered]@{
  schema       = 'verification-trailer-audit/v1'
  range        = if ($Range) { $Range } else { "last $Last (no-merge)" }
  audited      = $commits.Count
  crucial      = $crucial
  attested     = $attested
  bypassed     = $bypassed
  not_required = $notRequired
  failed       = $fails
  overall      = $overall
  commits      = @($results)
  measure      = "of $crucial crucial (T0/T1) commit(s): $attested attested + $bypassed disclosed-bypass carry a valid durable trailer; $fails missing/invalid. ATTESTED = a valid diff-bound CLAIM of verification, NOT proof it happened (ADR-0007)."
}

if ($Json) { $report | ConvertTo-Json -Depth 8 }
else {
  foreach ($r in $results) {
    $mark = switch ($r.status) { 'attested' { 'ATT ' } 'bypass' { 'BYP ' } 'not_required' { '--  ' } default { 'FAIL' } }
    Write-Host ("[{0}] {1} {2,-4} {3}" -f $mark, $r.commit, $r.tier, $r.subject)
    if ($r.status -eq 'FAIL') { Write-Host "       -> $($r.detail)" }
  }
  Write-Host ""
  Write-Host "AUDIT $overall — $($report.measure)"
}

if ($overall -eq 'FAIL') { exit 1 } else { exit 0 }
