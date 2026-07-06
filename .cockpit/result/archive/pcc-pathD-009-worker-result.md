# Worker Result

* Task ID: pcc-pathD-009
* Task Title: Tone/Behavior Controls (communication_prefs, First Request-Driven State Mutation)
* Task Safety Class: B
* Worker: Claude Code
* Handback: for verification via ChatGPT manual bridge (owner's stated session preference: pause before each verification), not self-closed. Class B is also not self-acceptable regardless of owner preference.

### Summary

Delivered the last named Phase D3 task: `scripts/request-communication-prefs-update.ps1` (producer) and `scripts/process-communication-prefs-requests.ps1` (consumer), plus one new display-only command-example line in the dashboard's Handoff/Rollover panel. **This is the first request-file consumer that mutates canonical `.cockpit/state/project-state.json`** -- every prior request-driven script only produced ephemeral inbox artifacts or ran a read-only check.

The consumer validates the full proposed `project-state.json` object against `schemas/project-state.schema.json` **before** writing anything to disk, per `DECISION-015`. An invalid request never touches the file at all -- confirmed by file hash before/after in testing.

### Files Changed

1. `scripts/request-communication-prefs-update.ps1` (new) -- producer.
2. `scripts/process-communication-prefs-requests.ps1` (new) -- consumer, with pre-write schema validation and a rollback safety net around the post-write cross-check.
3. `scripts/generate-dashboard.ps1` -- added one display-only line to the Handoff/Rollover panel.
4. `docs/DECISIONS.md` -- added `DECISION-100`.
5. `docs/PATH_A_PLAN.md` -- marked `pcc-pathD-009` delivered (pending verification); noted Phase D3's currently-named scope is complete.
6. `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` -- drafted/advanced for this task; `communication_prefs.chattiness` was changed and then reverted back to its original value through the same real pathway during testing (see below).
7. `.cockpit/state/handoff-gate.json` -- PASS gate record for `pcc-pathD-009`.
8. `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` -- regenerated.
9. `.cockpit/request/processed/`, `.cockpit/request/rejected/` -- new directories, each containing real artifacts from this task's own functional testing, left in place as honest evidence (consistent with `pcc-pathD-008`'s precedent).
10. `dashboard/index.html` -- regenerated (gitignored, generated artifact).

**No existing script other than `scripts/generate-dashboard.ps1` (one added line) was modified. No schema was modified.**

### Commands / Tests Run

* Set `task_status` to `ready_for_worker`; ran `scripts/enforce-handoff-restart-safety.ps1` **before any code change** -- passed cleanly, genuine pre-task backup `20260705-200745` (51 files) created before work began. This backup is the safety net for the real `project-state.json` testing below.
* Set `task_status` to `in_progress`; built both new scripts and the dashboard addition.
* **Before testing:** captured `communication_prefs`'s real values: `tone: direct, language_level: plain, chattiness: concise, no_cheerleading: true, concise_by_default: true, explicit_uncertainty: true, separate_facts_from_inference: true`.
* Test 1 (valid update): `request-communication-prefs-update.ps1 -Chattiness balanced` -> `process-communication-prefs-requests.ps1` -- applied correctly, `validate-cockpit-state.ps1` passed, request moved to `processed/`. Confirmed the actual file now shows `chattiness: balanced`, all other fields unchanged.
* Test 2 (invalid enum): `-Tone aggressive` -- hashed `project-state.json` before submitting (`2b8c03028aca37bc4f2cf57fb4e8c8b8`), ran the consumer, confirmed it printed a clear rejection naming the exact failing schema path (`/communication_prefs/tone`), moved the request to `rejected/`, and confirmed the file hash was **identical** after -- zero mutation from a rejected request.
* Test 3 (unrecognized field): hand-placed a request with `payload.fields.not_a_real_field` -- confirmed rejection with a clear "Unrecognized communication_prefs field name(s)" message, confirmed file hash unchanged again.
* Test 4 (empty inbox): ran the consumer with no pending requests -- clean no-op, exit 0.
* **Reverted the test change**: submitted a second valid request, `-Chattiness concise`, processed it through the same real pathway, confirming `chattiness` is back to its original value and `validate-cockpit-state.ps1` still passes -- `communication_prefs` is exactly as it was before testing began.
* `pwsh -File scripts/generate-dashboard.ps1` -- confirmed the new command-example line renders correctly.
* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, `scripts/doctor.ps1` -- all clean or expected (see Results).

### Results

* All four test scenarios behaved exactly as specified; the pre-write schema check correctly prevented any invalid write, confirmed by byte-identical file hashes in both rejection cases.
* `communication_prefs` was confirmed restored to its exact pre-test state after the full test sequence.
* `doctor.ps1`: one `[ISSUE]` (transient advisor-brief staleness from active mid-edit -- normal, resolved by the handback finalize step) and the same disclosed `[WARN]` on the `.cockpit/request/` directory first flagged in `pcc-pathD-007` (unchanged) -- both expected, neither a real defect.

### Evidence

* `scripts/process-communication-prefs-requests.ps1` builds the full proposed `project-state.json` object in memory and validates it against `schemas/project-state.schema.json` via `Test-Json` **before** any `Set-Content` call. Only on a passing validation does it write.
* A rollback safety net exists around the post-write `validate-cockpit-state.ps1` cross-check: if that surprising case ever failed, the script restores the pre-write file content immediately and exits non-zero, rather than leaving unchecked state on disk. This was not triggered in testing (the pre-write schema check was always sufficient), but the code path exists per `DECISION-015`'s discipline of checking before treating an update as complete.
* Only `communication_prefs` and `updated_at` are ever written by this pathway -- confirmed by inspecting the full diff of `project-state.json` across all test runs; no other field changed.

### Known Risks

* This is the first canonical-state-mutating request pathway; its correctness depends entirely on the pre-write schema validation catching every invalid case. The schema itself (closed enums for `tone`/`language_level`/`chattiness`, booleans for the rest) makes this a strong check, but any future addition of a new `communication_prefs` field would need the schema updated first for this pathway to accept it -- an intentional coupling, not an oversight.
* The command-to-copy design (same as `pcc-pathD-008`) means the owner must run the producer and consumer manually from a terminal; there is no automatic detection/processing of pending requests yet.
* `scripts/process-communication-prefs-requests.ps1` is not wired into `scripts/watch-dashboard.ps1`; doing so would need the same side-effect analysis performed in `pcc-pathD-006` (though this consumer's only side effect, when successful, is the intended canonical-state write, not a surprising log write).

### Unresolved Assumptions

* That validating the full proposed `project-state.json` object (not just the `communication_prefs` sub-object) against the schema is the right level of rigor -- judged correct since the schema's `additionalProperties: false` and cross-field requirements are defined at the whole-object level, and partial validation could miss an issue.
* That Task Safety Class B remains correct for this task (same precedent as `pcc-pathD-007`/`008`, and arguably the most consequential of the three given it is the first to mutate canonical state).

### Out-of-Scope Confirmation

Confirmed: no direct UI edit path for `communication_prefs` was created (the dashboard only displays an example command); no existing script other than `scripts/generate-dashboard.ps1`'s one added line was modified; no schema was modified; invalid input never touched `project-state.json` on disk (confirmed by hash in two separate rejection tests); only `communication_prefs` and `updated_at` were ever changed by this pathway; no new log event type was added; no verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule was changed; `codex exec` was not invoked and no verification verdict was self-issued; the mandatory pre-task handoff/backup gate was run correctly before work began.
