#requires -Version 7
<#
  canonical-preflight.ps1 — PCC PreToolUse hook adapter (ADR-0020 canonical-constraint enforcement,
  Phase A). Reads the PreToolUse JSON payload on stdin and decides whether a mutation-capable tool call
  may proceed. Proven to fire in headless `claude -p` on CLI 2.1.186 (see the probe evidence).

  Decision:
    * A valid, locked preflight governs the work  -> ALLOW (exit 0).
    * No valid preflight yet, but the operation IS the narrow preflight-creation step:
        - Write/Edit/NotebookEdit whose target is exactly .cockpit/preflight/<task_id>.json, OR
        - a Bash/PowerShell command invoking scripts/write-task-preflight.ps1
      -> ALLOW (exit 0).
    * Otherwise -> DENY (exit 2, reason on stderr; Claude shows the reason and does not run the tool).

  Read/search/research tools (Read, Glob, Grep, WebSearch, WebFetch) are NOT in the hook matcher and are
  never gated here. FAIL CLOSED: any payload we cannot parse is denied.
#>
$ErrorActionPreference = 'Stop'

function Deny([string]$reason) {
  [Console]::Error.WriteLine("PCC canonical-constraint gate: $reason")
  exit 2
}
function Allow { exit 0 }

$repoRoot = $env:CLAUDE_PROJECT_DIR
if (-not $repoRoot) { try { $repoRoot = (git rev-parse --show-toplevel 2>$null) } catch {} }
if (-not $repoRoot) { $repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..' '..')).Path }
$repoRoot = $repoRoot.Trim()

$raw = [Console]::In.ReadToEnd()
$payload = $null
try { $payload = $raw | ConvertFrom-Json } catch { Deny 'unreadable PreToolUse payload (failing closed)' }
if (-not $payload -or -not $payload.tool_name) { Deny 'PreToolUse payload missing tool_name (failing closed)' }

$tool = [string]$payload.tool_name
$ti = $payload.tool_input

# ---- Is there a valid, locked preflight? If so, allow everything. ----
$checker = Join-Path $repoRoot 'scripts/check-canonical-constraints.ps1'
if (-not (Test-Path $checker)) { Deny 'canonical checker missing (failing closed)' }
. $checker -RepoRoot $repoRoot 6>$null
try {
  $registry = Get-CanonRegistry
  $drift = Test-CanonDrift $registry
  if (-not $drift.ok) { Deny ("canonical rule drift — " + ($drift.reasons -join '; ')) }
  $pf = Invoke-Preflight $registry
  if ($pf.ok) { Allow }
} catch { Deny ("preflight check errored (failing closed): " + $_.Exception.Message) }

# ---- No valid preflight yet: permit only the narrow preflight-creation operations. ----
function Test-IsPreflightPath([string]$p) {
  if (-not $p) { return $false }
  $norm = ($p -replace '\\', '/')
  if ([System.IO.Path]::IsPathRooted($norm)) {
    $full = [System.IO.Path]::GetFullPath($norm) -replace '\\', '/'
    $root = ([System.IO.Path]::GetFullPath($repoRoot) -replace '\\', '/').TrimEnd('/')
    if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $false }
    $norm = $full.Substring($root.Length).TrimStart('/')
  }
  return ($norm -match '^\.cockpit/preflight/[a-z0-9][a-z0-9._-]{2,63}\.json$')
}

# The Bash/PowerShell allow is ONLY for a lone, well-formed INVOCATION of the preflight locker — never any
# command that merely mentions its name. Two layers (codex-caught, twice):
#   (1) reject shell command-separators/redirection/substitution/newlines, so nothing can be chained after;
#   (2) require the whole command to MATCH the shape of a writer invocation and nothing else — it must
#       start with pwsh/powershell, run <path>/write-task-preflight.ps1, and pass -TaskId <slug> (+ optional
#       -Json), anchored end-to-end. This rejects `Remove-Item …/write-task-preflight.ps1` and
#       `Copy-Item x …/write-task-preflight.ps1` (they don't INVOKE it), and any trailing junk.
function Test-IsLonePreflightWriter([string]$cmd) {
  if (-not $cmd) { return $false }
  if ($cmd -match '[;&|<>`]' -or $cmd -match '\$\(' -or $cmd -match '[\r\n]') { return $false }
  # The invoked script must be write-task-preflight.ps1 EXACTLY — a path-boundary (start, or a / \) must
  # precede the name, so `evilwrite-task-preflight.ps1` / `mywrite-task-preflight.ps1` do not qualify
  # (codex-caught, 3rd). `scripts/write-task-preflight.ps1`, `C:\...\write-task-preflight.ps1`, and a bare
  # `write-task-preflight.ps1` all do.
  return ($cmd -match '(?i)^\s*(pwsh|powershell)(\.exe)?(\s+-\w+)*\s+(-File\s+)?(\S*[\\/])?write-task-preflight\.ps1\s+-TaskId\s+[a-z0-9][a-z0-9._-]{2,63}(\s+-Json)?\s*$')
}

switch -Regex ($tool) {
  '^(Write|Edit)$' { if (Test-IsPreflightPath ([string]$ti.file_path)) { Allow } }
  '^NotebookEdit$' { if (Test-IsPreflightPath ([string]$ti.notebook_path)) { Allow } }
  '^(Bash|PowerShell)$' { if (Test-IsLonePreflightWriter ([string]$ti.command)) { Allow } }
}

Deny "no valid preflight plan for this task. Before implementing, record a preflight at .cockpit/preflight/<task_id>.json and lock it with scripts/write-task-preflight.ps1 -TaskId <task_id>. Read/search/research tools remain available."
