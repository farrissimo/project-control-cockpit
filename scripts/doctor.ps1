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

# --- Check 1: state consistency (schema/state alignment) ---
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

# --- Check 2: dual restart-safety (advisor brief + worker directive content) ---
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

# --- Check 3: schema/format check (project-state.json, task-state.json, verification-result.json) ---
# Requires pwsh (Test-Json does not exist in Windows PowerShell 5.1), same as
# the other composed checks above.
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

# --- Check 4: last known handoff-gate verdict (informational only - does not re-run the gate) ---
$gatePath = ".cockpit/state/handoff-gate.json"
$taskStatePath = ".cockpit/state/task-state.json"
$projectStatePath = ".cockpit/state/project-state.json"
$gate = Read-JsonSafe $gatePath
$taskState = Read-JsonSafe $taskStatePath
$projectState = Read-JsonSafe $projectStatePath

if ($null -eq $gate) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "No $gatePath found yet. The enforcement gate (scripts/enforce-handoff-restart-safety.ps1) has not been run this cycle."
} elseif ($null -ne $taskState -and $gate.task_id -ne $taskState.task_id) {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded gate result was for task '$($gate.task_id)' ($($gate.gate_result)), but the active task is now '$($taskState.task_id)'. Re-run scripts/enforce-handoff-restart-safety.ps1 before treating this task's handoff as gated."
} elseif ($gate.gate_result -eq "PASS") {
  Add-Finding -Check "Handoff gate (last known)" -Status "OK" -Detail "Last recorded result: PASS for task '$($gate.task_id)' at $($gate.checked_at)."
} else {
  Add-Finding -Check "Handoff gate (last known)" -Status "WARN" -Detail "Last recorded result: $($gate.gate_result) for task '$($gate.task_id)' at $($gate.checked_at). Reason: $($gate.reason)"
}

# --- Check 5: active task context (informational only, not a pass/fail judgment) ---
if ($null -eq $taskState) {
  Add-Finding -Check "Active task" -Status "WARN" -Detail "$taskStatePath is missing or unreadable."
} else {
  Add-Finding -Check "Active task" -Status "OK" -Detail "Task '$($taskState.task_id)' status is '$($taskState.task_status)' (verification_verdict: $($taskState.verification_verdict))."
}

# --- Check 6: working tree (uncommitted changes are normal mid-cycle, never an ISSUE) ---
try {
  $gitStatus = & git status --porcelain 2>&1
  if ($LASTEXITCODE -ne 0) {
    Add-Finding -Check "Working tree" -Status "WARN" -Detail "Could not read git status (not a git repo, or git unavailable): $(Strip-AnsiAndLastLine $gitStatus)"
  } elseif ([string]::IsNullOrWhiteSpace(($gitStatus -join "`n"))) {
    Add-Finding -Check "Working tree" -Status "OK" -Detail "No uncommitted changes."
  } else {
    $changedCount = @($gitStatus | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
    Add-Finding -Check "Working tree" -Status "WARN" -Detail "$changedCount uncommitted change(s) present. Normal mid-cycle; review before handoff/close-out."
  }
} catch {
  Add-Finding -Check "Working tree" -Status "WARN" -Detail "Could not run 'git status --porcelain': $($_.Exception.Message)"
}

# --- Check 7: branch hygiene (current branch vs. project-state.json's active_branch) ---
try {
  $currentBranch = (& git rev-parse --abbrev-ref HEAD 2>&1)
  if ($LASTEXITCODE -ne 0) {
    Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "Could not determine current branch (not a git repo, or git unavailable): $(Strip-AnsiAndLastLine $currentBranch)"
  } else {
    $currentBranch = "$currentBranch".Trim()
    $expectedBranch = if ($null -ne $projectState -and $projectState.PSObject.Properties.Name -contains "active_branch") { $projectState.active_branch } else { $null }

    $aheadBehindNote = ""
    $upstream = (& git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>&1)
    if ($LASTEXITCODE -eq 0) {
      $counts = (& git rev-list --left-right --count "HEAD...@{u}" 2>&1)
      if ($LASTEXITCODE -eq 0) {
        $parts = "$counts".Trim() -split "\s+"
        if ($parts.Count -eq 2) {
          $aheadBehindNote = " Upstream '$("$upstream".Trim())': $($parts[0]) ahead, $($parts[1]) behind."
        }
      }
    } else {
      $aheadBehindNote = " No upstream configured for this branch."
    }

    if ($null -eq $expectedBranch) {
      Add-Finding -Check "Branch hygiene" -Status "WARN" -Detail "On branch '$currentBranch'. $projectStatePath has no active_branch to compare against.$aheadBehindNote"
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
  $expectedSubdirs = @("backups", "handoff", "logs", "result", "state")
  $expectedStateFiles = @(
    ".cockpit/state/project-state.json",
    ".cockpit/state/task-state.json",
    ".cockpit/state/handoff-gate.json"
  )

  $missing = New-Object System.Collections.Generic.List[string]
  foreach ($d in $expectedSubdirs) {
    if (-not (Test-Path -LiteralPath ".cockpit/$d" -PathType Container)) { $missing.Add(".cockpit/$d") }
  }
  foreach ($f in $expectedStateFiles) {
    if (-not (Test-Path -LiteralPath $f -PathType Leaf)) { $missing.Add($f) }
  }

  $unexpected = New-Object System.Collections.Generic.List[string]
  if (Test-Path -LiteralPath ".cockpit" -PathType Container) {
    Get-ChildItem -LiteralPath ".cockpit" -Force | ForEach-Object {
      if ($_.Name -notin $expectedSubdirs) { $unexpected.Add($_.Name) }
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
