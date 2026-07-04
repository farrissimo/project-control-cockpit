# Worker Result

### Summary

Completed task `pcc-brr1-002` ("BRR Policy: Task Safety Classification") by extending `docs/BRR_POLICY.md` with a "Task Safety Classification" section defining the four classes named in `docs/BRR_PLAN.md` Phase 1 (A: safe unattended, B: safe to execute but review before acceptance, C: owner approval required before execution, D: blocked). The classification is tied directly to the Owner Review Matrix added by `pcc-brr1-001` via an explicit row-to-class mapping, rather than being a parallel, independently-derived rule set. Propagated to `docs/DECISIONS.md` (new `DECISION-025`); reviewed `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, and `README.md` and found them not stale (see Evidence).

No runtime scripts, schemas, or verification mechanics were touched. This is docs-only policy work extending `docs/BRR_POLICY.md`, per the directive's forbidden scope.

### Files Changed

* Updated: `docs/BRR_POLICY.md` — added the "Task Safety Classification" section (class table + "Relationship to the Owner Review Matrix" + its own "Notes on scope"), updated the header note to say the doc now covers both `pcc-brr1-001` and `pcc-brr1-002`, and fixed row 11's stale "not yet written" cross-reference to point at the new section instead.
* Updated: `docs/DECISIONS.md` (added `DECISION-025`)
* Updated: `.cockpit/state/task-state.json` (`task_status`: `ready_for_worker` → `returned_for_verification`; `next_action` updated to point at this evidence and hand off to the verifier; `updated_at` bumped)
* Updated: `.cockpit/state/project-state.json` (`next_expected_action` updated to match; `updated_at` bumped)

### Commands / Tests Run

* `powershell -ExecutionPolicy Bypass -File .\scripts\validate-cockpit-state.ps1` — run twice: once before state-file edits (baseline OK), once after updating `task-state.json` and `project-state.json` (confirms no drift/inconsistency introduced).
* No other scripts run; this task involves no code, schema, or runtime changes to test.
* Read `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, and `README.md` in full to check for staleness before deciding not to edit them (see Evidence for the specific reasoning per file).

### Results

* Both `validate-cockpit-state.ps1` runs returned `PCC state validation OK`.
* `docs/BRR_POLICY.md` was read back in full after editing to confirm: the class table's four rows are internally consistent with each other, the "Relationship to the Owner Review Matrix" section's row-to-class mapping covers every matrix row (1–11) exactly once, and no leftover stale cross-references remained (caught and fixed one: row 11 previously said Task Safety Classification was "not yet written," which was true when `pcc-brr1-001` was completed but is no longer true).

### Evidence

Mapping to the directive's completion criteria:

* **Repo gains canonical policy text defining Task Safety Classification with the four named classes** — `docs/BRR_POLICY.md`'s "Task Safety Classification" section, a table with Class, Meaning, Execution, Acceptance, and "When it applies" columns for A/B/C/D.
* **Each class concrete enough to distinguish safe-unattended vs. execute-but-review vs. owner-approval-required vs. blocked** — the table separates the "Execution" question from the "Acceptance" question per class (e.g. Class B permits unattended execution but forbids self-acceptance), which is the actual distinction the directive asks for, not just a one-line label per class.
* **Classification explicitly builds on and does not contradict the Owner Review Matrix; relationship to Class C/D stated, not implicit** — the "Relationship to the Owner Review Matrix" subsection states the mapping directly: matrix rows 1–8 (all "before execution" rows) are Class C by definition; row 9 (repeated failure) is Class D; rows 10–11 (both "before acceptance" rows) explain why a task is Class B rather than Class A. Every one of the 11 matrix rows is accounted for exactly once — verified by re-reading both sections side by side after writing.
* **Stays practical and docs-only** — no new state machine, no `task-state.json` schema change, no automatic gating logic. The section's own "Notes on scope" explicitly disclaims Phase 2 fielding (recording a class in live state, checking it automatically) as future work.
* **Truth-surface propagation handled honestly** — `docs/DECISIONS.md` got a new decision (`DECISION-025`) since this is new project behavior/governance content per `docs/REPO_GOVERNANCE.md`'s Change Propagation Rule. `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, and `README.md` were each reviewed and found *not* stale: `docs/BRR_PLAN.md`'s own Phase 1 deliverable list already just names "Task Safety Classification" generically (no specific class definitions to go stale); `docs/REPO_GOVERNANCE.md` already lists `docs/BRR_POLICY.md` as a canonical doc (added during `pcc-brr1-001`) and doesn't enumerate its contents; `docs/STATE_MODEL.md` defines no task-class field today (that's Phase 2), so nothing there references classification yet; `README.md`'s doc-index entry for `docs/BRR_POLICY.md` already reads "Owner Review Matrix and successors," which already covers this addition without needing a rewrite. This is a deliberate "update only what's actually stale" call, not an omission — flagging it for the verifier per the directive's own propagation-honesty criterion.
* **Evidence returned in required format, with independent-review call-out** — this document; see Unresolved Assumptions below.

