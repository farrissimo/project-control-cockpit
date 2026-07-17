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

# The ONE path excluded from diff_id: the bypass ledger (so a staged bypass can name its own diff).
# Shared by the live (index) computation and the audit (commit-range) re-derivation so they agree.
$PCC_LEDGER_EXCLUDE = ':(exclude).cockpit/state/governance-gate-exceptions.json'

# The ONE diff_id formula — base + the change's diff text. Everything that computes a diff_id
# (Get-ChangeIdentity at commit time, Get-CommitDiffId at audit time) funnels through here, so a
# trailer written at commit time always re-derives at audit time.
function Get-DiffIdFromText([string]$base, [string]$diffText) {
  return Get-Sha256Hex ("BASE=$base`n---diff---`n$diffText")
}

# Re-derive a committed change's diff_id: base -> commit tree, ledger excluded. base MUST come from
# the commit's own trailer (never recomputed from today's main). This is the audit-time twin of
# Get-ChangeIdentity's index computation; base->commit-tree equals base->index at the moment the
# index became that commit, so the two produce identical text (and identical diff_id).
function Get-CommitDiffId([string]$base, [string]$commit) {
  # --no-renames pins the diff so rename detection (diff.renames config, which varies by
  # environment) can never change the text — the audit must re-derive the SAME bytes CI-side.
  # A root/first commit stores base = the null-sha (40 zeros); at commit time its diff was
  # `git diff --cached` (index vs the EMPTY tree). The literal null-sha is not a real tree, so
  # diff against git's empty-tree object instead — proven byte-identical to the --cached form —
  # while still HASHING with the original base string so it matches what the emitter stored.
  $EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'
  $NULL_SHA = '0000000000000000000000000000000000000000'
  $diffBase = if ($base -eq $NULL_SHA) { $EMPTY_TREE } else { $base }
  $t = (& git diff --no-renames $diffBase $commit -- . $PCC_LEDGER_EXCLUDE 2>$null) -join "`n"
  return Get-DiffIdFromText $base $t
}

# Resolve the ACTUAL ref to diff against for a given symbolic baseline name (e.g. 'main'), in
# a fixed, deterministic priority order -- never a heuristic guess (Finding B, patch-intake
# report; docs/specs/governor-trusted-baseline.md). Local `main` is a ref any local-only
# operation (a reset, a rebase, an unpushed commit, a restore) can move; a fetched
# `origin/<name>` cannot silently drift the same way. Same class of fix as ADR-0008 (CI judges
# from a trusted origin/main worktree, not the PR's own tree), applied to the LOCAL side.
#   1. origin/<name>   -- a network-anchored copy, if this repo has a remote and it resolves.
#   2. <name>            -- the local ref, unchanged existing behavior (covers local-only
#                            projects with no origin remote at all).
#   3. pcc-baseline tag -- already created by scripts/bootstrap-project.ps1 on every scaffolded
#                            project's first commit for exactly this purpose; reused, not invented.
#   4. $null            -- nothing resolves; caller falls back to HEAD (unchanged, honest).
# Skips step 1 when $Baseline already names a remote-tracking ref itself (e.g. a caller that
# already passed 'origin/main' explicitly) -- 'origin/origin/main' is never a sensible ref.
function Resolve-TrustedBaseline([string]$Baseline) {
  if ($Baseline -notmatch '^origin/') {
    $originCandidate = "origin/$Baseline"
    & git rev-parse --verify --quiet $originCandidate > $null 2>&1
    if ($LASTEXITCODE -eq 0) { return $originCandidate }
  }
  & git rev-parse --verify --quiet $Baseline > $null 2>&1
  if ($LASTEXITCODE -eq 0) { return $Baseline }
  & git rev-parse --verify --quiet 'refs/tags/pcc-baseline' > $null 2>&1
  if ($LASTEXITCODE -eq 0) { return 'refs/tags/pcc-baseline' }
  return $null
}

function Get-ChangeIdentity {
  param([string]$Baseline = 'main')

  $head = (& git rev-parse --verify --quiet HEAD 2>$null)
  $head = if ($head) { "$head".Trim() } else { '' }

  # Resolve the base: merge-base(trusted baseline, HEAD). If nothing resolves (fresh repo,
  # detached history, no remote/local/tag match), fall back to HEAD so only staged-vs-HEAD
  # changes define the diff — and record that so callers surface it honestly rather than
  # silently narrowing scope.
  $base = $head
  $baseNote = ''
  $resolvedBaseline = Resolve-TrustedBaseline $Baseline
  if ($resolvedBaseline -and $head) {
    $mb = (& git merge-base $resolvedBaseline HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $mb) { $base = "$mb".Trim() }
    else { $baseNote = "merge-base($resolvedBaseline, HEAD) unresolved; used HEAD as base" }
  } elseif (-not $head) {
    $baseNote = 'no commits yet (HEAD unresolved); base = HEAD = empty'
  } else {
    # Exact original wording preserved (Codex review: an earlier draft unconditionally claimed
    # "checked origin/$Baseline" even when $Baseline itself already started with 'origin/' --
    # a check Resolve-TrustedBaseline deliberately skips in that case -- describing a lookup
    # that never ran. Simplest honest fix: don't claim what was checked, just the plain fact.
    $baseNote = "baseline '$Baseline' not found; used HEAD as base"
  }

  # The staged index tree — exactly what the pending commit will contain (forensic record).
  $tree = (& git write-tree 2>$null)
  $tree = if ($tree) { "$tree".Trim() } else { '' }

  # Staged change vs base (index compared to the base commit), for the classifier + reasons.
  # --no-renames (Finding G, patch-intake report; docs/specs/rename-classification-convergence.md):
  # `git diff` detects a tracked rename as a single R entry by DEFAULT, so without this flag a
  # rename never appears under --diff-filter=A or =D and delete_or_rename never fires here --
  # while `git diff-tree` (the CI audit's command) does NOT detect renames by default and always
  # sees delete+add, for the SAME commit. Pinning both to --no-renames makes them agree always,
  # not just on machines/configs where the defaults happen to line up. Same flag, same reasoning
  # already applied a few lines below to diff_id — extended here to the classification lists too.
  function StagedNames([string]$filter) {
    $args = @('diff', '--cached', '--no-renames', '--name-only')
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
  # --no-renames pins the diff so rename detection (diff.renames config) can never change the text;
  # the CI audit re-derives from `git diff --no-renames <base> <commit>` and must get the same bytes.
  $diffArgs = @('diff', '--cached', '--no-renames')
  if ($base) { $diffArgs += $base }
  $diffArgs += @('--', '.', $PCC_LEDGER_EXCLUDE)
  $diffText = (& git @diffArgs 2>$null) -join "`n"

  # Emit git's null-object-id (40 zeros — its own convention for "no commit") instead of an empty
  # string when there is no HEAD/base yet (an empty-history repo, e.g. a project's very first
  # commit). Empty strings would violate the receipt schema's minLength and break the verified path
  # for a brand-new project. The git COMMANDS above still key off the real (possibly-empty) refs.
  $NULL_SHA = '0000000000000000000000000000000000000000'
  $outBase = if ($base) { $base } else { $NULL_SHA }
  $outHead = if ($head) { $head } else { $NULL_SHA }
  $diffId = Get-DiffIdFromText $outBase $diffText

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
