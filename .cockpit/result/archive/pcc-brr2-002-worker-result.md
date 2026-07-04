# Worker Result

### Summary

Completed task `pcc-brr2-002` ("BRR Execution: Deterministic Worker Handback") by adding `scripts/finalize-worker-handback.ps1`, a single deterministic script that performs the worker-to-verifier handback in a fixed order: (1) sets `task_status` to `returned_for_verification` on both state files, refusing to run unless the task is currently `ready_for_worker` or `in_progress`; (2) runs `validate-cockpit-state.ps1` immediately after that write; (3) regenerates both live handoff artifacts from the state just written; (4) runs `check-schemas.ps1` and `doctor.ps1` last, against the exact state being handed back, failing if either reports a problem. This directly closes the sequencing gap that caused `pcc-brr2-001`'s original `FAIL`: a worker can no longer regenerate a handoff artifact before the final state change, because the script performs the state change first by construction.

This task itself was handed back using the new script — its own existence is the demonstration the completion criteria ask for.

### Files Changed

* Created: `scripts/finalize-worker-handback.ps1`.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — added a new "Worker Handback Is a Local Deterministic Step" section documenting the script's fixed sequence and explaining why `scripts/enforce-handoff-restart-safety.ps1` is intentionally excluded from it.
* Updated: `docs/REPO_GOVERNANCE.md` — inserted a new step 10 into the Task Process's Standard task workflow naming the script as the required handback step, renumbering the final step.
* Updated: `docs/DECISIONS.md` — added `DECISION-030`.
* Live handoff artifacts (`.cockpit/handoff/worker-directive.md`, `.cockpit/handoff/advisor-restart-brief.md`) and state files (`.cockpit/state/task-state.json`, `.cockpit/state/project-state.json`) were updated by the script itself as part of this task's own handback, not hand-edited.

### Commands / Tests Run

1. **Guard test 1 (live repo, read-only/non-destructive):** `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1 -TaskId "wrong-id-does-not-exist"` — confirms the script refuses before writing anything if given a mismatched task ID.
2. **Guard test 2 (disposable scratch copy):** copied live state/scripts to a scratch directory, forced `task_status` to `"complete"`, ran the script — confirms it refuses (does not write) when the task is not `ready_for_worker`/`in_progress`.
3. **Idempotency check (incidental, surfaced by an incomplete scratch setup on the first full-path attempt):** running the script twice in a row against the same scratch copy — the second run correctly refused once the first had already moved the task to `returned_for_verification`.
4. **Full happy-path test (disposable scratch copy, complete file set):** ran the script end-to-end against a scratch copy carrying the real live task/project state, verification result, existing directive, worker-result, and archived directives — confirmed exit `0`, all four steps completed in order, and both regenerated artifacts correctly showed `returned_for_verification`/Class B.
5. **Real run against the live repo:** `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1` — this is the actual handback for `pcc-brr2-002` itself, run once, as the final action before writing this file.
6. `git status --porcelain` before and after all scratch testing, to confirm scratch work never touched the live repo's `.cockpit/` state.

### Results

1. Refused with a clear error (`Refusing to act: given -TaskId 'wrong-id-does-not-exist' does not match active task-state.json task_id 'pcc-brr2-002'.`), exit `1`; `git status` showed no `.cockpit/state/` changes from this call.
2. Refused with `Refusing to hand back task 'pcc-brr2-002': task_status is 'complete', not one of ready_for_worker, in_progress.`, exit `1`, no writes.
3. Second run against the same scratch copy refused with `task_status is 'returned_for_verification', not one of ready_for_worker, in_progress.` — confirming the script cannot be run twice against the same handback by accident.
4. Exit `0`. Output showed all four steps completing (`Step 1/4` through `Step 4/4`), ending with `Handback finalized for task 'pcc-brr2-002': state, artifacts, and health checks all agree. Safe to write .cockpit/result/worker-result.md now.` The regenerated directive and brief both read `returned_for_verification` and `Class B` correctly. `doctor.ps1`'s only finding was a `[WARN]` (not `[ISSUE]`) about a missing `handoff-gate.json`, which is expected in a scratch copy that never ran the enforcement gate — confirms the script correctly distinguishes `WARN` (non-fatal) from `ISSUE` (fatal) rather than over-triggering.
5. Exit `0`. Same four-step success sequence, this time against the real repo; `doctor.ps1` reported all five findings `[OK]` (the real repo does have a `handoff-gate.json` from prior cycles), `Overall: OK. No issues or warnings found.`
6. Clean both times — no scratch artifacts ever appeared in the live repo's `git status`.

### Evidence

Mapping to the directive's completion criteria:

* **One concrete worker-facing mechanism for final handback ordering, making the sequence explicit and repeatable** — `scripts/finalize-worker-handback.ps1`, demonstrated in Results 4–5 to perform state update → validate → regenerate artifacts → final health checks, in that fixed order, every time.
* **Local-first and bounded; no new autonomy, verdict-model change, or scope broadening** — the script only composes existing scripts (`validate-cockpit-state.ps1`, `generate-worker-directive.ps1`, `generate-advisor-restart-brief.ps1`, `check-schemas.ps1`, `doctor.ps1`) in a fixed sequence; it introduces no new verdict, no new task status, no owner-decision capture, and no autonomous task selection.
* **Worker directive and docs tell the worker exactly what to run and when, no longer dependent on memory** — `docs/HANDOFF_PACKET_SPEC.md`'s new section and `docs/REPO_GOVERNANCE.md`'s renumbered step 10 both name the single command (`scripts/finalize-worker-handback.ps1`) as the required handback step.
* **Demonstrated for the active task flow; leaves the repo healthy under the four named scripts as applicable** — Result 5 is this exact demonstration on the live, active task. `scripts/enforce-handoff-restart-safety.ps1` was deliberately not run as part of the handback sequence (see Known Risks/Evidence below for why), consistent with the directive's own "as applicable" qualifier.
* **Truth-surface propagation handled honestly** — `docs/HANDOFF_PACKET_SPEC.md`, `docs/REPO_GOVERNANCE.md`, and `docs/DECISIONS.md` were all updated; `docs/STATE_MODEL.md` and `README.md` were checked (no new state field, no phase-level change) and correctly left untouched.
* **No automatic owner-decision capture, no new acceptance-boundary policy, no unrelated workflow redesign** — confirmed; the script only automates an already-correct manual sequence, it does not add judgment or acceptance logic.

**Why `scripts/enforce-handoff-restart-safety.ps1` is excluded from the sequence, addressed directly since the directive names it as one of four scripts the resulting path should leave healthy "as applicable":** that gate's entire purpose (per `docs/HANDOFF_PACKET_SPEC.md` and its own code) is confirming a task is safe to hand to a *fresh worker session* — it hard-fails unless `task_status` is exactly `ready_for_worker`. `finalize-worker-handback.ps1` moves `task_status` *away* from `ready_for_worker` to `returned_for_verification` by design. Running the enforcement gate after that transition would fail every time, not because of a defect, but because the gate is checking the wrong direction of handoff for this script's purpose. This is documented explicitly in both the script's own comments and the new `docs/HANDOFF_PACKET_SPEC.md` section, rather than silently skipped.

### Known Risks

* This script fixes the worker side of the sequencing gap. The verifier side (independently re-confirming health at review time rather than trusting the worker's report) is a related but separate concern — and per `docs/HANDOFF_PACKET_SPEC.md`'s and `docs/DECISIONS.md`'s current content (`DECISION-031`, added concurrently by the advisor), that has now also been addressed as an explicit verifier duty. I did not author `DECISION-031` or its doc changes; noting it here only because it's directly related and already landed in the same files this task touches.
* The script's `doctor.ps1` `[ISSUE]`-detection is a text-match (`-match "\[ISSUE\]"`) against `doctor.ps1`'s printed output rather than a structured exit code, since `doctor.ps1` itself always exits `0` by design (`DECISION-020`) and was not modified. This is a reasonable, narrow coupling to `doctor.ps1`'s current output format; if `doctor.ps1`'s finding-label format ever changes, this text match would need updating alongside it.
* `advance-cockpit-state.ps1` was not touched or composed into this script — this task is about the worker-to-verifier handback, not the verifier's post-PASS close-out, which remains a separate step per `docs/HANDOFF_PACKET_SPEC.md`'s existing "Recommended Close-Out Order."

### Unresolved Assumptions

* Assumed the correct source states for the handback transition are exactly `ready_for_worker` and `in_progress` (not, say, allowing `verified_fail`/`insufficient_evidence`/`blocked` directly) — a retry from a failed verdict should still pass back through `ready_for_worker` first (as happened manually in `pcc-brr2-001`'s own retry), rather than jumping straight from a failure status to `returned_for_verification` via this script. This keeps the script narrowly scoped to the one transition it was built for.
* Assumed hardcoding `current_blocker = $null` as part of this script's state update is correct, since this script is specifically for a clean, unblocked handback — a worker that needs to report a `BLOCKED` state per `docs/BRR_POLICY.md`'s Stop-Instead-of-Guess Policy should not use this script at all, and nothing currently prevents someone from calling it inappropriately in that situation. Flagging this as worth confirming: should the script itself refuse to run if there's reason to believe the task should be reported blocked instead, or is that judgment call correctly left to the worker choosing whether to invoke it in the first place?
* Recommend independent (Codex) review specifically on: (a) whether excluding `scripts/enforce-handoff-restart-safety.ps1` from the sequence is correctly justified or whether the directive intended something else by "as applicable," (b) whether the `ready_for_worker`/`in_progress` source-state restriction is the right boundary, and (c) whether hardcoding a clean (non-blocked) handback is the right scope limit for this first version of the script.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. `doctor.ps1` was not redesigned into a broad gate — it is unchanged, still always exits `0`, and still never gates anything for any other caller; only the new script reads its output and decides whether to certify handback based on that read. No verification verdicts, task safety classes, or BRR Phase 1 policy content were changed. No owner-decision capture flow, automatic stop-trigger detection, or autonomous next-task drafting was introduced. No archived history was rewritten or retrofitted — the script only reads archived files during testing, never writes to `archive/`. The owner was not asked to manually restate the handback sequence; it is now expressed directly in the repo via the script and documented in `docs/HANDOFF_PACKET_SPEC.md`/`docs/REPO_GOVERNANCE.md`.
