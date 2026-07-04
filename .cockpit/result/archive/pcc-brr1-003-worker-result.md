# Worker Result

### Summary

Completed task `pcc-brr1-003` ("BRR Policy: Stop-Instead-of-Guess") by extending `docs/BRR_POLICY.md` with a "Stop-Instead-of-Guess Policy" section covering all seven trigger examples named in `docs/BRR_PLAN.md` Phase 1 (ambiguous scope, conflicting truth surfaces, weak/missing evidence, repeated failure with no new evidence, out-of-scope drift, no trusted way to verify a risky task, unresolved owner-facing tradeoff). Each trigger maps to one of PCC's five existing verification verdicts (`FAIL`/`INSUFFICIENT`/`BLOCKED`/`OUT_OF_SCOPE` — `PASS` is never the outcome of a trigger firing) and cross-references the specific Owner Review Matrix row and/or Task Safety Class it aligns with, so this section reads as a third view of the same underlying policy rather than a fourth, independent rule set.

As part of this, I folded the old "Relationship To Existing Verdicts" section (added under `pcc-brr1-001`/`DECISION-024`) into the new section, since both covered the same ground (rows 9–10 mapping to verdicts) and leaving both would have created a stale duplicate the moment this task landed.

No runtime scripts, schemas, or verification mechanics were touched. This is docs-only policy work extending `docs/BRR_POLICY.md`, per the directive's forbidden scope.

### Files Changed

* Updated: `docs/BRR_POLICY.md` — added the "Stop-Instead-of-Guess Policy" section (7-row trigger table + "Verdict reuse, not expansion" + its own "Notes on scope"), replacing the now-redundant "Relationship To Existing Verdicts" section; updated the header note to list all three completed pieces (`pcc-brr1-001`/`002`/`003`); updated two forward-reference notes in the Owner Review Matrix and Task Safety Classification sections that previously said the stop policy was "not yet written."
* Updated: `docs/DECISIONS.md` (added `DECISION-026`)
* Updated: `.cockpit/state/task-state.json` (`task_status`: `ready_for_worker` → `returned_for_verification`; `next_action` updated to hand off to the verifier; `updated_at` bumped)
* Updated: `.cockpit/state/project-state.json` (`next_expected_action` updated to match; `updated_at` bumped)

### Commands / Tests Run

* `powershell -ExecutionPolicy Bypass -File .\scripts\validate-cockpit-state.ps1` — run twice: once before state-file edits (baseline OK), once after updating `task-state.json` and `project-state.json` (confirms no drift/inconsistency introduced).
* No other scripts run; this task involves no code, schema, or runtime changes to test.
* Read `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, and `README.md` in full (and grepped for `pcc-brr1-003`/`Stop-Instead-of-Guess`) to check for staleness before deciding not to edit them.

### Results

* Both `validate-cockpit-state.ps1` runs returned `PCC state validation OK`.
* The grep across the four "propagation candidate" docs found only generic, still-accurate mentions of "Stop-Instead-of-Guess Policy" as a named Phase 1 deliverable (in `README.md` and `docs/BRR_PLAN.md`) — none of them describe its content in a way this task made stale.
* `docs/BRR_POLICY.md` was read back in full after editing to confirm: all 7 triggers map to exactly one verdict each, no trigger maps to `PASS`, every Owner Review Matrix row (1–11) that's relevant to a trigger is correctly cited, and no leftover "not yet written"/forward-reference language remained pointing at this task.

### Evidence

Mapping to the directive's completion criteria:

* **Repo gains canonical policy text defining Stop-Instead-of-Guess rules, practical and bounded** — `docs/BRR_POLICY.md`'s new "Stop-Instead-of-Guess Policy" section: a 7-row table (Trigger / What it looks like / Verdict-stop point / Relationship to Matrix-Class) plus two short prose subsections.
* **Covers all named trigger examples** — ambiguous scope, conflicting truth surfaces, weak/missing evidence, repeated failure with no new evidence, out-of-scope drift, no trusted way to verify a risky task, and unresolved owner-facing tradeoff each appear as their own numbered row, in the same order the directive lists them.
* **Reuses, does not expand, the verdict set; relationship stated not invented** — the "Verdict reuse, not expansion" subsection states explicitly that every trigger resolves to one of the five existing verdicts and that `PASS` is never a trigger outcome; the table's own "Verdict / stop point" column names the specific verdict (`FAIL`, `INSUFFICIENT`, `BLOCKED`, or `OUT_OF_SCOPE`) for each trigger rather than leaving it generic.
* **Aligns with, does not contradict, the Owner Review Matrix and Task Safety Classification** — every row's "Relationship to Matrix / Class" column cites the specific matrix row and/or class it corresponds to (e.g. trigger 3 "weak or missing evidence" → matrix row 10, the reason a task is Class B; trigger 4 "repeated failure" → matrix row 9, Class D). Two triggers (5: out-of-scope drift, and part of 7: unresolved tradeoff) don't map to a single matrix row one-to-one, and the table says so explicitly rather than forcing a false correspondence — flagged for the verifier below.
* **Stays practical and docs-only** — no new state, no schema change, no automatic detection logic. The section's own "Notes on scope" explicitly disclaims trigger-detection automation and Phase 2 gating as future work.
* **Truth-surface propagation handled honestly** — `docs/DECISIONS.md` got `DECISION-026` (new project behavior/governance content). `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, and `README.md` were each checked (via grep + full read) and found not stale — their existing mentions of "Stop-Instead-of-Guess Policy" are generic deliverable-list references that remain accurate without edits.
* **Evidence returned in required format, with independent-review call-out** — this document; see Unresolved Assumptions below.

