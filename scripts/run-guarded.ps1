<#
  run-guarded.ps1 — LONG-RUN FORWARD-PROGRESS GUARD.

  WHY THIS EXISTS
  ---------------
  PCC forbids fake-green, false reassurance, and owner babysitting everywhere — EXCEPT it had one
  hole: long-running verification (the test suite / release gate / mutation & failure-injection
  proofs) had no enforced check that the run was actually MOVING. An operator (human OR AI) could
  say "still running" while a wedged process sat dead for hours. That once cost the owner ~7h of
  false reassurance. This guard closes that hole: it makes "still running" a TOOL-PROVEN fact, not
  a claim anyone can assert, and it can never itself hang forever.

  WHAT IT DOES (deterministic, no LLM, no network)
  ------------------------------------------------
  1. KILLS STALE TEST PROCESSES first — leftover `pcc-test` electrons/node from an earlier run are
     cleared as hygiene before a fresh e2e launch. (This was once believed to be the 7h hang's
     mechanism via a single-instance-lock collision; that theory was reproduced and DISPROVEN — see
     docs/HARDENING_LONG_RUN_GUARD.md — so this reap is defensive cleanup, NOT the proven fix; the
     enforced defence is the forward-progress abort below.) Safe by construction: it only matches
     command lines containing the test-only marker(s), never the owner's real app.
  2. RUNS the target command as a child, streaming its output to log files.
  3. SAMPLES EVIDENCE PROGRESS every -SampleSec. EVIDENCE = the child's combined output GREW (a
     reporter line, a completed test/case — "something advanced"). Output growth, NOT "a process
     exists" and NOT "CPU is busy", is the progress signal, and it generalises to any long run (suite,
     gate, proofs), not just Playwright. CPU is sampled too but only as ACTIVITY: it proves the tree
     is doing something, not that it is advancing (a busy infinite loop burns CPU forever), so it buys
     only a small, explicitly-bounded silent-work grace (-CpuGraceSec) — never resets the clock. Each
     sample updates a machine-readable HEARTBEAT that distinguishes evidence progress from activity.
  4. DECLARES HUNG AND ABORTS (kills the whole process tree) if there is NO evidence progress for
     -StallSec (+ up to -CpuGraceSec more only while the tree is actively burning CPU). It never
     silently waits, and a CPU-burning loop is aborted at that bound, never postponed to -MaxSec.
  5. Enforces a HARD OVERALL CAP (-MaxSec) too — the proven CI watchdog pattern (inactivity timeout
     + hard cap, e.g. Travis CI's "no output in 10 min / 50-min job cap"; Playwright's own
     globalTimeout is the in-tool version and stays as an inner backstop).
  6. EMITS a machine-readable VERDICT (+ the heartbeat) so the outcome is provable evidence.

  USAGE
  -----
    pwsh -NoProfile -File scripts/run-guarded.ps1 -Label suite -Command 'npm test'
    pwsh -NoProfile -File scripts/run-guarded.ps1 -Label gate -StallSec 300 -MaxSec 2400 -Command 'pwsh -NoProfile -File scripts/run-release-gate.ps1'
  The whole command is ONE string, run via cmd.exe /c so npm/pwsh/node all resolve normally on
  Windows (a single string sidesteps PowerShell's parameter-binding ambiguity around `-` flags).

  EXIT CODES: 0 = child passed (exit 0). 1 = child FAILED (nonzero exit). 2 = SETUP error (could
  not start / bad args). 3 = HUNG (no forward progress within -StallSec). 4 = CAP exceeded (-MaxSec).
  -Json prints the verdict record to stdout.

  ARTIFACTS (git-ignored, under .cockpit/evidence/guard/ by default, override with -EvidenceDir):
    <label>.heartbeat.json  — live, updated every sample; a reader sees lastProgress advancing or not
    <label>.verdict.json    — final, machine-readable outcome
    <label>.out.log / .err.log — the child's captured output
#>
[CmdletBinding()]
param(
  [string]$Label = 'run',
  [string]$WorkDir,
  [int]$StallSec = 180,     # PRIMARY hang-catcher: abort if NO EVIDENCE progress (output/case count grew)
                            #   for this many seconds AND the tree is not burning CPU. Evidence — not
                            #   "a process exists" and not "CPU is busy" — is what resets this clock.
  [int]$CpuGraceSec = 120,  # SMALL, explicitly-bounded silent-work grace: while the process tree is
                            #   actively burning CPU, allow this much EXTRA silence beyond -StallSec
                            #   before declaring HUNG. Bounded on purpose — CPU is activity, not
                            #   progress, so a CPU-burning infinite loop is still aborted at
                            #   StallSec+CpuGraceSec, NEVER postponed to the -MaxSec hard cap.
  [int]$MaxSec   = 3600,    # last-resort backstop: hard wall-clock cap (generous — a progressing run is
                            #   caught by the stall check, not this, so this only stops a run that makes
                            #   endless output but never actually finishes)
  [int]$SampleSec = 10,     # progress sampling interval
  [string]$EvidenceDir,
  # Reap targets a stale process ONLY when BOTH hold: its executable name is in this allowlist AND
  # its command line contains a marker below. The name gate is the safety wall — a shell, editor,
  # grep, or the agent harness that merely MENTIONS the marker can never be a target; only the
  # actual test-runtime binaries (Electron app + its node grandchildren) qualify.
  [string[]]$KillStaleName = @('electron.exe', 'node.exe'),
  # cmdline substring(s) marking a throwaway TEST instance. Default is the dedicated launch flag
  # tests/helpers/launch.js adds to every Playwright electron — an unmistakable token no real user
  # process ever carries (a loose 'pcc-test' could hit an unrelated app under a pcc-test-* path).
  [string[]]$KillStalePattern = @('--pcc-test-instance'),
  [switch]$NoKillStale,
  [switch]$Json,
  [switch]$Quiet,
  [Parameter(Mandatory = $true, Position = 0)]
  [string]$Command
)

$ErrorActionPreference = 'Stop'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}

