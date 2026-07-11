<#
  atomic-write.ps1 — dot-sourced durable-write helper for PCC's PowerShell state
  writers. Mirrors app/state/atomic-store.js so the state files those scripts own
  get the same guarantee the chat store already has: a write is all-or-nothing and
  the immediately-prior GOOD generation is always retained in <file>.prev.

  Write-JsonAtomic -Path <file> -Json <string>:
    1. REJECTS (throws) a payload that is empty or not valid JSON, BEFORE touching
       disk — an unserializable/garbage payload can never replace a good file.
    2. Ensures the parent directory exists.
    3. Stages the new bytes in a same-directory temp (touches nothing that exists).
    4. Preserves the prior generation BEFORE replacing the target:
         - current exists + valid JSON  -> atomically installed to <file>.prev FIRST;
         - current exists but UNREADABLE -> FAIL CLOSED (throw); never overwrite a
           possibly-good, momentarily-locked file;
         - current readable but corrupt  -> leave the existing good .prev untouched
           (never clobber it with garbage) and let the new valid target replace it.
    5. Installs the new target by atomic replace — [System.IO.File]::Move(.., $true)
       is MoveFileEx REPLACE_EXISTING, atomic on an NTFS same-volume rename — as the
       LAST mutating step, so a normal return means BOTH the new target and the prior
       generation are in place.
    Throws with a clear message on any failure; never returns a false success. Temp
    files are cleaned up on every path.

  DURABILITY SCOPE (honest): protects against INTERRUPTED / PARTIAL writes and
  process kills — the target is only ever replaced by a whole, already-written temp.
  It does NOT fsync (PowerShell has no portable fsync), so this is not an absolute
  power-loss guarantee — the same practical scope the JS primitive documents on
  Windows, where directory fsync is unavailable anyway.

  SCOPE: per-CALL atomicity only. Consistency ACROSS two Write-JsonAtomic calls
  (e.g. task-state.json + project-state.json) is NOT provided and is the caller's
  concern. NOTE (do not repeat the old false claim): validate-cockpit-state.ps1 is
  NOT a reliable cross-file backstop — it does not run if the process stops between
  the two writes, and even when it runs it skips a still-null project verdict
  (validate-cockpit-state.ps1:58), so a task-advanced / project-stale split can pass
  it. Each file does retain its own recoverable .prev; the cross-file window is
  bounded only by the pre-task backup, not automatically detected or repaired.
  (Part 7 I1 remainder — OPEN.)
#>

function Write-JsonAtomic {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Json
  )
  # Scope strict mode to THIS function only. This file is dot-sourced, and a
  # top-level Set-StrictMode would leak into the caller's scope (dot-source runs in
  # the current scope) — imposing strict-mode on consuming scripts that legitimately
  # reference optional/absent object properties (e.g. finalize-worker-handback.ps1).
  Set-StrictMode -Version Latest

  # 1. Validate the payload before touching disk. Empty/whitespace or non-JSON is
  #    refused — it must never replace a good file.
  if ([string]::IsNullOrWhiteSpace($Json)) {
    throw "Write-JsonAtomic: refusing to write '$Path' — payload is empty."
  }
  try { $null = $Json | ConvertFrom-Json -ErrorAction Stop }
  catch { throw "Write-JsonAtomic: refusing to write '$Path' — payload is not valid JSON: $($_.Exception.Message)" }

  # Resolve via PowerShell's provider (NOT [IO.Path]::GetFullPath, which uses
  # [Environment]::CurrentDirectory — PowerShell does not sync that with Set-Location).
  # GetUnresolvedProviderPathFromPSPath handles a not-yet-existing target too.
  $full = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($Path)
  $dir = [System.IO.Path]::GetDirectoryName($full)
  if ([string]::IsNullOrEmpty($dir)) { throw "Write-JsonAtomic: cannot resolve a directory for '$Path'." }
  if (-not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

  $rand = [System.IO.Path]::GetRandomFileName()
  $targetTmp = "$full.tmp-$PID-$rand"
  $prevTmp = $null

  try {
    # 2. Stage the new content (UTF-8, no BOM — matches the JSON writers).
    $enc = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($targetTmp, $Json, $enc)

    # 3. Preserve the prior generation BEFORE replacing the target.
    if ([System.IO.File]::Exists($full)) {
      $curBytes = $null
      try { $curBytes = [System.IO.File]::ReadAllBytes($full) }
      catch { throw "Write-JsonAtomic: current file '$Path' exists but is unreadable; failing closed rather than overwrite it: $($_.Exception.Message)" }

      $curValid = $true
      try { $null = [System.Text.Encoding]::UTF8.GetString($curBytes).TrimStart([char]0xFEFF) | ConvertFrom-Json -ErrorAction Stop }
      catch { $curValid = $false }

      if ($curValid) {
        # Preserve the EXACT prior bytes, then atomically install to .prev. If this
        # fails the whole write is rejected (current target + existing .prev intact).
        $prevTmp = "$full.prevtmp-$PID-$rand"
        [System.IO.File]::WriteAllBytes($prevTmp, $curBytes)
        [System.IO.File]::Move($prevTmp, "$full.prev", $true)
        $prevTmp = $null
      }
      # else: readable but corrupt JSON — keep the existing good .prev (never clobber).
    }

    # 4. Install the new target atomically — the LAST mutating step.
    [System.IO.File]::Move($targetTmp, $full, $true)
    $targetTmp = $null
  }
  finally {
    if ($targetTmp -and [System.IO.File]::Exists($targetTmp)) { try { [System.IO.File]::Delete($targetTmp) } catch {} }
    if ($prevTmp -and [System.IO.File]::Exists($prevTmp)) { try { [System.IO.File]::Delete($prevTmp) } catch {} }
  }
}
