<#
  PCC recent decisions (COCKPIT_ROADMAP #5 - deeper memory carry-forward).

  Surfaces the most recent owner decisions from the canonical log
  (docs/DECISIONS.md) so neither the owner nor a fresh chat has to re-derive
  "what did we already decide?" - a direct hit on Groundhog Day.

  Deterministic: parses the decision headers, no LLM, read-only, always exits 0.
  -Count N (default 8) most recent by decision number. -Json for the app.
#>
param(
  [int]$Count = 8,
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$path = 'docs/DECISIONS.md'
$decisions = @()

if (Test-Path -LiteralPath $path -PathType Leaf) {
  $lines = Get-Content -LiteralPath $path
  for ($i = 0; $i -lt $lines.Count; $i++) {
    $m = [regex]::Match($lines[$i], '^##\s+DECISION-(\d+):\s*(.+?)\s*$')
    if (-not $m.Success) { continue }
    $num = [int]$m.Groups[1].Value
    $title = $m.Groups[2].Value
    # Skip the DECISION-0 template/legend header (real decisions start at 1).
    if ($num -lt 1 -or $title -eq 'Short Decision Title') { continue }
    # Look a few lines ahead for Date: and Status:
    $date = ''; $status = ''
    for ($j = $i + 1; $j -lt [Math]::Min($i + 8, $lines.Count); $j++) {
      if ($lines[$j] -match '^Date:\s*(.+?)\s*$' -and -not $date) { $date = $matches[1] }
      if ($lines[$j] -match '^Status:\s*(.+?)\s*$' -and -not $status) { $status = $matches[1] }
    }
    # PSCustomObject (not [ordered]) so Sort-Object -Property works reliably.
    $decisions += [pscustomobject]@{ num = $num; id = "DECISION-$num"; title = $title; date = $date; status = $status }
  }
}

# Most recent by number, keep the requested count.
$recent = @($decisions | Sort-Object -Property num -Descending | Select-Object -First $Count)

$result = [ordered]@{
  source     = $path
  found      = $decisions.Count
  showing    = $recent.Count
  decisions  = $recent
}

if ($Json) {
  $result | ConvertTo-Json -Depth 5
} else {
  if ($decisions.Count -eq 0) {
    Write-Output "No decisions found in $path."
  } else {
    Write-Output "Recent decisions (most recent $($recent.Count) of $($decisions.Count) in $path):"
    Write-Output ''
    foreach ($d in $recent) {
      $st = if ($d.status) { " [$($d.status)]" } else { '' }
      $dt = if ($d.date) { " ($($d.date))" } else { '' }
      Write-Output "$($d.id)$st$dt"
      Write-Output "   $($d.title)"
    }
  }
}