$repoRoot = Split-Path -Parent $PSScriptRoot
if (-not $WorkDir) { $WorkDir = $repoRoot }
if (-not $EvidenceDir) { $EvidenceDir = Join-Path $repoRoot '.cockpit/evidence/guard' }

# NOTE: use [Console]::Error, not Write-Error — with $ErrorActionPreference='Stop' a Write-Error
# terminates the script with exit code 1 BEFORE 'exit 2' runs, which would collapse a real
# setup-error into a suite FAILURE at the release gate. Setup failures must exit exactly 2.
if ([string]::IsNullOrWhiteSpace($Command)) { [Console]::Error.WriteLine('run-guarded: no command given (-Command ''<command line>'')'); exit 2 }

$safeLabel = ($Label -replace '[^A-Za-z0-9._-]', '_')
$outLog      = Join-Path $EvidenceDir "$safeLabel.out.log"
$errLog      = Join-Path $EvidenceDir "$safeLabel.err.log"
$heartbeat   = Join-Path $EvidenceDir "$safeLabel.heartbeat.json"
$verdictPath = Join-Path $EvidenceDir "$safeLabel.verdict.json"

try { if (-not (Test-Path -LiteralPath $EvidenceDir)) { New-Item -ItemType Directory -Path $EvidenceDir -Force | Out-Null } }
catch { [Console]::Error.WriteLine("run-guarded: cannot create evidence dir '$EvidenceDir': $($_.Exception.Message)"); exit 2 }
# Fresh logs per run (the receipt is a single-run record, like the release gate's).
foreach ($f in @($outLog, $errLog)) { try { if (Test-Path -LiteralPath $f) { Remove-Item -LiteralPath $f -Force } } catch {} }
New-Item -ItemType File -Path $outLog -Force | Out-Null
New-Item -ItemType File -Path $errLog -Force | Out-Null

