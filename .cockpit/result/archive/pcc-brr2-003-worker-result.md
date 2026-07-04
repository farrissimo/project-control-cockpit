# Worker Result

### Summary

Completed task `pcc-brr2-003` ("BRR Verification: Deterministic Verifier Guardrails") by adding `scripts/verify-handback-guardrails.ps1`, a read-only script that gives the verifier one deterministic path to independently confirm repo health before issuing a verdict — the same kind of concrete, repeatable mechanism `pcc-brr2-002` gave the worker for handback. It runs `validate-cockpit-state.ps1`, `check-schemas.ps1`, and `doctor.ps1` unconditionally against the task's actual current state, and runs `enforce-handoff-restart-safety.ps1` only when `task_status` is `ready_for_worker` — printing an explicit `[SKIP]` with reasoning otherwise, since that gate does not apply once a task has already been returned for verification. It never writes to state and never issues a verdict; it only certifies whether the applicable repo-health checks are clean.

This task's own handback (via `scripts/finalize-worker-handback.ps1`, from `pcc-brr2-002`) and this new script's own demonstration (via `scripts/verify-handback-guardrails.ps1`, against that exact final state) together are the live-flow proof the completion criteria ask for.

### Files Changed

* Created: `scripts/verify-handback-guardrails.ps1`.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — expanded the existing "Advisor / Verifier Handoff" paragraph (added under `DECISION-031`) to name the new script explicitly and describe its status-specific `enforce-handoff-restart-safety.ps1` handling.
* Updated: `docs/REPO_GOVERNANCE.md` — updated Task Process step 11 to name the script as the concrete verifier guardrail path.
* Updated: `docs/DECISIONS.md` — added `DECISION-032`.
* Live handoff artifacts and state files were updated by `scripts/finalize-worker-handback.ps1` as part of this task's own handback, not hand-edited.

### Commands / Tests Run

1. **Ready-for-worker branch (live repo, read-only):** `pwsh -NoProfile -File scripts/verify-handback-guardrails.ps1` while the live task was still `ready_for_worker` — confirms the applicable-check branch runs `enforce-handoff-restart-safety.ps1` and passes.
2. **Skip branch + real-drift detection (disposable scratch copy):** copied live state to scratch, forced `task_status` to `returned_for_verification` without regenerating the handoff artifacts to match — confirms the script prints `[SKIP]` for the restart-safety gate and still correctly fails overall, because `doctor.ps1` genuinely found the (real, scratch-introduced) stale-artifact drift.
3. **Skip branch, fully clean (same scratch copy, after regenerating both artifacts to match the forced status):** confirms `[SKIP]` prints and the script exits `0` once the state is genuinely consistent.
4. **Real handback for this task:** `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1` — transitions `pcc-brr2-003` to `returned_for_verification` and regenerates both live artifacts, per the now-established path from `pcc-brr2-002`.
5. **Real verifier-guardrail demonstration:** `pwsh -NoProfile -File scripts/verify-handback-guardrails.ps1` — run immediately after (4), against the live repo's actual final state.
6. `git status --porcelain` before and after all scratch testing, to confirm the live repo's `.cockpit/` state was untouched by scratch work.

### Results

1. Output showed all checks `[OK]`, including `enforce-handoff-restart-safety.ps1` running and passing (`Handoff gate PASSED...`), ending with `Guardrails confirmed clean for task 'pcc-brr2-003' at status 'ready_for_worker'.` Exit `0`.
2. Output showed `[SKIP] scripts/enforce-handoff-restart-safety.ps1: not applicable at task_status 'returned_for_verification'...`, followed by `doctor.ps1` reporting a real `[ISSUE]` (stale advisor brief, then stale worker directive, found and fixed incrementally), and the script correctly failing overall each time with `Guardrail check FAILED for task 'pcc-brr2-003': - scripts/doctor.ps1 reported at least one [ISSUE]...`. This is the check working as intended, not a script defect — the drift was real (I forced a status change without regenerating the matching artifacts).
3. Once both artifacts were regenerated to match: all checks `[OK]`, the `[SKIP]` line still printed with its reasoning, ending with `Guardrails confirmed clean...`. Exit `0`.
4. Output: the four-step success sequence from `pcc-brr2-002`'s own script, ending in `Handback finalized for task 'pcc-brr2-003': state, artifacts, and health checks all agree.` Exit `0`.
5. Output: all checks `[OK]`, `[SKIP] scripts/enforce-handoff-restart-safety.ps1: not applicable at task_status 'returned_for_verification'...`, ending in `Guardrails confirmed clean for task 'pcc-brr2-003' at status 'returned_for_verification'. This certifies repo health only - the verdict itself... remains the verifier's own judgment.` Exit `0`.
6. Clean both times — no scratch artifacts appeared in the live repo's `git status`.

