<#
  CI status for one EXACT commit (the single PCC authority for "did clean-room CI pass for this
  sha"). Queries GitHub's check-runs API for the named 'test' check ONLY — an unrelated successful
  check (a bot, CodeQL) must never read as "the suite passed" (same conservative rule as
  app/ci-status.js and the trust strip). Deterministic, read-only, no LLM; degrades offline-safe to
  an honest status, never throws. Emits one JSON object: { sha, status, detail }.

  status leaves (the release gate maps these to ok/FAIL/UNKNOWN):
    passed                                  -> ok
    failed | cancelled | skipped            -> FAIL
    pending | missing | ambiguous |
      unreachable | no_remote | not_github  -> UNKNOWN

  The result carries the sha it was queried for, so a consumer can bind it to the exact commit.
#>
param([Parameter(Mandatory)][string]$Sha, [switch]$Json)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
function GitOut([string[]]$argv) { $o = & git @argv 2>$null; return "$o".Trim() }

$result = [ordered]@{ sha = $Sha; status = 'unknown'; detail = '' }
$remote = GitOut @('remote', 'get-url', 'origin')
if (-not $remote) {
  $result.status = 'no_remote'
} else {
  $m = [regex]::Match($remote, '(?:github\.com[:/])([^/]+)/([^/]+?)(?:\.git)?/?$')
  if (-not $m.Success) {
    $result.status = 'not_github'
  } else {
    $owner = $m.Groups[1].Value; $name = $m.Groups[2].Value
    try {
      # per_page=100 so the named 'test' check is never missed on a later page (default page size
      # is 30). PCC commits carry 1-2 checks, so this covers every realistic case without paging.
      $uri = "https://api.github.com/repos/$owner/$name/commits/$Sha/check-runs?per_page=100"
      $resp = Invoke-RestMethod -Uri $uri -Headers @{ Accept = 'application/vnd.github+json'; 'User-Agent' = 'PCC-Cockpit' } -TimeoutSec 8 -ErrorAction Stop
      $mine = @($resp.check_runs | Where-Object { $_.name -eq 'test' })
      $result.status =
        if ($mine.Count -eq 0) { 'missing' }
        elseif (@($mine | Where-Object { $_.status -ne 'completed' }).Count -gt 0) { 'pending' }
        elseif (@($mine | Where-Object { $_.conclusion -in @('failure', 'timed_out', 'startup_failure') }).Count -gt 0) { 'failed' }
        elseif (@($mine | Where-Object { $_.conclusion -in @('cancelled', 'action_required') }).Count -gt 0) { 'cancelled' }
        elseif (@($mine | Where-Object { $_.conclusion -in @('skipped', 'neutral', 'stale') }).Count -gt 0) { 'skipped' }
        elseif (@($mine | Where-Object { $_.conclusion -eq 'success' }).Count -gt 0) { 'passed' }
        else { 'ambiguous' }
      $result.detail = "$owner/$name@$($Sha.Substring(0,[Math]::Min(9,$Sha.Length)))"
    } catch { $result.status = 'unreachable'; $result.detail = "$($_.Exception.Message)" }
  }
}

$result | ConvertTo-Json -Depth 4
