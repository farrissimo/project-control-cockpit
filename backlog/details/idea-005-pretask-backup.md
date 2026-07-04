# IDEA-005 Detail: Pre-Task Protected-File Backup / Restore Point

Placeholder detail for IDEA-005. Non-canonical. Not an active task.

## Problem

PCC edits its own control files (`.cockpit/state/*.json`, `.cockpit/handoff/*`, `scripts/*`) on nearly every cycle. A worker (or a bad edit) can damage the exact files that define state, routing, and workflow *before* anyone has made a clean git commit. Git alone does not cover the window between "last good commit" and "risky edit," which is precisely when self-inflicted damage happens.

## Idea

Before a risky cycle, take an automatic local restore point of a small, fixed set of protected files, independent of git commit hygiene. If the cycle damages those files, recovery is a cheap, deterministic copy-back rather than manual reconstruction.

## Why it ranks #1 under the babysitting filter

* **Reduces babysitting:** removes the fear that makes the owner supervise risky cycles closely; recovery becomes routine, not a crisis.
* **No governance added:** it is a snapshot helper, not a rule or approval step.
* **Cannot block task completion:** a backup is passive. It never gates, halts, or rejects a cycle — it only creates an escape hatch. This is the property that puts it above `doctor` and `safe-stop`.

## Rough shape (non-binding)

* A local deterministic script (PowerShell) that copies the protected file set into a timestamped folder under something like `.cockpit/backups/<timestamp>/` (path TBD).
* A matching restore step that copies a chosen restore point back.
* Protected set kept small and explicit (state files, live handoff artifacts, `scripts/`), not the whole repo.
* Old restore points pruned/capped so backups do not accumulate into bloat.

## Boundaries / cautions

* Must stay complementary to git, not a replacement for it.
* Must not become a required gate — it is insurance, invoked before risky work, never a blocker on normal completion.
* Backup directory should be git-ignored or otherwise kept from polluting canonical state.

## Related

* CCB lesson #1 (protected-file backup / restore point).
* [[idea-006-doctor-healthcheck]], [[idea-007-safe-stop]] — the other two Tier-1 babysitting-reducers from the 2026-07-03 review.
* Original scope §7.14 (manual compact/restart/fork/rollover) and DECISION-010 (fresh-thread rollover as safety mechanism) share the "cheap recovery" spirit.
