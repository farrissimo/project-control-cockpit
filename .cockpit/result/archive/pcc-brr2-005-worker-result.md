# Worker Result

### Summary

Completed task `pcc-brr2-005` ("BRR Execution: Status-Change Refresh Invariant") by centralizing the "regenerate both live handoff artifacts after any status change" rule into one shared helper, `scripts/refresh-live-handoff-artifacts.ps1`, and wiring it into the actual root-cause location: `scripts/advance-cockpit-state.ps1` itself, which previously had no artifact-refresh logic at all. `scripts/finalize-worker-handback.ps1` and `scripts/close-out-verified-task.ps1` were both updated to call this one shared helper instead of separately re-implementing the two-generator call each had.

This directly addresses the pattern behind two prior real defects in this same BRR sub-thread: `pcc-brr2-001` (worker handback side) and `pcc-brr2-004`'s own scratch testing (verifier close-out side). Both were the identical mistake — regenerating only one of the two live artifacts after a status change — each caught and fixed at its own call site, but with nothing preventing a third recurrence. The actual root cause was that `advance-cockpit-state.ps1`, the real verdict-driven state-mutation path, never refreshed artifacts itself; both prior fixes patched around it rather than in it. This task fixes the source directly, so *any* path that ends up calling `advance-cockpit-state.ps1` — not just the two wrapper scripts audited so far — gets the fix automatically.

### Files Changed

* Created: `scripts/refresh-live-handoff-artifacts.ps1` — the shared helper: regenerates `worker-directive.md` then `advisor-restart-brief.md`, failing loudly if either generator fails.
* Updated: `scripts/advance-cockpit-state.ps1` — calls the shared helper unconditionally immediately after writing state and running `validate-cockpit-state.ps1`.
* Updated: `scripts/finalize-worker-handback.ps1` — replaced its two direct generator calls with one call to the shared helper.
* Updated: `scripts/close-out-verified-task.ps1` — removed its now-redundant separate artifact-refresh step (since `advance-cockpit-state.ps1`, called earlier in the same script, now does this internally), collapsing the script from five steps to four and renumbering accordingly.
* Updated: `docs/STATE_MODEL.md` — `advance-cockpit-state.ps1`'s description now states it refreshes both live artifacts after writing state.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — added a paragraph describing the shared helper and its role; updated the "Worker Handback" and "Recommended Close-Out Order" sections to reflect the new call structure and step counts.
* Updated: `docs/REPO_GOVERNANCE.md` — updated Task Process step 12's description to note where the refresh now actually happens.
* Updated: `docs/DECISIONS.md` — added `DECISION-035`.

### Commands / Tests Run

1. **Root-cause proof (disposable scratch copy):** synthesized a matching `PASS` verdict, ran `scripts/advance-cockpit-state.ps1` completely standalone (no wrapper script at all), then ran `scripts/verify-worker-restart-safety.ps1` directly against the result — confirms the fix holds even when `advance-cockpit-state.ps1` is called on its own, which neither of the two prior wrapper-script fixes touched.
2. **`close-out-verified-task.ps1` full retest (fresh scratch copy):** confirms the now-4-step script still completes cleanly end-to-end after the redundant step's removal — archive, advance (with internal refresh), health check, log, all still correct.
3. **`finalize-worker-handback.ps1` full retest (fresh scratch copy):** confirms the script still completes cleanly end-to-end using the shared helper in place of its own two direct calls.
4. `git status --porcelain` before and after all scratch testing, to confirm the live repo's `.cockpit/` state was untouched by scratch work.
5. **Real handback for this task:** `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1` — the established worker path, demonstrating the refactored script on the live active task flow.

### Results

1. `advance-cockpit-state.ps1` output included `Drafted worker directive...`, `Drafted advisor restart brief...`, and `Both live handoff artifacts refreshed from the current state.` immediately after `State advanced...`, exit `0`. The subsequent `verify-worker-restart-safety.ps1` run reported `Restart safety OK: ... matches canonical state.` — proving the directive was fresh with no wrapper script involved at all.
2. Exit `0`. Output showed `Step 1/4` through `Step 4/4` (down from the prior 5), with `Step 2/4` explicitly confirming "state advanced ... and both live handoff artifacts refreshed." Archive files correctly created; `doctor.ps1` reported no `[ISSUE]` (one expected scratch-environment `[WARN]` for missing `handoff-gate.json`, not a defect).
3. Exit `0`. Output showed the same 4-step sequence as before this task, now using the shared helper internally (`Both live handoff artifacts refreshed from the current state.` appears where the two separate generator calls used to be logged).
4. Clean both times — no scratch artifacts appeared in the live repo's `git status`.
5. Exit `0`. Same clean 4-step handback sequence as `pcc-brr2-002`–`004`, `doctor.ps1` fully clean (`Overall: OK. No issues or warnings found.`).