### Known Risks

* Class B's "When it applies" description ("policy/prose content, verification-model changes") is itself illustrative, not exhaustive — like the Owner Review Matrix's row 11, the boundary of what counts as "judgment-heavy rather than mechanically checkable" isn't fully closed here. This is disclosed in the classification's own default rule ("a task that matches none of the matrix's rows defaults to Class A, unless something else... clearly makes self-acceptance unsafe, in which case it is Class B") rather than hidden, but it means Class A/B boundary calls for genuinely novel task types will still require judgment until more classification precedent accumulates.
* `DECISION-022` recommends independent secondary review for BRR Phase 1 tasks generally, and this task is exactly that case again: whether the four classes are described "concretely enough" and whether the row-to-class mapping is correct is a judgment call on completeness, not something a script can confirm.
* This classification currently has no live effect (correctly, since Phase 2 fielding doesn't exist yet) — so nothing in this task can be verified by running it against a real task the way a code change could be tested. Verification here is necessarily a read-and-judge exercise, same as `pcc-brr1-001`.

### Unresolved Assumptions

* Assumed the "Execution" / "Acceptance" two-column split is the right way to express class meaning (rather than one combined description per class) — the directive's own completion criteria distinguish "safe unattended" from "review before acceptance" from "owner approval before execution" from "blocked," which maps naturally onto two independent yes/no questions rather than four mutually exclusive one-dimensional states. Flagging this framing choice specifically for verifier review, since it's the main structural decision in this task.
* Assumed Class C and Class D needed an explicit distinguishing note (Class C is unblocked by owner approval; Class D is not, and needs the task/evidence/approach itself to change) rather than leaving "owner approval required" and "blocked" as self-evidently different — the directive's own matrix already treats them as separate stop points (row groups 1–8 vs. row 9), so I judged the distinction was worth stating rather than assumed obvious, but this is a judgment call the verifier should confirm reads clearly.
* Assumed no update was needed to `docs/BRR_PLAN.md`, `docs/REPO_GOVERNANCE.md`, `docs/STATE_MODEL.md`, or `README.md` beyond what already exists (see Evidence's propagation paragraph) — recommend the verifier specifically re-check this "nothing to update" call, since it's the kind of judgment where silently skipping a file that actually needed a touch would be an easy miss to make and hard to notice later.
* Recommend independent (Codex) review specifically on: (a) whether the four classes as described are concrete enough per the directive's own bar, (b) whether the row-to-class mapping in "Relationship to the Owner Review Matrix" is complete and correct (all 11 rows, no gaps, no double-mapping), and (c) whether the Execution/Acceptance two-column framing is the right structural choice versus some other framing the owner had in mind.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No Phase 2 behavior, runtime enforcement, automatic gating, or task-class execution logic was implemented — the new section's own "Notes on scope" explicitly defers all of that. No files under `scripts/` or `schemas/` were touched. This task was not broadened into Stop-Instead-of-Guess Policy or BRR Operating Definitions — those remain named as separate, not-yet-written tasks (`pcc-brr1-003`, `pcc-brr1-004`), referenced but not drafted here. No canonical project goals, role assignments, or previously recorded verification verdicts were changed (`DECISION-025` only adds a new decision; no existing decision was altered). The owner was not asked to restate anything already in canonical truth — this task was completed entirely from the worker directive, `docs/BRR_PLAN.md`, `docs/BRR_POLICY.md`, and `docs/DECISIONS.md`. No adjacent policy ambiguity was turned into a separate mini-project or a blocker for completing the classification.
