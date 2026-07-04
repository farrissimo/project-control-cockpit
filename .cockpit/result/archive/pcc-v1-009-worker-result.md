# Worker Result

### Summary

Completed task `pcc-v1-009` by creating `scripts/enforce-handoff-restart-safety.ps1`, a local deterministic enforcement gate that must be run and must pass before the live handoff artifacts (`.cockpit/handoff/worker-directive.md` and `.cockpit/handoff/advisor-restart-brief.md`) are treated as ready for fresh-session use. It does not duplicate existing checks: it reuses `scripts/verify-dual-restart-safety.ps1` unchanged for the content-freshness/completeness checks (which in turn reuse `scripts/verify-worker-restart-safety.ps1` and `scripts/generate-advisor-restart-brief.ps1`), and reads `.cockpit/state/task-state.json` directly for the one check those proofs cannot make on their own: whether the active task is actually in a handoff-ready status.

That second check exists because of a concrete failure mode observed earlier in this same session: a fresh session was handed `pcc-v1-008`'s directive/result files after that task was already `complete` and verified `PASS`, and those files were byte-identical to what the (already-finished) task's own generators would produce — a content-only restart-safety proof would have passed on that stale handoff. The new gate closes that gap by refusing to pass whenever `task_status` is anything other than `ready_for_worker`, regardless of content validity.

Each run of the gate writes its verdict to a new runtime file, `.cockpit/state/handoff-gate.json` (`gate_result: PASS|FAIL`, `reason`, `checked_at`, `task_id`), so "has restart-safety validation passed for the artifacts currently on disk" is itself a canonical, inspectable fact rather than something only visible in a terminal transcript. Documented the gate and the new state file in `docs/HANDOFF_PACKET_SPEC.md` and `docs/STATE_MODEL.md`.

### Files Changed

* Created: `scripts/enforce-handoff-restart-safety.ps1`
* Created (runtime artifact, written by the script itself): `.cockpit/state/handoff-gate.json`
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a paragraph after the existing dual-restart-safety cross-reference, describing the new gate and its recorded verdict)
* Updated: `docs/STATE_MODEL.md` (added a short paragraph noting `.cockpit/state/handoff-gate.json` as an optional, derived supporting state file)

Note: `git status --porcelain` also shows `.cockpit/handoff/advisor-restart-brief.md`, `.cockpit/handoff/worker-directive.md`, `.cockpit/logs/routing-log.jsonl`, `.cockpit/result/worker-result.md`, `.cockpit/state/project-state.json`, and `.cockpit/state/task-state.json` as modified. These changes predate this task's execution (they reflect the advisor's advancement from `pcc-v1-008` to `pcc-v1-009` plus this session's earlier blocked-report write to `worker-result.md`, before this directive was issued) and were not touched by `scripts/enforce-handoff-restart-safety.ps1` itself, which only reads `task-state.json` and writes `handoff-gate.json` — confirmed by diffing this script's read/write paths against its source below and by the fact that `verify-dual-restart-safety.ps1`'s regeneration steps write only to OS-temp scratch paths, never the live `.cockpit/handoff/*` files.

### Commands / Tests Run

1. **Live-repo run (expected and actual pass):**
   `powershell -ExecutionPolicy Bypass -File scripts/enforce-handoff-restart-safety.ps1`
2. **Stale-task-status test** (scratch copy of `.cockpit` + `scripts` under a temp directory, never the live repo): edited the scratch `task-state.json` so `task_status` was `complete` while directive/brief content was otherwise untouched and valid, then ran the gate against the scratch copy.
3. **Stale-content test** (separate scratch copy): left `task_status` as `ready_for_worker` but hand-edited the scratch `worker-directive.md` (renamed all `pcc-v1-009` references to `pcc-v1-999-stale`), then ran the gate against that scratch copy, to confirm the underlying dual-restart proof's failure still propagates through the new gate.
4. Re-ran the gate against the live repo after the doc edits, to confirm nothing in this task's own changes broke the passing state.
5. `git status --porcelain` before and after all work, to confirm only the intended files were created/modified and that scratch-copy testing never touched the live repo.
6. Deleted both temporary scratch directories after testing (`/tmp/pcc-gate-test`, `/tmp/pcc-gate-test2`).

### Results

