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

function New-Result([string]$signal, $items, [string]$observed, [string]$mightMean, [string]$notProven, [string]$whatToDo) {
  [ordered]@{
    detector   = 'repo-sync'
    roadmap    = 'P2 #13'
    checked_at = $checkedAt
    signal     = $signal
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
  $r = New-Result 'unknown' @() 'Not a git repository (or git unavailable).' `
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

  $items = @()
  if ($trackedChanges.Count -gt 0) { $items += "$($trackedChanges.Count) uncommitted change(s) to tracked files" }
  if ($untracked.Count -gt 0)      { $items += "$($untracked.Count) untracked file(s) (see the Untracked-files signal for the list)" }
  if ($hasUpstream -and $ahead -gt 0) { $items += "$ahead commit(s) committed but NOT pushed to $upstream" }
  if (-not $hasUpstream)           { $items += "branch '$branch' has no upstream remote - nothing here is backed up off this machine" }

  $atRisk = ($trackedChanges.Count -gt 0) -or ($untracked.Count -gt 0) -or ($ahead -gt 0) -or (-not $hasUpstream)

  if (-not $atRisk) {
    $observed = "Working tree clean and branch '$branch' is level with $upstream"
    if ($behind -gt 0) { $observed += " (though $behind commit(s) behind it)" }
    $observed += '. All committed work is backed up to the remote.'
    $r = New-Result 'clear' @() $observed `
      'Nothing is sitting only on this machine right now.' `
      'Whether the remote itself is safe, and whether uncommitted-but-intended work exists that you have not made yet.' `
      'Nothing needed for this signal.'
  } else {
    $observed = "Work is only on this machine: " + ($items -join '; ') + '.'
    if ($behind -gt 0) { $observed += " (Also $behind commit(s) behind $upstream.)" }
    $r = New-Result 'notice' $items $observed `
      'This work would be lost if the machine or chat is lost. It is not yet backed up to the remote.' `
      'Whether the changes are ready to commit or push - that is your call; this only reports that they are not backed up yet.' `
      'Commit and push (or stash) to back it up. If there is no upstream, set one and push.'
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
