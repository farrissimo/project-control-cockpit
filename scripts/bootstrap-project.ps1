<#
  PCC new-project bootstrap (COCKPIT_ROADMAP #18).

  Scaffolds a brand-new project "the PCC way" so every project starts identical:
  the cockpit app, the self-contained detector/lifecycle/handoff scripts, fresh
  declared state (lifecycle pinned at 'define', generic boundaries), and starter
  brief/rules/decisions. Then optionally git-inits it.

  Deterministic: file copies + templated text, no LLM. Read-only against THIS
  repo (the reference implementation); only writes under -Target.

  Usage:
    pwsh -File scripts/bootstrap-project.ps1 -Target C:\path\to\new-project -Name "My Project"
    (add -Force to write into a non-empty folder; -NoGit to skip git init)
#>
param(
  [Parameter(Mandatory = $true)][string]$Target,
  [Parameter(Mandatory = $true)][string]$Name,
  [switch]$Force,
  [switch]$NoGit
)

$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $PSScriptRoot

# --- validate target ---
if (Test-Path -LiteralPath $Target) {
  $existing = @(Get-ChildItem -LiteralPath $Target -Force)
  if ($existing.Count -gt 0 -and -not $Force) {
    Write-Error "Target '$Target' is not empty. Use -Force to write into it anyway."
    exit 1
  }
} else {
  New-Item -ItemType Directory -Path $Target -Force | Out-Null
}
$Target = (Resolve-Path -LiteralPath $Target).Path
Write-Output "Bootstrapping '$Name' into $Target"

function Ensure-Dir([string]$p) { if (-not (Test-Path -LiteralPath $p)) { New-Item -ItemType Directory -Path $p -Force | Out-Null } }
function Copy-File([string]$rel) {
  $from = Join-Path $src $rel
  if (-not (Test-Path -LiteralPath $from)) { Write-Output "  (skip, missing: $rel)"; return }
  $to = Join-Path $Target $rel
  Ensure-Dir (Split-Path -Parent $to)
  Copy-Item -LiteralPath $from -Destination $to -Force
  Write-Output "  + $rel"
}

# --- 1. the cockpit app (without node_modules) ---
Write-Output "Copying app/ ..."
Copy-Item -LiteralPath (Join-Path $src 'app') -Destination $Target -Recurse -Force
$nm = Join-Path $Target 'app/node_modules'
if (Test-Path -LiteralPath $nm) { Remove-Item -LiteralPath $nm -Recurse -Force }
$lv = Join-Path $Target 'app/last-verification.txt'
if (Test-Path -LiteralPath $lv) { Remove-Item -LiteralPath $lv -Force }

# --- 2. self-contained cockpit scripts (detectors + lifecycle + handoff + verify) ---
Write-Output "Copying scripts/ ..."
foreach ($s in @(
  'detect-untracked.ps1', 'detect-drift.ps1', 'detect-stale-docs.ps1',
  'detect-repo-sync.ps1', 'detect-bloat.ps1', 'lifecycle-status.ps1',
  'generate-handoff.ps1', 'recent-decisions.ps1', 'verify-work.ps1',
  'bootstrap-project.ps1'
)) { Copy-File "scripts/$s" }

# --- 3. config / rules ---
Copy-File 'CLAUDE.md'
Copy-File 'AGENTS.md'
Copy-File '.gitignore'

# --- 4. generic declared state (lifecycle model + thresholds copied; state fresh) ---
Copy-File '.cockpit/state/lifecycle-model.json'
Copy-File '.cockpit/state/bloat-thresholds.json'
Ensure-Dir (Join-Path $Target '.cockpit/result/detections')
Ensure-Dir (Join-Path $Target '.cockpit/logs')

$stamp = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')

Set-Content -LiteralPath (Join-Path $Target '.cockpit/state/lifecycle-state.json') -Encoding utf8 -Value (@"
{
  "lane": "main",
  "current_stage": "define",
  "note": "New project bootstrapped by PCC. Start by defining the goal and rough scope. Set deliberately, not inferred.",
  "updated_at": "$stamp"
}
"@)

Set-Content -LiteralPath (Join-Path $Target '.cockpit/state/app-build-scope.json') -Encoding utf8 -Value (@"
{
  "scope_id": "main",
  "title": "$Name - allowed-change boundary",
  "authorized_by": "bootstrap",
  "plain_language": {
    "what_this_is": "The honest list of what work on this project is allowed to change, so the drift signal has a real boundary instead of guessing. Edit allowed_globs as the project takes shape.",
    "must_not_change": "Anything not covered below should be a deliberate decision, not an accident."
  },
  "compare_baseline": "main",
  "allowed_globs": ["app/**", "scripts/**", "docs/**", "PROJECT.md", "CLAUDE.md", "AGENTS.md", ".gitignore", ".cockpit/**"],
  "updated_at": "$stamp"
}
"@)

Set-Content -LiteralPath (Join-Path $Target '.cockpit/state/doc-freshness-map.json') -Encoding utf8 -Value (@"
{
  "map_id": "doc-freshness-v1",
  "title": "Stale-docs rules (starter, adjustable)",
  "plain_language": {
    "what_this_is": "If this kind of code changed, this doc should have been updated too. Start small; grow from real misses.",
    "how_it_reads": "If code matching when_changed changed but expect_updated did not, stale-docs flags it. No rule match = stays quiet."
  },
  "compare_baseline": "main",
  "rules": [
    { "id": "app-in-brief", "when_changed": ["app/*.js"], "expect_updated": ["PROJECT.md"], "satisfied_by": "any", "why": "A user-facing app change should be reflected in the brief." }
  ],
  "not_yet_automated": [],
  "updated_at": "$stamp"
}
"@)

# --- 5. starter docs ---
Ensure-Dir (Join-Path $Target 'docs')
Set-Content -LiteralPath (Join-Path $Target 'PROJECT.md') -Encoding utf8 -Value (@"
# PROJECT.md - current project brief

Read this first. Always-current summary so a new session starts fully oriented.

## What this is
$Name. (Define the goal and what "done" looks like here.)

## Owner
Visionary / product lead. Plain-language, concise, no cheerleading, no fake "done".
Standing rules are in CLAUDE.md.

## Where we are
- Phase: define (just bootstrapped). Lifecycle map is in the app's Lifecycle tab.
- Next: define the goal and rough scope, then plan the first bounded task.

## How this project is run (PCC cockpit)
- Launch the app: npm install --prefix app (once), then npm start --prefix app.
- Signals tab watches for untracked files, drift, stale docs, un-backed-up work,
  bloat, and sycophancy. Lifecycle tab shows the stage map. Project tab generates
  a new-chat handoff and shows recent decisions.
- Detectors are deterministic scripts in scripts/; the app just consumes them.

## Key decisions
- See docs/DECISIONS.md.
"@)

Set-Content -LiteralPath (Join-Path $Target 'docs/DECISIONS.md') -Encoding utf8 -Value (@"
# Decisions log

## DECISION-0: Short Decision Title
Date: (template)
Status: Active / Superseded / Reversed

(Template header - real decisions start at DECISION-001 below.)

## DECISION-001: $Name bootstrapped with the PCC cockpit
Date: $stamp
Status: Active

This project was scaffolded from the PCC reference implementation: cockpit app,
deterministic detectors, lifecycle state-machine, and honest-signal design.
"@)

# --- 6. git init ---
if (-not $NoGit) {
  Push-Location $Target
  try {
    & git init | Out-Null
    & git add -A | Out-Null
    & git -c user.name='PCC Bootstrap' -c user.email='pcc@localhost' commit -q -m "Bootstrap $Name from PCC" | Out-Null
    Write-Output "git: initialized and made the first commit."
  } catch { Write-Output "git: skipped ($($_.Exception.Message))" }
  Pop-Location
}

Write-Output ''
Write-Output "Done. Next steps:"
Write-Output "  1. cd `"$Target`""
Write-Output "  2. npm install --prefix app"
Write-Output "  3. npm start --prefix app"
Write-Output "  4. Fill in PROJECT.md's goal, then use the Lifecycle tab to move from 'define' to 'plan'."
