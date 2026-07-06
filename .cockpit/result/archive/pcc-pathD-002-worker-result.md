# Worker Result

* Task ID: pcc-pathD-002
* Task Title: Directive + Verification Panels (Read-Only)
* Task Safety Class: A
* Worker: Claude Code
* Handback: for verification via ChatGPT manual bridge (owner's stated session preference: pause before each verification), not self-closed

### Summary

Extended `scripts/generate-dashboard.ps1` (`pcc-pathD-001`, `DECISION-089`) with two more read-only panels per `docs/PATH_A_PLAN.md` §6, Phase D1: the **Directive Panel** (task ID/title, safety class, allowed/forbidden scope, completion criteria, required evidence, handoff target) and the **Verification Panel** (verdict, summary, missing evidence, out-of-scope findings, risks, next action, evidence-file pointer). `dashboard/index.html` now renders all three panels. The Directive Panel is sourced entirely from fields already present in `.cockpit/state/task-state.json` (no markdown parsing needed); the Verification Panel reads the one genuinely new input, `.cockpit/result/verification-result.json`.

**Process correction from `pcc-pathD-001`:** this cycle ran the mandatory pre-task handoff/backup gate (`scripts/enforce-handoff-restart-safety.ps1`) correctly, before any code change -- task-state was moved to `ready_for_worker` first, the gate produced a genuine pre-task backup (`.cockpit/backups/20260705-183639`), and only then did work move to `in_progress`. The gap disclosed on `pcc-pathD-001` did not recur.

### Files Changed

1. `scripts/generate-dashboard.ps1` -- added `-VerificationResultPath` and `-WorkerResultPath` parameters, `Format-ListOrNone` and `Build-Table` helpers, the Directive Panel and Verification Panel row sets, and the updated three-panel HTML body.
2. `docs/DECISIONS.md` -- added `DECISION-092`.
3. `docs/PATH_A_PLAN.md` -- marked `pcc-pathD-002` delivered (pending verification) in §5 and §6; scope/spec unchanged.
4. `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` -- drafted/advanced for this task.
5. `.cockpit/state/handoff-gate.json` -- PASS gate record for `pcc-pathD-002` (mandatory pre-task gate, run correctly this cycle).
6. `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` -- regenerated from canonical state.
7. `dashboard/index.html` -- regenerated (gitignored, generated artifact).

**No existing script other than `scripts/generate-dashboard.ps1` was edited; no schema was edited.**

### Commands / Tests Run

* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1` -- clean before drafting.
* Set `task_status` to `ready_for_worker`; ran `scripts/enforce-handoff-restart-safety.ps1` **before any code change**. First run failed on a stale advisor-restart-brief (benign staleness, not a process skip); fixed by running `scripts/refresh-live-handoff-artifacts.ps1`; re-ran the gate -> PASS, with a genuine pre-task backup (`20260705-183639`, 47 files) recorded before work began.
* Set `task_status` to `in_progress`; made the code changes.
* `pwsh -File scripts/generate-dashboard.ps1` -- against the real, live `.cockpit/` state: all three panels render correctly.
* `pwsh -File scripts/generate-dashboard.ps1 -VerificationResultPath .cockpit/result/archive/pcc-pathD-001-verification-result.json -WorkerResultPath .cockpit/result/archive/pcc-pathD-001-worker-result.md` -- against a real completed cycle's archived artifacts: Verification Panel correctly rendered the actual archived INSUFFICIENT verdict, its full summary, missing evidence, and risks; Evidence File pointer correctly showed the archived path.
* Synthetic failure-mode tests for the new input, in an isolated scratch directory outside the repo:
  * Malformed JSON for `-VerificationResultPath` -> `Fail "Invalid JSON in ... :: Conversion from JSON failed ..."`, exit 1, no output file written.
  * Missing file for `-VerificationResultPath` -> `Fail "Missing required file: ..."`, exit 1, no output file written.
* Confirmed via `git status --short .cockpit/` that the synthetic test runs touched no `.cockpit/` file (diffs present are only this task's own legitimate state bookkeeping).
* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, `scripts/doctor.ps1` -- all clean after the change (see Results).

### Results

* Real-state run: all three panels (Owner Control Board, Directive, Verification) render with correct live content; HTML-encoding confirmed correct (embedded apostrophes render as `&#39;`).
* Archived-cycle run: Verification Panel correctly shows the real `pcc-pathD-001` INSUFFICIENT verdict and full evidence from the archive, not the live cycle -- confirming the panel genuinely reads whatever file path it's given rather than something hardcoded.
* Both synthetic failure cases for the new input exit non-zero, print a clear, specific error, and write nothing.
* `doctor.ps1`: no `[ISSUE]`. Handoff gate `[OK]` for `pcc-pathD-002` after the correctly-run gate (no repeat of the `pcc-pathD-001` `[WARN]`). The pre-existing "Working tree: N uncommitted change(s)" `[WARN]` is expected mid-cycle.

### Evidence

* `scripts/generate-dashboard.ps1` remains read-only over the `.cockpit/` bridge: the only new file read is `.cockpit/result/verification-result.json` (structured JSON, parameterized path); `worker-result.md` is referenced by path only, never opened; writes only `-OutputPath`; calls no other script.
* Directive Panel avoids a markdown-parsing dependency entirely by sourcing from `task-state.json` fields already in hand, which carry the same content `worker-directive.md` renders.
* `docs/PATH_A_PLAN.md` §6's completion criteria explicitly allowed this simplification ("or equivalently sourced fields already available in task-state.json, whichever is simpler and does not require a markdown parser dependency").

### Known Risks

* The Verification Panel always reflects whatever is currently at the given `-VerificationResultPath` (live path by default), which is the *previous* cycle's verdict while a new cycle is `in_progress` -- this is correct/expected behavior (the file genuinely hasn't been overwritten yet), but a reader glancing at the dashboard mid-cycle could momentarily mistake a prior verdict for the current one. Not a bug; a live-dashboard limitation that Phase D2's auto-refresh work does not change, since even auto-refresh only reflects whatever the file currently contains.
* Same static-snapshot risk as `pcc-pathD-001`: manual regeneration only, until Phase D2 (`pcc-pathD-004`).

### Unresolved Assumptions

* That displaying `worker-result.md`'s path as a pointer (rather than rendering its content) satisfies the Verification Panel's evidence-file requirement -- the owner opens that file directly for full detail. Rendering full markdown content was judged unnecessary complexity for a read-only status board.
* That Task Safety Class A remains correct for this task (same precedent as `pcc-pathD-001`).

### Out-of-Scope Confirmation

Confirmed: no script other than `scripts/generate-dashboard.ps1` was modified; no schema was modified; no new log event type was added; the dashboard generator still calls no other script and writes no `.cockpit/` file; no verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule was changed; no Phase D2/D3 functionality (auto-refresh, Local Tools/routing-history panel, write-path controls) was built; `codex exec` was not invoked and no verification verdict was self-issued for this task; the mandatory pre-task handoff/backup gate was run correctly before work began, unlike the prior cycle.
