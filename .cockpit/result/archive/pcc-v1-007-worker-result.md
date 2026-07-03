# Worker Result

### Summary

Completed task `pcc-v1-007` by creating `scripts/verify-worker-restart-safety.ps1`, a local deterministic PowerShell check that proves the live `.cockpit/handoff/worker-directive.md` is restart-safe for a brand-new Claude Code worker session. It runs two independent checks: (1) the live directive contains all 12 sections required by `docs/HANDOFF_PACKET_SPEC.md`, checked directly against the file's own text; and (2) the live directive is byte-for-byte identical to what `scripts/generate-worker-directive.ps1` currently produces from canonical `.cockpit/state/*.json`, proving it carries no stale or hand-edited content. This directly closes the gap the verifier flagged in `pcc-v1-005`'s verification result ("does not yet prove that the live directive matches fresh generator output"). Added a short cross-reference in `.cockpit/handoff/claude-worker-runbook.md`.

### Files Changed

* Created: `scripts/verify-worker-restart-safety.ps1`
* Updated: `.cockpit/handoff/claude-worker-runbook.md` (added a paragraph under "1. What Claude Reads First" pointing to the new check)
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

The check is read-only against the live repo (it regenerates a comparison copy to a temp scratch path inside the OS temp directory and deletes it in a `finally` block; it never writes to the live directive). Guard-condition tests used disposable scratch copies of the directive and state, never the live repo files.

1. **Run against the live repo (expected pass):**
   `pwsh -NoProfile -File scripts/verify-worker-restart-safety.ps1`
2. **First design iteration had a logic gap, found by testing, not by inspection:** I initially wrote the freshness check (byte-for-byte diff against the generator) to run before the required-sections check. Since `generate-worker-directive.ps1`'s template always includes all 12 sections by construction, that ordering meant the sections check could never actually fail once the freshness check had already passed — it was unreachable, not genuine defense-in-depth as the comment claimed. I caught this by attempting to write a test that would trigger the sections check in isolation and realizing it couldn't be constructed under the original ordering.
3. **Fix applied:** reordered so the required-sections check runs first, directly against the live file, independent of the freshness check.
4. **Re-run against the live repo after the fix (expected pass):**
   `pwsh -NoProfile -File scripts/verify-worker-restart-safety.ps1`
5. **Truncation test** (scratch copy of the live directive with the `## Blocked / Failure Instructions` section and everything after it removed): `pwsh -NoProfile -File scripts/verify-worker-restart-safety.ps1` — this must now fail via the sections check, independently of the freshness check.
6. **Staleness test** (scratch copy of the live directive and state, with the task title hand-edited to something that no longer matches `task-state.json`, but otherwise structurally complete): `pwsh -NoProfile -File scripts/verify-worker-restart-safety.ps1` — this must fail via the freshness check, since the sections check alone would not have caught it.
7. `git status --porcelain` after all testing, to confirm only the intended files changed and no stray temp files were left behind.

### Results

1. Exit code `0`. Output: `Restart safety OK: '.cockpit/handoff/worker-directive.md' contains all 12 required sections and matches canonical state. A fresh worker session can execute it without owner re-briefing.` (This first pass used the pre-fix ordering, which happened to still pass since the live file was genuinely both complete and fresh — the ordering bug only affects failure *detection*, not correctness of a passing result.)
2/3. Design gap identified and fixed as described above; see the script's final structure (required-sections check first, freshness diff second).
4. Same passing output as step 1, confirming the fix didn't change the correct-case result.
5. Exit code `1`. Failed with: `Restart-safety check FAILED: .cockpit/handoff/worker-directive.md is missing required section(s): ## Blocked / Failure Instructions. A fresh worker session cannot resume without owner re-briefing if required sections are absent.` — caught by the sections check, before any regeneration attempt.
6. Exit code `1`. Failed with: `Restart-safety check FAILED: .cockpit/handoff/worker-directive.md does not match what generate-worker-directive.ps1 currently produces from canonical state. A fresh worker session would read stale or hand-edited content instead of canonical truth. Regenerate the directive from state before handing it to a worker.` — caught by the freshness check, confirming it fires independently of the sections check (the file was structurally complete in this test, so only the freshness check could have caught the problem).
7. `git status --porcelain` showed only `scripts/verify-worker-restart-safety.ps1` (new), `.cockpit/handoff/claude-worker-runbook.md` (modified), plus this result file. No scratch/temp files were left in the OS temp directory (confirmed by listing it after each run); the live `.cockpit/handoff/worker-directive.md` and `.cockpit/state/*.json` were untouched throughout.

