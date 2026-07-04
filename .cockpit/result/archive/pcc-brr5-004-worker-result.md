# Worker Result

### Summary

Fields `DECISION-066`'s restored two-role split as a real, low-cost mechanism: `scripts/codex-verify-watcher.ps1` polls two JSON files (free) and invokes `codex exec` exactly once per task genuinely needing verification, with a lock file preventing double-invocation while awaiting a response. All repeated/looped testing used a stub `codex` command, burning zero real Codex session usage. This task's own verification will be performed via one real, deliberate `codex exec` call against the live repo — the first genuine Codex verification since the fallback began, and the only real Codex usage this task consumes.

### Files Changed

* Created: `scripts/codex-verify-watcher.ps1`.
* Updated: `docs/REPO_GOVERNANCE.md` — describes the watcher and the restored normal-verifier expectation.
* Updated: `docs/DECISIONS.md` — added `DECISION-067`.
* Updated: `.cockpit/state/task-state.json`, `.cockpit/state/project-state.json` — task drafted and executed.

### Commands / Tests Run

* `pwsh -File scripts/validate-cockpit-state.ps1`, `scripts/check-schemas.ps1`, `scripts/refresh-live-handoff-artifacts.ps1`, `scripts/doctor.ps1` — before drafting; all clean.
* Inspected the real, installed Codex CLI directly (`codex --version`, `codex --help`, `codex exec --help`) to confirm actual invocation syntax rather than guessing at flags.
* Created an isolated scratch copy with a stub `codex` command (a `.cmd` wrapper calling a `.ps1` that logs invocations and writes a fixed verdict) to test the watcher's polling/lock/detection logic without spending any real Codex session usage.
* Test 1 (no work): `task_status: ready_for_worker` — confirmed the stub was never invoked (no call-count file created).
* Test 2 (new work): `task_status: returned_for_verification`, mismatched `verification-result.json` `task_id` — confirmed the stub was invoked exactly once, and `verification-result.json` was correctly updated to the current task's ID.
* Test 3 (pending response): lock present, `verification-result.json` reverted to the old (mismatched) `task_id` — confirmed the watcher recognized the pending lock and did **not** re-invoke (call count stayed at 1).
* Test 4 (response landed): `verification-result.json` updated to match — confirmed the lock cleared and no further invocation occurred (call count stayed at 1).
* Deleted the scratch copy; confirmed via `git status --short` that no test artifacts leaked into live state.

### Results

* All four lifecycle scenarios (no work, new work, pending, resolved) behaved exactly as designed on the first fully-fixed implementation. (One early iteration revealed the test *stub* wasn't directly invocable the way the real `codex` binary is — fixed by wrapping it in a `.cmd`, not by changing the watcher's own invocation logic, which was correct from the start against the real CLI's verified syntax.)

### Evidence

* `scripts/codex-verify-watcher.ps1`: read directly — the only file reads on every poll are `task-state.json` and `verification-result.json`; `codex exec` is called only inside the new-work branch, after the lock is written first (preventing the exact race the owner was concerned about).
* Scratch-test transcript captured in this cycle's tool output for all four scenarios, including exact stub invocation counts at each step.
* Real `codex exec --help` output captured and used directly to construct the prompt-invocation line (`-C`, `-s workspace-write`), not guessed.
* `docs/DECISIONS.md` `DECISION-067`: records the design, the cost-safety property, and the test methodology.

### Known Risks

* This task's own verification (a real `codex exec` call) has not yet been performed as of this writing — it is the required next step, separate from this evidence file.
* The watcher's lock file is a simple JSON marker, not a true distributed lock — if the watcher process itself crashes mid-invocation, the lock could be left in a state requiring manual clearing (deleting `.cockpit/state/codex-watcher.lock`) before the next real check. This is disclosed, not engineered around, since building true crash recovery wasn't required by this task's narrow scope.
* The prompt instructs Codex not to advance state or run close-out scripts itself, but nothing currently prevents Codex from doing so if it doesn't follow that instruction — this depends on Codex's own compliance with the prompt, same trust boundary any instruction-following agent has.
* The watcher has not yet been run in its actual loop mode (only `-Once`) against a real, live multi-cycle scenario; the loop wrapper itself (`while ($true) { ...; Start-Sleep }`) is simple enough that this is a low-risk gap, but it is a real one.

### Unresolved Assumptions

* Assumed `-s workspace-write` is the correct sandbox mode for a verifier that needs to write `verification-result.json` but shouldn't need full system access — chosen over `read-only` (which would prevent writing the verdict at all) and `danger-full-access` (broader than needed).
* Assumed pointing Codex at the already-generated `advisor-restart-brief.md` (rather than re-deriving context in the prompt itself) is correct, since that file already exists specifically to give a fresh advisor session full current-task truth.
* This task's own verification does not use the `DECISION-033` fallback (which ended per `DECISION-066`) — a real `codex exec` invocation is required next, not a self-verification disclosure.

### Out-of-Scope Confirmation

Confirmed: no existing script was modified. No schema was touched. The watcher is not wired to be started automatically by any other script. No existing verdict, task safety class, or the Acceptance Boundary Rules were changed.