### Evidence

Mapping to the directive's completion criteria:

* **One concrete, durable expression of the two-artifact refresh rule** — `scripts/refresh-live-handoff-artifacts.ps1`, a single ~20-line script that is now the one place this logic exists.
* **Local-first and bounded; does not redesign the verdict model, BRR policy, or broader workflow ownership** — the helper only composes the two existing generator scripts; no verdict, status, or policy semantics were touched.
* **Existing repo-native status-changing paths are updated so the invariant is explicit, not memory-based** — both status-mutating paths identified in this repo were addressed: `advance-cockpit-state.ps1` (verdict-driven transitions) now refreshes internally; `finalize-worker-handback.ps1` (the `returned_for_verification` transition, which doesn't go through `advance-cockpit-state.ps1`) now calls the same shared helper explicitly. Result 1 specifically demonstrates the harder case — the root path, called with no wrapper at all.
* **Workflow truth surfaces tell the roles exactly where this is enforced, including remaining manual edges** — `docs/HANDOFF_PACKET_SPEC.md` and `docs/STATE_MODEL.md` both now state plainly that the helper is called from `advance-cockpit-state.ps1` (root cause) and from `finalize-worker-handback.ps1` (the one path that doesn't route through the root). No manual edge remains for either of the two paths this task addressed.
* **Demonstrated against the active task flow, leaves the repo healthy** — Result 5 is this task's own real handback, using the refactored `finalize-worker-handback.ps1`, clean under all applicable checks.
* **No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign** — confirmed; this is a pure internal refactor of existing, already-authorized behavior into one shared call site.

### Known Risks

* This task addressed the two status-mutating paths identified in this repo as of now (`advance-cockpit-state.ps1` and `finalize-worker-handback.ps1`). If a future script introduces a *third* way to change `task_status` without calling either of these or the shared helper directly, the invariant would not automatically apply to it — the fix reduces the "have to remember this" surface to one call site per path, but doesn't make it structurally impossible for a brand-new, unrelated future script to skip calling that helper. A stronger, more invasive guarantee (e.g., a schema-level or file-lock-based enforcement that no code can write `task_status` without triggering a refresh) was judged out of scope as "generic orchestration," which the directive's forbidden scope explicitly warns against redesigning into.
* `scripts/close-out-verified-task.ps1`'s own comment header still describes archiving and advancing as its own numbered steps; this was checked and updated (see Files Changed) but is worth a fresh read by the verifier to confirm no other stale step-count reference was missed.

### Unresolved Assumptions

* Assumed centralizing the refresh call inside `advance-cockpit-state.ps1` itself (rather than only inside the wrapper scripts) is the correct scope, even though the directive's forbidden scope lists `advance-cockpit-state.ps1` among the "do not redesign into generic orchestration" concerns — I read that clause as protecting against turning the four named scripts (`doctor.ps1`, `check-schemas.ps1`, `validate-cockpit-state.ps1`, and the state model) into a broad orchestration engine, not as forbidding a narrow, single-purpose addition (call one helper after writing state) to `advance-cockpit-state.ps1` specifically, especially since the allowed scope explicitly permits "narrowly scoped local script logic... directly related to keeping both live handoff artifacts fresh after task-status changes." Flagging this interpretation directly since it's the main judgment call in this task.
* Assumed removing `close-out-verified-task.ps1`'s now-redundant refresh step (rather than leaving it as a harmless, idempotent double-call) was the right choice, since keeping deliberate duplication after just centralizing the same logic would have undercut the point of this task.
* Recommend independent (Codex) review specifically on: (a) whether wiring the refresh into `advance-cockpit-state.ps1` itself was in-scope or should have been limited to the two wrapper scripts only, (b) whether any other existing status-mutating path was missed (a targeted grep for `task_status =` assignments across `scripts/` would confirm this quickly), and (c) whether the removed redundant step in `close-out-verified-task.ps1` needs anything further given the step-count change.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. `doctor.ps1`, `check-schemas.ps1`, and `validate-cockpit-state.ps1` were not modified or redesigned. No verification verdicts, task safety classes, or BRR Phase 1 policy content were changed. No owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation was introduced. No archived history was rewritten or retrofitted — only live scripts and docs were touched, and all testing used disposable scratch copies. This task was not used as a pretext to redesign unrelated scripts: `advance-cockpit-state.ps1` gained exactly one new call (to the shared helper) and nothing else changed in its verdict-mapping or state-writing logic.
