# Worker Result

### Summary

Completed task `pcc-v1-011` by creating `scripts/doctor.ps1`, a read-only advisory health-check command that answers "is this repo safe to trust and hand off right now?" in one report. This implements `backlog/IDEAS.md` IDEA-006 (ranked #2 in the 2026-07-03 owner review), per the design constraint in `backlog/details/idea-006-doctor-healthcheck.md`: it composes PCC's existing checks rather than inventing new logic, and it is strictly advisory — it never halts, blocks, or gates anything, and it stays clearly separate from the one script allowed to gate a handoff (`scripts/enforce-handoff-restart-safety.ps1`).

`doctor` runs four checks and labels each finding `OK`, `WARN`, or `ISSUE`: (1) state consistency via the existing `validate-cockpit-state.ps1`, (2) restart safety via the existing `verify-dual-restart-safety.ps1` (which itself covers both the advisor brief and worker directive), (3) the *last recorded* `.cockpit/state/handoff-gate.json` verdict — read passively, not re-triggered, and flagged `WARN` (not `ISSUE`) if it's missing or stale for the current task, and (4) the active task's status/verdict from `task-state.json`, shown for context rather than judged pass/fail. It prints a compact summary line and **always exits 0**, regardless of how many issues it finds — a design choice made explicitly so nothing downstream could ever be wired to treat a doctor run as a precondition.

While testing, I found and fixed a real bug: the summary's warning/issue counts were wrong (a classic PowerShell gotcha where `Where-Object` returns a single unwrapped object when exactly one item matches, so `.Count` silently returned the matched hashtable's own key count instead of "1 match"). I also found that error text from composed child scripts was leaking raw ANSI escape codes into the report, and that my first attempt to strip them (using the `` `e `` escape token) silently failed under Windows PowerShell 5.1 — `` `e `` is a PowerShell 6+ feature, but `doctor.ps1` itself runs under `powershell.exe` (5.1) even though the scripts it composes run under `pwsh` (7+). Fixed by using an explicit `[char]27` instead, which works on both.

### Files Changed

* Created: `scripts/doctor.ps1`
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a paragraph describing `doctor.ps1` as the advisory counterpart to the enforcement gate, immediately after the gate's own description)

Runtime artifact: `.cockpit/state/handoff-gate.json` was refreshed during testing by running the existing `scripts/enforce-handoff-restart-safety.ps1` (to demonstrate the "last known gate result" check reporting `OK`); this is the same pre-existing runtime file from `pcc-v1-009`, not a new one, and its update falls under allowed scope ("Update .cockpit runtime files only as needed for the doctor report or its demonstration").

Note: `git status --porcelain` also shows several other modified/untracked files (`.cockpit/handoff/*`, `.cockpit/result/*`, `.cockpit/state/project-state.json`, `.cockpit/state/task-state.json`, `backlog/IDEAS.md`, `docs/STATE_MODEL.md`, `scripts/enforce-handoff-restart-safety.ps1`, `scripts/backup-protected-files.ps1`, archived `pcc-v1-009`/`pcc-v1-010` artifacts). These all predate this task's execution (prior verified cycles plus this session's backlog-ranking work) and were not touched by this task.

### Commands / Tests Run