function Now { Get-Date }
function Iso([datetime]$t) { $t.ToString('yyyy-MM-ddTHH:mm:sszzz') }

# Atomic JSON write (temp -> move) so a live reader never sees a half-written heartbeat/verdict.
function Write-JsonAtomic([string]$path, $obj) {
  $tmp = "$path.tmp"
  try {
    ($obj | ConvertTo-Json -Depth 8) | Out-File -FilePath $tmp -Encoding utf8 -ErrorAction Stop
    Move-Item -LiteralPath $tmp -Destination $path -Force -ErrorAction Stop
  } catch { try { if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force } } catch {} }
}

function Get-LogBytes {
  $b = 0
  foreach ($f in @($outLog, $errLog)) { try { if (Test-Path -LiteralPath $f) { $b += (Get-Item -LiteralPath $f).Length } } catch {} }
  return $b
}

# Total CPU time (ms) burned by the child and ALL its descendants. This is the SECOND progress
# signal beside output growth: a genuinely-hung tree stops accumulating CPU, while a working one
# keeps burning it even during a silent/buffered phase. So "still doing real work" is proven, not
# assumed from output alone — this is what stops the guard from false-aborting a busy-but-quiet run.
# Best-effort: returns -1 on any failure, and the caller then relies on output growth only.
function Get-TreeCpuMs([int]$rootPid) {
  try {
    $all = Get-CimInstance Win32_Process -ErrorAction Stop
    $byParent = @{}
    foreach ($p in $all) { $k = [int]$p.ParentProcessId; if (-not $byParent.ContainsKey($k)) { $byParent[$k] = @() }; $byParent[$k] += $p }
    $byId = @{}
    foreach ($p in $all) { $byId[[int]$p.ProcessId] = $p }
    $stack = New-Object System.Collections.Stack; $stack.Push([int]$rootPid)
    $seen = @{}; $totalMs = 0.0
    while ($stack.Count -gt 0) {
      $curPid = [int]$stack.Pop()            # NOTE: not $pid — that is PowerShell's own PID
      if ($seen.ContainsKey($curPid)) { continue }
      $seen[$curPid] = $true
      $proc = $byId[$curPid]
      if ($proc) { $totalMs += ([double]$proc.KernelModeTime + [double]$proc.UserModeTime) / 10000.0 }  # 100ns units -> ms
      if ($byParent.ContainsKey($curPid)) { foreach ($c in $byParent[$curPid]) { $stack.Push([int]$c.ProcessId) } }
    }
    return $totalMs
  } catch { return -1.0 }
}

