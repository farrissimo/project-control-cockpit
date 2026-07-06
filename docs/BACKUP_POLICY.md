# Backup / restore-point policy

When to use `scripts/backup-protected-files.ps1`. This is **not optional** for the
triggers below. Grounded in `docs/STATE_MODEL.md` (`.cockpit/backups/` is
"cheap, git-independent recovery insurance before risky cycles") and the
project's original pre-task backup convention.

## What it is
A restore point copies a small, explicit **protected set** — the canonical state
files, live handoff artifacts, the latest evidence/verification pair, and all
`scripts/*.ps1`, `schemas/*.json`, `docs/*.md` — into a timestamped folder under
`.cockpit/backups/` (git-ignored) with a `manifest.json`. It is passive and
non-gating: nothing reads it to allow/block work; restoring is always a
deliberate manual action.

## Why it is separate from git
Git is the primary snapshot and the off-machine backup (commits + push). The
restore point is **git-independent local insurance**: it survives even if git
history is disrupted, a rebase/reset goes wrong, or protected files are damaged
while uncommitted. Use **both** — commit as you go **and** take restore points
at the triggers below.

## When to create a restore point (mandatory)
Run `-Action Backup` BEFORE any of these:
1. **Starting a risky change cycle** — a bounded task or a batch of edits that
   will touch protected files (state, scripts, schemas, docs, handoff artifacts).
2. **The start of a work session** that will modify any protected file.
3. **A bulk or mechanical change** spanning many files at once.
4. **Overwriting, deleting, or restoring** any protected file.
5. **Before a git operation that rewrites history** (reset --hard, rebase, force-push).

If in doubt, take one — it is cheap and never harmful.

## Commands
```
# Create a restore point (do this at the triggers above)
pwsh -NoProfile -File scripts/backup-protected-files.ps1 -Action Backup

# List restore points
pwsh -NoProfile -File scripts/backup-protected-files.ps1 -Action List

# Restore a specific point (deliberate, manual)
pwsh -NoProfile -File scripts/backup-protected-files.ps1 -Action Restore -RestorePoint <timestamp>
```

## Retention
Restore points are disposable local snapshots, not project truth. Prune old ones
manually when the folder grows; git remains the canonical history.