1. **First live run:** `powershell -ExecutionPolicy Bypass -File scripts/doctor.ps1` — surfaced the miscounted-warnings bug (reported "3 warning(s)" while only one `WARN` line was printed).
2. Root-caused the count bug directly: reproduced the `Where-Object`/`.Count` unwrapping behavior in isolation, then fixed by wrapping both count expressions in `@(...)`.
3. **Re-run after the count fix:** confirmed the summary line now matched the actual number of printed findings (1 warning).
4. **Cleared the warning via its real fix, not a workaround:** ran `powershell -ExecutionPolicy Bypass -File scripts/enforce-handoff-restart-safety.ps1` against the live repo (a legitimate, in-scope use of the existing gate) so the "last known gate" check would have a fresh, matching-task-id `PASS` to report — then re-ran `doctor.ps1` and confirmed an all-`OK` report.
5. **Scratch-copy test, missing gate file** (`.cockpit` + `scripts` copied to an OS-temp scratch directory, never the live repo): deleted the scratch copy's `handoff-gate.json`, ran `doctor.ps1`, confirmed the "no gate file yet" `WARN` path.
6. **Scratch-copy test, genuine `ISSUE`:** in the same scratch copy, hand-edited `project-state.json` so `current_task_id` no longer matched `task-state.json`'s `task_id`, then ran `doctor.ps1` — this is when the raw-ANSI-codes-in-output problem surfaced.
7. Fixed the ANSI stripping (see Summary) and **re-ran the same scratch-copy `ISSUE` test** to confirm clean, readable output with the underlying failure reason still intact and exit code still `0`.
8. **Final live-repo run** after the `docs/HANDOFF_PACKET_SPEC.md` edit, to confirm the doc change didn't affect behavior.
9. `git status --porcelain` before and after all work, to confirm only the intended files were created/modified and scratch-copy testing never touched the live repo.
10. Deleted the temporary scratch directory (`/tmp/pcc-doctor-test`) after testing.

### Results

