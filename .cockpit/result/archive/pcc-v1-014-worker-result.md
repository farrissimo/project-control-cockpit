# Worker Result

### Summary

Completed task `pcc-v1-014` by fixing both confirmed root causes of `scripts/advance-cockpit-state.ps1`'s post-close-out staleness (IDEA-011), which had bitten `pcc-v1-011` and `pcc-v1-012` and required manual correction each time.

**Root cause 1 (next_action staleness):** for a `PASS` verdict, the script now defaults `next_action`/`next_expected_action` to a durable, always-true statement ("Task '&lt;id&gt;' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.") instead of copying `verification.next_action` verbatim — that text was always the verifier's own pre-close-out checklist (advance/doctor/archive/commit), which necessarily describes already-finished work as pending the moment those steps complete. A new optional `-FinalNextAction` parameter lets a verifier override this default when a specific PASS cycle genuinely needs different wording recorded. Non-`PASS` verdicts (`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE`) are unaffected — their `next_action` describes corrective work that genuinely still needs to happen, so it's left as `verification.next_action`, unchanged from before.

**Root cause 2 (last_verified_handoff pointing at the wrong path):** a new optional `-ArchivedDirectivePath` parameter lets the caller pass the path of the cycle's just-archived directive; when supplied, `last_verified_handoff` is set to that immutable archive path instead of the live, soon-to-be-overwritten `worker-directive.md`. When omitted, the script falls back to the old behavior exactly, so any existing caller that hasn't adopted the new archive-then-advance order keeps working unchanged.

Both parameters are optional with backward-compatible defaults — this was a deliberate design choice to avoid breaking anything already depending on the script's existing zero-argument invocation.

### Files Changed

* Updated: `scripts/advance-cockpit-state.ps1` (added `-ArchivedDirectivePath` and `-FinalNextAction` parameters; changed `PASS`-verdict `next_action` resolution logic; changed `last_verified_handoff` resolution logic)
* Updated: `docs/VERIFICATION_RESULT_SPEC.md` (the `next_action` field definition now explains the PASS-verdict durable-statement requirement and the non-PASS exception)
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a new "Recommended Close-Out Order" section spelling out archive-then-advance-then-health-check-then-log-then-commit, with the exact `-ArchivedDirectivePath` invocation)
* Updated: `docs/STATE_MODEL.md` (the existing "State advancement is a local deterministic step" paragraph now documents both new parameters and cross-references the close-out order section)

### Commands / Tests Run

All testing was performed against a disposable scratch copy of `.cockpit` + `scripts` under the OS temp directory (with a synthetic `pcc-v1-test-999` task), never the live repo, since this task modifies a script that writes canonical state and a mistaken live-repo test could corrupt real task/project state.

1. **Full corrected cycle test**: created a synthetic PASS verification result whose `next_action` was deliberately written as a verifier checklist (to prove it would NOT leak through), archived the directive first (`cp` to `archive/`), then ran `advance-cockpit-state.ps1 -ArchivedDirectivePath "<the archived path>"` with no `-FinalNextAction` (to test the new default).
2. **Backward-compatibility test**: a synthetic `FAIL` verdict, script invoked with zero parameters (old-style call), to confirm non-PASS behavior is byte-for-byte unchanged from before this task.
3. **`-FinalNextAction` override test**: a second synthetic `PASS` verdict, script invoked with an explicit `-FinalNextAction` string, to confirm the override takes precedence over the new default.
4. **No-archive-path fallback test**: a third synthetic `PASS` verdict, script invoked with zero parameters, to confirm `last_verified_handoff` falls back to the old live-path behavior when the new parameter isn't supplied (so a caller that hasn't adopted the new order doesn't break).
5. `powershell -ExecutionPolicy Bypass -File scripts/validate-cockpit-state.ps1` after each scratch-copy run, to confirm no state drift was introduced.
6. `git status --porcelain` before and after all work, to confirm only the intended files were modified and scratch-copy testing never touched the live repo.
7. Deleted the temporary scratch directory (`/tmp/pcc-wrapup-test`) after testing.

### Results

