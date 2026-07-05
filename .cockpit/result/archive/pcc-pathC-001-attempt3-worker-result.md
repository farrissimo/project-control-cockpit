# Worker Result — pcc-pathC-001

**Task:** Metrics & Evidence: Extend doctor.ps1 With Dirty-Tree, Branch-Hygiene, And File-Structure Checks
**Worker:** Claude Code
**Task Safety Class:** A (bounded, low-risk, mechanically checkable; no truth surface touched)

## Resubmission note (attempt 2 of 3)

This is the third cycle of pcc-pathC-001.

**Cycle 1: `OUT_OF_SCOPE`.** The independent verifier correctly found that `docs/PROJECT_CHARTER.md` (recording `DECISION-077`) had been modified in the same working-tree cycle, which the directive's allowed scope did not authorize. That change (and a related `IDEA-013` backlog-intake entry, also outside this task's authorized `backlog/IDEAS.md` scope of "update IDEA-012 only") were split out and committed separately, on their own, as owner-directed session-level work distinct from this task:

- `3641fc4` — "Promote modularity/extractability into core charter (DECISION-077)" — `docs/PROJECT_CHARTER.md` + the `DECISION-077` portion of `docs/DECISIONS.md`.
- `6aadcd0` — "Backlog intake: record IDEA-013 ... as proposed, not promoted" — `backlog/IDEAS.md`'s `IDEA-013` entry only.