1. Exit code `0`. Output ended with: `Handoff gate PASSED: task 'pcc-v1-009' handoff artifacts are restart-safe and ready for fresh-session use. Gate recorded at .cockpit/state/handoff-gate.json.` The written gate file recorded `gate_result: "PASS"`, `task_id: "pcc-v1-009"`.
2. Exit code `1`. Failed with: `Handoff gate FAILED: task-state.json task_status is 'complete', not 'ready_for_worker'. Fresh-session handoff artifacts for task 'pcc-v1-009' must not be treated as ready to hand off while the active task is in this status.` The scratch gate file recorded `gate_result: "FAIL"` with that same reason — confirming the gate blocks exactly the stale-completed-task scenario this task exists to prevent, independent of content validity.
3. Exit code `1`. Failed with (from the underlying `verify-worker-restart-safety.ps1`, propagated through `verify-dual-restart-safety.ps1` and then the new gate): `Restart-safety check FAILED: .cockpit/handoff/worker-directive.md does not match what generate-worker-directive.ps1 currently produces from canonical state...` followed by `Dual-restart proof FAILED (worker side): ...` followed by `Handoff gate FAILED: scripts/verify-dual-restart-safety.ps1 reported a restart-safety problem for task 'pcc-v1-009'. See its output above for detail.` The scratch gate file recorded `gate_result: "FAIL"` with the gate's own summary reason — confirming detail from the composed checks is preserved, not swallowed.
4. Exit code `0`, same passing output as Result 1.
5. `git status --porcelain` showed only the files listed under Files Changed as new/modified by this task; the pre-existing modifications noted there were present before this task's first command and unchanged in shape by it.
6. Both scratch directories removed; confirmed no residue via directory listing.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic enforcement step exists that checks restart safety before fresh-session handoff artifacts are treated as ready** — `scripts/enforce-handoff-restart-safety.ps1`, created this cycle; pure PowerShell, no network or model calls.
* **The enforcement reuses the generated advisor restart brief, the generated worker directive, and canonical repo truth rather than introducing hidden script-only truth** — confirmed by the script body: it reads `task-state.json` directly and delegates all content checks to the existing `verify-dual-restart-safety.ps1` (which itself compares the live brief/directive against fresh output from `generate-advisor-restart-brief.ps1` / `generate-worker-directive.ps1`). No new hardcoded facts were introduced.
* **The enforcement fails clearly on stale or incomplete handoff inputs and passes on valid inputs** — confirmed by Results 1 (pass on valid live inputs), 2 (fails clearly on a stale task-status/already-complete task), and 3 (fails clearly on stale/hand-edited directive content, with underlying detail visible).
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell and JSON, no dependencies added, no network access.
* **The enforcement remains narrowly scoped and does not introduce broad orchestration or paid dependencies** — one new script plus one derived state file; no hooks, watchers, schedulers, or CI wiring were added. It is invoked on demand, the same way the existing restart-safety proofs are.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* The gate is still invoked on demand, not automatically triggered by every act of handing off artifacts to a fresh session — nothing in the repo currently forces this script to run before a directive is copied to a new chat. This is a deliberate scope boundary (the directive forbids "broad orchestration or automation"), not an oversight, but it means enforcement still depends on the advisor/owner remembering to run it.
* `.cockpit/state/handoff-gate.json`'s `PASS` verdict reflects the moment it was checked, not a live/continuous guarantee. If `worker-directive.md`, `advisor-restart-brief.md`, or `task-state.json` change after a passing gate run, the recorded `PASS` becomes stale until the gate is re-run — nothing currently invalidates the file automatically on a later edit.
* The task-status check treats `ready_for_worker` as the sole "ready to hand off" status. If future task states introduce other legitimately handoff-ready statuses, this gate would need an explicit update to its allow-list rather than picking them up automatically.

### Unresolved Assumptions

* Assumed `ready_for_worker` is the correct (and currently only) task-status value that should gate as "ready for handoff," based on `docs/STATE_MODEL.md`'s task status list and this task's own directive showing that status for `pcc-v1-009`. Other statuses (`drafted`, `in_progress`, `complete`, etc.) were all treated as not handoff-ready.
* Assumed writing the gate verdict to a new file (`.cockpit/state/handoff-gate.json`) rather than adding fields to the existing `task-state.json` schema is the more bounded choice, since it avoids modifying `docs/STATE_MODEL.md`'s required `task-state.json` field list or `scripts/validate-cockpit-state.ps1`'s expectations, and keeps the enforcement record clearly separate from task truth itself.
* Assumed composing (invoking `verify-dual-restart-safety.ps1` as a subprocess) rather than re-implementing its checks was the right design, consistent with the same bounded-composition pattern used by `pcc-v1-008`'s own script.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration or automation was introduced (the gate is an on-demand script, matching the existing pattern of `verify-worker-restart-safety.ps1` and `verify-dual-restart-safety.ps1`), and no canonical project goals or verification verdicts were changed. `docs/HANDOFF_PACKET_SPEC.md` and `docs/STATE_MODEL.md` edits are directly about the new restart-safety enforcement gate and its state file, per allowed scope. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, `project-state.json`, and the existing restart-safety scripts). All stale/incomplete-input testing was performed against disposable scratch copies under the OS temp directory, never the live repo; both scratch directories were deleted after use.
