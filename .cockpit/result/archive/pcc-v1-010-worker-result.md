# Worker Result

### Summary

Completed task `pcc-v1-010` by creating `scripts/backup-protected-files.ps1`, a local deterministic backup/restore helper for PCC's own control files. It supports three actions: `Backup` (create a timestamped restore point), `Restore` (copy a chosen restore point's files back into place), and `List` (show available restore points). This implements `backlog/IDEAS.md` IDEA-005 (ranked #1 in the 2026-07-03 owner review) exactly as scoped in `backlog/details/idea-005-pretask-backup.md`: a small, explicit protected file set, a non-canonical backup location independent of git, and a helper that is passive and never gates anything.

The protected set is: `.cockpit/state/project-state.json`, `.cockpit/state/task-state.json`, `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md`, `.cockpit/result/worker-result.md`, `.cockpit/result/verification-result.json`, and every `*.ps1` file under `scripts/`. Restore points are written to `.cockpit/backups/<timestamp>/` with a `manifest.json` recording exactly which files were captured; this location is now git-ignored so it never pollutes canonical repo history. Restore reads the manifest and refuses to act if it is missing or if any listed file is absent from the snapshot, so a corrupted or partial restore point cannot cause a partial/inconsistent restore.

The helper does not call itself from any other script, is not wired into `enforce-handoff-restart-safety.ps1` or any other check, and nothing in the repo requires it to run before a task can proceed — consistent with the directive's requirement that it "remain passive and non-gating."

### Files Changed

* Created: `scripts/backup-protected-files.ps1`
* Created: `.gitignore` (new file; ignores `.cockpit/backups/` so restore points never pollute canonical history)
* Updated: `docs/STATE_MODEL.md` (added a paragraph describing `.cockpit/backups/` as a non-canonical, passive, git-ignored recovery location)

Runtime artifacts: each `Backup` run creates a new `.cockpit/backups/<timestamp>/` folder plus `manifest.json`; these are git-ignored and were deleted after each test run in this cycle (see Commands/Tests Run), so none are present in the final working tree.

Note: `git status --porcelain` also shows `.cockpit/handoff/*`, `.cockpit/result/*`, `.cockpit/state/project-state.json`, `.cockpit/state/task-state.json`, `backlog/IDEAS.md`, `docs/HANDOFF_PACKET_SPEC.md`, `.cockpit/state/handoff-gate.json`, and `scripts/enforce-handoff-restart-safety.ps1` as modified/untracked. These predate this task's execution (they reflect the prior `pcc-v1-009` cycle's committed work plus the advisor's advancement to `pcc-v1-010` and this session's backlog-ranking edits) and were not touched by this task.

### Commands / Tests Run

1. **Backup, live repo:**
   `powershell -ExecutionPolicy Bypass -File scripts/backup-protected-files.ps1 -Action Backup`
2. Inspected the resulting `manifest.json` and ran `-Action List` to confirm the restore point is discoverable.
3. **Corruption + restore test (live repo, deliberately reversible):** saved a copy of `.cockpit/state/task-state.json` to a scratch temp path, overwrote the live file with garbage non-JSON content, then ran:
   `powershell -ExecutionPolicy Bypass -File scripts/backup-protected-files.ps1 -Action Restore -RestorePoint <timestamp-from-step-1>`
   then diffed the restored file against the pre-corruption scratch copy.
4. **Missing-argument guard:** `-Action Restore` with no `-RestorePoint`.
5. **Nonexistent-restore-point guard:** `-Action Restore -RestorePoint "does-not-exist"`.
6. **Missing-manifest guard:** created an empty scratch folder `.cockpit/backups/broken-point-test/` (no manifest.json) and ran `-Action Restore -RestorePoint "broken-point-test"`.
7. `git status --porcelain --ignored` after adding `.gitignore`, filtered for `backups`, to confirm the backup directory is recognized as ignored.
8. A second live `Backup` run, purely as a final demonstration of the working helper, followed by cleanup (`rm -rf .cockpit/backups`) and a final `git status --porcelain` to confirm no residue.

### Results