**Cycle 2: `FAIL`.** Scope was confirmed clean this time (no `out_of_scope_findings`), but the verifier correctly flagged that the functional-test evidence was incomplete: the "baseline" doctor run was never actually against a clean tree (this task's own edits were already present), and the Working-tree check's `WARN` path was only ever shown via those same real edits, not a deliberately induced case distinct from them.

**This cycle's fix:** a genuinely clean-state baseline and a properly isolated induced case were produced using a disposable local git clone (`git clone --local`) of this repo at current HEAD, with only `scripts/doctor.ps1`'s new code copied in and committed inside that throwaway clone (never touching the real repo or its history). This cleanly separates "does the new code work" from "is the real repo's working tree clean," which cannot both be true at once in the real repo mid-task. Full detail in Commands run / Command-test results below. The clone was deleted after use; the real repo was not touched by this testing.

## Files created or changed

- **Edited** `scripts/doctor.ps1` — added three new advisory checks (Working tree, Branch hygiene, File structure), and fixed a pre-existing bug: the script never loaded `.cockpit/state/project-state.json` at all.
- **Edited** `docs/DECISIONS.md` — recorded `DECISION-078` (this task's delivery; cites the already-committed `DECISION-077` by ID, does not modify it).
- **Edited** `backlog/IDEAS.md` — added `IDEA-012`'s delivery note only (`IDEA-013` is not part of this file's diff in this cycle; it was committed separately in `6aadcd0`).
- No other script modified. `docs/PROJECT_CHARTER.md` is not part of this cycle's diff.

## Summary of changes

`doctor.ps1` previously reported five things: state consistency, restart safety, schema format, last gate result, and active task status. It now also reports:

1. **Working tree** — `git status --porcelain`; `OK` if clean, `WARN` (never `ISSUE`) if uncommitted changes exist.
2. **Branch hygiene** — current branch vs. `project-state.json`'s `active_branch`; `OK` if matched, `WARN` if not, plus ahead/behind counts against any configured upstream as informational detail.
3. **File structure** — confirms the five canonical `.cockpit/` subdirectories (`backups`, `handoff`, `logs`, `result`, `state`) and three canonical state files exist (`ISSUE` naming exactly what's missing if not); flags any unexpected top-level `.cockpit/` entry as `WARN`.

All three are read-only, call no other script, and preserve `doctor.ps1`'s existing always-`exit 0` advisory-only contract.

**Bug found and fixed during implementation:** `doctor.ps1` read `handoff-gate.json` and `task-state.json` via `Read-JsonSafe`, but never read `project-state.json` — so `$projectState` was always `$null`. The new branch-hygiene check's comparison depends on `project-state.json`'s `active_branch`; without this fix it would have silently fallen through to its "no data to compare" branch on every run. Added `$projectState = Read-JsonSafe $projectStatePath` alongside the existing calls.

## Commands run

Functional tests (not read-through only), each with results:

**Against the real repo:**
1. `pwsh -NoProfile -File scripts/doctor.ps1` (baseline against the real repo's actual working state)
2. Induced case A — branch mismatch: temporarily changed `project-state.json`'s `active_branch` from `main` to `scratch-test-branch`, ran doctor, reverted to `main`.
3. Induced case B — missing directory: temporarily renamed `.cockpit/logs` to `.cockpit/logs_scratch_bak`, ran doctor, renamed back to `.cockpit/logs`.
4. Re-ran doctor after each revert to confirm restoration; `git status --porcelain` confirmed no scratch artifacts left behind.

**Against a disposable local clone (for a genuinely clean-tree baseline and an isolated Working-tree induced case):**
5. `git clone --local . <scratch-path>` — a throwaway local clone of this repo at current HEAD.
6. Copied only `scripts/doctor.ps1` (this task's new version) into the clone, `git add` + `git commit` inside the clone only (never touches the real repo's history or remote).
7. Ran `pwsh -NoProfile -File scripts/doctor.ps1` in the clone with its tree genuinely clean (0 uncommitted changes).
8. Created a throwaway untracked file (`scratch-induced-dirty.txt`) in the clone -- a dirty-tree case with no relationship to this task's own edits -- and re-ran doctor.
9. Deleted the scratch file, re-ran doctor to confirm reversion to clean, then deleted the entire clone directory.

## Command/test results

| Test | Expected | Actual |
|---|---|---|
| Baseline run (before project-state.json fix) | Branch hygiene compares against active_branch | Bug found: always fell through to "no active_branch" WARN — `$projectState` was never loaded |
| Baseline run (after fix, real repo) | Branch hygiene reports OK on main | `[OK] Branch hygiene: On expected branch 'main'. Upstream 'origin/main': 0 ahead, 0 behind.` |
| Induced case A (branch mismatch, real repo) | WARN naming both branches | `[WARN] Branch hygiene: On branch 'main', but project-state.json's active_branch is 'scratch-test-branch'. ...` |
| Induced case A reverted | Back to OK | Confirmed OK again after revert |
| Induced case B (missing .cockpit/logs, real repo) | ISSUE naming the missing path | `[ISSUE] File structure: Missing expected .cockpit/ path(s): .cockpit/logs` |
| Induced case B reverted | Back to OK | `[OK] File structure: All canonical .cockpit/ subdirectories and state files are present; no unexpected top-level entries.` |
| **Clean-state baseline (disposable clone, genuinely 0 uncommitted changes)** | Working tree: OK | `[OK] Working tree: No uncommitted changes.` (also observed: Branch hygiene OK; File structure ISSUE for `.cockpit/backups`, expected -- that path is git-ignored per docs/STATE_MODEL.md and so absent from any fresh clone, not a defect in the check) |
| **Induced Working-tree case (disposable clone, one throwaway untracked file, unrelated to this task's real edits)** | WARN, 1 change | `[WARN] Working tree: 1 uncommitted change(s) present. Normal mid-cycle; review before handoff/close-out.` |
| **Induced case reverted (clone)** | Back to OK | `[OK] Working tree: No uncommitted changes.` |
| doctor.ps1 exit code throughout | Always 0 | Confirmed 0 in every run above (real repo and clone), including all ISSUE/WARN cases |

## Known risks

- The branch-hygiene check's ahead/behind reporting depends on `git rev-list --left-right --count` against a configured upstream; if no upstream exists it states that plainly rather than treating it as a problem — this was exercised naturally (this repo has `origin/main` configured) but the "no upstream" wording itself was not separately forced/tested since inducing a genuinely upstream-less branch would require more disruptive git surgery than the bounded scope justified.
- The project-state.json load fix is a genuine behavior change to `doctor.ps1` beyond the three new checks named in the task; it was necessary for branch-hygiene to work at all, and no other part of `doctor.ps1` uses `$projectState`, so the fix is additive and low-risk, but it is disclosed here rather than silently folded in.
- The clean-state baseline and induced Working-tree case were run inside a disposable local clone rather than the real repo, since the real repo could not simultaneously be "genuinely clean" and "carrying this task's own in-progress edits." The clone was created via `git clone --local` (a local, same-machine operation only; nothing was pushed or fetched from any remote), had exactly one file (the new `scripts/doctor.ps1`) copied in and committed, and was deleted immediately after the test. This is disclosed as a testing-method choice, not silently substituted for real-repo evidence -- the branch-hygiene and file-structure induced cases were still exercised directly against the real repo.

## Unresolved assumptions

- The five expected `.cockpit/` subdirectory names (`backups`, `handoff`, `logs`, `result`, `state`) and three canonical state file paths were taken from `docs/STATE_MODEL.md` and the live repo layout; if a future task adds a new canonical subdirectory, this check's expected list will need a corresponding update (not automatically discovered).

## Confirmation that forbidden scope was not touched

- Only `scripts/doctor.ps1` was modified among scripts; no other script changed.
- No schema changed, no verdict/task-status enum/Task Safety Class definition/Owner Review Matrix row/Stop-Instead-of-Guess trigger/Acceptance Boundary Rule changed.
- No new log event type; no write to `routing-log.jsonl`.
- `doctor.ps1`'s always-`exit 0` advisory-only contract preserved; none of the three new checks gate or block anything.
- All scratch artifacts used to induce test cases (the `active_branch` value swap, the `.cockpit/logs` rename) were reverted before this evidence was written; confirmed via a clean `.cockpit/` directory listing. The disposable clone used for the clean-state/Working-tree tests was deleted in full after use and never touched the real repo.
- No manual `codex exec` invoked — verification is left to the live PCC-CodexVerifyWatcher scheduled task.
