<#
  PCC detection: untracked files (COCKPIT_ROADMAP #9).

  One of the "human smoke alarm" jobs from DECISION-102: the owner should not
  have to notice by hand when the LLM created files that git never started
  tracking (new docs/code that will silently vanish on a rollover, or scratch
  that should be ignored).

  Deterministic: pure `git status` parsing, no LLM, read-only, always exits 0.
  This is a SIGNAL, never a gate. It respects .gitignore (git already hides
  ignored paths from untracked output), so disposable/generated files do not
  raise noise.

  Every detection ships ONLY in the honest four-part format the owner requires:
  Observed / What it might mean / What's NOT proven / What to do. It never
  states a fake certainty about intent.

  Default output is human-readable text. With -Json it emits a structured
  object the app renders. With -WriteFile it also drops that JSON to
  .cockpit/result/detections/untracked-files.json (repo truth via the file
  bridge), so the CLI works with app/ deleted.
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

# --untracked-files=all lists every untracked file (not just the top dir), so a
# whole new folder of work is counted honestly rather than as a single entry.
$raw = & git status --porcelain=v1 --untracked-files=all 2>&1
$gitFailed = ($LASTEXITCODE -ne 0)

$items = @()
if (-not $gitFailed) {
  foreach ($line in ($raw -split "\r?\n")) {
    if ($line -match '^\?\?\s(.+)$') { $items += $matches[1].Trim('"') }
  }
}

$count = $items.Count
$checkedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')

if ($gitFailed) {
  $signal      = 'unknown'
  $observed    = "Could not read git status: $($raw -join ' ')".Trim()
  $mightMean   = 'The detector could not run (not a git repo, or git unavailable).'
  $notProven   = 'Whether any untracked files exist — this check did not complete.'
  $whatToDo    = 'Confirm git is installed and this is a git repository, then re-run.'
} elseif ($count -eq 0) {
  $signal      = 'clear'
  $observed    = 'No untracked files. Everything git can see is either tracked or ignored by .gitignore.'
  $mightMean   = 'Nothing created-but-untracked is sitting in the working tree right now.'
  $notProven   = 'Whether tracked files hold uncommitted edits (that is a separate check), or whether something belongs in .gitignore but is currently tracked.'
  $whatToDo    = 'Nothing needed for this signal.'
} else {
  $signal      = 'notice'
  $observed    = "$count untracked file(s) present (not tracked by git, not covered by .gitignore)."
  $mightMean   = 'These may be real work the LLM created but never staged — at risk of being lost on a rollover or new chat — OR scratch/output that should be ignored. This detector cannot tell which.'
  $notProven   = 'Whether any of these files matter, whether they should be committed, and whether they are intentional. Intent is not observable from git.'
  $whatToDo    = 'Review the list. `git add` the ones that are real project work and commit them; add genuine scratch/generated paths to .gitignore. Do not bulk-add blindly.'
}

$result = [ordered]@{
  detector    = 'untracked-files'
  roadmap     = 'P2 #9'
  checked_at  = $checkedAt
  signal      = $signal          # clear | notice | unknown
  count       = $count
  items       = $items
  observed    = $observed
  might_mean  = $mightMean
  not_proven  = $notProven
  what_to_do  = $whatToDo
}

if ($WriteFile) {
  $dir = Join-Path $repo '.cockpit/result/detections'
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
  $path = Join-Path $dir 'untracked-files.json'
  ($result | ConvertTo-Json -Depth 5) | Out-File -FilePath $path -Encoding utf8
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5
} else {
  Write-Output "PCC detection - untracked files ($checkedAt)"
  Write-Output "Signal: $signal ($count untracked)"
  Write-Output ''
  Write-Output "OBSERVED:        $observed"
  if ($count -gt 0) { foreach ($it in $items) { Write-Output "                   - $it" } }
  Write-Output "WHAT IT MIGHT MEAN: $mightMean"
  Write-Output "WHAT'S NOT PROVEN:  $notProven"
  Write-Output "WHAT TO DO:         $whatToDo"
}