### Known Risks

* Trigger 5 (out-of-scope drift) and part of trigger 7 (unresolved owner-facing tradeoff) don't correspond to a single Owner Review Matrix row the way triggers 1–4 and 6 do — the table is explicit about this ("Not itself a matrix row... but is exactly the failure mode the Owner Review Matrix and Task Safety Classification exist to prevent from going unnoticed" for trigger 5; "same shape as... rows 4 and 8" for trigger 7, an analogy rather than a direct row citation). This is disclosed rather than papered over, but it means the alignment claim for these two rows is looser than for the others.
* Folding the old "Relationship To Existing Verdicts" section into this new one is a structural change to previously-verified content (that section was part of the `pcc-brr1-001` PASS). It doesn't alter any fact that section stated (rows 9–10 still map to `FAIL`/`INSUFFICIENT` exactly as before) — it only relocates and extends that mapping — but a verifier re-reading `docs/BRR_POLICY.md` end-to-end should confirm nothing was silently lost in that merge, since it touches content from a prior verified cycle.
* Same standing risk as `pcc-brr1-001`/`002`: this is judgment-heavy policy content, not deterministically testable; `DECISION-022`'s recommendation for independent secondary review applies here too.

### Unresolved Assumptions

* Assumed folding the old "Relationship To Existing Verdicts" section into the new "Stop-Instead-of-Guess Policy" section (rather than leaving both side by side) was the right call, since the directive says this task should "tie them cleanly to the existing verification verdicts... already recorded" — leaving the old section would have meant two places stating the same rows-9-10-to-verdict mapping, which risked drifting apart over time. Flagging this specifically since it modifies content from an already-PASSed cycle rather than only adding new content.
* Assumed it's acceptable for two of the seven trigger rows (5 and 7) to reference the Owner Review Matrix by analogy/purpose rather than by a single specific row number, since the directive doesn't require a 1:1 row mapping for every trigger — only that "the relationship between owner-required cases and Class C or D is stated rather than left implicit" (from `pcc-brr1-002`'s completion criteria, echoed here) and that the new policy "aligns with, and does not contradict" the existing content. No contradiction exists; the mapping is simply looser for these two.
* Assumed no update was needed to `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, or `README.md` (see Evidence's propagation paragraph) — recommend the verifier re-check this "nothing to update" call specifically, consistent with the same flag raised in the prior two cycles.
* Recommend independent (Codex) review specifically on: (a) whether triggers 5 and 7's looser (non-1:1) matrix mapping is acceptable or needs tightening, (b) whether folding the old verdict-mapping section into this one was the right structural call rather than something that should have been left untouched, and (c) whether all seven verdict assignments (especially `BLOCKED` vs. `OUT_OF_SCOPE` vs. `INSUFFICIENT` for the less clear-cut triggers) are the correct choice.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No Phase 2 behavior, runtime enforcement, automatic gating, or trigger-detection logic was implemented — the new section's own "Notes on scope" explicitly defers all of that. No files under `scripts/` or `schemas/` were touched. This task was not broadened into BRR Operating Definitions — that remains named as a separate, not-yet-written task (`pcc-brr1-004`), referenced but not drafted here. No canonical project goals, role assignments, or previously recorded verification verdicts were changed (`DECISION-026` only adds a new decision; no existing decision's own text was altered, though the `docs/BRR_POLICY.md` content it references was restructured as described above). The owner was not asked to restate anything already in canonical truth — this task was completed entirely from the worker directive, `docs/BRR_PLAN.md`, `docs/BRR_POLICY.md`, and `docs/DECISIONS.md`. No adjacent policy ambiguity was turned into a separate mini-project or a blocker for completing the stop policy.