# Read newly-appended text from a log since a byte offset (efficient incremental tail for live echo).
function Read-Since([string]$path, [long]$offset) {
  try {
    $fs = [System.IO.File]::Open($path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
    try {
      if ($fs.Length -le $offset) { return @{ text = ''; offset = $fs.Length } }
      $fs.Seek($offset, [System.IO.SeekOrigin]::Begin) | Out-Null
      $len = $fs.Length - $offset
      $buf = New-Object byte[] $len
      [void]$fs.Read($buf, 0, $len)
      return @{ text = [System.Text.Encoding]::UTF8.GetString($buf); offset = $fs.Length }
    } finally { $fs.Dispose() }
  } catch { return @{ text = ''; offset = $offset } }
}

# ---- 1. reap stale test processes (defensive hygiene; NOT the proven hang fix — see header) ----
$killed = @()
if (-not $NoKillStale -and $KillStalePattern.Count -gt 0 -and $KillStaleName.Count -gt 0) {
  $nameSet = @($KillStaleName | ForEach-Object { $_.ToLower() })
  try {
    $selfPid = $PID
    $procs = Get-CimInstance Win32_Process -ErrorAction Stop
    foreach ($p in $procs) {
      if ($p.ProcessId -eq $selfPid) { continue }
      # SAFETY WALL: name must be an allowed test-runtime binary, else never a candidate.
      if ($nameSet -notcontains "$($p.Name)".ToLower()) { continue }
      $cl = "$($p.CommandLine)"
      if (-not $cl) { continue }
      $match = $false
      foreach ($pat in $KillStalePattern) { if ($pat -and $cl.ToLower().Contains($pat.ToLower())) { $match = $true; break } }
      if ($match) {
        try { & taskkill /PID $p.ProcessId /T /F *> $null } catch {}
        $killed += [ordered]@{ pid = $p.ProcessId; name = "$($p.Name)" }
      }
    }
  } catch { <# process enumeration unavailable: proceed; the guard's own abort still bounds the run #> }
  if ($killed.Count -gt 0 -and -not $Quiet -and -not $Json) {
    Write-Host "[guard $safeLabel] reaped $($killed.Count) stale test process(es) before start."
  }
}

# ---- 2. launch the child ------------------------------------------------------------------------
# Mark the child (and its whole subtree) as ALREADY guarded. The canonical entrypoints
# (app: npm test via tools/guarded-test.js; scripts: the proof scripts' self-guard re-exec) check
# this sentinel and run RAW when it is set, so a guarded command never wraps itself in a second guard.
$env:PCC_GUARDED = '1'
$startedAt = Now
$state = 'running'          # running | passed | failed | hung | cap | setup-error
$proc = $null
try {
  $proc = Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', $Command) -WorkingDirectory $WorkDir `
            -NoNewWindow -PassThru -RedirectStandardOutput $outLog -RedirectStandardError $errLog -ErrorAction Stop
  # Cache the handle NOW so $proc.ExitCode is reliable after exit (Start-Process -PassThru gotcha).
  $null = $proc.Handle
} catch {
  $state = 'setup-error'
}

if ($state -eq 'setup-error' -or $null -eq $proc) {
  $rec = [ordered]@{
    schema = 'run-guarded/v2'; label = $Label; state = 'setup-error'; command = $Command
    started_at = (Iso $startedAt); ended_at = (Iso (Now)); exit_code = $null
    reason = 'could not start the child process'; stale_reaped = @($killed)
  }
  Write-JsonAtomic $verdictPath $rec
  if ($Json) { $rec | ConvertTo-Json -Depth 8 } elseif (-not $Quiet) { Write-Host "[guard $safeLabel] SETUP-ERROR: could not start '$Command'." }
  exit 2
}

if (-not $Quiet -and -not $Json) {
  Write-Host "[guard $safeLabel] pid=$($proc.Id) — stall>$StallSec s or cap>$MaxSec s aborts. cmd: $Command"
}

# ---- 3. monitor forward progress ----------------------------------------------------------------
# ACTIVITY vs EVIDENCE PROGRESS — the distinction the guard turns on.
#   EVIDENCE progress = the child's combined output GREW (a Playwright reporter line, a completed
#     case, any real "something advanced" byte). This — and ONLY this — resets the stall clock. It is
#     never "a process exists". For the proofs, each case emits a boundary line, so a completed case
#     is evidence. Output growth generalises to every long run.
#   ACTIVITY = the process tree is burning CPU. CPU proves the tree is DOING something, not that it is
#     ADVANCING (a busy infinite loop burns CPU forever). So CPU is recorded as diagnostics and buys
#     only a SMALL, explicitly-bounded silent-work grace (-CpuGraceSec): while the tree is actively
#     burning CPU, silence is tolerated up to StallSec+CpuGraceSec, no further. A CPU-burning infinite
#     loop is thus aborted at that bound, NOT postponed to the -MaxSec hard cap; a brief legitimate
#     silent computation (well under the bound) is not false-aborted.
$lastEvidenceAt = $startedAt   # last time OUTPUT grew — the real forward-progress signal
$lastBytes = 0
$lastCpuMs = 0.0
$cpuActive = $false            # was the tree burning CPU during the most recent SILENT interval?
$samples = 0
$outOffset = 0L
$errOffset = 0L
# "Real work this interval" threshold for the CPU activity signal: ~5% of one core over the sample
# window (min 50ms). A hung tree stays well below it; any actual computation clears it easily.
$cpuStepMs = [math]::Max(50, $SampleSec * 50)

function Save-Heartbeat([string]$st, [double]$elapsed, [double]$sinceEvidence, [long]$bytes, [double]$cpuMs, [bool]$cpuAct, [double]$effStall) {
  Write-JsonAtomic $heartbeat ([ordered]@{
    schema = 'run-guarded-heartbeat/v2'; label = $Label; state = $st; pid = $proc.Id
    command = $Command; started_at = (Iso $startedAt); updated_at = (Iso (Now))
    # EVIDENCE progress (resets the stall clock):
    last_evidence_at = (Iso $lastEvidenceAt); since_evidence_sec = [math]::Round($sinceEvidence, 1)
    output_bytes = $bytes
    # ACTIVITY (diagnostic only; buys the bounded grace, never counts as progress):
    tree_cpu_ms = [math]::Round($cpuMs, 0); cpu_active = $cpuAct
    elapsed_sec = [math]::Round($elapsed, 1); samples = $samples
    stall_limit_sec = $StallSec; cpu_grace_sec = $CpuGraceSec
    effective_stall_sec = [math]::Round($effStall, 1); cap_limit_sec = $MaxSec
  })
}
Save-Heartbeat 'running' 0 0 0 0 $false $StallSec

while (-not $proc.HasExited) {
  $exited = $proc.WaitForExit($SampleSec * 1000)
  $samples++
  $now = Now
  $elapsed = ($now - $startedAt).TotalSeconds
  $bytes = Get-LogBytes

  # live-echo any new child output (so a human sees real motion, not just a counter)
  if (-not $Quiet -and -not $Json) {
    $o = Read-Since $outLog $outOffset; $outOffset = $o.offset; if ($o.text) { Write-Host -NoNewline $o.text }
    $e = Read-Since $errLog $errOffset; $errOffset = $e.offset; if ($e.text) { Write-Host -NoNewline $e.text }
  }

  # EVIDENCE: output grew -> reset the stall clock. This is the only thing that counts as progress.
  # ACTIVITY: only when output was SILENT this interval, sample tree CPU (paid only during silence, so
  # a streaming run stays cheap). CPU growth does NOT reset the clock; it only flags $cpuActive, which
  # extends the tolerated silence by the bounded grace below.
  if ($bytes -gt $lastBytes) {
    $lastEvidenceAt = $now; $lastBytes = $bytes; $cpuActive = $false
  } else {
    $cpuActive = $false
    $cpu = Get-TreeCpuMs $proc.Id
    if ($cpu -ge 0) {
      if ($cpu -gt ($lastCpuMs + $cpuStepMs)) { $cpuActive = $true }
      $lastCpuMs = [math]::Max($lastCpuMs, $cpu)
    }
  }
  $sinceEvidence = ($now - $lastEvidenceAt).TotalSeconds
  # Bounded grace: extra silence is tolerated ONLY while the tree is actively burning CPU, and only up
  # to +CpuGraceSec. A CPU-burning loop stays $cpuActive forever, so it is still aborted at this bound.
  $effectiveStall = if ($cpuActive) { $StallSec + $CpuGraceSec } else { $StallSec }
  Save-Heartbeat 'running' $elapsed $sinceEvidence $bytes $lastCpuMs $cpuActive $effectiveStall

  if (-not $Quiet -and -not $Json) {
    Write-Host ("[guard $safeLabel] t={0}s +{1}KB last-evidence {2}s ago{3}" -f [int]$elapsed, [int]($bytes/1KB), [int]$sinceEvidence, $(if ($cpuActive) { ' (cpu busy, grace)' } else { '' }))
  }

  if ($exited) { break }
  if ($sinceEvidence -ge $effectiveStall) { $state = 'hung'; break }
  if ($elapsed -ge $MaxSec) { $state = 'cap'; break }
}

# ---- 4. resolve outcome -------------------------------------------------------------------------
$endedAt = Now
$exitCode = $null
if ($state -eq 'hung' -or $state -eq 'cap') {
  # abort the WHOLE tree (electron + fakebin grandchildren) — a force-kill so nothing lingers.
  try { & taskkill /PID $proc.Id /T /F *> $null } catch {}
  try { $proc.WaitForExit(5000) | Out-Null } catch {}
} else {
  # normal exit
  try { $proc.WaitForExit() | Out-Null } catch {}
  try { $exitCode = $proc.ExitCode } catch { $exitCode = $null }
  if ($null -eq $exitCode) { $state = 'failed' } # unreadable exit code is NEVER treated as success
  elseif ($exitCode -eq 0) { $state = 'passed' }
  else { $state = 'failed' }
}

$elapsedTotal = ($endedAt - $startedAt).TotalSeconds
$sinceEvidenceEnd = ($endedAt - $lastEvidenceAt).TotalSeconds
$reason = switch ($state) {
  'passed' { 'child exited 0' }
  'failed' { "child exited $exitCode" }
  'hung'   { "no EVIDENCE progress for >= $([int]$sinceEvidenceEnd) s (limit $StallSec s + up to $CpuGraceSec s CPU grace; aborted)" }
  'cap'    { "exceeded hard cap of $MaxSec s (aborted)" }
  default  { $state }
}

$verdict = [ordered]@{
  schema = 'run-guarded/v2'; label = $Label; state = $state; command = $Command
  work_dir = $WorkDir; started_at = (Iso $startedAt); ended_at = (Iso $endedAt)
  elapsed_sec = [math]::Round($elapsedTotal, 1); exit_code = $exitCode; output_bytes = (Get-LogBytes)
  since_evidence_sec = [math]::Round($sinceEvidenceEnd, 1); tree_cpu_ms = [math]::Round($lastCpuMs, 0)
  samples = $samples; stall_limit_sec = $StallSec; cpu_grace_sec = $CpuGraceSec; cap_limit_sec = $MaxSec
  reason = $reason; stale_reaped = @($killed)
  out_log = $outLog; err_log = $errLog; heartbeat = $heartbeat
}
Write-JsonAtomic $verdictPath $verdict
Save-Heartbeat $state $elapsedTotal $sinceEvidenceEnd (Get-LogBytes) $lastCpuMs $false $StallSec

# ---- 5. report ----------------------------------------------------------------------------------
if ($Json) {
  $verdict | ConvertTo-Json -Depth 8
} elseif (-not $Quiet) {
  Write-Host ''
  Write-Host "=== GUARD [$safeLabel]: $($state.ToUpper()) ==="
  Write-Host "cmd: $Command   elapsed: $([int]$elapsedTotal)s   exit: $exitCode"
  Write-Host "reason: $reason"
  if ($state -eq 'hung' -or $state -eq 'cap' -or $state -eq 'failed') {
    Write-Host "--- last child output ($outLog) ---"
    try { Get-Content -LiteralPath $outLog -Tail 40 | ForEach-Object { Write-Host $_ } } catch {}
    try {
      $errTail = Get-Content -LiteralPath $errLog -Tail 20 -ErrorAction SilentlyContinue
      if ($errTail) { Write-Host "--- stderr tail ---"; $errTail | ForEach-Object { Write-Host $_ } }
    } catch {}
  }
  Write-Host "verdict: $verdictPath"
}

switch ($state) {
  'passed' { exit 0 }
  'failed' { exit 1 }
  'hung'   { exit 3 }
  'cap'    { exit 4 }
  default  { exit 2 }
}
