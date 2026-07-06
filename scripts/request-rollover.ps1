param(
  [string]$Reason = "Owner requested a session rollover.",
  [string]$RequestDir = ".cockpit/request"
)

$ErrorActionPreference = "Stop"

# Rollover request producer (pcc-pathD-008, Category D Phase D3).
#
# This is the "command-to-copy" control the dashboard's Handoff/Rollover
# panel displays (owner-confirmed design: the dashboard is a static HTML file
# with no server, so it cannot write files from a live button click). The
# owner runs this script directly; it writes exactly one new file into
# .cockpit/request/ matching schemas/request.schema.json, with
# request_type "rollover" and status "pending". It writes nothing else and
# calls no other script. scripts/process-rollover-requests.ps1 is the
# separate consumer that later detects and acts on this file.

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

if (-not (Test-Path -LiteralPath $RequestDir -PathType Container)) {
  New-Item -ItemType Directory -Force -Path $RequestDir | Out-Null
}

$requestId = "rollover-$((Get-Date).ToString('yyyyMMdd-HHmmss'))-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$createdAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")

$request = [ordered]@{
  request_id   = $requestId
  request_type = "rollover"
  created_at   = $createdAt
  source       = "owner-cli"
  status       = "pending"
  payload      = [ordered]@{
    reason = $Reason
  }
}

$outputPath = Join-Path $RequestDir "$requestId.json"
if (Test-Path -LiteralPath $outputPath) {
  Fail "Refusing to overwrite an existing request file at $outputPath (unexpected request_id collision)."
}

$request | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outputPath
Write-Output "Rollover request '$requestId' written to $outputPath. Run scripts/process-rollover-requests.ps1 to have it picked up."
