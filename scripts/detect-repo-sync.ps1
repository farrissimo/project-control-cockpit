<#
  PCC detection: repo sync / work-not-backed-up (COCKPIT_ROADMAP #13).

  Answers one plain question: is the work actually backed up to the remote, or
  is it only on this machine right now? Uncommitted changes and commits that
  were never pushed are both "at risk if this machine or chat is lost."

  Fully deterministic: git only, no LLM, read-only, always exits 0. A SIGNAL,
  never a gate. -Json for the app; -WriteFile drops truth to
  .cockpit/result/detections/repo-sync.json. Works with app/ deleted.
#>
param(
  [switch]$Json,
  [switch]$WriteFile
)

$ErrorActionPreference = 'Continue'
# Emit UTF-8 so non-ASCII survives a redirected pipe (else PowerShell writes
# OEM-codepage bytes that make the JSON invalid and the app silently drops it).
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$checkedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')

function New-Result([string]$signal, [string]$chipLabel, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector   = 'repo-sync'
    roadmap    = 'P2 #13'
    checked_at = $checkedAt
    signal     = $signal
    chip_label = $chipLabel
    count      = @($items).Count
    items      = @($items)
    observed   = $observed
    might_mean = $mightMean
    not_proven = $notProven
    what_to_do = $whatToDo
  }
}

# Confirm this is a git repo first; otherwise report unknown, never guess.
& git rev-parse --is-inside-work-tree > $null 2>&1
if ($LASTEXITCODE -ne 0) {
  $r = New-Result 'unknown' 'Backup status unknown' @() 'Not a git repository (or git unavailable).' `
    'Backup status cannot be read.' 'Whether any work is unsaved.' 'Run this inside the git repo.'
} else {
  $porcelain = @(& git status --porcelain=v1 --untracked-files=all 2>$null | ForEach-Object { "$_" } | Where-Object { $_.Trim() })
  $untracked = @($porcelain | Where-Object { $_ -match '^\?\?' })
  $trackedChanges = @($porcelain | Where-Object { $_ -notmatch '^\?\?' })

  $branch = "$(& git rev-parse --abbrev-ref HEAD 2>$null)".Trim()

  # Upstream + ahead/behind. No upstream means nothing is being backed up to a
  # remote at all -- itself an at-risk state.
  $hasUpstream = $false
  $upstream = "$(& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>$null)".Trim()
  & git rev-parse --abbrev-ref --symbolic-full-name '@{u}' > $null 2>&1
  if ($LASTEXITCODE -eq 0 -and $upstream) { $hasUpstream = $true }

  $ahead = 0; $behind = 0
  if ($hasUpstream) {
    $counts = "$(& git rev-list --left-right --count "HEAD...@{u}" 2>$null)".Trim() -split '\s+'
    if ($counts.Count -eq 2) { $ahead = [int]$counts[0]; $behind = [int]$counts[1] }
  }

  # Declared backup tier (owner policy 2026-07-09): local-only | remote-backed | (missing).
  # Policy-driven, never inferred from folder name.
  $mode = $null
  $policyPath = Join-Path $repo '.cockpit/state/backup-policy.json'
  if (Test-Path -LiteralPath $policyPath -PathType Leaf) {
    try { $mode = "$((Get-Content -Raw -LiteralPath $policyPath | ConvertFrom-Json).mode)".Trim() } catch { $mode = $null }
  }

  $dirty = ($trackedChanges.Count -gt 0) -or ($untracked.Count -gt 0)
  $items = @()
  if ($trackedChanges.Count -gt 0) { $items += "$($trackedChanges.Count) uncommitted change(s) to tracked files" }
  if ($untracked.Count -gt 0)      { $items += "$($untracked.Count) untracked file(s) (see the Untracked-files signal for the list)" }

  if ($dirty) {
    # Uncheckpointed: work not saved even as a local commit -> warn regardless of tier.
    $r = New-Result 'notice' 'Uncheckpointed' $items `
      "Uncommitted or untracked work exists: $($items -join '; ')." `
      'This work is not saved even as a local checkpoint yet; it could be lost.' `
      'Whether the changes are ready to commit.' `
      'Use Backup to save a local checkpoint (commit).'
  }
  elseif ($mode -eq 'local-only') {
    # Clean + local-only by decision: this IS the accepted checkpoint. Not off-machine, not at risk.
    $r = New-Result 'clear' 'Local checkpointed' @() `
      "Clean. Local-only by decision: local commits are the accepted checkpoint for this project." `
      'Your work is checkpointed on this machine, at the tier this project chose.' `
      'It is NOT backed up off-machine (no remote by decision).' `
      'Nothing needed. To add off-machine backup later, switch to remote-backed and set a remote.'
  }
  elseif ($hasUpstream) {
    if ($ahead -gt 0) {
      $r = New-Result 'notice' 'Committed, not pushed' @("$ahead commit(s) not pushed to $upstream") `
        "Clean, but $ahead local commit(s) are not pushed to $upstream." `
        'Those commits are only on this machine until pushed.' `
        'Whether they are ready to push.' `
        'Use Backup to push them to the remote.'
    } else {
      $observed = "Clean and level with $upstream. All committed work is backed up to the remote."
      if ($behind -gt 0) { $observed = "Clean and $behind commit(s) behind $upstream. All local commits are on the remote." }
      $r = New-Result 'clear' 'Backed up' @() $observed `
        'Nothing is sitting only on this machine right now.' `
        'Whether the remote itself is safe.' `
        'Nothing needed for this signal.'
    }
  }
  elseif ($mode -eq 'remote-backed') {
    # Declared remote-backed but no upstream configured -> a real setup problem.
    $r = New-Result 'notice' 'No remote configured' @("declared remote-backed but branch '$branch' has no upstream") `
      "Declared remote-backed, but branch '$branch' has no upstream remote set." `
      'Nothing is backed up off-machine despite the remote-backed decision.' `
      'Why the remote is missing.' `
      'Set an upstream remote and push, or switch this project to local-only.'
  }
  else {
    # No policy and no remote -> undecided setup state, not a failure.
    $r = New-Result 'notice' 'No backup tier set' @("branch '$branch' has no remote and no backup-policy decision") `
      "No remote is configured and no backup tier (local-only or remote-backed) has been chosen." `
      'This is a setup/undecided state, not a failure or lost work.' `
      'Which tier this project should use.' `
      'Choose local-only (local commits are enough) or set a remote for off-machine backup.'
  }
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  ($r | ConvertTo-Json -Depth 5) | Out-File -FilePath (Join-Path $dir 'repo-sync.json') -Encoding utf8
}

if ($Json) {
  $r | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - repo sync / backup ($checkedAt)"
  Write-Output "Signal: $($r.signal)"
  Write-Output ''
  Write-Output "OBSERVED:           $($r.observed)"
  if ($r.count -gt 0) { foreach ($it in $r.items) { Write-Output "                      - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $($r.might_mean)"
  Write-Output "WHAT'S NOT PROVEN:  $($r.not_proven)"
  Write-Output "WHAT TO DO:         $($r.what_to_do)"
}
