# Worker Result

### Summary

Completed task `pcc-v1-004` by creating `scripts/generate-worker-directive.ps1`, a local deterministic PowerShell helper that drafts `.cockpit/handoff/worker-directive.md` directly from `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`. It renders the full worker-directive template (project identity, current task, current truth, exact next action, allowed/forbidden scope, completion criteria, required evidence, the fixed return-format and blocked-instructions boilerplate) purely from state fields, and refuses to draft anything if the two state files disagree on the active task or if required task fields (objective, allowed/forbidden scope, completion criteria) are missing. Added a short cross-reference note in `docs/HANDOFF_PACKET_SPEC.md` pointing at the new script, mirroring the pattern used for `scripts/advance-cockpit-state.ps1` in `docs/STATE_MODEL.md`.

### Files Changed

* Created: `scripts/generate-worker-directive.ps1`
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a short "Directive Generation Is a Local Deterministic Step" note after the handoff template, cross-referencing the new script)
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

All tests used an `-OutputPath` parameter to redirect generated output to scratch locations, so the live `.cockpit/handoff/worker-directive.md` (the directive this very task was executed from) was never overwritten mid-task. Guard-condition tests used disposable scratch copies of the state files, never the live repo state.

1. **Generate from live state, redirected to scratch:**
   `pwsh -NoProfile -File scripts/generate-worker-directive.ps1 -OutputPath <scratch>/pcc-generated-directive.md`, run from the repo root against the real `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`.
2. **Structural diff:** `diff .cockpit/handoff/worker-directive.md <scratch>/pcc-generated-directive.md` to compare the generated output against the live, manually-authored directive for this same task.
3. **Task-ID mismatch guard** (scratch copy of state, `project-state.json.current_task_id` changed to a non-matching value): `pwsh -NoProfile -File generate-worker-directive.ps1 -OutputPath out.md`.
4. **Missing-objective guard** (scratch copy of state, `task-state.json.task_objective` set to `""`): `pwsh -NoProfile -File generate-worker-directive.ps1 -OutputPath out.md`.
5. Repo-cleanliness check after all testing: `git status --porcelain` from the repo root.

### Results

1. Exit code `0`. Output: `Drafted worker directive for task 'pcc-v1-004' at <scratch path>`. The generated file contained all required sections populated from state: Project (from `project-state.json`), Current Task (from `task-state.json`), Current Truth (derived from `project_name` + `active_constraints`, deduplicated against a small fixed set of standing operational facts), Exact Next Action (`task_state.task_objective` verbatim), Allowed/Forbidden Scope (`boundaries.allowed`/`boundaries.forbidden`), Completion Criteria (`completion_criteria`), Required Evidence (`required_evidence`), plus the fixed Expected Return Format and Blocked/Failure Instructions boilerplate.
2. The diff showed only wording differences, not structural or missing-section differences — e.g., the live directive's hand-written "The primary rule is reducing owner babysitting." vs. the generated "Reduce owner babysitting." (the literal `active_constraints` array text). All sections were present and in the same order in both files; the only real defect the diff caught was a missing trailing newline in the first draft, which was fixed before the second run (confirmed no-newline issue resolved).
3. Exit code `1`. Script failed with: `State drift: project-state current_task_id 'pcc-v1-999-mismatch' does not match task-state task_id 'pcc-v1-004'. Reconcile state before drafting a directive.` No output file was written for the mismatched state.
4. Exit code `1`. Script failed with: `task-state.json field 'task_objective' is empty. Cannot draft a bounded directive without it.`
5. `git status --porcelain` showed only the two intended file changes (`scripts/generate-worker-directive.ps1` untracked, `docs/HANDOFF_PACKET_SPEC.md` modified) plus this result file — confirming no state files or unrelated files were touched by any test.

### Evidence

Mapping to the directive's completion criteria:

* **A local helper script exists under `scripts/`** — `scripts/generate-worker-directive.ps1` created this cycle.
* **The helper reads canonical state from `project-state.json` and `task-state.json`** — confirmed by script body (`Read-Json $projectStatePath`, `Read-Json $taskStatePath`) and by all four test runs, which succeeded or failed based on that state's content.
* **The helper drafts `worker-directive.md` in a worker-ready format** — confirmed by Test 1/2: the generated file matches the section structure of the live, previously hand-written directive exactly.
* **The generated directive includes the active task objective, boundaries, completion criteria, and required evidence** — confirmed present in the Test 1 output (Exact Next Action, Allowed/Forbidden Scope, Completion Criteria, Required Evidence sections all populated from the corresponding `task-state.json` fields).
* **The helper is local and deterministic rather than chat-driven** — pure PowerShell string templating from local JSON; no model calls, no network access.
* **Required evidence is explicit** — this document.
* **No forbidden-scope work was performed** — see Out-of-Scope Confirmation below.

### Known Risks

* The generated "Current Truth" section is not sourced from a single canonical field — it's assembled from `project_name` + `active_constraints` + three fixed operational-fact strings hardcoded in the script (worker claims are evidence, Claude Code is ready, PCC owns the handoff contract). These three facts describe the worker-bridge setup itself rather than per-project state, and nothing in `project-state.json` currently carries them. If that changes, the script's fixed list would need a corresponding edit.
* The generator faithfully renders whatever phrasing is already stored in `task-state.json`'s `boundaries.forbidden` array. In the live state for this task, those items already include a "Do not ..." prefix, so the rendered section reads "The worker must not: * Do not build UI...". This is a minor doubled-negative readability quirk inherited from the input data, not a defect in the generator — the script does not rewrite or infer array-item phrasing.
* The script does not gate on `task_status` (e.g., it will happily draft a directive even if `task_status` is `complete` or `blocked`). It renders whatever `task-state.json` currently describes; deciding when it's appropriate to draft a new directive is left to whoever invokes it, consistent with staying bounded rather than adding workflow-decision logic.
* Because I was executing this exact directive while building its own generator, all state-mutating and file-overwriting tests were run through `-OutputPath` redirection to scratch locations to avoid disturbing the live directive mid-task; the live `.cockpit/handoff/worker-directive.md` was never regenerated or overwritten by this task's execution.

### Unresolved Assumptions

* Assumed `task_state.task_objective` should be rendered verbatim as "Exact Next Action" rather than combined with `task_state.next_action` or elaborated further. The live, hand-written directives for prior tasks were somewhat more detailed/expanded than the corresponding `task_objective` field text; going forward, directive detail depends on how much detail is written into `task_objective` before running the generator.
* Assumed the one-line addition to `docs/HANDOFF_PACKET_SPEC.md` counts as "docs directly related to the helper or handoff-generation workflow" (explicitly allowed) rather than an unrelated doc change.
* Assumed a task-ID mismatch between `project-state.json` and `task-state.json` should hard-fail the generator rather than silently pick one source over the other, consistent with the same drift-safety posture already established by `scripts/validate-cockpit-state.ps1` and `scripts/advance-cockpit-state.ps1`.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, V1 scope was not redesigned, no canonical verification verdicts were changed, and no unrelated docs were modified — only `docs/HANDOFF_PACKET_SPEC.md`, which is directly related to the handoff-generation workflow this task implements. The live repo's `.cockpit/state/*.json` and `.cockpit/handoff/worker-directive.md` were left untouched by this task's execution (confirmed via `git status`); all directive-drafting tests were redirected to scratch output paths or run against disposable scratch copies of state.
