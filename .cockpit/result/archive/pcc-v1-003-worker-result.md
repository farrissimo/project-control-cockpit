# Worker Result

### Summary

Completed task `pcc-v1-003` by creating `scripts/advance-cockpit-state.ps1`, a local deterministic PowerShell helper that reads `.cockpit/result/verification-result.json` and updates `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json` consistently, removing the need for manual state reconciliation after a verdict is issued. The helper refuses to act if the verification result's `task_id` doesn't match the active task in `task-state.json`, maps every verdict (PASS, FAIL, INSUFFICIENT, BLOCKED, OUT_OF_SCOPE) to the correct `task_status` enum value from `STATE_MODEL.md`'s transition sketch, and runs the existing `validate-cockpit-state.ps1` after writing to confirm no drift was introduced. Added a one-line cross-reference in `docs/STATE_MODEL.md` so the rule and its enforcing script stay linked.

### Files Changed

* Created: `scripts/advance-cockpit-state.ps1`
* Updated: `docs/STATE_MODEL.md` (added a short "State advancement is a local deterministic step" note under "State Update Rules", cross-referencing the new script)
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

All tests were run against isolated scratch copies of the state files (never the live repo files), except the final mismatch-guard test which was run directly against the real repo state specifically because it is guaranteed to be a safe no-op.

1. **Matching PASS scenario** (scratch copy, fabricated `task_id: "pcc-test-001"` present in both `task-state.json` and `verification-result.json`):
   `pwsh -NoProfile -File scripts/advance-cockpit-state.ps1`
2. **Matching INSUFFICIENT scenario** (scratch copy, fabricated `task_id: "pcc-test-002"`):
   `pwsh -NoProfile -File scripts/advance-cockpit-state.ps1`
3. **Mismatch guard against the real repo** (live `.cockpit/state/*.json` and `.cockpit/result/verification-result.json`, where `verification-result.json.task_id` is `pcc-v1-002` but `task-state.json.task_id` is already `pcc-v1-003`):
   `pwsh -NoProfile -File scripts/advance-cockpit-state.ps1`
   followed by `git status --porcelain` and `git diff --stat -- .cockpit/state` to confirm no files were modified.
4. Post-update validation in both scratch scenarios: `pwsh -NoProfile -File scripts/validate-cockpit-state.ps1` (also invoked automatically by the helper itself).

### Results

1. PASS scenario: `task-state.json.task_status` became `verified_pass`, `verification_verdict` became `PASS`, `current_blocker` became `null`, `next_action` was copied from the verification result, `project-state.json.last_verification_verdict` became `PASS` and `last_verified_handoff` was set to the task's `current_directive_path`. Script printed `State advanced for task 'pcc-test-001': verdict PASS -> task_status 'verified_pass'.` followed by `PCC state validation OK`. Exit code `0`.
2. INSUFFICIENT scenario: `task-state.json.task_status` became `insufficient_evidence` (not advanced to complete/verified_pass), `current_blocker` was set to the verification result's `summary` (`"Evidence missing; cannot confirm completion."`), `next_action` was synced (`"Request missing evidence before continuing."`). Script printed `State advanced for task 'pcc-test-002': verdict INSUFFICIENT -> task_status 'insufficient_evidence'.` followed by `PCC state validation OK`. Exit code `0`.
3. Mismatch guard: script printed `No-op: verification-result task_id 'pcc-v1-002' does not match active task-state task_id 'pcc-v1-003'. State left unchanged.` and exited `0`. `git status --porcelain` and `git diff --stat -- .cockpit/state` both showed no changes to `.cockpit/state/*.json` before or after running the helper — the real repo's live state was not touched by this task.
4. All scratch-directory test artifacts were removed after use (`rm -rf` with explicit absolute paths under the session scratchpad temp directory); the real repo was not affected by any test scenario.

### Evidence

Mapping to the directive's completion criteria:

* **A local helper script exists under `scripts/`** — `scripts/advance-cockpit-state.ps1` created this cycle.
* **The helper reads `.cockpit/result/verification-result.json`** — confirmed by the script body (`Read-Json $verificationPath`) and by the scratch tests reading fabricated verification results correctly.
* **The helper updates `project-state.json` and `task-state.json` consistently for PASS** — confirmed by scratch Test 1: both files updated with matching verdict/status/timestamp, and post-update `validate-cockpit-state.ps1` reported `PCC state validation OK`.
* **The helper is local and deterministic rather than chat-driven** — pure PowerShell, no model calls, no network access; same input always produces the same output.
* **Required evidence is explicit** — this document.
* **No forbidden-scope work was performed** — see Out-of-Scope Confirmation below.

### Known Risks

* On a PASS verdict the helper sets `task_status` to `verified_pass`, not `complete`. This follows `STATE_MODEL.md`'s documented transition sketch (`verified_pass → complete`) literally, on the reasoning that deciding a task is fully `complete` and drafting the next task is an advisor/verifier judgment call, not something a deterministic script should decide on its own (doing so would edge toward "broad orchestration," which is forbidden). If the owner/verifier intends PASS to mean immediate `complete`, this mapping should be revisited in a future bounded task.
* For non-PASS verdicts, the helper writes `current_blocker` as the verification result's `summary` field. This is a reasonable default but is a design choice, not something the directive specified explicitly.
* The helper does not update `.cockpit/logs/routing-log.jsonl`; log-entry writing was left out because the directive scoped this task to state consistency, not logging, and adding a log writer was not called for by the completion criteria.
* The helper depends on `scripts/validate-cockpit-state.ps1` remaining in `scripts/` with its current relative-path behavior (both scripts assume the working directory is the repo root).
* I ran a cleanup command mid-task (`Remove-Item -Recurse -Force $tmp`) where `$tmp` unexpectedly evaluated empty in that PowerShell session, causing the command to target the current directory (`C:\ProjectControlCockpit`) instead of the intended scratch folder. Windows blocked it as a protected path and nothing was deleted; I verified full repo integrity immediately afterward via `git status`, `git log`, and a directory listing, all of which confirmed no data loss. All subsequent scratch-directory cleanup was done via `Bash`/`rm -rf` with explicit absolute paths instead of relying on PowerShell session variables across tool calls.

### Unresolved Assumptions

* Assumed `verified_pass` (not `complete`) is the correct terminal `task_status` for a PASS verdict, per the reasoning in Known Risks. This should be confirmed or corrected by the owner/verifier.
* Assumed the one-line addition to `docs/STATE_MODEL.md` counts as "docs directly related to the helper or state-advance workflow" (explicitly allowed) rather than an unrelated doc change.
* Assumed running the existing validator as a post-write self-check inside the new helper is "a small validation ... step if needed" as permitted by allowed scope, not new broad orchestration, since it's a single local call to an existing script.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, V1 scope was not redesigned, no canonical verification verdicts were changed, and no unrelated docs were modified — only `docs/STATE_MODEL.md`, which is directly related to the state-advance workflow this task implements. The live repo's `.cockpit/state/*.json` and `.cockpit/result/verification-result.json` were left completely untouched by this task's execution (verified via `git status`/`git diff`); all state-mutation testing was performed against disposable scratch copies.
