<#
  FI-2 — a corrupt/incomplete state journal is REFUSED (never replays garbage).
  Exercises the REAL scripts/lib/state-journal.ps1 (Resume-StateJournal). Expected: CONTAINED.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. (Join-Path $PSScriptRoot '..' 'lib' 'state-journal.ps1')

$checks = New-Object System.Collections.ArrayList
function Add-Check($name, $ok, $detail) { [void]$checks.Add([ordered]@{ name = $name; ok = [bool]$ok; detail = "$detail" }) }
$baselineOk = $false; $injectionTriggered = $false; $observed = ''

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("pcc-fi2-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
  $t = Join-Path $tmp 'task-state.json'
  $p = Join-Path $tmp 'project-state.json'
  $j = Join-Path $tmp '.state-update.journal.json'

  # ---- baseline: valid canonical files present, no journal -> Resume is a clean no-op ----
  Write-JsonAtomic -Path $t -Json (@{ task_status = 'in_progress'; step = 1 } | ConvertTo-Json)
  Write-JsonAtomic -Path $p -Json (@{ next_expected_action = 'implement'; step = 1 } | ConvertTo-Json)
  $noop = Resume-StateJournal -TaskStatePath $t -ProjectStatePath $p -JournalPath $j
  $baselineOk = ((-not $noop) -and ((Get-Content -Raw $t | ConvertFrom-Json).step -eq 1))
  $taskBefore = Get-Content -Raw $t
  $projBefore = Get-Content -Raw $p

  # ---- inject: a MALFORMED journal — valid JSON file, but a payload that is NOT a JSON
  #      object (canonical state must be an object). Resume must refuse BEFORE any write. ----
  $bad = [ordered]@{ task_state_json = 'not-a-json-object'; project_state_json = '{"next_expected_action":"done"}' } | ConvertTo-Json
  Set-Content -LiteralPath $j -Value $bad -Encoding UTF8
  $injectionTriggered = (Test-Path $j)
  $observed = 'malformed journal present: task payload is a bare string, not a JSON object'

  # ---- run the REAL recovery: it MUST throw a visible refusal, write nothing ----
  $threw = $false; $errMsg = ''
  try { $null = Resume-StateJournal -TaskStatePath $t -ProjectStatePath $p -JournalPath $j }
  catch { $threw = $true; $errMsg = $_.Exception.Message }

  Add-Check 'resume_refused_visibly' $threw "Resume-StateJournal threw a visible refusal rather than replaying garbage: $errMsg"
  Add-Check 'task_state_unchanged' ((Get-Content -Raw $t) -eq $taskBefore) 'the canonical task-state is untouched by the refused replay'
  Add-Check 'project_state_unchanged' ((Get-Content -Raw $p) -eq $projBefore) 'the canonical project-state is untouched by the refused replay'
  Add-Check 'journal_left_for_inspection' (Test-Path $j) 'the corrupt journal is preserved for inspection, not silently deleted'
}
finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

([ordered]@{ id = 'FI-2-journal-corrupt'; expected = 'CONTAINED'; baselineOk = $baselineOk; injectionTriggered = $injectionTriggered; observed = $observed; checks = @($checks) } | ConvertTo-Json -Depth 6)
