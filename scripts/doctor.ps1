param()

# Doctor is a read-only, advisory report. It composes PCC's existing
# deterministic checks into one summary answering "is this repo safe to
# trust and hand off right now?" It never gates anything and always exits 0 -
# consuming its output to block a cycle would defeat the whole point of
# keeping this separate from scripts/enforce-handoff-restart-safety.ps1,
# which is the one script allowed to be a hard gate.

$ErrorActionPreference = "Continue"

$findings = New-Object System.Collections.Generic.List[object]

function Add-Finding {
  param(
    [string]$Check,
    [ValidateSet("OK", "WARN", "ISSUE")]
    [string]$Status,
    [string]$Detail
  )
  $findings.Add([ordered]@{ check = $Check; status = $Status; detail = $Detail })
}

function Read-JsonSafe {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    return $null
  }
}

function Strip-AnsiAndLastLine {
  # Composed child scripts write their failure detail via Write-Error, which
  # PowerShell renders with ANSI color codes and a multi-line pointer block
  # when captured as text. Doctor only needs the plain-text failure message
  # on one line for a readable report.
  param([string[]]$Lines)
  # Use an explicit [char]27 rather than the "`e" escape token: this script
  # must also run correctly under Windows PowerShell 5.1 (powershell.exe),
  # which does not support "`e" (added in PowerShell 6+) and would otherwise
  # silently treat it as a literal "e", leaving ANSI codes in the report.
  $esc = [char]27
  $joined = ($Lines -join " ") -replace "$esc\[[0-9;]*m", ""
  $joined = $joined -replace "\s+", " "
  return $joined.Trim()
}

function Invoke-ProcessCapture {
  param(
    [string]$FileName,
    [string[]]$Arguments
  )
  $psi = [System.Diagnostics.ProcessStartInfo]::new()
  $psi.FileName = $FileName
  foreach ($arg in $Arguments) {
    [void]$psi.ArgumentList.Add($arg)
  }
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.UseShellExecute = $false

  $process = [System.Diagnostics.Process]::Start($psi)
  $stdout = $process.StandardOutput.ReadToEnd()
  $stderr = $process.StandardError.ReadToEnd()
  $process.WaitForExit()

  return [ordered]@{
    ExitCode = $process.ExitCode
    Stdout   = $stdout
    Stderr   = $stderr
  }
}

# --- Scaffold awareness (soak fix F7) ---
# PCC itself uses a "legacy" advisor/worker restart-safety track: project-state.json,
# task-state.json, verification-result.json, and a .cockpit/handoff/ brief dir. Freshly
# scaffolded projects (scripts/bootstrap-project.ps1) DELIBERATELY do not create these
# (main.js calls project-state.json "the retired track"). Doctor must not report a lean
# scaffolded project as broken for lacking files it was never meant to have. The presence
# of the legacy anchor files is the signal for which checks apply; when they are absent the
# legacy checks are reported "Not applicable" (OK), not ISSUE. This keeps PCC's own behavior
# identical (it has the files) while a correctly-scaffolded child comes back clean.
$legacyProjectStatePath = ".cockpit/state/project-state.json"
$legacyTaskStatePath = ".cockpit/state/task-state.json"
$usesLegacyTrack = (Test-Path -LiteralPath $legacyProjectStatePath -PathType Leaf) -or (Test-Path -LiteralPath $legacyTaskStatePath -PathType Leaf)
$hasHandoffDir = Test-Path -LiteralPath ".cockpit/handoff" -PathType Container

# --- Check 1: state consistency (schema/state alignment) ---
if (-not $usesLegacyTrack) {
  Add-Finding -Check "State consistency" -Status "OK" -Detail "Not applicable: this is a lean project (no legacy project-state/task-state track). Nothing to cross-check."
} else {
  try {
    $output = & pwsh -NoProfile -File "scripts/validate-cockpit-state.ps1" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Add-Finding -Check "State consistency" -Status "OK" -Detail (Strip-AnsiAndLastLine $output)
    } else {
      Add-Finding -Check "State consistency" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $output)
    }
  } catch {
    Add-Finding -Check "State consistency" -Status "ISSUE" -Detail "Could not run scripts/validate-cockpit-state.ps1: $($_.Exception.Message)"
  }
}

