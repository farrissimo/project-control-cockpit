# Worker Result

* Task ID: pcc-pathD-003
* Task Title: Routing / Local Tools Read-Only Panel
* Task Safety Class: A
* Worker: Claude Code
* Handback: for verification via ChatGPT manual bridge (owner's stated session preference: pause before each verification), not self-closed

### Summary

Added the final two Phase D1 panels to `scripts/generate-dashboard.ps1`: the **Local Tools Panel** (displays `scripts/classify-routing.ps1`'s advisory stdout, invoked as an explicit subprocess and captured verbatim as display-only text) and **Routing History** (a read-only tail of `.cockpit/logs/routing-log.jsonl`). `dashboard/index.html` now renders all five Phase D1 panels. **Phase D1 is now complete** (`pcc-pathD-001` through `pcc-pathD-003`).

This is a deliberate, disclosed, narrow exception to the prior two tasks' "calls no other script" rule: `classify-routing.ps1` produces plain advisory stdout (not structured data), so surfacing it means either duplicating its classification logic inline (a real extractability risk -- two copies silently drifting apart) or invoking it as an explicit subprocess, mirroring `scripts/doctor.ps1`'s already-audited composition pattern (`pcc-pathC-004`). No other script is invoked.

**Process continuation from `pcc-pathD-002`:** the mandatory pre-task handoff/backup gate was run correctly before any code change again this cycle, passing cleanly on its first real attempt with a genuine pre-task backup (`.cockpit/backups/20260705-184557`).

### Files Changed

1. `scripts/generate-dashboard.ps1` -- added `-RoutingLogPath`, `-ClassifyRoutingScriptPath`, `-RoutingHistoryTailCount` parameters; `Get-RoutingHistoryHtml` and `Get-LocalToolsAdvisoryHtml` helper functions; the Local Tools Panel and Routing History sections in the HTML body; minor CSS for `<pre>`.
2. `docs/DECISIONS.md` -- added `DECISION-093`.
3. `docs/PATH_A_PLAN.md` -- marked `pcc-pathD-003` delivered (pending verification), updated the Category D roadmap line to reflect Phase D1 complete.
4. `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` -- drafted/advanced for this task.
5. `.cockpit/state/handoff-gate.json` -- PASS gate record for `pcc-pathD-003`.
6. `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` -- regenerated.
7. `dashboard/index.html` -- regenerated (gitignored, generated artifact).

**No script other than `scripts/generate-dashboard.ps1` was edited (including `scripts/classify-routing.ps1` and `scripts/doctor.ps1`, both referenced read-only, never touched); no schema edited.**

### Commands / Tests Run

* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1` -- clean before drafting.
* Set `task_status` to `ready_for_worker`; ran `scripts/enforce-handoff-restart-safety.ps1` **before any code change** -- passed cleanly on the first real attempt, genuine pre-task backup `20260705-184557` (47 files) created before work began.
* Set `task_status` to `in_progress`; made the code changes.
* `pwsh -File scripts/generate-dashboard.ps1` -- against the real, live `.cockpit/` state: Local Tools Panel correctly showed the live routing advisory for `pcc-pathD-003` itself (classified `mixed`); Routing History correctly tailed the last 10 real log entries across both historical entry shapes.
* Synthetic tests, in an isolated scratch directory outside the repo:
  * Missing `-RoutingLogPath` -> graceful `(no routing history: ... not found)`, exit 0, dashboard still renders.
  * Empty `-RoutingLogPath` file -> graceful `(routing history is empty)`, exit 0.
  * `-RoutingLogPath` with one malformed line among two valid ones -> malformed line skipped, both valid entries rendered correctly.
  * Missing `-ClassifyRoutingScriptPath` -> graceful `(routing advisory unavailable: ... not found)` for that one panel; rest of the dashboard (confirmed: Owner Control Board present) still rendered normally.
  * Malformed `-TaskStatePath` -> whole dashboard correctly fails (this is the existing, correct behavior from `pcc-pathD-001`/`002` for a malformed core input; confirmed unchanged, a distinct and correct failure mode from the two graceful-degradation cases above).
* Confirmed via `git status --short .cockpit/` that none of the test runs touched any `.cockpit/` file (diffs present are only this task's own legitimate state bookkeeping).
* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, `scripts/doctor.ps1` -- all clean after the change (see Results).

### Results

* Real-state run: all five panels render correctly; Local Tools Panel shows the genuine live advisory output verbatim (HTML-escaped); Routing History shows the real last-10 tail, correctly handling both `{route, reason, result}` and `{event_type, detail}` entry shapes in the same table.
* All four synthetic edge cases behave exactly as specified: two graceful degradations (missing/empty log, missing classify-routing script) that don't crash the dashboard, one line-level tolerance (malformed JSONL line skipped), and confirmation that a malformed core state file still correctly fails the whole dashboard (unchanged prior behavior, not a regression).
* `doctor.ps1`: no `[ISSUE]`. Handoff gate `[OK]` for `pcc-pathD-003`. The pre-existing "Working tree: N uncommitted change(s)" `[WARN]` is expected mid-cycle.

### Evidence

* `scripts/generate-dashboard.ps1` invokes exactly one other script, `scripts/classify-routing.ps1`, as an explicit subprocess (`& pwsh -NoProfile -File $ScriptPath -TaskStatePath $TaskStatePath`), capturing stdout and exit code -- the same composition shape `scripts/doctor.ps1` already uses and that the `pcc-pathC-004` extractability audit reviewed and found extractable (no hidden shared state, explicit contract).
* Routing History reads `.cockpit/logs/routing-log.jsonl` directly via `Get-Content`/`ConvertFrom-Json` per line, with a `try/catch` around each line's parse so one bad line cannot take down the whole panel.
* The script still writes only `-OutputPath` and mutates no `.cockpit/` file directly itself.

### Known Risks

* `classify-routing.ps1`'s output is captured as opaque display text (not parsed/re-interpreted) -- if its own output format ever changes, the Local Tools Panel just shows whatever it prints, with no structural coupling to break, but also no ability for the dashboard to react to a change in its meaning.
* Routing History's tolerance for the log's two historical entry shapes is field-presence-based (`event_type` vs `route`); a future third shape would render best-effort (blank cells for absent fields) rather than fail, which is the intended degrade-gracefully behavior but is worth knowing.
* Same static-snapshot risk as the prior two tasks: manual regeneration only, until Phase D2 (`pcc-pathD-004`), which is the next task now that Phase D1 is complete.

### Unresolved Assumptions

* That capturing `classify-routing.ps1`'s full stdout verbatim (rather than parsing out just the "Detected routing class" line) is the right level of detail for this panel -- judged more honest and simpler than re-parsing an advisory that already states it may be wrong.
* That Task Safety Class A remains correct for this task (same precedent as the prior two).

### Out-of-Scope Confirmation

Confirmed: no script other than `scripts/generate-dashboard.ps1` was modified; no schema was modified; no new log event type was added; exactly one other script (`scripts/classify-routing.ps1`) was invoked as a subprocess, matching the disclosed, scoped exception -- no other script was called; the dashboard writes no `.cockpit/` file; no verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule was changed; no Phase D2/D3 functionality (auto-refresh, write-path controls) was built; `codex exec` was not invoked and no verification verdict was self-issued; the mandatory pre-task handoff/backup gate was run correctly before work began.
