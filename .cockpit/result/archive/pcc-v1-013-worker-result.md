# Worker Result

### Summary

Completed task `pcc-v1-013` by creating `scripts/log-event.ps1`, a local deterministic helper that appends one structured, factual JSON line per meaningful cycle event to `.cockpit/logs/routing-log.jsonl`. This implements `backlog/IDEAS.md` IDEA-008 ("Honesty Checks: Activity Log", rank #4 in the 2026-07-03 owner review), and was motivated directly by a real failure observed earlier in this same session: `routing-log.jsonl` had gone stale (missing entries for `pcc-v1-011`'s PASS and all of `pcc-v1-012`) because every prior entry was hand-typed free-form JSON by whoever was acting as advisor/verifier, with nothing enforcing that it actually happened each cycle. This task doesn't fix the "someone has to remember to run it" problem (that would be new automation, out of scope per the directive's forbidden list), but it does fix the "hand-typing JSON drifts and is error-prone" problem.

The script supports two modes: an explicit mode (`-EventType`, `-TaskId`, `-Detail`, where `EventType` is validated against a small fixed set — `next_task_drafted`, `verified_pass`, `verified_fail`, `verified_insufficient`, `verified_blocked`, `verified_out_of_scope`, `correction_applied` — via PowerShell's `ValidateSet`, so an invalid type is rejected before anything is written), and a derived mode (`-FromVerificationResult`) that reads `.cockpit/result/verification-result.json` and maps its `verdict` onto the matching `event_type`, pulling `task_id` and `summary` (as `detail`) directly from canonical evidence rather than requiring anyone to retype it. It is structurally, not just conventionally, append-only: the only file-write call in the script is `Add-Content`, which appends to a file without reading or rewriting existing lines — there is no code path that could alter prior history even by mistake.

New log lines use a cleaner schema (`timestamp`, `task_id`, `event_type`, `detail`) than the pre-existing hand-typed lines (`timestamp`, `task_id`, `route`, `reason`, `result`). Consistent with the naming-convention precedent from earlier this session (identifiers and past records are not retroactively rewritten), old lines were left exactly as they are; the file now contains two line shapes over time, both individually valid JSON, disclosed below rather than silently mixed.

### Files Changed

* Created: `scripts/log-event.ps1`
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a paragraph describing `log-event.ps1`, after the existing `safe-stop.ps1` description)

Advisor-side files changed while drafting this task (same session, dual-role per DECISION-019, listed for completeness — not part of the worker's bounded scope): `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` (advanced to `pcc-v1-013`), `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` (regenerated from state). `.cockpit/logs/routing-log.jsonl` was also backfilled by the advisor, by hand, with the specific missing entries discovered before this task was drafted (`pcc-v1-011` PASS, `pcc-v1-012` draft/PASS, the `pcc-v1-012` close-out correction, and this task's own draft entry) — this predates and motivated the worker task, and is not itself part of the bounded worker deliverable.

### Commands / Tests Run

All destructive/failure-mode testing was done against a disposable scratch copy of `.cockpit` + `scripts` under the OS temp directory, never the live repo.

1. **Manual mode:** `powershell -ExecutionPolicy Bypass -File scripts/log-event.ps1 -EventType next_task_drafted -TaskId "pcc-v1-test" -Detail "manual mode test entry"` (scratch copy).
2. **Derived mode:** `powershell -ExecutionPolicy Bypass -File scripts/log-event.ps1 -FromVerificationResult` (scratch copy, using the scratch copy's `verification-result.json`, which at the time was `pcc-v1-012`'s PASS record).
3. **Invalid `EventType` guard:** `powershell -ExecutionPolicy Bypass -File scripts/log-event.ps1 -EventType "made_up_type" -TaskId "x" -Detail "y"` (scratch copy) — first attempt's exit code check was accidentally masked by a shell pipe (`$?` reflected `tail`, not `powershell`); re-ran without the pipe to get the real exit code.
4. **Missing `TaskId` guard:** `powershell -ExecutionPolicy Bypass -File scripts/log-event.ps1 -EventType next_task_drafted -Detail "y"` (scratch copy).
5. **Missing `Detail` guard:** `powershell -ExecutionPolicy Bypass -File scripts/log-event.ps1 -EventType next_task_drafted -TaskId "x"` (scratch copy).
6. **Append-only integrity check:** compared the first N lines of the scratch log (N = line count before any test writes) against the pre-test copy of the file, byte-for-byte, after all six test runs above.
7. **JSONL structural integrity check:** parsed every individual line of the post-test scratch log with `ConvertFrom-Json` in a loop and counted failures.
8. `git status --porcelain` before and after all work, to confirm only the intended files were created/modified and scratch-copy testing never touched the live repo.
9. Deleted the temporary scratch directory (`/tmp/pcc-log-test`) and its comparison copies after testing.

### Results

1. Exit code `0`. Output: `Logged event 'next_task_drafted' for task 'pcc-v1-test' to .cockpit/logs/routing-log.jsonl.` New line confirmed present and well-formed.
2. Exit code `0`. Output: `Logged event 'verified_pass' for task 'pcc-v1-012' to .cockpit/logs/routing-log.jsonl.` Confirmed the derived line's `task_id` and `event_type` matched the source verification result's `task_id`/`verdict`, and `detail` matched its `summary` verbatim.
3. First attempt showed `EXIT:0` — traced to the pipe masking the real exit code, not a script defect. Re-ran without the pipe: real exit code `1`, PowerShell's own `ValidateSet` parameter-validation error correctly rejected the value before the script body ran at all. Line count of the log file was unchanged (28 before, 28 after) — nothing was written for the rejected call.
4. Exit code `1`. Failed with: `Fail : TaskId is required (either passed directly or derived via -FromVerificationResult).`
5. Exit code `1`. Failed with: `Fail : Detail is required (either passed directly or derived from verification-result.json's summary).`
6. `diff` between the pre-test log and the first N lines of the post-test log produced no output — byte-for-byte identical; confirmed append-only behavior holds in practice, not just by the `Add-Content`-only code path argument.
7. All lines (28 in the scratch copy after the two successful test appends) parsed successfully; `0` invalid JSON lines.
8. `git status --porcelain` showed only the files listed under Files Changed as new/modified beyond the advisor-side state/log files noted above; scratch-copy test writes never appeared in the live repo's status.
9. Scratch directory and comparison files removed; confirmed no residue.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic script exists that appends one well-formed JSON line per event** — `scripts/log-event.ps1`, confirmed via Results 1–2.
* **The script validates event/result type against a small explicit set rather than accepting arbitrary free text** — `ValidateSet` on `-EventType` for manual mode (Result 3), and a fixed verdict-to-event-type lookup table for derived mode (no free text accepted there either).
* **The script is strictly append-only** — confirmed both structurally (only `Add-Content` is used to write) and empirically (Result 6's byte-for-byte diff of prior lines).
* **The script can derive an entry directly from verification-result.json** — Result 2.
* **Recorded detail is factual, not narrative justification** — the `detail` field is either an explicit caller-supplied string or the verification result's own `summary` field (itself already a factual completion-criteria-based statement per `VERIFICATION_RESULT_SPEC.md`); the script adds no interpretive commentary of its own.
* **The change stays within scope, remains non-blocking, does not gate anything** — pure PowerShell, no dependencies, no network access; nothing in the repo calls this script automatically or conditions any other step on its output.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* This script still requires someone to remember to run it — it does not itself close the "an event happened and nothing recorded it" gap that motivated this task, only the "recording it by hand is error-prone" gap. The directive's forbidden scope explicitly excludes adding automation to solve the former; that remains a distinct, larger decision for later (see IDEA-001, currently deferred).
* `.cockpit/logs/routing-log.jsonl` now contains two structurally different line shapes (`route`/`reason`/`result` for pre-existing entries, `event_type`/`detail` for new ones going forward). Any future tool that reads this file needs to handle both shapes, or needs a normalization step, since none exists today.
* The `-FromVerificationResult` mode assumes `verification-result.json` on disk reflects the event being logged "right now." If it is run against a stale (already-archived-elsewhere) verification result, it would log a correct-but-late entry with no built-in staleness check — consistent with this being a plain recording tool, not a gate, but worth knowing.

### Unresolved Assumptions

* Assumed the event-type set named in the directive (`next_task_drafted`, `verified_pass`, `verified_fail`, `verified_insufficient`, `verified_blocked`, `verified_out_of_scope`, `correction_applied`) is complete enough for now; `correction_applied` in particular was included specifically to cover the kind of secondary-verifier-caught fix that happened during `pcc-v1-012`'s close-out, even though it doesn't correspond to a `VERIFICATION_RESULT_SPEC.md` verdict value.
* Assumed leaving pre-existing `routing-log.jsonl` lines in their original `route`/`reason`/`result` shape (rather than attempting to reformat them to match the new schema) is correct, mirroring the "identifiers and past records are not retroactively rewritten" decision already made for the plain-language naming convention this same session.
* Assumed a single flat `detail` string (rather than a structured object) is sufficient for "factual, not narrative" recording at this stage; a more structured schema (e.g. separate fields for criteria-checked counts, file lists) would be a larger design decision better deferred until there's a concrete reason to need it.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no orchestration or automation was introduced (nothing calls `log-event.ps1` automatically; it remains a manually-invoked recording tool, matching `doctor.ps1` and `safe-stop.ps1`'s existing pattern), and no canonical project goals or verification verdicts were changed. No existing line in `routing-log.jsonl` was rewritten, reordered, or deleted — confirmed both by code inspection (only `Add-Content` is used) and by the byte-for-byte diff in Result 6. The script does not gate, block, or fail any other script or cycle based on log contents. `docs/HANDOFF_PACKET_SPEC.md` was updated only to describe the new helper, per allowed scope. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and `backlog/IDEAS.md`'s IDEA-008 entry). All destructive/guard-condition testing was performed against a disposable scratch copy, never the live repo, and the scratch directory was deleted after use.
