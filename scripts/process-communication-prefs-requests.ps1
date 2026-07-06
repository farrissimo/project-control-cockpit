param(
  [string]$RequestDir = ".cockpit/request",
  [string]$ProjectStatePath = ".cockpit/state/project-state.json",
  [string]$ProjectStateSchemaPath = "schemas/project-state.schema.json",
  [string]$ValidateStateScriptPath = "scripts/validate-cockpit-state.ps1"
)

$ErrorActionPreference = "Stop"

# Tone/behavior request consumer (pcc-pathD-009, Category D Phase D3).
#
# This is the first request-file consumer that mutates canonical
# .cockpit/state/project-state.json (pcc-pathD-008's consumer only ran a
# read-only check and never touched canonical state). Discipline enforced
# here per DECISION-015 (state consistency must be checked with a local
# deterministic validator before an update is treated as complete): the FULL
# proposed project-state.json object is validated against
# schemas/project-state.schema.json BEFORE anything is written to disk. If
# invalid, nothing is written -- the request is rejected instead. Only
# communication_prefs and updated_at are ever changed by this pathway.

$recognizedFields = @(
  "tone", "language_level", "chattiness", "no_cheerleading",
  "concise_by_default", "explicit_uncertainty", "separate_facts_from_inference"
)

function Write-Warning2 {
  param([string]$Message)
  Write-Output "[WARNING] $Message"
}

if (-not (Test-Path -LiteralPath $RequestDir -PathType Container)) {
  Write-Output "No request directory at $RequestDir; nothing to process."
  exit 0
}

$processedDir = Join-Path $RequestDir "processed"
$rejectedDir = Join-Path $RequestDir "rejected"
foreach ($d in @($processedDir, $rejectedDir)) {
  if (-not (Test-Path -LiteralPath $d -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
  }
}

$candidateFiles = Get-ChildItem -LiteralPath $RequestDir -Filter "*.json" -File -ErrorAction SilentlyContinue

if (-not $candidateFiles -or $candidateFiles.Count -eq 0) {
  Write-Output "No pending request files found in $RequestDir. Nothing to process."
  exit 0
}

$processedCount = 0
$rejectedCount = 0
$skippedCount = 0

foreach ($file in $candidateFiles) {
  $req = $null
  try {
    $raw = Get-Content -Raw -LiteralPath $file.FullName
    $req = $raw | ConvertFrom-Json
  } catch {
    Write-Warning2 "Skipping $($file.Name): could not parse as JSON ($($_.Exception.Message)). Left in place."
    $skippedCount++
    continue
  }

  $requiredFields = @("request_id", "request_type", "created_at", "source", "status", "payload")
  $missing = $requiredFields | Where-Object { -not ($req.PSObject.Properties.Name -contains $_) }
  if ($missing.Count -gt 0) {
    Write-Warning2 "Skipping $($file.Name): missing required field(s) $($missing -join ', '). Left in place."
    $skippedCount++
    continue
  }

  if ($req.request_type -ne "communication_prefs_update") {
    # Not this consumer's concern -- e.g. a 'rollover' request belongs to
    # scripts/process-rollover-requests.ps1 instead.
    continue
  }

  if ($req.status -ne "pending") {
    continue
  }

  Write-Output "Processing communication_prefs_update request '$($req.request_id)' from $($file.Name)..."

  $rejectReason = $null

  if (-not $req.payload.fields -or ($req.payload.fields.PSObject.Properties.Name.Count -eq 0)) {
    $rejectReason = "payload.fields is empty; nothing to apply."
  } else {
    $requestedFieldNames = $req.payload.fields.PSObject.Properties.Name
    $unrecognized = $requestedFieldNames | Where-Object { $_ -notin $recognizedFields }
    if ($unrecognized.Count -gt 0) {
      $rejectReason = "Unrecognized communication_prefs field name(s): $($unrecognized -join ', ')."
    }
  }

  $proposedProjectState = $null
  if (-not $rejectReason) {
    $projectStateRaw = Get-Content -Raw -LiteralPath $ProjectStatePath
    $proposedProjectState = $projectStateRaw | ConvertFrom-Json
    foreach ($fieldName in $req.payload.fields.PSObject.Properties.Name) {
      $proposedProjectState.communication_prefs.$fieldName = $req.payload.fields.$fieldName
    }
    $proposedProjectState.updated_at = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

    $schema = Get-Content -Raw -LiteralPath $ProjectStateSchemaPath
    $proposedJson = $proposedProjectState | ConvertTo-Json -Depth 10
    try {
      $valid = Test-Json -Json $proposedJson -Schema $schema -ErrorAction Stop
      if (-not $valid) {
        $rejectReason = "Proposed project-state.json failed schema validation (Test-Json returned false)."
      }
    } catch {
      $rejectReason = "Proposed project-state.json failed schema validation: $($_.Exception.Message)"
    }
  }

  if ($rejectReason) {
    Write-Warning2 "Rejecting '$($req.request_id)': $rejectReason No file on disk was changed."
    $req.status = "rejected"
    if (-not ($req.payload.PSObject.Properties.Name -contains "rejection_reason")) {
      $req.payload | Add-Member -MemberType NoteProperty -Name "rejection_reason" -Value $rejectReason
    } else {
      $req.payload.rejection_reason = $rejectReason
    }
    $destPath = Join-Path $rejectedDir $file.Name
    $req | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $destPath
    Remove-Item -LiteralPath $file.FullName -Force
    $rejectedCount++
    continue
  }

  # --- Validated: safe to write. Keep the pre-write bytes so a surprise
  # post-write validate-cockpit-state.ps1 failure (cross-file consistency,
  # not schema shape) can be rolled back immediately rather than left as
  # written-but-unchecked state on disk. ---
  $preWriteRaw = $projectStateRaw
  $proposedProjectState | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $ProjectStatePath

  $postWriteOutput = & pwsh -NoProfile -File $ValidateStateScriptPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    Set-Content -LiteralPath $ProjectStatePath -Value $preWriteRaw -NoNewline
    Write-Error "Post-write validate-cockpit-state.ps1 FAILED after applying '$($req.request_id)': $($postWriteOutput -join ' | '). This should not happen given the pre-write schema check. project-state.json was rolled back to its pre-write content; the request file was left unmoved for manual review."
    exit 1
  }

  $req.status = "processed"
  $destPath = Join-Path $processedDir $file.Name
  $req | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $destPath
  Remove-Item -LiteralPath $file.FullName -Force

  Write-Output "Applied communication_prefs update from '$($req.request_id)' and moved it to $destPath."
  $processedCount++
}

Write-Output ""
Write-Output "Done. Processed: $processedCount. Rejected: $rejectedCount. Skipped (malformed/unreadable): $skippedCount."
