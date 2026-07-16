# PostToolUse hook (Claude Code): when a PR is merged to main, generate the FIXED-format owner
# milestone-update skeleton (scripts/new-milestone-update.ps1) and inject it as context, so the worker
# relays a TEMPLATED milestone update instead of freeforming from memory. This is the channel-1
# enforcement (comms contracts / ADR-0009): the format is machine-produced at the milestone event, not
# left to the worker remembering to run the generator.
#
# Lives in scripts/hooks/ (a normal project dir) on purpose: edits here are not gated the way .claude/
# config is, so iterating on this hook never prompts the owner — and it travels to spawned projects via
# the scaffolder's wholesale scripts/ copy (parity). Only the thin pointer in .claude/settings.json is
# gated, and it rarely changes.
#
# NON-BLOCKING + FAIL-SAFE by construction: it only ever exits 0 and only ever prints the additionalContext
# JSON. A non-merge command, a generator failure, malformed stdin, or ANY error -> exit 0 with no output.
# It can never block, stop, or wedge a session (exit 2 is the only blocking code and is never used here).
#
# Disclosed property: like any committed Claude Code hook, this runs on every Bash/PowerShell tool call for
# anyone who trusts the repo. That is acceptable here because it is READ-ONLY (it only reads the phase
# manifest via the generator) and fail-safe. Do not add side effects (writes/network) to this hook.

try {
  $raw = [Console]::In.ReadToEnd()
  if ([string]::IsNullOrWhiteSpace($raw)) { exit 0 }

  $inp = $null
  try { $inp = $raw | ConvertFrom-Json -ErrorAction Stop } catch { exit 0 }

  $cmd = ''
  if ($inp.tool_input -and $inp.tool_input.command) { $cmd = [string]$inp.tool_input.command }
  # Fire ONLY on an actual PR merge at a COMMAND POSITION -- the deterministic milestone event. Split the
  # command on shell separators (; && || | & newline); a segment must START with `gh pr merge <n>` (with a
  # real numeric-token boundary, so `5abc` is rejected) AND carry a merge-method flag (--merge/--squash/
  # --rebase, which every real headless merge uses). This fires on real forms (`gh pr merge 24 --merge`,
  # `cd x; gh pr merge 24 --merge`, `gh pr merge 24 --merge | tail -1`) but NOT on mentions (`echo gh pr
  # merge 5 --merge`), non-numeric tokens (`gh pr merge 5abc --merge`), or prose (`gh pr merge 5 is the
  # command`). Anything unmatched -> exit 0, no injection.
  $isMerge = $false
  foreach ($seg in ($cmd -split '[;&|\r\n]+')) {
    $t = $seg.Trim()
    if ($t -match '^gh\s+pr\s+merge\s+\d+(\s|$)' -and $t -match '--(merge|squash|rebase)\b') { $isMerge = $true; break }
  }
  if (-not $isMerge) { exit 0 }

  # Repo root = harness-provided project dir, else two levels up from scripts/hooks/.
  $repo = $env:CLAUDE_PROJECT_DIR
  if ([string]::IsNullOrWhiteSpace($repo)) { $repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
  $gen = Join-Path $repo 'scripts/new-milestone-update.ps1'
  if (-not (Test-Path -LiteralPath $gen)) { exit 0 }

  $skeleton = & pwsh -NoProfile -File $gen 2>$null | Out-String
  if ([string]::IsNullOrWhiteSpace($skeleton)) { exit 0 }

  $note = @"
MILESTONE HOOK -- a PR just merged to main, so an owner milestone update is owed. When you next report to
the owner, use EXACTLY the template below: fill each <<fill: ...>> slot with plain-English judgment, and
do NOT freeform your own format. The header / phase / % are already computed by the generator -- verify the
% is current (re-run scripts/new-milestone-update.ps1 if you have merged again since) but keep the fixed
block structure. This is the channel-1 communication contract, enforced.

$skeleton
"@

  $out = @{
    hookSpecificOutput = @{
      hookEventName     = 'PostToolUse'
      additionalContext = $note
    }
    suppressOutput = $false
  } | ConvertTo-Json -Depth 8 -Compress

  Write-Output $out
  exit 0
} catch {
  # Never disrupt the session on a hook error.
  exit 0
}
