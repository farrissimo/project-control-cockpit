# Worker Result

### Summary

Completed task `pcc-v1-015` by adding `scripts/check-schemas.ps1` (a light, non-blocking JSON-schema format check for the three canonical runtime JSON files) and wiring it into `scripts/doctor.ps1` as one additional advisory finding. This implements `backlog/IDEAS.md` IDEA-003 ("Honesty Checks: Format Check"), the last open V1 backlog item.

Before writing any code, the owner asked me to confirm this could genuinely be done lightly rather than assuming it — a prior session had already flagged that Windows PowerShell 5.1 (which several PCC scripts, including `doctor.ps1`, are invoked under) has no `Test-Json` cmdlet at all, and that .NET's JSON Schema support has historically had gaps with exactly the features our schemas use. I ran a spike before drafting this task: confirmed `pwsh` 7.5.5's `Test-Json` correctly validates our real schemas (`additionalProperties: false`, enum values, nullable `["string", "null"]` unions, and `verification-result.schema.json`'s `if/then` conditional requiring `state_update_allowed` to agree with `verdict`) against both valid and deliberately-broken sample files, before committing to this approach.

`scripts/check-schemas.ps1` validates `project-state.json`, `task-state.json`, and `verification-result.json` against their `schemas/*.schema.json` files, printing one `[PASS]`/`[FAIL]` line per file. It requires `pwsh` (same constraint as `Test-Json` itself), so `doctor.ps1` invokes it the same way it already invokes its other two composed checks — as a `pwsh` subprocess, translating the result into one `OK`/`ISSUE` finding rather than three separate ones, per the directive's completion criteria. Neither script gates or blocks anything: `check-schemas.ps1`'s own exit code is informational (for `doctor.ps1` to read), and `doctor.ps1` continues to always exit `0` regardless of what it finds, exactly as it already did for its other checks.

While testing, this check demonstrably caught something `validate-cockpit-state.ps1` (the existing consistency check) does not: an invalid `task_status` enum value. `validate-cockpit-state.ps1` only checks agreement *between* files (e.g. matching `task_id`s, matching verdicts) — it has no concept of what values a field is allowed to hold *within* one file. This is a concrete demonstration of the new check adding real coverage, not duplicating existing coverage.

### Files Changed

* Created: `scripts/check-schemas.ps1`
* Updated: `scripts/doctor.ps1` (added a third composed check, "Format check (schemas)", between the existing restart-safety check and the handoff-gate check; renumbered the trailing comment for the active-task check accordingly)
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a paragraph describing `check-schemas.ps1`, and updated the existing `doctor.ps1` paragraph to list it among the composed checks)

### Commands / Tests Run

Schema-violation testing was performed against a disposable scratch copy of `.cockpit` + `scripts` + `schemas` under the OS temp directory, never the live repo, since deliberately corrupting `task-state.json` to test the failure path could otherwise damage real canonical state.

