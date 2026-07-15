<#
  change-identity.ps1 — dot-sourced helper that computes the ONE identity of "the change
  about to be committed," shared by the receipt writer (scripts/write-verification-receipt.ps1)
  and the governance gate (scripts/run-governance-gate.ps1) so the two can never drift. If they
  computed the binding differently, a receipt written seconds before a commit could fail to
  match its own change — the whole "diff-bound receipt" contract (ADR-0006 §10.1) depends on
  both sides agreeing byte-for-byte.

  It binds to the STAGED INDEX diff vs base, because that — not the working tree — is exactly what
  a commit will contain. Staged new files are included; unstaged/untracked noise is excluded. The
  identity is (base commit + the index-vs-base diff, EXCLUDING the bypass ledger): stage one more
  line of real content and the diff changes and the receipt no longer applies. Git-ignored paths
  (e.g. the receipt itself under .cockpit/evidence/) are never staged, so writing the receipt
  cannot change the diff_id. The bypass ledger is excluded so a bypass entry can be staged (=
  committed, auditable) without changing the diff_id it names.

  Get-ChangeIdentity [-Baseline main] -> [ordered]@{
    base       = <40-hex merge-base(baseline,HEAD); HEAD if baseline unresolved; null-sha (40 zeros) in an empty repo>
    head       = <40-hex current HEAD; null-sha (40 zeros) in an empty repo>
    tree       = <40-hex hash of the staged index tree (git write-tree; forensic record)>
    diff_id    = <sha256 hex over "BASE=<base>" + the staged index diff vs base, ledger excluded>
    files      = <string[] of staged paths (added/modified/deleted) vs base>
    added      = <string[] of staged ADDED paths vs base>
    deleted    = <string[] of staged DELETED paths vs base>
    tree_dirty = <bool: are there unstaged/untracked changes NOT in this commit>
    baseline   = <the baseline ref used>
    base_note  = <'' or a note when the baseline could not be resolved>
  }
  Deterministic, no LLM. `git write-tree` only writes a (dangling, gc-able) tree object from the
  current index — it does not touch refs, HEAD, or the working tree.
#>

function Get-Sha256Hex([string]$text) {
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes([string]$text)
    return -join ($sha.ComputeHash($bytes) | ForEach-Object { $_.ToString('x2') })
  } finally { $sha.Dispose() }
}

function Get-ChangeIdentity {
  param([string]$Baseline = 'main')

  $head = (& git rev-parse --verify --quiet HEAD 2>$null)
  $head = if ($head) { "$head".Trim() } else { '' }

  # Resolve the base: merge-base(baseline, HEAD). If the baseline ref does not exist (fresh
  # repo, detached history), fall back to HEAD so only staged-vs-HEAD changes define the diff —
  # and record that so callers surface it honestly rather than silently narrowing scope.
  $base = $head
  $baseNote = ''
  & git rev-parse --verify --quiet $Baseline > $null 2>&1
  if ($LASTEXITCODE -eq 0 -and $head) {
    $mb = (& git merge-base $Baseline HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $mb) { $base = "$mb".Trim() }
    else { $baseNote = "merge-base($Baseline, HEAD) unresolved; used HEAD as base" }
  } elseif (-not $head) {
    $baseNote = 'no commits yet (HEAD unresolved); base = HEAD = empty'
  } else {
    $baseNote = "baseline '$Baseline' not found; used HEAD as base"
  }

  # The staged index tree — exactly what the pending commit will contain (forensic record).
  $tree = (& git write-tree 2>$null)
  $tree = if ($tree) { "$tree".Trim() } else { '' }

  # Staged change vs base (index compared to the base commit), for the classifier + reasons.
  function StagedNames([string]$filter) {
    $args = @('diff', '--cached', '--name-only')
    if ($filter) { $args += "--diff-filter=$filter" }
    if ($base) { $args += $base }
    $out = & git @args 2>$null
    return @($out | ForEach-Object { "$_".Trim() } | Where-Object { $_.Length -gt 0 })
  }
  $files = @(StagedNames '')
  $added = @(StagedNames 'A')
  $deleted = @(StagedNames 'D')

  # diff_id binds to the STAGED CONTENT vs base (index diff — exactly what the commit introduces),
  # but EXCLUDES the bypass ledger. Excluding it breaks a chicken-and-egg: a bypass entry must be
  # STAGED to count (so it lands in git history — auditable, never invisible), yet staging it must
  # not itself change the diff_id it names. The ledger is the ONLY excluded path, and any real
  # ledger edit is still classified T0 (governor_self_edit) so the change still requires proof.
  $exclude = ':(exclude).cockpit/state/governance-gate-exceptions.json'
  $diffArgs = @('diff', '--cached')
  if ($base) { $diffArgs += $base }
  $diffArgs += @('--', '.', $exclude)
  $diffText = (& git @diffArgs 2>$null) -join "`n"

  # Emit git's null-object-id (40 zeros — its own convention for "no commit") instead of an empty
  # string when there is no HEAD/base yet (an empty-history repo, e.g. a project's very first
  # commit). Empty strings would violate the receipt schema's minLength and break the verified path
  # for a brand-new project. The git COMMANDS above still key off the real (possibly-empty) refs.
  $NULL_SHA = '0000000000000000000000000000000000000000'
  $outBase = if ($base) { $base } else { $NULL_SHA }
  $outHead = if ($head) { $head } else { $NULL_SHA }
  $diffId = Get-Sha256Hex ("BASE=$outBase`n---diff---`n$diffText")

  # Anything present in the working tree but not staged into this commit (informational honesty).
  $porcelain = @(& git status --porcelain 2>$null | Where-Object { $_ -and $_.Length -ge 2 })
  $treeDirty = [bool](@($porcelain | Where-Object { $_.Substring(1, 1).Trim() -ne '' -or $_.StartsWith('??') }).Count)

  return [ordered]@{
    base       = $outBase
    head       = $outHead
    tree       = $tree
    diff_id    = $diffId
    files      = $files
    added      = $added
    deleted    = $deleted
    tree_dirty = $treeDirty
    baseline   = $Baseline
    base_note  = $baseNote
  }
}

# Classify the EXACT staged change (from Get-ChangeIdentity) via the shipped classifier, passing
# explicit file lists so tier and binding measure the same set. Shared by the gate + writer so
# their tier never drifts. -RepoRoot is the repo top (parent of scripts/). Returns:
#   @{ tier = 'T0'..'T4' | 'UNKNOWN' | 'NONE'; empty = <bool nothing staged>; raw = <classifier obj|null> }
function Get-ChangeTier {
  param([Parameter(Mandatory = $true)]$Identity, [Parameter(Mandatory = $true)][string]$RepoRoot)
  if (-not $Identity.files -or @($Identity.files).Count -eq 0) {
    return [ordered]@{ tier = 'NONE'; empty = $true; raw = $null }
  }
  $classifier = Join-Path $RepoRoot 'scripts/classify-stakes.ps1'
  $filesArg = (@($Identity.files) -join "`n")
  $addedArg = (@($Identity.added) -join "`n")
  $deletedArg = (@($Identity.deleted) -join "`n")
  $raw = & pwsh -NoProfile -File $classifier -Json -Files $filesArg -Added $addedArg -Deleted $deletedArg 2>$null
  $obj = $null
  try { $obj = $raw | ConvertFrom-Json } catch {}
  $tier = if ($obj -and $obj.tier) { "$($obj.tier)" } else { 'UNKNOWN' }
  return [ordered]@{ tier = $tier; empty = $false; raw = $obj }
}