# --- Check 2: dual restart-safety (advisor brief + worker directive content) ---
if (-not $hasHandoffDir) {
  Add-Finding -Check "Restart safety (advisor + worker)" -Status "OK" -Detail "Not applicable: this lean project has no .cockpit/handoff restart-brief track. A fresh session resumes from PROJECT.md + the lifecycle pin instead."
} else {
  try {
    $output = & pwsh -NoProfile -File "scripts/verify-dual-restart-safety.ps1" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Add-Finding -Check "Restart safety (advisor + worker)" -Status "OK" -Detail "Fresh advisor and worker sessions can both resume from canonical repo truth."
    } else {
      Add-Finding -Check "Restart safety (advisor + worker)" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $output)
    }
  } catch {
    Add-Finding -Check "Restart safety (advisor + worker)" -Status "ISSUE" -Detail "Could not run scripts/verify-dual-restart-safety.ps1: $($_.Exception.Message)"
  }
}

# --- Check 3: schema/format check (project-state.json, task-state.json, verification-result.json) ---
# Requires pwsh (Test-Json does not exist in Windows PowerShell 5.1), same as
# the other composed checks above.
if (-not $usesLegacyTrack) {
  Add-Finding -Check "Format check (schemas)" -Status "OK" -Detail "Not applicable: no legacy state files (project-state/task-state/verification-result) to schema-check in a lean project."
} else {
  try {
    $output = & pwsh -NoProfile -File "scripts/check-schemas.ps1" 2>&1
    if ($LASTEXITCODE -eq 0) {
      Add-Finding -Check "Format check (schemas)" -Status "OK" -Detail "project-state.json, task-state.json, and verification-result.json all match their schemas."
    } else {
      Add-Finding -Check "Format check (schemas)" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $output)
    }
  } catch {
    Add-Finding -Check "Format check (schemas)" -Status "ISSUE" -Detail "Could not run scripts/check-schemas.ps1: $($_.Exception.Message)"
  }
}

# --- Check 3b: ADR format check (docs/adr/*.md against the locked MADR standard) ---
# Reports whether every decision record is well-formed (front matter, title, and the
# five required sections incl. Confirmation + Engagement). CI/pre-commit gate on this;
# here it is informational, same as the schema check above.
try {
  $adrOut = & pwsh -NoProfile -File "scripts/check-adr.ps1" 2>&1
  if ($LASTEXITCODE -eq 0) {
    Add-Finding -Check "Format check (ADRs)" -Status "OK" -Detail "All docs/adr/*.md match the MADR decision standard."
  } else {
    Add-Finding -Check "Format check (ADRs)" -Status "ISSUE" -Detail (Strip-AnsiAndLastLine $adrOut)
  }
} catch {
  Add-Finding -Check "Format check (ADRs)" -Status "ISSUE" -Detail "Could not run scripts/check-adr.ps1: $($_.Exception.Message)"
}

# --- Check 4: last known handoff-gate verdict (informational only - does not re-run the gate) ---
$gatePath = ".cockpit/state/handoff-gate.json"
$taskStatePath = ".cockpit/state/task-state.json"
$projectStatePath = ".cockpit/state/project-state.json"
$gate = Read-JsonSafe $gatePath
$taskState = Read-JsonSafe $taskStatePath
$projectState = Read-JsonSafe $projectStatePath

if (-not $usesLegacyTrack) {
  Add-Finding -Check "Handoff gate (last known)" -Status "OK" -Detail "Not applicable: this lean project uses the lifecycle phase-close gate (a fresh verification verdict), not the legacy handoff-gate track."
} elseif ($null -eq $gate) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "No $gatePath found yet. The enforcement gate (scripts/enforce-handoff-restart-safety.ps1) has not been run this cycle."
} elseif ($null -ne $taskState -and $gate.task_id -ne $taskState.task_id) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded gate result was for task '$($gate.task_id)' ($($gate.gate_result)), but the active task is now '$($taskState.task_id)'. Re-run scripts/enforce-handoff-restart-safety.ps1 before treating this task's handoff as gated."
} elseif ($gate.gate_result -eq "PASS") {
  Add-Finding -Check "Handoff gate (last known)" -Status "OK" -Detail "Last recorded result: PASS for task '$($gate.task_id)' at $($gate.checked_at)."
} else {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded result: $($gate.gate_result) for task '$($gate.task_id)' at $($gate.checked_at). Reason: $($gate.reason)"
}

# --- Check 5: active task context (informational only, not a pass/fail judgment) ---
if (-not $usesLegacyTrack) {
  Add-Finding -Check "Active task" -Status "OK" -Detail "Not applicable: the active task is tracked by the lifecycle pin (.cockpit/state/lifecycle-state.json), not task-state.json."
} elseif ($null -eq $taskState) {
  Add-Finding -Check "Active task" -Status "WARN" -Detail "$taskStatePath is missing or unreadable."
} else {
  Add-Finding -Check "Active task" -Status "OK" -Detail "Task '$($taskState.task_id)' status is '$($taskState.task_status)' (verification_verdict: $($taskState.verification_verdict))."
}

