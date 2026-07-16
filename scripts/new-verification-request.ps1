<#
  PCC verification-request generator (comms spec channels 3 & 4 / ADR-0009 category 1).

  Structure->machinery for the two verification-request copy blocks the worker otherwise hand-crafts
  every time:
    -Channel codex : the independent-verifier (codex exec) request -- fixed role (read-only, do NOT run
                     the guarded suite), the exact review target (`git diff --cached <base>`), context +
                     judge-points slots, and the required VERDICT/EVIDENCE/NOT PROVEN output shape. Also
                     prints the canonical run line (piped `< /dev/null`, since codex blocks on open stdin).
    -Channel gpt   : the secondary-verification copy block for the owner to paste into ChatGPT -- the
                     REMOTE repo URL (computed from origin) + the pushed ref, what-changed + numbered
                     confirm-question slots, and the required output shape. GPT reads GitHub, so it warns
                     LOUD if HEAD is not pushed (else GPT verifies stale/absent code), and it requires a
                     stated trigger reason (secondary verification fires ONLY when the ADR-0009 trigger
                     applies -- not by reflex).

  The generator fills the deterministic boilerplate + computed facts (review target, repo URL, pushed
  state); the LLM fills only the judgment slots ("<<fill: ...>>"). Deterministic, read-only, no LLM,
  exits 0. Spec: docs/specs/verification-request-generator.md.

  Params:
    -Channel <codex|gpt>   : which request to assemble (required).
    -Base <ref>            : codex review base (default 'main').
    -Context <text>        : judgment slot -- what the change is / why (optional; placeholder if omitted).
    -Judge <text>          : judgment slot -- specific things to judge / numbered confirm questions (optional).
    -TriggerReason <text>  : gpt only -- which ADR-0009 trigger condition applies + why (required for a real send).
    -Json                  : machine-readable output (computed fields + the rendered text).
#>
param(
  [Parameter(Mandatory = $true)][ValidateSet('codex', 'gpt')][string]$Channel,
  [string]$Base = 'main',
  [string]$Context = '',
  [string]$Judge = '',
  [string]$TriggerReason = '',
  [switch]$Json
)

$ErrorActionPreference = 'Continue'
try { [Console]::OutputEncoding = [System.Text.Encoding]::UTF8 } catch {}
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

$ctx = if ([string]::IsNullOrWhiteSpace($Context)) { '<<fill: what the change is and why, 1-3 lines>>' } else { $Context }
$judgeText = if ([string]::IsNullOrWhiteSpace($Judge)) { '<<fill: the specific things the verifier should judge>>' } else { $Judge }
$warnings = @()

if ($Channel -eq 'codex') {
  $reviewTarget = "git diff --cached $Base"
  $text = @"
You are the independent verifier (read-only; do NOT modify files; do NOT run the guarded Playwright/Electron suite -- CI owns execution).

REVIEW TARGET: the staged change only -- ``$reviewTarget`` (also ``$reviewTarget --stat``).

CONTEXT: $ctx

JUDGE SPECIFICALLY: $judgeText

You may run read-only checks (git, read files, run the script under review against a synthetic input in your own temp dir). Do NOT run ``npm test``.

OUTPUT EXACTLY:
VERDICT: PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE
EVIDENCE: 2-4 bullets of what you actually checked and found (commands run, real results).
NOT PROVEN: anything you could not verify.
"@
  $runLine = "codex exec --sandbox read-only `"<paste the prompt above>`" < /dev/null"
  $notProven = ''
}
else {
  # gpt: compute the remote web URL + the pushed ref.
  $originUrl = (& git remote get-url origin 2>$null)
  $webUrl = ''
  if (-not [string]::IsNullOrWhiteSpace($originUrl)) {
    $webUrl = ($originUrl.Trim() -replace '\.git$', '')
    $webUrl = $webUrl -replace '^git@github\.com:', 'https://github.com/'
  }
  if ([string]::IsNullOrWhiteSpace($webUrl)) { $webUrl = '<<fill: repo URL -- origin remote not found>>'; $warnings += 'origin remote not found; fill the repo URL by hand' }

  $headSha = (& git rev-parse --short HEAD 2>$null)
  if ([string]::IsNullOrWhiteSpace($headSha)) { $headSha = '<<fill: commit sha>>' }
  $branch = (& git rev-parse --abbrev-ref HEAD 2>$null)

  # Pushed? GPT reads the REMOTE, so an unpushed HEAD means it would verify stale/absent code.
  $remoteContains = (& git branch -r --contains HEAD 2>$null)
  $pushed = -not [string]::IsNullOrWhiteSpace(($remoteContains | Out-String).Trim())
  if (-not $pushed) { $warnings += "HEAD ($headSha) is NOT on any remote branch -- PUSH FIRST, or GPT will read stale/absent code (or inline the unpushed diff)" }

  # Trigger discipline: secondary verification fires ONLY when the ADR-0009 trigger applies.
  $triggerLine = if ([string]::IsNullOrWhiteSpace($TriggerReason)) {
    '<<fill: which ADR-0009 trigger applies -- (1) touches T0 trust-root/verification/governance machinery; (2) changes trust boundaries/evidence standards/release gating/rollback/security model; (3) high-consequence + low-observability if wrong>>'
  } else { $TriggerReason }
  if ([string]::IsNullOrWhiteSpace($TriggerReason)) { $warnings += 'no -TriggerReason given: GPT secondary verification fires ONLY when the trigger applies (ADR-0009) -- state the condition or do not send' }

  $pushedNote = if ($pushed) { "pushed: yes (on a remote branch)" } else { "pushed: NO -- push before sending (or inline the diff below)" }

  $text = @"
Independent secondary verification request (you are a third, different-model reviewer reading the repo on GitHub).

REPO: $webUrl
COMMIT: $headSha  (branch ``$branch``; $pushedNote)
WHY THIS NEEDS A SECOND OPINION (trigger): $triggerLine

WHAT CHANGED & WHY: $ctx

CONFIRM (numbered): $judgeText

Read the change on GitHub at the commit above. If anything isn't pushed yet, say so rather than guessing.

OUTPUT EXACTLY:
VERDICT: PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE
EVIDENCE: 2-4 bullets of what you actually checked (files/commits read, real findings).
NOT PROVEN: anything you could not verify from the remote repo.
"@
  $runLine = ''
  $notProven = if ($warnings.Count -gt 0) { ($warnings -join ' | ') } else { '' }
}

if ($Json) {
  $obj = [pscustomobject]@{
    schema     = 'verification-request/v1'
    channel    = $Channel
    base       = $Base
    run_line   = $runLine
    warnings   = $warnings
    not_proven = $notProven
    text       = $text
  }
  $obj | ConvertTo-Json -Depth 6
}
else {
  if ($warnings.Count -gt 0) { foreach ($w in $warnings) { Write-Output "[warn] $w" } ; Write-Output '' }
  Write-Output $text
  if (-not [string]::IsNullOrWhiteSpace($runLine)) { Write-Output ''; Write-Output "run: $runLine" }
}

exit 0
