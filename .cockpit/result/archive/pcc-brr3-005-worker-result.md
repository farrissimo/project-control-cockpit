# Worker Result

### Summary

Added `scripts/return-inadequate-work.ps1`, the non-`PASS` mirror of `scripts/close-out-verified-task.ps1`, fielding the asymmetry `pcc-brr3-004`/`DECISION-049` named as recommended future work. It was functionally tested against a synthetic `FAIL` cycle plus three refusal cases in an isolated scratch copy of the repo (never against live state), then deleted. `docs/HANDOFF_PACKET_SPEC.md` and `docs/REPO_GOVERNANCE.md` now name the new script. Per `DECISION-051`'s Post-Close Canonical Amendment Rule, added a clearly-marked "Later update" pointer to `pcc-brr3-004`'s existing section, without rewriting its original (accurate-at-the-time) claim. Recorded `DECISION-052`. Owner-directed; `promotion_basis` is null.

### Files Changed

* Created: `scripts/return-inadequate-work.ps1`.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — "Recommended Close-Out Order" now names the new script for the non-PASS path.
* Updated: `docs/REPO_GOVERNANCE.md` — Task Process step 12 now names the new script.
* Updated: `docs/BRR_POLICY.md` — added a "Later update" pointer block inside the existing "Inadequate-Work Return Path" section (pointer only, original claim untouched).
* Updated: `docs/DECISIONS.md` — added `DECISION-052`.
* Updated: `.cockpit/state/task-state.json` — task drafted and fielded, `promotion_basis` null (owner-directed).
* Updated: `.cockpit/state/project-state.json` — `current_task_id` updated to `pcc-brr3-005`.

### Commands / Tests Run

* `pwsh -File scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, `scripts/generate-worker-directive.ps1` — before drafting.
* Created an isolated scratch copy (`.cockpit/`, `scripts/`, `schemas/` only) under the session scratchpad directory, outside the live repo.
* In the scratch copy: wrote a synthetic `verification-result.json` with `verdict: "FAIL"` matching the live `task-state.json`'s `task_id`, then ran `pwsh -File scripts/return-inadequate-work.ps1` — confirmed all four steps (archive, advance state, doctor health check, event log) completed correctly and `task_status` became `verified_fail`.
* Re-ran the script immediately against the same (now-archived) cycle — confirmed it refused with the expected "archive path already exists" error, exit code 1.
* Reset archives, set the synthetic verdict to `PASS`, re-ran — confirmed it refused with "verdict is PASS, use close-out-verified-task.ps1 instead," exit code 1.
* Set the synthetic `verification-result.json`'s `task_id` to a deliberate mismatch, re-ran — confirmed it refused with the expected task_id-mismatch error, exit code 1.
* Deleted the entire scratch copy afterward; confirmed via `git status --short` in the real repo that no test artifacts leaked into live state.

### Results

* All four functional tests (one happy path, three refusals) passed as designed.
* State validation and schema validation: OK / PASS throughout.
* Real repo `git status` after cleanup showed only this cycle's own expected changes — no scratch-test contamination.

### Evidence

* `scripts/return-inadequate-work.ps1`: mirrors `close-out-verified-task.ps1`'s exact four-step order and safety refusals; calls the existing, unmodified `advance-cockpit-state.ps1` and `log-event.ps1` rather than reimplementing verdict-mapping logic; `-Commit` mirrors the PASS-side script exactly and never pushes.
* Scratch-test transcript (captured in this cycle's tool output): synthetic FAIL cycle archived correctly, `task_status` → `verified_fail`, doctor clean, log entry `verified_fail` appended; three refusal cases each exited 1 with the correct, specific error message.
* `docs/BRR_POLICY.md`'s new "Later update" block: names `pcc-brr3-005`/`DECISION-052` explicitly, states it does not rewrite `pcc-brr3-004`'s original claim, and points to the real script location — applying `DECISION-051`'s rule for the first time since it was written.
* `docs/DECISIONS.md` `DECISION-052`: records the script, the test methodology, the doc updates, and the amendment-rule application, plus the owner's single pre-approval covering both this task and the separate Phase 4 transition work.

### Known Risks

* This task touches `scripts/` (a truth surface per `pcc-brr3-003`'s Out-of-Scope Detection policy) and is Class B; self-verified under the `DECISION-033`/`DECISION-036` fallback, requiring `strict` depth per the Verification Depth Policy. No independent second-party review occurred.
* The new script was tested against one non-PASS verdict (FAIL) directly; INSUFFICIENT/BLOCKED/OUT_OF_SCOPE were not separately exercised, though the code path for all four is identical (a single verdict-to-status hashtable lookup in the unmodified `advance-cockpit-state.ps1`, and a single verdict-to-event-type hashtable lookup in the unmodified `log-event.ps1`) — the FAIL test exercises that shared logic, but a reviewer might reasonably want the other three verdicts spot-checked too.
* The new script is not wired into any automatic call site, by design — but nothing currently prevents a future task from accidentally wiring it in as an automatic gate; that remains a manual-discipline property, same as `close-out-verified-task.ps1`.
* This is the second time `DECISION-051`'s Post-Close Canonical Amendment Rule has been applied (first time was its own writing); its practical workability is still only lightly tested.

### Unresolved Assumptions

* Assumed testing one representative non-PASS verdict (FAIL) plus three refusal paths was sufficient evidence, given the other three verdicts route through the identical shared hashtable-lookup logic in scripts this task did not modify — did not additionally test INSUFFICIENT/BLOCKED/OUT_OF_SCOPE individually.
* Assumed the isolated-scratch-copy testing method (copy `.cockpit/`, `scripts/`, `schemas/` to a temp directory, run there, delete afterward) is an acceptable way to satisfy "functionally tested, not just read through" without ever risking live state — chose this over, e.g., a git worktree, for simplicity.
* This cycle is self-verified under the `DECISION-033`/`DECISION-036` fallback, same disclosure as all prior autonomy cycles.

### Out-of-Scope Confirmation

Confirmed: no existing script's behavior was altered (`close-out-verified-task.ps1`, `advance-cockpit-state.ps1`, `log-event.ps1`, `doctor.ps1` are all unmodified). The new script is not called automatically by any other script. No schema was modified. `pcc-brr3-004`'s original claim in `docs/BRR_POLICY.md` was not rewritten, only pointed at from a clearly-marked later addendum. The self-verification fallback, autonomous gate logic, Acceptance Boundary Rules, and Task Safety Classification's core meanings were not touched. BRR Phase 3 completion (already recorded, `DECISION-050`) was not re-touched and `current_phase` was not advanced.
