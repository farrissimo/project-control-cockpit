param(
  [string]$Tone,
  [string]$LanguageLevel,
  [string]$Chattiness,
  [bool]$NoCheerleading,
  [bool]$ConciseByDefault,
  [bool]$ExplicitUncertainty,
  [bool]$SeparateFactsFromInference,
  [string]$RequestDir = ".cockpit/request"
)

$ErrorActionPreference = "Stop"

# Tone/behavior request producer (pcc-pathD-009, Category D Phase D3).
#
# This is the "command-to-copy" control the dashboard displays (same design
# as pcc-pathD-008's rollover control: the dashboard is a static HTML file
# with no server, so it cannot write files from a live button click). The
# owner runs this script directly, supplying only the field(s) to change; it
# writes exactly one new file into .cockpit/request/ matching
# schemas/request.schema.json, with request_type "communication_prefs_update"
# and status "pending", whose payload.fields contains only the parameters
# actually supplied (a partial update). It writes nothing else and calls no
# other script. scripts/process-communication-prefs-requests.ps1 is the
# separate consumer that validates and applies this later.

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

$fields = [ordered]@{}
if ($PSBoundParameters.ContainsKey("Tone")) { $fields["tone"] = $Tone }
if ($PSBoundParameters.ContainsKey("LanguageLevel")) { $fields["language_level"] = $LanguageLevel }
if ($PSBoundParameters.ContainsKey("Chattiness")) { $fields["chattiness"] = $Chattiness }
if ($PSBoundParameters.ContainsKey("NoCheerleading")) { $fields["no_cheerleading"] = $NoCheerleading }
if ($PSBoundParameters.ContainsKey("ConciseByDefault")) { $fields["concise_by_default"] = $ConciseByDefault }
if ($PSBoundParameters.ContainsKey("ExplicitUncertainty")) { $fields["explicit_uncertainty"] = $ExplicitUncertainty }
if ($PSBoundParameters.ContainsKey("SeparateFactsFromInference")) { $fields["separate_facts_from_inference"] = $SeparateFactsFromInference }

if ($fields.Count -eq 0) {
  Fail "No communication_prefs field parameters were supplied. Nothing to request -- pass at least one, e.g. -Chattiness concise."
}

if (-not (Test-Path -LiteralPath $RequestDir -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $RequestDir | Out-Null
}

$requestId = "commprefs-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$createdAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

$request = [ordered]@{
  request_id   = $requestId
  request_type = "communication_prefs_update"
  created_at   = $createdAt
  source       = "owner-cli"
  status       = "pending"
  payload      = [ordered]@{
    fields = $fields
  }
}

$outputPath = Join-Path $RequestDir "$requestId.json"
if (Test-Path -LiteralPath $outputPath) {
  Fail "Refusing to overwrite an existing request file at $outputPath (unexpected request_id collision)."
}

$request | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outputPath
Write-Output "communication_prefs_update request '$requestId' written to $outputPath. Run scripts/process-communication-prefs-requests.ps1 to have it picked up."
