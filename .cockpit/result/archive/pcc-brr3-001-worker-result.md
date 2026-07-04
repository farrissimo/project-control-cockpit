# Worker Result

### Summary

Added a "Verification Depth Policy" section to `docs/BRR_POLICY.md` (BRR Phase 3 deliverable 1, `docs/BRR_PLAN.md`), defining three rigor levels (`light`/`normal`/`strict`) and a concrete Task Safety Class × task type mapping table that determines which depth applies. Recorded `DECISION-046` in `docs/DECISIONS.md`. No runtime scripts, schemas, or existing verdicts/classes were touched.

### Files Changed

* Updated: `docs/BRR_POLICY.md` — new "Verification Depth Policy" section appended after "Acceptance Boundary Rules."
* Updated: `docs/DECISIONS.md` — added `DECISION-046`.
* Updated: `.cockpit/state/task-state.json` — task drafted and fielded (owner-directed selection; `promotion_basis` null).
* Updated: `.cockpit/state/project-state.json` — `current_task_id` updated to `pcc-brr3-001`.

### Commands / Tests Run

* `pwsh -File scripts/validate-cockpit-state.ps1` — before drafting the directive.
* `pwsh -File scripts/check-schemas.ps1` — before drafting the directive.
* `pwsh -File scripts/generate-worker-directive.ps1` — generated `.cockpit/handoff/worker-directive.md`.

Note: an initial attempt used `powershell -File` (Windows PowerShell 5.1), which lacks `Test-Json` and failed `check-schemas.ps1` with a cmdlet-not-found error — a shell/version issue, not a repo defect. Re-run under `pwsh` (PowerShell 7+) passed cleanly.

### Results

* State validation: OK.
* Schema validation (`pwsh`): all three files PASS.
* Worker directive generated without error.

### Evidence

* `docs/BRR_POLICY.md` new section: three levels defined (`light`, `normal`, `strict`) with concrete distinguishing criteria; class × type mapping table; explicit note that a truth-surface-affecting task cannot be Class A (ties back to Owner Review Matrix row 7 / Task Safety Classification, so no contradiction); explicit reconciliation against Acceptance Boundary Rules; this task's own classification (Class B, truth-surface-affecting → `strict`) stated and applied to its own verification.
* `docs/DECISIONS.md` `DECISION-046`: records the policy addition, the owner-directed (non-self-promotion) task-selection reasoning, and the `DECISION-036` push-authorization lapse finding (time-boxed to "the remainder of BRR Phase 2," now expired in Phase 3 — commit locally per `DECISION-020`, but remote push requires fresh explicit owner approval this cycle).

### Known Risks

* This is a Class B, truth-surface-affecting policy addition and, by its own new table, requires `strict` verification depth — applied here as self-verification under the `DECISION-033`/`DECISION-036` fallback (Codex still unavailable), not independent second-party review. Secondary (GPT) review is recommended per the section's own text.
* The policy is definitional only; nothing currently enforces applying the correct depth in scripts — that is future fielding work, matching the pattern of every earlier BRR policy section before it was fielded.
* Reconciliation against existing policy is a single drafting pass; a future task fielding this policy into scripts is where any latent inconsistency would most likely surface.

### Unresolved Assumptions

* Assumed the three task-type categories (deterministic/mechanical, judgment-heavy/prose, truth-surface/governance-affecting) cover realistic BRR task shapes; if a future task doesn't cleanly fit one, that is evidence the taxonomy needs revision rather than a reason to force-fit it here.
* Left the doc's top-of-file "Canonical status" banner untouched, consistent with the fact it was never updated for BRR Phase 2's additions either.
* This cycle is self-verified under the `DECISION-033`/`DECISION-036` fallback, same disclosure as all prior autonomy cycles.

### Out-of-Scope Confirmation

Confirmed: no scripts, schemas, or `verification-result.json` shape were modified. BRR Phase 3 was not marked complete and `current_phase` was not advanced. Nothing outside the allowed scope was touched.
