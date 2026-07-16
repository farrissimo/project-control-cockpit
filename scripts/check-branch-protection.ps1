<#
  PCC branch-protection checker (verification & proof-of-done audit, ADR-0009).

  Converts an OWNER-ASSERTED precondition into a LIVE, re-runnable fact. PCC's whole server-side
  "un-bypassable" guarantee (CI-audited trailer + required checks) rests on GitHub branch protection
  actually being ON for the default branch. Nothing checked it — it was owner-confirmed prose (O1).
  This queries the GitHub rulesets API and verifies the real protection contract:
    - an ACTIVE ruleset targeting the default branch exists
    - its bypass list is EMPTY (no admin/actor bypass)
    - it requires the 'test' status check, requires a pull request, and blocks deletion + force-push

  Fails CLOSED, never fake-green:
    - PASS    : a matching active ruleset satisfies every requirement above
    - FAIL    : the API is reachable but protection is ABSENT or WEAKENED (with the specific reasons)
    - UNKNOWN : the API/auth/gh is unavailable — we genuinely cannot tell (never reported as PASS)

  Deterministic parsing is testable offline via -FixtureRuleset (a ruleset-detail JSON); the live path
  uses `gh api`. Spec: docs/audit/verification-proof-of-done.md.

  Modeling note (honest limitation): each ruleset is evaluated INDIVIDUALLY — PASS requires a single
  ruleset to satisfy the whole contract (PCC's case: one `protect-main` ruleset). GitHub rulesets are
  additive, so protection split across two rulesets could read as FAIL here. That error is fail-SAFE (a
  false alarm, never a false green); the dangerous direction (reporting PASS when unprotected) is fully
  guarded. Union evaluation is deferred until a real project actually splits protection across rulesets.

  Params:
    -Repo <owner/repo>       : target repo (default: derived from `git remote get-url origin`).
    -FixtureRuleset <path>   : evaluate this ruleset-detail JSON directly (test seam; skips live API).
    -Json                    : machine-readable output.
#>
param(
  [string]$Repo = '',
  [string]$FixtureRuleset = '',
  [string]$FixtureRulesetsList = '',
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

# Evaluate a single ruleset-DETAIL object against the required protection contract.
# Returns @{ verdict='PASS'|'FAIL'; reasons=@(...) }.
function Test-RulesetProtects($detail) {
  $reasons = @()
  if ([string]$detail.enforcement -ne 'active') {
    $reasons += "ruleset enforcement is '$($detail.enforcement)', not 'active'"
  }
  $bypass = @($detail.bypass_actors)
  if ($bypass.Count -gt 0) {
    $reasons += "bypass list is non-empty ($($bypass.Count) actor(s)) — protection is bypassable"
  }
  $ruleTypes = @($detail.rules | ForEach-Object { [string]$_.type })
  foreach ($needed in @('pull_request', 'deletion', 'non_fast_forward')) {
    if ($ruleTypes -notcontains $needed) { $reasons += "missing required rule '$needed'" }
  }
  $sc = $detail.rules | Where-Object { $_.type -eq 'required_status_checks' } | Select-Object -First 1
  if (-not $sc) {
    $reasons += "missing required_status_checks rule"
  } else {
    $contexts = @($sc.parameters.required_status_checks | ForEach-Object { [string]$_.context })
    if ($contexts -notcontains 'test') { $reasons += "required_status_checks does not require the 'test' check" }
  }
  if ($reasons.Count -eq 0) { return @{ verdict = 'PASS'; reasons = @() } }
  return @{ verdict = 'FAIL'; reasons = $reasons }
}

$verdict = 'UNKNOWN'
$reasons = @()
$rulesetName = ''
$notProven = ''

if (-not [string]::IsNullOrWhiteSpace($FixtureRuleset)) {
  # ---- Test seam: evaluate a fixture ruleset-detail directly. ----
  if (-not (Test-Path -LiteralPath $FixtureRuleset)) {
    $verdict = 'UNKNOWN'; $notProven = "fixture not found: $FixtureRuleset"
  } else {
    $detail = $null
    try { $detail = Get-Content -Raw -LiteralPath $FixtureRuleset | ConvertFrom-Json -ErrorAction Stop } catch { $detail = $null }
    if ($null -eq $detail) { $verdict = 'UNKNOWN'; $notProven = 'fixture is not valid JSON' }
    else { $rulesetName = [string]$detail.name; $res = Test-RulesetProtects $detail; $verdict = $res.verdict; $reasons = $res.reasons }
  }
} else {
  # ---- Fetch the rulesets LIST (live via gh, or a fixture for testing the classification). ----
  $listRaw = $null
  $listAvailable = $false
  if (-not [string]::IsNullOrWhiteSpace($FixtureRulesetsList)) {
    if (Test-Path -LiteralPath $FixtureRulesetsList) { $listRaw = Get-Content -Raw -LiteralPath $FixtureRulesetsList; $listAvailable = $true }
    else { $verdict = 'UNKNOWN'; $notProven = "fixture list not found: $FixtureRulesetsList" }
  } else {
    if ([string]::IsNullOrWhiteSpace($Repo)) {
      $origin = (& git remote get-url origin 2>$null)
      if ($origin) {
        $m = [regex]::Match($origin.Trim(), 'github\.com[:/]([^/]+/[^/]+?)(\.git)?$')
        if ($m.Success) { $Repo = $m.Groups[1].Value }
      }
    }
    if ([string]::IsNullOrWhiteSpace($Repo)) {
      $verdict = 'UNKNOWN'; $notProven = 'could not determine owner/repo (pass -Repo)'
    } elseif (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
      $verdict = 'UNKNOWN'; $notProven = 'gh CLI not found — cannot query the GitHub API (cannot tell; not reported as protected)'
    } else {
      $listRaw = & gh api "repos/$Repo/rulesets" 2>$null
      if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace(($listRaw | Out-String).Trim())) {
        $verdict = 'UNKNOWN'; $notProven = "GitHub rulesets API unreachable/unauthorized for '$Repo' (cannot tell)"
      } else { $listAvailable = $true }
    }
  }

  if ($listAvailable) {
    # A successful HTTP read that we cannot PARSE means we genuinely cannot tell — UNKNOWN, never a
    # definitive FAIL (a malformed read must not masquerade as "protection is absent"; integrity Rule 4).
    $list = $null
    try { $list = ($listRaw | Out-String) | ConvertFrom-Json -ErrorAction Stop } catch { $list = $null }
    if ($null -eq $list) {
      $verdict = 'UNKNOWN'; $notProven = 'rulesets list is not valid JSON (cannot tell)'
    } else {
      $candidates = @($list | Where-Object { $_.target -eq 'branch' -and $_.enforcement -eq 'active' })
      if ($candidates.Count -eq 0) {
        # A parseable list with zero active branch rulesets is a real, read answer: unprotected.
        $verdict = 'FAIL'; $reasons = @("no ACTIVE branch ruleset — the default branch is unprotected")
      } elseif (-not [string]::IsNullOrWhiteSpace($FixtureRulesetsList)) {
        # Fixture-list mode covers only the pre-detail classification (malformed / empty); it has no
        # way to fetch per-ruleset detail, so anything beyond that is honestly UNKNOWN.
        $verdict = 'UNKNOWN'; $notProven = 'fixture-list mode cannot fetch ruleset detail; use -FixtureRuleset for detail verdicts'
      } else {
        $passed = $false
        $firstFail = $null
        $detailReadError = $false
        foreach ($c in $candidates) {
          $detailRaw = & gh api "repos/$Repo/rulesets/$($c.id)" 2>$null
          if ($LASTEXITCODE -ne 0) { $detailReadError = $true; continue }
          $detail = $null
          try { $detail = ($detailRaw | Out-String) | ConvertFrom-Json -ErrorAction Stop } catch { $detail = $null }
          if ($null -eq $detail) { $detailReadError = $true; continue }
          $includes = @($detail.conditions.ref_name.include)
          $coversDefault = ($includes -contains '~DEFAULT_BRANCH') -or ($includes -contains 'refs/heads/main')
          if (-not $coversDefault) { continue }
          $res = Test-RulesetProtects $detail
          if ($res.verdict -eq 'PASS') { $passed = $true; $rulesetName = [string]$detail.name; $reasons = @(); break }
          elseif ($null -eq $firstFail) { $firstFail = @{ name = [string]$detail.name; reasons = $res.reasons } }
        }
        if ($passed) { $verdict = 'PASS' }
        elseif ($detailReadError) {
          # A protecting ruleset MIGHT be among the ones we couldn't read — a read failure must never
          # masquerade as a definitive FAIL. UNKNOWN takes precedence over a weak-ruleset FAIL, because
          # GitHub rulesets are additive (another ruleset could supply what a weak one lacks).
          $verdict = 'UNKNOWN'; $notProven = "could not read ruleset detail for '$Repo' (API error) — a protecting ruleset may exist among the unreadable ones; cannot confirm"
        }
        elseif ($firstFail) { $verdict = 'FAIL'; $rulesetName = $firstFail.name; $reasons = $firstFail.reasons }
        else {
          # Every candidate read cleanly and none covers the default branch: a real "unprotected" answer.
          $verdict = 'FAIL'; $reasons = @("no active ruleset covers the default branch of '$Repo'")
        }
      }
    }
  }
}

if ($Json) {
  [pscustomobject]@{
    schema       = 'branch-protection-check/v1'
    repo         = $Repo
    verdict      = $verdict
    ruleset_name = $rulesetName
    reasons      = $reasons
    not_proven   = $notProven
  } | ConvertTo-Json -Depth 6
} else {
  $line = "[branch-protection] $verdict"
  if ($rulesetName) { $line += " (ruleset '$rulesetName')" }
  Write-Output $line
  foreach ($r in $reasons) { Write-Output "  - $r" }
  if ($notProven) { Write-Output "  not proven: $notProven" }
}

# Exit code: 0 PASS, 1 FAIL, 2 UNKNOWN (fail-closed — a caller must not read UNKNOWN as success).
switch ($verdict) { 'PASS' { exit 0 } 'FAIL' { exit 1 } default { exit 2 } }
