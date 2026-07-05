# Worker Result — pcc-pathC-001

**Task:** Metrics & Evidence: Extend doctor.ps1 With Dirty-Tree, Branch-Hygiene, And File-Structure Checks
**Worker:** Claude Code
**Task Safety Class:** A (bounded, low-risk, mechanically checkable; no truth surface touched)

## Files created or changed

- **Edited** `scripts/doctor.ps1` — added three new advisory checks (Working tree, Branch hygiene, File structure), and fixed a pre-existing bug: the script never loaded `.cockpit/state/project-state.json` at all.
- **Edited** `docs/DECISIONS.md` — recorded `DECISION-077` (modularity/extractability promoted to core charter, done earlier in this session as an owner-approved documentation-only edit) and `DECISION-078` (this task's delivery).
- **Edited** `docs/PROJECT_CHARTER.md` — added a "Core Design Rule: Modularity / Extractability" section (owner-directed, part of the same session, precedes and informs this task's scoping).
- **Edited** `backlog/IDEAS.md` — added `IDEA-012` (this task, now marked delivered) and `IDEA-013` (richer evidence review, deliberately left at `proposed`, not promoted).
- No other script modified.

## Summary of changes

`doctor.ps1` previously reported five things: state consistency, restart safety, schema format, last gate result, and active task status. It now also reports:

1. **Working tree** — `git status --porcelain`; `OK` if clean, `WARN` (never `ISSUE`) if uncommitted changes exist.
2. **Branch hygiene** — current branch vs. `project-state.json`'s `active_branch`; `OK` if matched, `WARN` if not, plus ahead/behind counts against any configured upstream as informational detail.
3. **File structure** — confirms the five canonical `.cockpit/` subdirectories (`backups`, `handoff`, `logs`, `result`, `state`) and three canonical state files exist (`ISSUE` naming exactly what's missing if not); flags any unexpected top-level `.cockpit/` entry as `WARN`.

All three are read-only, call no other script, and preserve `doctor.ps1`'s existing always-`exit 0` advisory-only contract.

**Bug found and fixed during implementation:** `doctor.ps1` read `handoff-gate.json` and `task-state.json` via `Read-JsonSafe`, but never read `project-state.json` — so `$projectState` was always `$null`. The new branch-hygiene check's comparison depends on `project-state.json`'s `active_branch`; without this fix it would have silently fallen through to its "no data to compare" branch on every run. Added `$projectState = Read-JsonSafe $projectStatePath` alongside the existing calls.

## Commands run

Functional tests (not read-through only), each with results, followed by two induced-failure cases that were reverted immediately after confirming behavior:

1. `pwsh -NoProfile -File scripts/doctor.ps1` (baseline, real repo, current clean-ish state)
2. Induced case A — branch mismatch: temporarily changed `project-state.json`'s `active_branch` from `main` to `scratch-test-branch`, ran doctor, reverted to `main`.
3. Induced case B — missing directory: temporarily renamed `.cockpit/logs` to `.cockpit/logs_scratch_bak`, ran doctor, renamed back to `.cockpit/logs`.
4. Re-ran doctor after each revert to confirm restoration.

## Command/test results

| Test | Expected | Actual |
|---|---|---|
| Baseline run (before project-state.json fix) | Branch hygiene compares against active_branch | Bug found: always fell through to "no active_branch" WARN — `$projectState` was never loaded |
| Baseline run (after fix) | Branch hygiene reports OK on main | `[OK] Branch hygiene: On expected branch 'main'. Upstream 'origin/main': 0 ahead, 0 behind.` |
| Induced case A (branch mismatch) | WARN naming both branches | `[WARN] Branch hygiene: On branch 'main', but project-state.json's active_branch is 'scratch-test-branch'. ...` |
| Induced case A reverted | Back to OK | Confirmed OK again after revert |
| Induced case B (missing .cockpit/logs) | ISSUE naming the missing path | `[ISSUE] File structure: Missing expected .cockpit/ path(s): .cockpit/logs` |
| Induced case B reverted | Back to OK | `[OK] File structure: All canonical .cockpit/ subdirectories and state files are present; no unexpected top-level entries.` |
| Working tree (natural case, this task's own in-progress edits) | WARN, count of changes | `[WARN] Working tree: N uncommitted change(s) present. Normal mid-cycle; review before handoff/close-out.` |
| doctor.ps1 exit code throughout | Always 0 | Confirmed 0 in every run above, including both ISSUE/WARN cases |

## Known risks

- The branch-hygiene check's ahead/behind reporting depends on `git rev-list --left-right --count` against a configured upstream; if no upstream exists it states that plainly rather than treating it as a problem — this was exercised naturally (this repo has `origin/main` configured) but the "no upstream" wording itself was not separately forced/tested since inducing a genuinely upstream-less branch would require more disruptive git surgery than the bounded scope justified.
- The project-state.json load fix is a genuine behavior change to `doctor.ps1` beyond the three new checks named in the task; it was necessary for branch-hygiene to work at all, and no other part of `doctor.ps1` uses `$projectState`, so the fix is additive and low-risk, but it is disclosed here rather than silently folded in.

## Unresolved assumptions

- The five expected `.cockpit/` subdirectory names (`backups`, `handoff`, `logs`, `result`, `state`) and three canonical state file paths were taken from `docs/STATE_MODEL.md` and the live repo layout; if a future task adds a new canonical subdirectory, this check's expected list will need a corresponding update (not automatically discovered).

## Confirmation that forbidden scope was not touched

- Only `scripts/doctor.ps1` was modified among scripts; no other script changed.
- No schema changed, no verdict/task-status enum/Task Safety Class definition/Owner Review Matrix row/Stop-Instead-of-Guess trigger/Acceptance Boundary Rule changed.
- No new log event type; no write to `routing-log.jsonl`.
- `doctor.ps1`'s always-`exit 0` advisory-only contract preserved; none of the three new checks gate or block anything.
- All scratch artifacts used to induce test cases (the `active_branch` value swap, the `.cockpit/logs` rename) were reverted before this evidence was written; confirmed via a clean `.cockpit/` directory listing.
- No manual `codex exec` invoked — verification is left to the live PCC-CodexVerifyWatcher scheduled task.