1. Exit code `0`. `task-state.json`'s `next_action` read exactly: `Task 'pcc-v1-test-999' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.` — the deliberately-planted checklist text from the synthetic verification result did **not** leak through. `project-state.json`'s `last_verified_handoff` read exactly `.cockpit/handoff/archive/pcc-v1-test-999-worker-directive.md` — the archived path, not the live one. Both `next_action` and `next_expected_action` matched.
2. Exit code `0`. `task_status` became `verified_fail` and `next_action` read exactly `Retry with a tighter directive.` (the synthetic verification result's literal `next_action` text) — confirming FAIL-path behavior is unchanged.
3. Exit code `0`. `next_action` read exactly the supplied override string, confirming `-FinalNextAction` takes precedence over the new default.
4. Exit code `0`. `last_verified_handoff` read `.cockpit/handoff/worker-directive.md` (the live path) — confirming the fallback preserves the prior behavior when no archive path is given.
5. `PCC state validation OK` after every run; no drift introduced by any of the four scenarios.
6. `git status --porcelain` showed only the files listed under Files Changed as modified, plus the advisor-side draft files for `pcc-v1-014` itself; no scratch-copy artifacts appeared in the live repo's status.
7. Scratch directory removed; confirmed no residue.

### Evidence

Mapping to the directive's completion criteria:

* **advance-cockpit-state.ps1 accepts an explicit archived-directive-path input and uses it for last_verified_handoff when supplied, falling back otherwise** — confirmed by Results 1 and 4.
* **docs/VERIFICATION_RESULT_SPEC.md's next_action definition updated for PASS vs. non-PASS** — see the updated `### next_action` section.
* **Documented close-out order updated to archive before advance, passing the archive path in** — see the new "Recommended Close-Out Order" section in `docs/HANDOFF_PACKET_SPEC.md`.
* **Demonstration shows a full cycle leaves last_verified_handoff and next_action correct with no manual correction** — Result 1 shows exactly this: the archived path and the durable next_action were both correct immediately after the single `advance-cockpit-state.ps1` invocation, with no follow-up hand-edit required (unlike `pcc-v1-011`/`pcc-v1-012`, which both needed manual correction after the fact).
* **Change stays in V1 scope, remains local deterministic, no broad orchestration** — pure PowerShell parameter/logic changes; no new dependencies, no automation added (the caller still must remember to run the close-out steps in order — this task fixes correctness of the values written, not the reminder problem, consistent with forbidden scope).
* **Claude returns evidence in worker-result.md** — this document.

### Known Risks

* This fix does not make archive-then-advance-then-log automatic — a verifier could still run `advance-cockpit-state.ps1` without `-ArchivedDirectivePath` (e.g. by forgetting, or by not having archived yet), silently falling back to the old, still-slightly-wrong live-path behavior. The fallback exists for backward compatibility, not because the old behavior is still considered correct; nothing currently warns when the fallback path is taken.
* The new default `next_action` for PASS is a fixed, generic template. If a verifier genuinely needs richer PASS-time context recorded (e.g. "next task should account for X"), they must remember to pass `-FinalNextAction` explicitly — the default alone would silently omit it. This trades "always accurate" for "sometimes less detailed," which was a deliberate choice given the directive's completion criteria, but it is a real trade-off.
* `docs/HANDOFF_PACKET_SPEC.md`'s new "Recommended Close-Out Order" section is prose guidance, not enforced by any script — a future cycle could still archive after advancing (the old order) and simply not pass `-ArchivedDirectivePath`, silently reverting to the fallback rather than failing loudly.

### Unresolved Assumptions

* Assumed a fixed, parameterizable default string (rather than, say, reading a template from canonical state) is the right level of engineering for the PASS-verdict `next_action` default — matches the project's existing preference for small, explicit, hardcoded logic over configurable templating machinery at this stage of V1.
* Assumed `-ArchivedDirectivePath` and `-FinalNextAction` should be independent, orthogonal parameters (either, neither, or both may be supplied) rather than requiring them together, since a verifier might reasonably want to fix only one of the two root causes on a given cycle (e.g. supply the archive path but keep the default next_action wording).
* Assumed leaving the "someone has to remember to run close-out in the right order" problem out of scope is correct, per the directive's explicit forbidden-scope item against introducing broad orchestration/automation — this task fixes what happens when the steps are run in the new order, not whether they get run.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no orchestration or automation was introduced (the close-out sequence remains a documented, manually-invoked set of steps, same as before), and no verification verdict values were changed (`PASS`/`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE` remain exactly the five existing values — only how `next_action`/`last_verified_handoff` are derived from a verdict changed). No existing archived file or `routing-log.jsonl` line was rewritten, reordered, or deleted; this task changes script behavior going forward only. Docs were updated only in the three files explicitly listed in allowed scope (`docs/VERIFICATION_RESULT_SPEC.md`, `docs/HANDOFF_PACKET_SPEC.md`, `docs/STATE_MODEL.md`) — `docs/DECISIONS.md` (where `DECISION-020` itself lives) was deliberately left untouched, since it was not in allowed scope for this task. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and the two prior cycles' own diagnosis of the bug). All testing was performed against a disposable scratch copy with synthetic data, never the live repo, and the scratch directory was deleted after use.
