# Worker Result

### Summary

Completed task `pcc-v1-006` by creating `scripts/generate-advisor-restart-brief.ps1`, a local deterministic PowerShell helper that drafts a concise fresh-advisor restart brief at `.cockpit/handoff/advisor-restart-brief.md` directly from `.cockpit/state/project-state.json`, `.cockpit/state/task-state.json`, and `.cockpit/result/verification-result.json`. It implements the "Fresh-Chat Handoff" role notes already defined in `docs/HANDOFF_PACKET_SPEC.md` (project goal, current phase, current task, verified truth, unresolved issues, next expected action, files to read first) as an executable artifact rather than prose guidance alone. It refuses to draft a brief if project/task state disagree on the active task, or if project state and the live verification result disagree on the last verdict. Added a short cross-reference note to `docs/HANDOFF_PACKET_SPEC.md`'s existing "Fresh-Chat Handoff" section.

### Files Changed

* Created: `scripts/generate-advisor-restart-brief.ps1`
* Created: `.cockpit/handoff/advisor-restart-brief.md` (generated output, produced by running the new script against live state)
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a short cross-reference note under "Fresh-Chat Handoff")
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

The brief-generation output path (`.cockpit/handoff/advisor-restart-brief.md`) is a new artifact distinct from `.cockpit/handoff/worker-directive.md` (the directive this task was executed from), so running it directly against the live repo was safe and did not disturb the directive I was following. Guard-condition tests used disposable scratch copies of state, never the live repo state.

1. **Generate from live state (first pass):**
   `pwsh -NoProfile -File scripts/generate-advisor-restart-brief.ps1`
2. **Bug found and fixed:** the first pass rendered the verification `verified_at` timestamp as `07/03/2026 17:30:00` instead of the original `2026-07-03T17:30:00-06:00` — PowerShell's `ConvertFrom-Json` silently auto-parses ISO-8601-looking JSON strings into `[datetime]` objects, and default string interpolation reformatted it to a locale style that dropped the UTC offset entirely. Fixed by detecting `[datetime]`-typed values and reformatting back to the original ISO shape before interpolating.
3. **Re-run after fix:**
   `pwsh -NoProfile -File scripts/generate-advisor-restart-brief.ps1`, followed by `Select-String -Path .cockpit/handoff/advisor-restart-brief.md -Pattern "Verdict:"` to confirm the timestamp.
4. **Task-ID mismatch guard** (scratch copy of state with `project-state.json.current_task_id` changed to a non-matching value): `pwsh -NoProfile -File generate-advisor-restart-brief.ps1 -OutputPath out.md`.
5. **Verdict mismatch guard** (scratch copy of state with `verification-result.json.verdict` changed to `"FAIL"` while `project-state.json.last_verification_verdict` stayed `"PASS"`): `pwsh -NoProfile -File generate-advisor-restart-brief.ps1 -OutputPath out.md`.
6. `git status --porcelain` after all testing, to confirm only the intended files changed.

### Results

1. Exit code `0` on the first pass, but the `verified_at` field was corrupted as described above (a real defect, not a test artifact).
2/3. After the fix, re-running produced: `Drafted advisor restart brief for task 'pcc-v1-006' at .cockpit/handoff/advisor-restart-brief.md`, exit code `0`. `Select-String` confirmed the line now reads `Verdict: PASS for task 'pcc-v1-005', verified at 2026-07-03T17:30:00-06:00` — matching the source JSON exactly. The full generated brief includes: project name/goal/phase, the active task's ID/title/status/objective, the last verified verdict/summary/handoff path, an Open Issues section populated from `project-state.current_blocker`, `task-state.current_blocker`, and the last verification's `risks` array (currently the two `pcc-v1-005` risks about schema enforcement and directive-drift checking), a Read First list (state files, current directive, worker result, verification result, `docs/DECISIONS.md`, `docs/REPO_GOVERNANCE.md`), and a What Happens Next section from `task_state.next_action` / `project_state.next_expected_action`.
4. Exit code `1`. Failed with: `State drift: project-state current_task_id 'pcc-v1-999-mismatch' does not match task-state task_id 'pcc-v1-006'. Reconcile state before drafting a restart brief.` No output file written.
5. Exit code `1`. Failed with: `Verification drift: project-state last_verification_verdict 'PASS' does not match verification-result verdict 'FAIL'. Reconcile state before drafting a restart brief.` No output file written.
6. `git status --porcelain` showed only `scripts/generate-advisor-restart-brief.ps1` (new), `.cockpit/handoff/advisor-restart-brief.md` (new), `docs/HANDOFF_PACKET_SPEC.md` (modified), plus this result file — the live `worker-directive.md` and all `.cockpit/state/*.json` files were untouched.