1. Exit code `0`. Output showed 1 `[WARN]` line but `Overall: no issues, 3 warning(s) found.` — a genuine bug, not expected behavior.
2. Isolated repro confirmed the root cause: `(single-match-collection).Count` on an `[ordered]@{}` (three keys: `check`, `status`, `detail`) returns the hashtable's own key count (3), not "1 matching item," because PowerShell unwraps single-item pipeline results before `.Count` is evaluated.
3. Exit code `0`. Output: `Overall: no issues, 1 warning(s) found.` — count now correct.
4. Gate script exit code `0`, ending: `Handoff gate PASSED: task 'pcc-v1-011' handoff artifacts are restart-safe and ready for fresh-session use.` Subsequent `doctor.ps1` run: all four checks `[OK]`, `Overall: OK. No issues or warnings found.`
5. Exit code `0`. Correctly reported: `[WARN] Handoff gate (last known): No .cockpit/state/handoff-gate.json found yet. The enforcement gate ... has not been run this cycle.`
6. Exit code `0` (doctor never fails its own exit code), but output was cluttered with raw ANSI escape sequences (e.g. literal `[31;1m` sequences) wrapped around the real failure text, making the report hard to read — confirmed via byte-level inspection (`[System.Text.Encoding]::UTF8.GetBytes(...)` showed a literal `0x1B` ESC byte preceding each `[` sequence).
7. First fix attempt (using `` `e `` in the regex) silently did not strip the codes when the script was invoked via `powershell.exe` (5.1), even though the identical regex worked correctly when tested interactively via `pwsh` (7+) — confirming the version-specific escape-token gap. After switching to `[char]27`, re-running the same scratch-copy `ISSUE` scenario under `powershell.exe` produced clean plain-text output: `[ISSUE] State consistency: Fail: ... State drift: project-state current_task_id 'pcc-v1-999-mismatch' does not match task-state task_id 'pcc-v1-011'.` with no escape codes, `Overall: 2 issue(s), 1 warning(s) found.`, exit code still `0`.
8. Exit code `0`, all `[OK]`, `Overall: OK. No issues or warnings found.` — confirms the doc-only edit didn't change script behavior.
9. `git status --porcelain` showed only the files listed under Files Changed as new/modified by this task beyond what already existed; scratch-copy edits never appeared in the live repo's status.
10. Scratch directory removed; confirmed no residue.

### Evidence

Mapping to the directive's completion criteria:

* **A local deterministic doctor command exists that summarizes PCC repo health in one readable report** — `scripts/doctor.ps1`, confirmed readable after the ANSI-stripping fix (Result 7).
* **The doctor command composes existing checks rather than inventing hidden script-only truth** — it calls `validate-cockpit-state.ps1` and `verify-dual-restart-safety.ps1` as subprocesses and reads `handoff-gate.json`/`task-state.json` directly; no new validation logic was invented.
* **The doctor command remains read-only, advisory, and non-gating; it does not halt or block a task cycle** — confirmed by design (always `exit 0`, Results 1–8 all show exit code `0` regardless of findings) and by the fact that no other script calls `doctor.ps1`.
* **The report clearly distinguishes warnings from pass/fail-style findings and does not replace the separate enforce-handoff gate** — `OK`/`WARN`/`ISSUE` labels are distinct; the "last known gate" check explicitly reads (never re-runs) `handoff-gate.json`, and the report text itself points to `scripts/enforce-handoff-restart-safety.ps1` as the separate blocking step.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell, no dependencies, no network access.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* `doctor.ps1` shells out to `pwsh` for the two composed checks. If `pwsh` (PowerShell 7+) is not installed on a given machine, those two checks would report `ISSUE` with a generic "could not run" message rather than their real underlying status — this is a environment-dependency risk inherited from the scripts it composes (they already assume `pwsh` is available), not something new this task introduced.
* The ANSI-stripping regex targets the specific `ESC [ <digits> m` SGR color-code pattern used by `Write-Error`'s current rendering. If a future PowerShell version changes how it renders terminal errors (a different escape sequence shape), the stripped output could regress to showing raw codes again — this would degrade readability, not correctness (the underlying OK/WARN/ISSUE status and failure detail text would still be accurate).
* The "handoff gate" check is purely informational; it does not distinguish "the gate has never been run this session" from "the gate was run a long time ago and nothing has changed since." Both currently just report whatever is in `handoff-gate.json`, or a `WARN` if absent/mismatched. This is consistent with the directive (doctor must stay advisory, not re-verify), but means a `WARN` here doesn't tell you how stale the last check actually was.

### Unresolved Assumptions

* Assumed the four checks composed (state consistency, dual restart-safety, last-known gate verdict, active task status) are the right initial set to satisfy "schema/state alignment, restart-safety status, handoff freshness, and similar structural signals" from the directive — IDEA-003 (runtime schema enforcement) was deliberately *not* added as a fifth check here, since it does not exist yet as a runnable script to compose; `doctor.ps1` is structured so a future schema check could be added as one more `Add-Finding` call without redesign.
* Assumed reading `.cockpit/state/handoff-gate.json` passively (not re-invoking `enforce-handoff-restart-safety.ps1`) is the correct way to surface "handoff freshness" without becoming a second gate, per IDEA-006's explicit instruction that doctor must not "replace or duplicate" the gate's blocking behavior.
* Assumed `doctor.ps1` should always exit `0` even when it finds real `ISSUE`s (rather than exiting non-zero on issues), since the directive's "must not halt or block a task cycle" reads as an unconditional constraint on the script itself, not just on how it happens to be wired up today. This is a stronger non-gating guarantee than strictly necessary (nothing currently consumes its exit code), but it forecloses the failure mode where someone later adds `if (doctor fails) { stop }` and inadvertently turns it into a gate.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no orchestration or automation was introduced (the helper is on-demand only; nothing calls it automatically), and no canonical project goals or verification verdicts were changed. `docs/HANDOFF_PACKET_SPEC.md` was updated only to describe the new advisory doctor command, per allowed scope. The owner was not asked to restate any project context; this task was completed entirely from canonical repo truth (`task-state.json`, the worker directive, and `backlog/details/idea-006-doctor-healthcheck.md`). All `ISSUE`-triggering and missing-file testing was performed against a disposable scratch copy under the OS temp directory, never the live repo; the live repo's only state change from testing was a legitimate, in-scope `enforce-handoff-restart-safety.ps1` run (used to demonstrate the "last known gate" `OK` path), and the scratch directory was deleted after use.