1. **Spike (pre-task, informs but predates the directive):** copied the four `schemas/*.schema.json` files and the three live canonical JSON files to a scratch directory; ran `Test-Json` against the valid files (all three passed), then against four deliberately-broken variants (bad enum, disallowed extra property, missing required field, and a `PASS` verdict paired with `state_update_allowed: false` to test `verification-result.schema.json`'s `if/then` block) to confirm each was correctly rejected, and a `null` value for a `["string","null"]`-typed field to confirm it was correctly accepted.
2. **Standalone script test (live repo, read-only):** `pwsh -NoProfile -File scripts/check-schemas.ps1` — confirmed all three live files pass.
3. **`doctor.ps1` integration test (live repo, read-only):** `powershell -ExecutionPolicy Bypass -File scripts/doctor.ps1` — confirmed the new "Format check (schemas)" finding appears as `[OK]` and the overall finding count/summary is still correct.
4. **`doctor.ps1` failure-path test (scratch copy):** set `task-state.json`'s `task_status` to an invalid enum value, ran `doctor.ps1` — confirmed `[ISSUE]` with the underlying `Test-Json` error message, and confirmed `validate-cockpit-state.ps1`'s own check did *not* flag this (demonstrating the new check's added coverage), with `doctor.ps1` still exiting `0`.
5. **`additionalProperties` failure test (scratch copy):** added an unexpected field to `task-state.json`, ran `check-schemas.ps1` directly — confirmed `[FAIL]` with a clear reason (`All values fail against the false schema at '/unexpected_field'`), exit code `1` (informational, not propagated as a block by anything).
6. `git status --porcelain` before and after all work, to confirm only the intended files were created/modified and scratch-copy testing never touched the live repo.
7. Deleted the temporary scratch directories after each round of testing.

### Results

1. All three valid files: `True`. All four broken variants: `False`, each with a specific, correct `Test-Json` error message identifying the exact schema violation. The nullable-union `null` value: `True` (correctly accepted).
2. Exit code `0`. Output: three `[PASS]` lines, one per file.
3. Exit code `0`. Output included `[OK] Format check (schemas): project-state.json, task-state.json, and verification-result.json all match their schemas.` alongside the pre-existing four findings (now five total), with the summary line's issue/warning counts still correct.
4. Exit code `0` (never non-zero, by design). Output included `[ISSUE] Format check (schemas): ... The JSON is not valid with the schema: Value should match one of the values specified by the enum at '/task_status'`. `[OK] State consistency: PCC state validation OK` on the same run confirmed `validate-cockpit-state.ps1` did not catch this — the two checks are genuinely complementary, not redundant.
5. Exit code `1` from `check-schemas.ps1` directly (informational, this script's own signal for its caller), with output `[FAIL] .cockpit/state/task-state.json: The JSON is not valid with the schema: All values fail against the false schema at '/unexpected_field'.`
6. `git status --porcelain` showed only the files listed under Files Changed as new/modified beyond the advisor-side draft files for `pcc-v1-015`; no scratch-copy artifacts appeared in the live repo's status.
7. Both scratch directories removed; confirmed no residue.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic script validates the three canonical files against their schemas, reporting pass/fail with a human-readable reason** — `scripts/check-schemas.ps1`, confirmed via Results 1, 2, 4, 5.
* **doctor.ps1 composes this as one additional advisory finding (OK/ISSUE), continuing to always exit 0** — confirmed via Results 3 and 4.
* **The schema-check script never gates, blocks, or fails any other script/cycle** — confirmed by design (no other script calls it except `doctor.ps1`, which treats its exit code purely informationally) and empirically (Result 4's `doctor.ps1` still exits `0` despite a real schema violation).
* **The check correctly passes on live files and correctly fails on deliberate violations (missing required field, invalid enum, disallowed additional property)** — confirmed via Results 1, 4, and 5 (enum and additional-property cases tested live against `doctor.ps1`/`check-schemas.ps1`; missing-required-field tested in the pre-task spike using the same `Test-Json` mechanism this script relies on).
* **Stays in V1 scope, remains local deterministic, no broad orchestration/automation, no hard gate** — pure PowerShell, no dependencies beyond the built-in `Test-Json` cmdlet already present in `pwsh`, no network access, and (per above) structurally non-blocking.
* **Claude returns evidence in worker-result.md** — this document.

### Known Risks

* `check-schemas.ps1` (and therefore this leg of `doctor.ps1`'s report) requires `pwsh` to be installed. If it is missing, `doctor.ps1`'s `try/catch` around the subprocess call reports a generic "could not run" `ISSUE` rather than real schema status — the same inherited-dependency risk already accepted for `validate-cockpit-state.ps1` and `verify-dual-restart-safety.ps1`, not something new.
* `Test-Json`'s error messages are useful but somewhat implementation-specific (JSON Pointer paths like `/task_status` rather than plain English). This is legible to someone reading `doctor.ps1`'s output with the schema open, but not as immediately readable as the rest of doctor's prose-style findings.
* `handoff-packet.schema.json` exists under `schemas/` but was deliberately **not** included in this check, because there is no corresponding live JSON runtime file to validate against it (the handoff packet is a markdown file, `worker-directive.md`, not JSON). If a JSON-based handoff artifact is ever introduced, this schema would need to be wired in separately.

### Unresolved Assumptions

* Assumed folding all three file checks into a single `OK`/`ISSUE` finding (rather than three separate `doctor.ps1` findings) is correct, since the directive's completion criteria explicitly says "one additional advisory finding" (singular) — `check-schemas.ps1`'s own multi-line, per-file output is still fully visible in the `ISSUE` detail text when something fails, so no information is lost by consolidating the pass/fail judgment.
* Assumed classifying a genuine schema violation as `ISSUE` (not `WARN`) is the right severity, consistent with how `doctor.ps1` already treats `State consistency` failures as `ISSUE` — a schema violation represents actual structural corruption of a canonical file, not merely an advisory heads-up, even though `doctor.ps1` itself never blocks on either severity level.
* Assumed `handoff-packet.schema.json` is out of scope for this task (see Known Risks) rather than something to force a check against, since there is no live JSON file it could meaningfully validate today.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added (only the pre-existing built-in `Test-Json` cmdlet is used), no orchestration or automation was introduced, and no canonical project goals or verification verdicts were changed. The schema check was not made a hard gate or blocking step — `check-schemas.ps1`'s exit code is read only by `doctor.ps1`, which itself still always exits `0`; nothing else calls either script. `schemas/*.schema.json` files themselves were not modified — only validation logic against the existing definitions was added, per the directive's explicit forbidden-scope item. Docs were updated only in `docs/HANDOFF_PACKET_SPEC.md`, within allowed scope. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and the pre-task spike results). All schema-violation testing was performed against disposable scratch copies, never the live repo, and both scratch directories were deleted after use.
