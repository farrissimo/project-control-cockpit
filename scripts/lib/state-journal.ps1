<#
  state-journal.ps1 — write-ahead journal for the PAIRED task-state/project-state
  write (Part 7 hardening I1). Dot-sourced by finalize-worker-handback.ps1 and
  advance-cockpit-state.ps1.

  THE PROBLEM: those scripts write task-state.json THEN project-state.json as two
  separate atomic writes. A kill BETWEEN them leaves the two canonical files
  inconsistent (task advanced, project stale), with no reliable way to detect it
  after the fact (project-state has its own independent update cadence, so comparing
  task-vs-project fields cannot distinguish a real split from a legitimate separate
  update — this was proven during implementation).

  THE FIX — a write-ahead journal, robust BY CONSTRUCTION (it never guesses whether a
  split happened; it completes a recorded intent):
    Write-PairedStateAtomic:
      1. Record BOTH intended file contents in a journal, written atomically.
      2. Apply write 1 (task-state), write 2 (project-state).
      3. Commit: delete the journal.
    Resume-StateJournal (called at the START of every writer run, before it reads
      state): if a journal exists, the previous paired write did not complete — re-apply
      BOTH files from the exact recorded payloads (idempotent) and delete the journal.

  A kill at ANY point leaves either no journal (fully committed) or a journal that the
  next run replays to completion — so the pair is atomic-in-effect. The recorded
  payloads are stored as their exact serialized JSON strings, so replay is byte-exact.

  Only ever writes task-state/project-state (+ the journal). Fails honest: a corrupt/
  unreadable journal throws rather than silently skipping recovery.
#>

. (Join-Path $PSScriptRoot 'atomic-write.ps1')  # Write-JsonAtomic — same lib/ dir

function Get-StateJournalPath {
  param([string]$StateDir = ".cockpit/state")
  return (Join-Path $StateDir '.state-update.journal.json')
}

# Replay an interrupted paired write if a journal is present. Idempotent; safe to call
# at the start of every run. Returns $true if it replayed, $false if there was nothing
# to do. Throws on a corrupt/incomplete journal (fail closed — never silently skip).
function Resume-StateJournal {
  param(
    [Parameter(Mandatory = $true)][string]$TaskStatePath,
    [Parameter(Mandatory = $true)][string]$ProjectStatePath,
    [Parameter(Mandatory = $true)][string]$JournalPath
  )
  if (-not (Test-Path -LiteralPath $JournalPath)) { return $false }
  $j = $null
  try { $j = Get-Content -Raw -LiteralPath $JournalPath | ConvertFrom-Json }
  catch { throw "State journal '$JournalPath' is unreadable/corrupt; refusing to guess. Inspect it before retrying: $($_.Exception.Message)" }

  $taskJson = $j.task_state_json
  $projJson = $j.project_state_json
  # Validate BOTH payloads up front, BEFORE any write, so a malformed journal FAILS
  # CLOSED here (journal left in place for inspection) instead of committing garbage into
  # the canonical files and then deleting the only recovery record. Each payload must be:
  #   1. an actual non-empty STRING (a bare number/object/array field would otherwise
  #      [string]-coerce to valid-looking JSON), and
  #   2. a JSON OBJECT — canonical state is an object, never a scalar/array/null/string.
  #      "starts with '{' after trim AND parses as valid JSON" is exactly "is a JSON
  #      object", and avoids ConvertFrom-Json's single-element-array unwrap quirk (a
  #      bare '[{...}]' would otherwise parse to an object).
  if ($taskJson -isnot [string] -or $projJson -isnot [string] -or
      [string]::IsNullOrWhiteSpace($taskJson) -or [string]::IsNullOrWhiteSpace($projJson)) {
    throw "State journal '$JournalPath' payloads are missing or not JSON strings; refusing to replay."
  }
  if ($taskJson.TrimStart()[0] -ne '{' -or $projJson.TrimStart()[0] -ne '{') {
    throw "State journal '$JournalPath' payloads are not JSON objects (canonical state must be an object, not a scalar/array/string); refusing to replay."
  }
  try {
    $null = $taskJson | ConvertFrom-Json -ErrorAction Stop
    $null = $projJson | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "State journal '$JournalPath' payloads are not valid JSON; refusing to replay: $($_.Exception.Message)"
  }

  # Validated — re-apply the exact recorded payloads (idempotent), THEN clear the journal
  # so a crash mid-replay just replays again next time.
  Write-JsonAtomic -Path $TaskStatePath -Json $taskJson
  Write-JsonAtomic -Path $ProjectStatePath -Json $projJson
  Remove-Item -LiteralPath $JournalPath -Force
  return $true
}

# Perform the paired write as a journaled transaction. $TaskState/$ProjectState are the
# in-memory objects; they are serialized once and both the journal and the files use the
# exact same bytes.
function Write-PairedStateAtomic {
  param(
    [Parameter(Mandatory = $true)][string]$TaskStatePath,
    [Parameter(Mandatory = $true)][string]$ProjectStatePath,
    [Parameter(Mandatory = $true)]$TaskState,
    [Parameter(Mandatory = $true)]$ProjectState,
    [Parameter(Mandatory = $true)][string]$JournalPath
  )
  $taskJson = $TaskState | ConvertTo-Json -Depth 10
  $projJson = $ProjectState | ConvertTo-Json -Depth 10
  $journalObj = [ordered]@{ task_state_json = $taskJson; project_state_json = $projJson }

  Write-JsonAtomic -Path $JournalPath -Json ($journalObj | ConvertTo-Json -Depth 6)  # 1. begin (record intent)
  Write-JsonAtomic -Path $TaskStatePath -Json $taskJson                              # 2. apply task-state
  Write-JsonAtomic -Path $ProjectStatePath -Json $projJson                           # 3. apply project-state
  Remove-Item -LiteralPath $JournalPath -Force                                       # 4. commit
}