### Evidence

Mapping to the directive's completion criteria:

* **One concrete verifier-facing mechanism for independent guardrail review, explicit and repeatable rather than memory-based** — `scripts/verify-handback-guardrails.ps1`, demonstrated in Results 1 and 5 to run the same fixed check set every time against whatever state is handed to it.
* **Local-first and bounded; does not redesign verdicts, re-run worker handback logic, or broaden BRR scope** — the script only reads state and composes existing scripts; it does not call `finalize-worker-handback.ps1` or replicate its state-writing logic, and it introduces no new verdict, status, or acceptance rule.
* **Handles applicability honestly rather than blindly running every check** — Results 1 vs. 3/5 show the `enforce-handoff-restart-safety.ps1` branch is genuinely conditional: it runs and is required to pass at `ready_for_worker`, and is explicitly skipped with a printed reason at `returned_for_verification`, never silently omitted.
* **Verifier-facing docs tell Codex exactly what to run and when, including recorded repo-health/repo-sync duties** — `docs/HANDOFF_PACKET_SPEC.md`'s "Advisor / Verifier Handoff" section and `docs/REPO_GOVERNANCE.md`'s Task Process step 11 both now name this script directly, alongside the existing `DECISION-020`/`DECISION-031` duties it operationalizes rather than replaces.
* **Demonstrated against the active task flow, repo left healthy under applicable checks** — Results 4–5 are this exact demonstration: the real handback for this task, followed by the real verifier-guardrail run against that resulting state, both clean.
* **No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign** — confirmed; the script only certifies repo health, it does not decide or record a verdict, and `doctor.ps1`/`check-schemas.ps1`/`validate-cockpit-state.ps1`/`finalize-worker-handback.ps1` were not modified.

### Known Risks

* Same `[ISSUE]`-text-match coupling to `doctor.ps1`'s output format as `finalize-worker-handback.ps1` already has (`scripts/finalize-worker-handback.ps1`'s own Known Risks, `pcc-brr2-002`) — this script uses the identical pattern (`-match "\[ISSUE\]"`), so both scripts would need updating together if `doctor.ps1`'s finding-label format ever changes.
* This script certifies repo health, not task-specific correctness — a task could pass every guardrail here and still deserve `FAIL`/`INSUFFICIENT` on its actual substance. This is intentional and stated directly in the script's own success message, but worth restating: this tool narrows what the verifier has to independently re-check by hand, it does not replace the verifier's judgment on whether the work itself is right.
* There is now some intentional logic duplication between this script and `scripts/finalize-worker-handback.ps1` (both call `validate-cockpit-state.ps1`/`check-schemas.ps1`/`doctor.ps1` and both do `[ISSUE]` text-matching against `doctor.ps1`'s output). Per the directive's forbidden scope ("do not change... worker handback script behavior unless a direct contradiction is found"), I left `finalize-worker-handback.ps1` untouched rather than refactoring both to share logic, to avoid risking its already-verified behavior. Flagging this as a deliberate, scope-conservative tradeoff rather than an oversight.

### Unresolved Assumptions

* Assumed the correct set of "always applicable" checks is exactly `validate-cockpit-state.ps1`, `check-schemas.ps1`, and `doctor.ps1` (composing `doctor.ps1`'s own report rather than re-deriving equivalent checks separately), matching what `DECISION-031` already named. `enforce-handoff-restart-safety.ps1` was treated as the one status-specific exception, per that same decision's own text.
* Assumed a non-zero exit should refuse to certify the state (i.e., the verifier should not treat any verdict decision as safely informed) rather than merely warning, since the whole purpose of this script is to be the thing the verifier trusts instead of the worker's self-report — a script that only warns on a real `[ISSUE]` would undercut that purpose.
* Recommend independent (Codex) review specifically on: (a) whether this script's check set and skip logic match what `DECISION-031` actually intended, (b) whether certifying "repo health only, not task correctness" is stated clearly enough in the script's own output to avoid it being mistaken for a verdict, and (c) whether the deliberate non-refactoring of `finalize-worker-handback.ps1` (leaving the duplicated `doctor.ps1`-parsing logic in both scripts) is the right scope call versus something to unify later.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. `doctor.ps1`, `check-schemas.ps1`, and `validate-cockpit-state.ps1` were not redesigned — none were modified; the new script only composes and reads their output. No verification verdicts, task safety classes, or worker handback script (`finalize-worker-handback.ps1`) behavior were changed. No owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation was introduced — this script is verifier-facing and read-only. No archived history was rewritten or retrofitted. The owner was not asked to manually arbitrate routine verifier-side guardrail choice; the new script and its documentation express the normal path directly.