### Evidence

Mapping to the directive's completion criteria:

* **A bounded restart-safety artifact or helper exists for a fresh worker session** — `scripts/verify-worker-restart-safety.ps1` created this cycle.
* **The proof uses canonical repo truth and the generated worker directive path as its primary inputs** — confirmed by the script body (it regenerates from `.cockpit/state/*.json` via `generate-worker-directive.ps1` and reads the live `.cockpit/handoff/worker-directive.md`).
* **The result clearly shows how a brand-new Claude worker session can start cold and execute the active task without owner re-briefing** — the check proves the exact directive a fresh worker would read is both structurally complete (all 12 required sections) and provably non-stale (matches canonical state exactly), which together are the two conditions `docs/HANDOFF_PACKET_SPEC.md`'s Core Rule requires for a handoff to work without owner restatement.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell, no model calls, no network access, same input always produces the same output.
* **The helper stays within the approved V1 scope and uses local deterministic logic** — same as above.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* The freshness check (Check 2) shells out to `pwsh -NoProfile -File scripts/generate-worker-directive.ps1` as a subprocess rather than dot-sourcing it, so it depends on `pwsh` being on `PATH` when the check itself is run via `pwsh -File`. This matches how the other scripts in this repo are already invoked (see prior tasks' evidence), so it's a consistent, not novel, dependency.
* This check proves the *current* directive is fresh and complete at the moment it's run — it is not a continuously-enforced guarantee. If someone hand-edits `worker-directive.md` after this check passes and before a worker reads it, the check would need to be re-run to catch that. Nothing currently runs it automatically before every worker handoff.
* The required-sections check matches on literal markdown heading text (`## Receiving Role`, etc.). If a future directive template changes heading wording, this check and `docs/HANDOFF_PACKET_SPEC.md`'s required-sections list would need to be updated together, or the check would report false failures.

### Unresolved Assumptions

* Assumed "restart-safety proof" should be an executable check a human or future automation can run on demand, rather than a one-time narrative demonstration — consistent with the local-first, deterministic-tool philosophy already established by the other three generator/validator scripts in this repo.
* Assumed the two conditions I chose (structural completeness + freshness-vs-canonical-state) are the right definition of "restart-safe" for this task, since the directive didn't specify exact pass/fail criteria beyond "clearly shows how a brand-new Claude worker session can start cold and execute the active task without owner re-briefing." I derived these two conditions directly from `docs/HANDOFF_PACKET_SPEC.md`'s Core Rule and Required Sections list rather than inventing new criteria.
* Assumed adding the cross-reference to `.cockpit/handoff/claude-worker-runbook.md` (rather than `docs/HANDOFF_PACKET_SPEC.md`, which already documents the other two generators) is the more directly relevant location, since that runbook is specifically about the worker restart procedure this task proves.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, canonical project goals and verification verdicts were not changed, and no unrelated docs were modified — `.cockpit/handoff/claude-worker-runbook.md` is directly related to the worker restart proof this task implements. The live `.cockpit/handoff/worker-directive.md` and `.cockpit/state/*.json` were left untouched by this task's execution (confirmed via `git status`); all guard-condition tests were run against disposable scratch copies of the directive and state.
