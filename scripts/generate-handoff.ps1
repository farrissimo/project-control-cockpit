<#
  PCC handoff generator (COCKPIT_ROADMAP #7).

  Assembles a ready-to-paste briefing for a FRESH chat, entirely from real repo
  truth (project-state.json + live git facts) so the owner never re-briefs a new
  session by hand. It states facts as they are; if something is unknown it says
  so rather than inventing it.

  Deterministic: git + state files, no LLM, read-only, always exits 0.
  Prints the handoff block to stdout; the app shows it with a Copy button.
  Works with app/ deleted.
#>
param()

$ErrorActionPreference = 'Continue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

function GitOut([string[]]$argv) {
  $out = & git @argv 2>$null
  return "$($out)".Trim()
}

$now = (Get-Date).ToString('yyyy-MM-dd HH:mm zzz')

# --- project-state.json (canonical truth) ---
# NOTE: we deliberately do NOT use project-state.json's next_expected_action or
# last_verification_verdict here. Those track the older governance lane
# (pre-DECISION-102) and are stale for the app-build; surfacing them would
# misdirect a fresh chat. The current "next" lives in PROJECT.md (the brief we
# keep updated), and verification status comes from the app-build's own file.
$phase = 'unknown'; $projName = 'this project'
$statePath = '.cockpit/state/project-state.json'
if (Test-Path -LiteralPath $statePath -PathType Leaf) {
  try {
    $st = Get-Content -Raw -LiteralPath $statePath | ConvertFrom-Json
    if ($st.project_name) { $projName = $st.project_name }
    if ($st.current_phase) { $phase = $st.current_phase }
  } catch { }
}

# Verification status from the app-build's own target file (same source the trust
# strip uses), stated honestly - not the stale governance verdict.
$verdict = 'none recorded yet (independent Codex run is scheduled)'
$vPath = 'app/last-verification.txt'
if (Test-Path -LiteralPath $vPath -PathType Leaf) {
  $vtext = Get-Content -Raw -LiteralPath $vPath
  $m = [regex]::Match($vtext, '\b(PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE)\b')
  if ($m.Success) { $verdict = "$($m.Value) (from $vPath)" }
}

# --- live git facts ---
$branch = GitOut @('rev-parse', '--abbrev-ref', 'HEAD')
$headLine = GitOut @('log', '-1', '--format=%h  %s')

$sync = 'unknown'
$upstream = GitOut @('rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}')
& git rev-parse --abbrev-ref --symbolic-full-name '@{u}' > $null 2>&1
if ($LASTEXITCODE -eq 0 -and $upstream) {
  $counts = (GitOut @('rev-list', '--left-right', '--count', 'HEAD...@{u}')) -split '\s+'
  if ($counts.Count -eq 2) {
    $a = [int]$counts[0]; $b = [int]$counts[1]
    if ($a -eq 0 -and $b -eq 0) { $sync = "in sync with $upstream" }
    else { $sync = "$a ahead / $b behind $upstream" }
  }
} else {
  $sync = 'no upstream remote set (local work is not backed up off this machine)'
}

$porcelain = @(& git status --porcelain=v1 --untracked-files=all 2>$null | ForEach-Object { "$_" } | Where-Object { $_.Trim() })
$untracked = @($porcelain | Where-Object { $_ -match '^\?\?' }).Count
$trackedChanges = @($porcelain | Where-Object { $_ -notmatch '^\?\?' }).Count
$tree = if ($porcelain.Count -eq 0) { 'clean' } else { "$trackedChanges uncommitted, $untracked untracked" }

# --- emit the paste block ---
$nl = "`n"
$out = @"
You are picking up $projName (PCC) mid-build in a fresh chat. Don't ask me to
re-explain anything.

ORIENT FROM REPO TRUTH FIRST:
- PROJECT.md - current brief (what this is, architecture, what's built, pending).
- docs/COCKPIT_ROADMAP.md - full ranked feature list + status.
- docs/DECISIONS.md -> DECISION-102 - the product direction.
- CLAUDE.md - my standing rules (follow them).

CURRENT STATE (as of $now):
- Branch: $branch at $headLine
- Sync: $sync
- Working tree: $tree
- Phase: $phase
- Verification: $verdict
- Next action: see "Pending / immediate next tasks" in PROJECT.md (the canonical
  brief; kept current for the app-build lane).

STANDING ORDERS:
- Keep going by default (stop only when genuinely unsure or at a real milestone).
- Research existing solutions before building; don't reinvent the wheel.
- Snapshot (commit) as you go; never lose work.
- Concise, plain-language updates tied to project goals; no cheerleading.
- Never fake a "done" - test it or say plainly it's untested.
- On every update, show the roadmap grid with progress.
- I'm the visionary/product lead, not a coder.

START HERE: continue down docs/COCKPIT_ROADMAP.md by priority (see "Next" in
PROJECT.md), snapshotting as you go.
"@

Write-Output $out
