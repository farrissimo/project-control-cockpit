<#
  FI-5 — unreadable git/remote truth never yields a false backed-up/synced/green claim.
  Exercises the REAL scripts/detect-repo-sync.ps1 against TEMP repos with real git. The
  detector Set-Location's to its own repo root, so we run a copy placed inside each temp
  repo (byte-identical production code, isolated) — under a git-ignored scripts/ dir so
  the copy itself never dirties the repo under test. Expected: CONTAINED.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path
$detectorSrc = Join-Path $repoRoot 'scripts/detect-repo-sync.ps1'

$checks = New-Object System.Collections.ArrayList
function Add-Check($name, $ok, $detail) { [void]$checks.Add([ordered]@{ name = $name; ok = [bool]$ok; detail = "$detail" }) }
$baselineOk = $false; $injectionTriggered = $false; $observed = ''

function GitIn([string]$dir, [string[]]$a) { Push-Location $dir; try { & git.exe @a 2>$null | Out-Null } finally { Pop-Location } }

# Set up a clean committed git repo. `scripts/` is git-ignored (committed) so the detector
# copy we drop in later can't show up as an untracked change.
function Setup-Repo([string]$dir, [string]$remoteBare) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  GitIn $dir @('init'); GitIn $dir @('config', 'user.email', 't@t.local'); GitIn $dir @('config', 'user.name', 'T')
  Set-Content -LiteralPath (Join-Path $dir 'f.txt') -Value 'hi'
  Set-Content -LiteralPath (Join-Path $dir '.gitignore') -Value 'scripts/'
  GitIn $dir @('add', '-A'); GitIn $dir @('commit', '-m', 'seed'); GitIn $dir @('branch', '-M', 'main')
  if ($remoteBare) { GitIn $dir @('remote', 'add', 'origin', $remoteBare); GitIn $dir @('push', '-u', 'origin', 'main') }
}
# Drop the REAL detector into <dir>/scripts (git-ignored) so its $repo resolves to <dir>, run it.
function Run-Detector([string]$dir) {
  $sd = Join-Path $dir 'scripts'
  if (-not (Test-Path $sd)) { New-Item -ItemType Directory -Path $sd -Force | Out-Null }
  Copy-Item $detectorSrc (Join-Path $sd 'detect-repo-sync.ps1') -Force
  $out = & pwsh -NoProfile -File (Join-Path $sd 'detect-repo-sync.ps1') -Json 2>$null
  return ("$out" | ConvertFrom-Json)
}

# Real repo untouched, proven (read-only, never cd into it) — HEAD + FULL status content.
$realHeadBefore = "$(& git.exe -C $repoRoot rev-parse HEAD 2>$null)".Trim()
$realStatusBefore = ((& git.exe -C $repoRoot status --porcelain 2>$null) -join "`n")

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("pcc-fi5-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
  # ---- baseline: a healthy repo genuinely backed up to a (local bare) remote -> 'Backed up' ----
  $bare = Join-Path $tmp 'remote.git'
  & git.exe init --bare $bare 2>$null | Out-Null
  Setup-Repo (Join-Path $tmp 'good') $bare
  $rBase = Run-Detector (Join-Path $tmp 'good')
  $baselineOk = ("$($rBase.signal)" -eq 'clear' -and "$($rBase.chip_label)" -eq 'Backed up')
  $observed = "baseline healthy+pushed repo -> signal='$($rBase.signal)' chip='$($rBase.chip_label)' (proves the detector CAN report backed-up)"

  # ---- inject A: a NON-repository directory (git truth unreadable) ----
  $nonrepo = Join-Path $tmp 'nonrepo'; New-Item -ItemType Directory -Path $nonrepo -Force | Out-Null
  $rNon = Run-Detector $nonrepo

  # ---- inject B: a clean git repo with NO remote at all ----
  $noremoteDir = Join-Path $tmp 'noremote'
  Setup-Repo $noremoteDir $null
  $rNo = Run-Detector $noremoteDir

  # Prove the injected fault states GENUINELY exist (not merely "a detector produced JSON"):
  # the non-repo dir really has no .git, and the no-remote repo really has no origin.
  $nonRepoIsNotGit = -not (Test-Path (Join-Path $nonrepo '.git'))
  $noRemoteHasNoOrigin = [string]::IsNullOrWhiteSpace("$(& git.exe -C $noremoteDir remote get-url origin 2>$null)")
  $injectionTriggered = $nonRepoIsNotGit -and $noRemoteHasNoOrigin
  $observed += " | injected states: nonRepoNoGit=$nonRepoIsNotGit noRemoteNoOrigin=$noRemoteHasNoOrigin"

  Add-Check 'non_repo_reports_unknown_never_backed_up' (("$($rNon.signal)" -eq 'unknown') -and ("$($rNon.chip_label)" -ne 'Backed up')) "non-repo -> signal='$($rNon.signal)' chip='$($rNon.chip_label)' (honest unknown, never 'Backed up')"
  Add-Check 'no_remote_never_claims_backed_up' (("$($rNo.signal)" -ne 'clear') -and ("$($rNo.chip_label)" -ne 'Backed up')) "no-remote -> signal='$($rNo.signal)' chip='$($rNo.chip_label)' (never a false backed-up/synced green)"

  $realHeadAfter = "$(& git.exe -C $repoRoot rev-parse HEAD 2>$null)".Trim()
  $realStatusAfter = ((& git.exe -C $repoRoot status --porcelain 2>$null) -join "`n")
  Add-Check 'real_repo_untouched' (($realHeadBefore -eq $realHeadAfter) -and ($realStatusBefore -eq $realStatusAfter)) 'the real PCC repository HEAD + FULL working-tree status content are identical (only temp repos were touched)'
}
finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

([ordered]@{ id = 'FI-5-git-remote-unavailable'; expected = 'CONTAINED'; baselineOk = $baselineOk; injectionTriggered = $injectionTriggered; observed = $observed; checks = @($checks) } | ConvertTo-Json -Depth 6)