# --- Check 6: working tree (uncommitted changes are normal mid-cycle, never an ISSUE) ---
try {
  $gitStatus = Invoke-ProcessCapture -FileName "git" -Arguments @("status", "--porcelain")
  if ($gitStatus.ExitCode -ne 0) {
    Add-Finding -Check "Working tree" -Status "WARN" -Detail "Could not read git status (not a git repo, or git unavailable): $(Strip-AnsiAndLastLine @($gitStatus.Stdout, $gitStatus.Stderr))"
  } elseif ([string]::IsNullOrWhiteSpace($gitStatus.Stdout)) {
    Add-Finding -Check "Working tree" -Status "OK" -Detail "No uncommitted changes."
  } else {
    $changedCount = @(($gitStatus.Stdout -split "\r?\n") | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
    Add-Finding -Check "Working tree" -Status "WARN" -Detail "$changedCount uncommitted change(s) present. Normal mid-cycle; review before handoff/close-out."
  }
  if (-not [string]::IsNullOrWhiteSpace($gitStatus.Stderr)) {
    Add-Finding -Check "Git status warnings" -Status "WARN" -Detail (Strip-AnsiAndLastLine @($gitStatus.Stderr))
  }
} catch {
  Add-Finding -Check "Working tree" -Status "WARN" -Detail "Could not run 'git status --porcelain': $($_.Exception.Message)"
}

# --- Check 7: branch hygiene (current branch vs. project-state.json's active_branch) ---
try {
  $currentBranchResult = Invoke-ProcessCapture -FileName "git" -Arguments @("rev-parse", "--abbrev-ref", "HEAD")
  if ($currentBranchResult.ExitCode -ne 0) {
    Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "Could not determine current branch (not a git repo, or git unavailable): $(Strip-AnsiAndLastLine @($currentBranchResult.Stdout, $currentBranchResult.Stderr))"
  } else {
    $currentBranch = "$($currentBranchResult.Stdout)".Trim()
    $expectedBranch = if ($null -ne $projectState -and $projectState.PSObject.Properties.Name -contains "active_branch") { $projectState.active_branch } else { $null }

    $aheadBehindNote = ""
    $upstreamResult = Invoke-ProcessCapture -FileName "git" -Arguments @("rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
    if ($upstreamResult.ExitCode -eq 0) {
      $countsResult = Invoke-ProcessCapture -FileName "git" -Arguments @("rev-list", "--left-right", "--count", "HEAD...@{u}")
      if ($countsResult.ExitCode -eq 0) {
        $parts = "$($countsResult.Stdout)".Trim() -split "\s+"
        if ($parts.Count -eq 2) {
          $aheadBehindNote = " Upstream '$("$($upstreamResult.Stdout)".Trim())': $($parts[0]) ahead, $($parts[1]) behind."
        }
      }
    } else {
      $aheadBehindNote = " No upstream configured for this branch."
    }

    if ($null -eq $expectedBranch) {
      if ($usesLegacyTrack) {
        Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "On branch '$currentBranch'. $projectStatePath has no active_branch to compare against.$aheadBehindNote"
      } else {
        Add-Finding -Check "Branch hygiene" -Status "OK" -Detail "On branch '$currentBranch'.$aheadBehindNote"
      }
    } elseif ($currentBranch -eq $expectedBranch) {
      Add-Finding -Check "Branch hygiene" -Status "OK" -Detail "On expected branch '$currentBranch'.$aheadBehindNote"
    } else {
      Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "On branch '$currentBranch', but project-state.json's active_branch is '$expectedBranch'.$aheadBehindNote"
    }
  }
} catch {
  Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "Could not check branch hygiene: $($_.Exception.Message)"
}

# --- Check 8: file structure (canonical .cockpit/ subdirectories and state files present, nothing stray at the top level) ---
try {
  # Only .cockpit/state (which holds the lifecycle pin) is essential and file-backed
  # in every project. backups/logs/result/handoff are working dirs that are created
  # on first use and, being empty, wouldn't even survive a git clone -- so requiring
  # them would false-flag a clean project. They are allowed, not required.
  $baseSubdirs = @("state")
  $baseStateFiles = @(".cockpit/state/lifecycle-state.json")
  # Legit optional subdirs — present in PCC (legacy) but not required of a lean scaffold.
  $allowedSubdirs = @("backups", "handoff", "logs", "request", "result", "state")
  # Legacy-only structure, required ONLY when this project uses the legacy track.
  $legacyOnlySubdirs = @("handoff")
  $legacyStateFiles = @(
    ".cockpit/state/project-state.json",
    ".cockpit/state/task-state.json",
    ".cockpit/state/handoff-gate.json"
  )

  $missing = New-Object System.Collections.Generic.List[string]
  foreach ($d in $baseSubdirs) {
    if (-not (Test-Path -LiteralPath ".cockpit/$d" -PathType Container)) { $missing.Add(".cockpit/$d") }
  }
  foreach ($f in $baseStateFiles) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { $missing.Add($f) }
  }
  if ($usesLegacyTrack) {
    foreach ($d in $legacyOnlySubdirs) {
      if (-not (Test-Path -LiteralPath ".cockpit/$d" -PathType Container)) { $missing.Add(".cockpit/$d") }
    }
    foreach ($f in $legacyStateFiles) {
      if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { $missing.Add($f) }
    }
  }

  $unexpected = New-Object System.Collections.Generic.List[string]
  if (Test-Path -LiteralPath ".cockpit" -PathType Container) {
    Get-ChildItem -LiteralPath ".cockpit" -Force | ForEach-Object {
      if ($_.Name -notin $allowedSubdirs) { $unexpected.Add($_.Name) }
    }
  }

  if ($missing.Count -gt 0) {
    Add-Finding -Check "File structure" -Status "ISSUE" -Detail "Missing expected .cockpit/ path(s): $($missing -join ', ')"
  } elseif ($unexpected.Count -gt 0) {
    Add-Finding -Check "File structure" -Status "WARN" -Detail "Unexpected top-level .cockpit/ entr(ies) found (not necessarily a problem, just unusual): $($unexpected -join ', ')"
  } else {
    Add-Finding -Check "File structure" -Status "OK" -Detail "All canonical .cockpit/ subdirectories and state files are present; no unexpected top-level entries."
  }
} catch {
  Add-Finding -Check "File structure" -Status "WARN" -Detail "Could not check file structure: $($_.Exception.Message)"
}

# Check 9: App-level error log. The app (app/main.js) records otherwise-swallowed
# failures (a failed authority write, a dropped scaffolded-inbox, a durable-mirror
# miss) to .cockpit/logs/app-error.log via app/error-log.js, so they are no longer
# silent. Surface them in plain language here — a non-coder owner never sees a
# devtools/terminal console. WARN, not ISSUE: these were handled (the app did not
# crash), but the owner should know they happened.
try {
  $appErrLog = ".cockpit/logs/app-error.log"
  if (Test-Path -LiteralPath $appErrLog -PathType Leaf) {
    $errLines = @(Get-Content -LiteralPath $appErrLog -ErrorAction Stop | Where-Object { $_.Trim() -ne "" })
    if ($errLines.Count -gt 0) {
      $lastCtx = "?"; $lastTs = "?"
      try { $lastErr = $errLines[-1] | ConvertFrom-Json; $lastCtx = $lastErr.context; $lastTs = $lastErr.ts } catch { }
      Add-Finding -Check "App errors" -Status "WARN" -Detail "The app recorded $($errLines.Count) internal error(s) in $appErrLog (most recent: '$lastCtx' at $lastTs). These were handled without a crash, but review them; delete the file once addressed."
    } else {
      Add-Finding -Check "App errors" -Status "OK" -Detail "App-error log exists but is empty; no recorded app failures."
    }
  } else {
    Add-Finding -Check "App errors" -Status "OK" -Detail "No app-error log; the app has recorded no internal failures."
  }
} catch {
  Add-Finding -Check "App errors" -Status "WARN" -Detail "Could not read the app-error log: $($_.Exception.Message)"
}

# --- Report ---
Write-Output "PCC Doctor Report - $((Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz'))"
Write-Output "(Advisory only. Read-only. Does not gate or block any task cycle.)"
Write-Output ""

foreach ($f in $findings) {
  Write-Output "[$($f.status)] $($f.check): $($f.detail)"
}

$issueCount = @($findings | Where-Object { $_.status -eq "ISSUE" }).Count
$warnCount = @($findings | Where-Object { $_.status -eq "WARN" }).Count

Write-Output ""
if ($issueCount -gt 0) {
  Write-Output "Overall: $issueCount issue(s), $warnCount warning(s) found. Review above before trusting current state."
} elseif ($warnCount -gt 0) {
  Write-Output "Overall: no issues, $warnCount warning(s) found. Repo is usable; warnings are informational."
} else {
  Write-Output "Overall: OK. No issues or warnings found."
}

# Always exits 0: doctor reports, it never gates. Use
# scripts/enforce-handoff-restart-safety.ps1 for a deliberate blocking check.
exit 0
