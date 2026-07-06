# Worker Result

* Task ID: pcc-pathD-007
* Task Title: Request-File Inbox Contract + Schema (Phase D3 Foundation)
* Task Safety Class: B
* Worker: Claude Code
* Handback: for verification via ChatGPT manual bridge (owner's stated session preference: pause before each verification), not self-closed. Class B is also not self-acceptable per the Acceptance Boundary Rules regardless of owner preference.

### Summary

Delivered the request-file inbox contract per `docs/PATH_A_PLAN.md` §6 Phase D3, following the owner's explicit authorization (`DECISION-097`): `schemas/request.schema.json`, the `.cockpit/request/` directory, and a canonical lifecycle description in `docs/STATE_MODEL.md`. This is contract-only -- no dashboard control writes a request file yet, and no consumer script acts on one yet; those are `pcc-pathD-008`/`009`.

### Files Changed

1. `schemas/request.schema.json` (new).
2. `.cockpit/request/.gitkeep` (new, tracking placeholder for the empty inbox directory).
3. `docs/STATE_MODEL.md` -- added a "Request-File Inbox (Category D Phase D3)" section documenting the lifecycle.
4. `docs/DECISIONS.md` -- added `DECISION-098`.
5. `docs/PATH_A_PLAN.md` -- marked `pcc-pathD-007` delivered (pending verification).
6. `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` -- drafted/advanced for this task.
7. `.cockpit/state/handoff-gate.json` -- PASS gate record for `pcc-pathD-007`.
8. `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` -- regenerated.

**No existing script or existing schema was modified. No dashboard script (`scripts/generate-dashboard.ps1`, `scripts/watch-dashboard.ps1`) was touched.**

### Commands / Tests Run

* Set `task_status` to `ready_for_worker`; ran `scripts/enforce-handoff-restart-safety.ps1` **before any code change** -- passed cleanly, genuine pre-task backup `20260705-193433` (48 files) created before work began.
* Set `task_status` to `in_progress`; created the schema, directory, and documentation.
* Two synthetic example request files (one per named `request_type`: `rollover`, `communication_prefs_update`) written to an isolated scratch directory outside the repo; validated via PowerShell's `Test-Json` against `schemas/request.schema.json` -- both valid.
* A third synthetic example using an unrecognized `request_type` ("not_a_real_type") -- confirmed correctly rejected by the schema's enum constraint, with a clear error naming the exact failing property.
* Confirmed via `git status --short .cockpit/` that only this task's own legitimate additions/bookkeeping are present -- no real file was written into `.cockpit/request/` beyond the tracking placeholder.
* `scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1` -- both clean; `check-schemas.ps1` was not modified and does not yet validate request files (explicitly deferred, not silently skipped).
* `scripts/doctor.ps1` -- see Results.

### Results

* Both synthetic examples validated successfully; the invalid example was correctly rejected with a specific, actionable error message.
* `doctor.ps1`: one `[ISSUE]` (transient advisor-brief staleness from active mid-edit -- normal, resolved by the handback finalize step, not a real defect) and one new `[WARN]` (the new `.cockpit/request/` directory flagged as an "unexpected but not necessarily a problem" top-level entry, since `doctor.ps1`'s `expectedSubdirs` list predates this task and was not modified per this task's own scope boundary) -- both expected and disclosed, neither a real defect.

### Evidence

* `schemas/request.schema.json` follows the same JSON Schema conventions as the other `schemas/*.schema.json` files (draft/2020-12, `$id`, `additionalProperties: false`, explicit `required`).
* The `request_type` enum is closed (`rollover`, `communication_prefs_update` only) rather than an open string, so the contract stays checkable as new types are added later -- each addition requires its own schema update, not silent drift.
* `docs/STATE_MODEL.md`'s new section states plainly what this task defines (schema + directory + lifecycle) versus what it defers (the actual producer and consumer scripts).

### Known Risks

* The `payload` field is deliberately left as a generic `object` in the schema (no further constraint), since its shape is type-specific and belongs to whichever task builds the first real producer/consumer for each `request_type`. This is a real looseness in the current contract, not an oversight -- tightening it further now would mean guessing at fields no consumer yet needs.
* `doctor.ps1`'s file-structure check will keep flagging `.cockpit/request/` as an "unexpected" entry (a `[WARN]`, not an `[ISSUE]`) until/unless a future task adds it to that script's `expectedSubdirs` list -- disclosed, not fixed here, since modifying `doctor.ps1` was outside this task's boundaries.

### Unresolved Assumptions

* That defining the contract now, well ahead of its first producer/consumer, is the right sequencing -- matches the plan's own explicit task breakdown (`pcc-pathD-007` before `008`/`009`).
* That Task Safety Class B is correct for this task (new schema/contract-defining work, judged more consequential than the read-only Category D panels, which were Class A).

### Out-of-Scope Confirmation

Confirmed: no existing script was modified; no existing schema was modified; no dashboard script was touched; no consumer/watcher script was created; no real file was written into `.cockpit/request/` other than the tracking placeholder; no new log event type was added; no verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule was changed; `pcc-pathD-008`/`009`'s actual controls were not built; `codex exec` was not invoked and no verification verdict was self-issued; the mandatory pre-task handoff/backup gate was run correctly before work began.
