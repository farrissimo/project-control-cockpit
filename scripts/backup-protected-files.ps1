param(
  [Parameter(Mandatory = $true)]
  [ValidateSet("Backup", "Restore", "List")]
  [string]$Action,

  [string]$RestorePoint,

  [string]$BackupRoot = ".cockpit/backups"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

# The protected set is deliberately explicit: canonical state, live handoff
# artifacts, the latest evidence/verification pair, core scripts, schemas,
# and canonical docs. This is not meant to snapshot the whole repo - just the
# files whose damage would be hardest to recover from without a clean prior
# git commit.
$ProtectedFiles = @(
  ".cockpit/state/project-state.json",
  ".cockpit/state/task-state.json",
  ".cockpit/handoff/worker-directive.md",
  ".cockpit/handoff/advisor-restart-brief.md",
  ".cockpit/result/worker-result.md",
  ".cockpit/result/verification-result.json"
)

if (Test-Path -LiteralPath "scripts" -PathType Container) {
  $scriptFiles = Get-ChildItem -LiteralPath "scripts" -Filter "*.ps1" -File
  foreach ($f in $scriptFiles) {
    $ProtectedFiles += "scripts/$($f.Name)"
  }
}

if (Test-Path -LiteralPath "schemas" -PathType Container) {
  $schemaFiles = Get-ChildItem -LiteralPath "schemas" -Filter "*.json" -File
  foreach ($f in $schemaFiles) {
    $ProtectedFiles += "schemas/$($f.Name)"
  }
}

if (Test-Path -LiteralPath "docs" -PathType Container) {
  $docFiles = Get-ChildItem -LiteralPath "docs" -Filter "*.md" -File
  foreach ($f in $docFiles) {
    $ProtectedFiles += "docs/$($f.Name)"
  }
}

function Do-Backup {
  $timestamp = (Get-Date).ToString("yyyyMMdd-HHmmss")
  $destDir = Join-Path $BackupRoot $timestamp

  if (Test-Path -LiteralPath $destDir) {
    Fail "Restore point '$timestamp' already exists at $destDir. Try again in a moment so the timestamp changes."
  }
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null

  $backedUp = New-Object System.Collections.Generic.List[string]
  $skipped = New-Object System.Collections.Generic.List[string]

  foreach ($relPath in $ProtectedFiles) {
    if (Test-Path -LiteralPath $relPath -PathType Leaf) {
      $destPath = Join-Path $destDir $relPath
      $destParent = Split-Path -Parent $destPath
      if (-not (Test-Path -LiteralPath $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
      }
      Copy-Item -LiteralPath $relPath -Destination $destPath -Force
      $backedUp.Add($relPath)
    } else {
      # Missing files (e.g. no advisor brief drafted yet) are recorded, not
      # fatal - a backup helper must never fail a cycle just because an
      # optional artifact does not exist yet.
      $skipped.Add($relPath)
    }
  }

  $activeTaskId = $null
  if (Test-Path -LiteralPath ".cockpit/state/task-state.json" -PathType Leaf) {
    try {
      $activeTaskId = (Get-Content -Raw -LiteralPath ".cockpit/state/task-state.json" | ConvertFrom-Json).task_id
    } catch {
      $activeTaskId = $null
    }
  }

  $manifest = [ordered]@{
    created_at      = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    restore_point    = $timestamp
    task_id         = $activeTaskId
    backed_up_files = $backedUp
    skipped_files   = $skipped
    note            = "Non-canonical PCC pre-task restore point. Not project truth. See docs/STATE_MODEL.md."
  }
  ($manifest | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath (Join-Path $destDir "manifest.json")

  Write-Output "Restore point '$timestamp' created at $destDir ($($backedUp.Count) file(s) backed up, $($skipped.Count) skipped/missing)."
  Write-Output "Restore with: pwsh -NoProfile -File scripts/backup-protected-files.ps1 -Action Restore -RestorePoint $timestamp"
}

function Do-Restore {
  if ([string]::IsNullOrWhiteSpace($RestorePoint)) {
    Fail "Restore requires -RestorePoint <name>. Use -Action List to see available restore points."
  }

  $sourceDir = Join-Path $BackupRoot $RestorePoint
  $manifestPath = Join-Path $sourceDir "manifest.json"

  if (-not (Test-Path -LiteralPath $sourceDir -PathType Container)) {
    Fail "Restore point '$RestorePoint' does not exist under $BackupRoot."
  }
  if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
    Fail "Restore point '$RestorePoint' is missing its manifest.json and cannot be trusted. Restore aborted."
  }

  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json

  $restored = New-Object System.Collections.Generic.List[string]
  foreach ($relPath in $manifest.backed_up_files) {
    $srcPath = Join-Path $sourceDir $relPath
    if (-not (Test-Path -LiteralPath $srcPath -PathType Leaf)) {
      Fail "Restore point '$RestorePoint' manifest lists '$relPath' but the file is missing from the snapshot. Restore aborted before making any changes."
    }
  }

  foreach ($relPath in $manifest.backed_up_files) {
    $srcPath = Join-Path $sourceDir $relPath
    $destParent = Split-Path -Parent $relPath
    if ($destParent -and -not (Test-Path -LiteralPath $destParent)) {
      New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }
    Copy-Item -LiteralPath $srcPath -Destination $relPath -Force
    $restored.Add($relPath)
  }

  Write-Output "Restored $($restored.Count) file(s) from restore point '$RestorePoint':"
  foreach ($r in $restored) { Write-Output "  $r" }
}

function Do-List {
  if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
    Write-Output "No restore points found ($BackupRoot does not exist yet)."
    return
  }
  $points = Get-ChildItem -LiteralPath $BackupRoot -Directory | Sort-Object Name
  if ($points.Count -eq 0) {
    Write-Output "No restore points found under $BackupRoot."
    return
  }
  foreach ($p in $points) {
    $manifestPath = Join-Path $p.FullName "manifest.json"
    if (Test-Path -LiteralPath $manifestPath -PathType Leaf) {
      $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
      Write-Output "$($p.Name)  ($($manifest.backed_up_files.Count) file(s), created $($manifest.created_at))"
    } else {
      Write-Output "$($p.Name)  (no manifest.json - do not restore from this one)"
    }
  }
}

switch ($Action) {
  "Backup"  { Do-Backup }
  "Restore" { Do-Restore }
  "List"    { Do-List }
}
