<#
  FI-1 — interrupted paired-state transaction is completed by journal replay.
  Exercises the REAL scripts/lib/state-journal.ps1 (Resume-StateJournal) in a temp dir.
  Expected: RECOVERED. Prints ONE JSON result for run-failure-injection.ps1.
#>
$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
. (Join-Path $PSScriptRoot '..' 'lib' 'state-journal.ps1')   # Resume-StateJournal (+ Write-JsonAtomic)

$checks = New-Object System.Collections.ArrayList
function Add-Check($name, $ok, $detail) { [void]$checks.Add([ordered]@{ name = $name; ok = [bool]$ok; detail = "$detail" }) }
$baselineOk = $false; $injectionTriggered = $false; $observed = ''

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ("pcc-fi1-" + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
try {
  $t = Join-Path $tmp 'task-state.json'
  $p = Join-Path $tmp 'project-state.json'
  $j = Join-Path $tmp '.state-update.journal.json'

  # ---- baseline: valid OLD files; Resume with NO journal is a clean no-op ----
  Write-JsonAtomic -Path $t -Json (@{ task_status = 'in_progress'; step = 1 } | ConvertTo-Json)
  Write-JsonAtomic -Path $p -Json (@{ next_expected_action = 'implement'; step = 1 } | ConvertTo-Json)
  $noop = Resume-StateJournal -TaskStatePath $t -ProjectStatePath $p -JournalPath $j
  $baselineOk = ((-not $noop) -and ((Get-Content -Raw $t | ConvertFrom-Json).step -eq 1) -and ((Get-Content -Raw $p | ConvertFrom-Json).step -eq 1))

  # ---- inject: the interrupted paired write (task advanced, project STALE, journal present) ----
  $taskJson = (@{ task_status = 'complete'; step = 2 } | ConvertTo-Json)
  $projJson = (@{ next_expected_action = 'done'; step = 2 } | ConvertTo-Json)
  # The exact write-ahead journal the real writer records (both payloads as strings).
  Write-JsonAtomic -Path $j -Json ([ordered]@{ task_state_json = $taskJson; project_state_json = $projJson } | ConvertTo-Json -Depth 6)
  # Model the crash AFTER task-state advanced but BEFORE project-state: put NEW task on
  # disk, leave project at OLD/step 1 -> the exact task-advanced / project-stale split.
  Write-JsonAtomic -Path $t -Json $taskJson

  $projPre = (Get-Content -Raw $p | ConvertFrom-Json)
  $taskPre = (Get-Content -Raw $t | ConvertFrom-Json)
  $injectionTriggered = ((Test-Path $j) -and ($projPre.step -eq 1) -and ($taskPre.step -eq 2))
  $observed = "pre-replay split: journal=$([bool](Test-Path $j)) task.step=$($taskPre.step) project.step=$($projPre.step)"

  # ---- run the REAL recovery ----
  $replayed = Resume-StateJournal -TaskStatePath $t -ProjectStatePath $p -JournalPath $j

  $taskRaw = (Get-Content -Raw $t); $projRaw = (Get-Content -Raw $p)
  $taskAfter = ($taskRaw | ConvertFrom-Json); $projAfter = ($projRaw | ConvertFrom-Json)
  Add-Check 'replay_reported' $replayed 'Resume-StateJournal reported it replayed an interrupted write'
  Add-Check 'task_is_exact_new_payload' (($taskAfter.step -eq 2) -and ($taskAfter.task_status -eq 'complete') -and ($taskRaw.Trim() -eq $taskJson.Trim())) 'task-state == exact recorded NEW payload'
  Add-Check 'project_is_exact_new_payload' (($projAfter.step -eq 2) -and ($projAfter.next_expected_action -eq 'done') -and ($projRaw.Trim() -eq $projJson.Trim())) 'project-state advanced to exact recorded NEW payload — the split is healed'
  Add-Check 'journal_removed_after_both_writes' (-not (Test-Path $j)) 'journal cleared only after BOTH canonical writes completed'

  # ---- idempotence: a second recovery is a no-op and mutates nothing further ----
  $again = Resume-StateJournal -TaskStatePath $t -ProjectStatePath $p -JournalPath $j
  Add-Check 'idempotent_second_run' ((-not $again) -and ((Get-Content -Raw $t | ConvertFrom-Json).step -eq 2) -and ((Get-Content -Raw $p | ConvertFrom-Json).step -eq 2)) 're-running recovery does nothing further (idempotent)'
}
finally { Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue }

([ordered]@{ id = 'FI-1-journal-replay'; expected = 'RECOVERED'; baselineOk = $baselineOk; injectionTriggered = $injectionTriggered; observed = $observed; checks = @($checks) } | ConvertTo-Json -Depth 6)
