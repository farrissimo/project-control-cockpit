# Worker Result

### Summary

Completed task `pcc-v1-012` by creating `scripts/safe-stop.ps1`, a read-only convenience command for ending a session cleanly. This implements `backlog/IDEAS.md` IDEA-007 (ranked #3 in the 2026-07-03 owner review), per the design constraints in `backlog/details/idea-007-safe-stop.md`: it composes existing checks rather than inventing new validation logic, it does not advance task status or write a verification verdict (DECISION-006 reserves that for the verifier), and it never gates or blocks anything — it exists purely to kill "where were we?" overhead at session end, not to enforce anything.

`safe-stop` runs `validate-cockpit-state.ps1` and `verify-dual-restart-safety.ps1`, confirms `task-state.json`'s `next_action` and `project-state.json`'s `next_expected_action` are present (reading, never rewriting them), then prints a plain summary: what to read first to resume cold, the active task and its status, both next-action fields, and a final "Safe to stop: YES / NOT CLEANLY" line. Like `doctor.ps1` (`pcc-v1-011`), it always exits `0` regardless of findings.

This task was drafted, executed, and is being reported under `DECISION-019`'s temporary dual-role arrangement: as advisor, I shaped `pcc-v1-012` from the ranked backlog and generated the directive/brief from canonical state (confirmed via `verify-dual-restart-safety.ps1` before handing it to myself as worker); I am now returning worker evidence for a separate, subsequent verification pass, not folding the two together.

### Files Changed

* Created: `scripts/safe-stop.ps1`
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a paragraph describing `safe-stop.ps1` as the session-end counterpart to `doctor.ps1`, immediately after doctor's own description)

Advisor-side files changed while drafting this task (not part of the worker's bounded scope, listed for completeness since the same session performed both roles): `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` (advanced to `pcc-v1-012`, added `DECISION-019`/`DECISION-020` to `owner_decisions`), `.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md` (regenerated from state via the existing generator scripts).

### Commands / Tests Run

1. **First live run:** `powershell -ExecutionPolicy Bypass -File scripts/safe-stop.ps1` — confirmed the "Safe to stop: YES" path against the live repo (all checks OK).
2. **Scratch-copy test, missing next_action** (`.cockpit` + `scripts` copied to an OS-temp scratch directory, never the live repo): emptied `task-state.json`'s `next_action` field, then ran `safe-stop.ps1` against the scratch copy.
3. **Read-only guarantee check:** after the scratch-copy run in step 2, re-inspected the scratch `task-state.json` to confirm `next_action` was still empty (i.e. `safe-stop.ps1` did not "fix" or rewrite it) — checksummed the four key files (`project-state.json`, `task-state.json`, `worker-directive.md`, `advisor-restart-brief.md`) to confirm none were modified by the run.
4. **Final live-repo re-run** after the `docs/HANDOFF_PACKET_SPEC.md` edit, to confirm the doc change didn't affect behavior.
5. `git status --porcelain` before and after all work, to confirm only the intended files were created/modified and scratch-copy testing never touched the live repo.
6. Deleted the temporary scratch directory (`/tmp/pcc-safestop-test`) after testing.

### Results

1. Exit code `0`. Output ended with: `Safe to stop: YES. Canonical state and handoff artifacts are consistent and restart-safe.` All three checks reported `[OK]`.
2. Exit code `0` (never non-zero, by design). Output correctly showed `[ISSUE] Next action: missing or empty in canonical state. A fresh session would not know what to do next.` It also surfaced a second, cascading `[ISSUE]` from the restart-safety check — because the scratch copy's `advisor-restart-brief.md` embeds the task's `next_action` text, blanking that field made the live brief no longer match what the generator would produce, so `verify-dual-restart-safety.ps1` correctly flagged that too. Final line: `Safe to stop: NOT CLEANLY. 2 issue(s) found above - a fresh session may need extra context until these are resolved.`
3. `grep` confirmed `"next_action": ""` was still present, unmodified, in the scratch `task-state.json` after the run. Checksums of all four files were consistent with only my deliberate test edit (`task-state.json`) having changed; `project-state.json`, `worker-directive.md`, and `advisor-restart-brief.md` were untouched by `safe-stop.ps1` itself.
4. Exit code `0`, identical passing output to step 1 — confirms the doc-only edit didn't change script behavior.
5. `git status --porcelain` showed only the files listed under Files Changed as new/modified beyond the advisor-side state files noted above; scratch-copy edits never appeared in the live repo's status.
6. Scratch directory removed; confirmed no residue.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic safe-stop command exists that composes existing checks into one readable 'safe to stop' summary** — `scripts/safe-stop.ps1`, confirmed via Results 1 and 2.
* **The command surfaces the current canonical next_action... without inventing new status or rewriting it** — confirmed by Result 3 (checksum/grep proof the field was read, not rewritten).
* **The command does not advance task status, write verification verdicts, or gate/block anything; it is read-only** — confirmed by design (no `Set-Content`/`ConvertTo-Json` write calls anywhere in the script) and by Result 2 showing `exit 0` even with 2 real issues found.
* **The summary clearly tells a human what to read first and what the next action is** — see the "Resume by reading" and "next action" lines in Results 1/2.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell, no dependencies, no network access.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* `safe-stop.ps1` shells out to `pwsh` for its two composed checks, the same environment dependency already accepted for `doctor.ps1` and the restart-safety scripts it wraps — not a new risk introduced by this task.
* The "resume by reading" list is a fixed, hand-authored set of paths (mirroring the advisor brief's own Read First list) rather than dynamically derived the same way `generate-advisor-restart-brief.ps1` builds its list. If a future PCC change adds a new canonical read-first file, this list would need a matching manual update.
* Like `doctor.ps1`, this script's ANSI-stripping helper targets the current `Write-Error` SGR color-code shape and reuses the same `[char]27` approach (validated under PS 5.1 in `pcc-v1-011`) rather than the version-sensitive `` `e `` token — carried forward correctly here, but it's a duplicated helper rather than a shared one, since neither `doctor.ps1` nor `safe-stop.ps1` currently exposes reusable functions to import.

### Unresolved Assumptions

* Assumed "Safe to stop: NOT CLEANLY" (rather than "NO") is the right framing for the failure case, since the directive and idea detail doc are explicit that this is a convenience signal, not a hard verdict — stopping is always still possible; the message is meant to set expectations for the next session, not prohibit anything.
* Assumed printing both `task-state.json`'s `next_action` and `project-state.json`'s `next_expected_action` (rather than picking one) is correct, since PCC's state model treats them as separate task-level and project-level fields that can in principle diverge, and surfacing both lets a human/advisor notice if they ever do.
* Assumed the duplicated ANSI-stripping helper (rather than extracting a shared script/module) is an acceptable, bounded tradeoff for this task, consistent with keeping each script self-contained and avoiding a shared-module refactor that would touch multiple existing files beyond this task's allowed scope.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no orchestration or automation was introduced, and no canonical project goals or verification verdicts were changed by this command — `safe-stop.ps1` contains no code path that writes `task_status` or a verification verdict, satisfying the directive's explicit additional forbidden-scope item. `docs/HANDOFF_PACKET_SPEC.md` was updated only to describe the new command, per allowed scope. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and `backlog/details/idea-007-safe-stop.md`). All missing-next_action and read-only-guarantee testing was performed against a disposable scratch copy under the OS temp directory, never the live repo, and the scratch directory was deleted after use.