### Evidence

Mapping to the directive's completion criteria:

* **A local helper exists that drafts an advisor restart brief from canonical repo truth** — `scripts/generate-advisor-restart-brief.ps1` created this cycle; confirmed working via Test 1/3.
* **The helper uses current project/task state plus verified artifact paths as its primary inputs** — confirmed by script body (`Read-Json` against `project-state.json`, `task-state.json`, `verification-result.json`) and by the Read First / Last Verified sections in the generated output.
* **The generated brief clearly tells a fresh advisor what the project is, what task is active, what was last verified, what to read first, and what happens next** — confirmed by the generated `.cockpit/handoff/advisor-restart-brief.md`, which has a dedicated section for each of those five things by name.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell/JSON, no model calls, no network access.
* **The helper stays within the approved V1 scope and uses local deterministic logic** — same as above.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* The generated brief's "Open Issues" section pulls the *last verification result's* `risks` array, which reflects the previously completed task (`pcc-v1-005`), not necessarily anything about the currently active task (`pcc-v1-006`). This is intentional — those risks are still open until someone resolves or supersedes them — but a fresh advisor should understand the risks are historical carry-over, not new findings about the current task. The brief's wording ("Risk from last verification of '...'") is meant to make that clear, but it's still a judgment call.
* Like the other two generators, this script does not validate its inputs against the JSON schemas in `schemas/` — it duplicates lightweight hand-rolled guards (non-empty required fields, task-ID/verdict consistency) rather than a shared schema-validation layer. This is consistent with the existing `validate-cockpit-state.ps1` / `generate-worker-directive.ps1` pattern already in the repo, not a new gap introduced here.
* The `verified_at` datetime-parsing bug (found and fixed during this task) suggests other scripts that interpolate JSON string fields which happen to look like dates could have the same latent issue. I did not audit `advance-cockpit-state.ps1` or `generate-worker-directive.ps1` for this, since neither of them currently interpolates a raw JSON timestamp field into user-facing text the way this new script does — but it's worth keeping in mind if a similar field is added to their output later.

### Unresolved Assumptions

* Assumed the output path `.cockpit/handoff/advisor-restart-brief.md` is the right location, by analogy with `worker-directive.md` and `first-proof-handoff.md` already living under `.cockpit/handoff/`. The directive did not specify an exact output path.
* Assumed "verified artifact paths" in the completion criteria means the brief should point to (not embed the full contents of) `worker-result.md` and `verification-result.json`, consistent with keeping the brief concise per the task's "concise" framing.
* Assumed the brief should be regenerated on demand (run the script fresh each time a new advisor session starts) rather than kept continuously in sync automatically — consistent with the other two generators, which are also on-demand rather than wired into an automatic trigger.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, canonical project goals and verification verdicts were not changed, and no unrelated docs were modified — `docs/HANDOFF_PACKET_SPEC.md` is directly related to the restart-brief generation this task implements. The live `.cockpit/handoff/worker-directive.md` and `.cockpit/state/*.json` were left untouched by this task's execution (confirmed via `git status`); all guard-condition tests were run against disposable scratch copies of state.