1. Exit code `0`. Output: `Restore point '20260703-190002' created at .cockpit\backups\20260703-190002 (14 file(s) backed up, 0 skipped/missing).` Manifest listed all 6 explicit protected files plus 8 `scripts/*.ps1` files (7 existing scripts at the time, plus the new helper itself), matching expectations.
2. `List` output: `20260703-190002  (14 file(s), created 2026-07-03T19:00:02-06:00)` — confirms `List` reads the manifest correctly.
3. Exit code `0`. Output: `Restored 14 file(s) from restore point '20260703-190002': ...` (all 14 paths listed). `diff` between the restored `task-state.json` and the pre-corruption scratch copy produced no output — **byte-for-byte match**, confirming the corrupted file was fully and correctly recovered.
4. Exit code `1`. Failed with: `Restore requires -RestorePoint <name>. Use -Action List to see available restore points.`
5. Exit code `1`. Failed with: `Restore point 'does-not-exist' does not exist under .cockpit/backups.`
6. Exit code `1`. Failed with: `Restore point 'broken-point-test' is missing its manifest.json and cannot be trusted. Restore aborted.` No files were touched (the failure occurs before any copy).
7. `!! .cockpit/backups/` — confirmed git recognizes the path as ignored.
8. Exit code `0`, same successful-backup behavior as step 1. Final `git status --porcelain` showed no `.cockpit/backups/` entries and no other unintended changes.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic backup/restore helper exists for an explicit protected PCC file set** — `scripts/backup-protected-files.ps1`, with the protected set hardcoded as an explicit list (Results 1–2).
* **The helper can create a timestamped restore point in a non-canonical backup location without depending on git** — confirmed by Result 1 (`.cockpit/backups/<timestamp>/`, no git commands involved) and by `.gitignore` keeping it out of canonical history (Result 7).
* **The helper can restore a chosen snapshot of the protected files back into place** — confirmed by Result 3, including a byte-for-byte diff proving correct recovery of deliberately corrupted content.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell and JSON, no dependencies, no network access.
* **The helper remains passive and non-gating; it does not block task completion or become workflow enforcement** — confirmed by design (no other script calls it, it is not part of `enforce-handoff-restart-safety.ps1` or any other check) and by the guard-condition tests (Results 4–6), which show the helper only ever fails *its own* restore action, never something else's.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* Restore points accumulate under `.cockpit/backups/` with no automatic pruning. Over many cycles this could grow unbounded on disk (though it stays out of git). A future follow-on could add a retention cap, but that would be new scope beyond this bounded task.
* The protected file set is a hardcoded list inside the script rather than sourced from canonical state. If the set of files PCC considers "protected" changes (e.g., a new state file is added), this script needs a manual update — it will not pick up new protected files automatically. This mirrors the same tradeoff accepted for other bounded helpers in this project and was judged simpler and more bounded than adding a new canonical-state field just for this.
* `Restore` overwrites live files unconditionally (no dry-run or diff-preview step). This is consistent with "passive and non-gating" (nothing stops you from running it), but it does mean a restore is not itself protected by a confirmation prompt — the safety model here relies on `Restore` being an explicit, deliberate action rather than something invoked accidentally or automatically.

### Unresolved Assumptions

* Assumed the six explicit non-script files listed in `backlog/details/idea-005-pretask-backup.md` ("state files, live handoff artifacts, `scripts/`") should map to exactly `project-state.json`, `task-state.json`, `worker-directive.md`, `advisor-restart-brief.md`, `worker-result.md`, and `verification-result.json` — i.e., the current live handoff/result pair, not the `archive/` copies, since archived copies are already immutable historical record and do not need restore-point protection.
* Assumed all `scripts/*.ps1` files should be included as a group (rather than naming each script individually), since the idea detail doc says "scripts/" as one item and PCC's script count is expected to keep growing — enumerating by directory avoids needing to update this helper every time a new script is added.
* Assumed "non-gating" means this helper must never be invoked automatically by any other PCC script (including `enforce-handoff-restart-safety.ps1`), and that leaving it purely on-demand (like the existing restart-safety scripts) satisfies "keep the helper passive" rather than requiring some additional passivity mechanism.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no orchestration or automation was introduced (the helper is on-demand only, not wired into any other script or trigger), and no canonical project goals or verification verdicts were changed. `docs/STATE_MODEL.md` was updated only to describe the new non-canonical backup location, per allowed scope ("docs directly related to backup/restore handling, protected files, or canonical state"). `.gitignore` is a new root-level file but is narrowly scoped to keeping the backup path non-canonical, matching the idea detail doc's explicit guidance ("should be git-ignored ... to not pollute canonical state"). The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and `backlog/details/idea-005-pretask-backup.md`). All corruption/guard-condition testing was performed against the live repo only where safely reversible (task-state.json was saved to a scratch temp copy before corruption and verified byte-for-byte restored), and all demonstration restore-point directories were deleted after use, confirmed via `git status --porcelain` showing no residue.
