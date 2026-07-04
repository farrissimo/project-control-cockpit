# Worker Result

### Summary

Completed task `pcc-brr2-008` ("BRR Execution: Safe Next-Task Drafting Rules") by recording, in `docs/BRR_POLICY.md`, the canonical rule set that operationalizes `DECISION-038`'s principle — owner approval is for direction changes, not routine continuation inside an already-approved lane. The rules define: what counts as an already-approved lane (owner-approved phase-plan deliverables and owner-ranked backlog priority, explicitly excluding unreviewed ideas); an eight-part all-must-be-true gate for auto-promoting the next task without per-task approval; a hard-stop rule that any fork trips the Owner-Decision Capture Flow rather than PCC choosing for itself; and an explicit statement that these are drafting/promotion rules only, with unattended execution gated behind Phase 2 items 4-5 per `DECISION-038`'s safe-sequencing clause.

To make each auto-promotion falsifiable rather than trust-based, added an optional/nullable `promotion_basis` field (lane / priority_ref / justification) to the task schema and both handoff generators. It is `null` for owner-drafted tasks — including this one, which the owner directed and I drafted as advisor under the current fallback.

### Files Changed

* Updated: `docs/BRR_POLICY.md` — new "Safe Next-Task Drafting Rules" section; also fixed a stale end-of-doc line that still said Phase 2 was "not yet started."
* Updated: `schemas/task-state.schema.json` — added `promotion_basis` (nullable object; `lane`/`priority_ref`/`justification` all required when non-null; `additionalProperties: false`).
* Updated: `.cockpit/state/task-state.json` — added `"promotion_basis": null`.
* Updated: `scripts/generate-worker-directive.ps1`, `scripts/generate-advisor-restart-brief.ps1` — render an "Auto-Promotion Basis" section when `promotion_basis` is populated; omitted otherwise.
* Updated: `docs/STATE_MODEL.md` — added the field to the Task State example and a full field definition.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — added the section to the template and the generator descriptions.
* Updated: `docs/REPO_GOVERNANCE.md` — new Task Process step 0 (who selects a task: owner-directed default vs. PCC self-promotion under the gate), and step 7 now covers `promotion_basis`.
* Updated: `README.md` — refreshed the Phase 2 status to include `pcc-brr2-008` and the auto-promotion principle.
* Updated: `docs/DECISIONS.md` — added `DECISION-039` (the implementing-rules record; `DECISION-038` remains the governing direction decision).

### Commands / Tests Run

1. **Null case (live repo):** regenerated both artifacts with `promotion_basis: null` and grepped for the section — confirmed absent.
2. **Populated case (scratch):** set a realistic `promotion_basis`, ran `check-schemas.ps1` (pass), regenerated both artifacts, confirmed the "Auto-Promotion Basis" section renders correctly.
3. **Malformed case (scratch) — re-tested after a false negative:** my first attempt to test a missing-`justification` object appeared to pass, which would have meant the schema wasn't enforcing the nested shape. I re-tested by writing the malformed JSON directly to disk rather than mutating an in-memory object; that correctly `[FAIL]`ed with `Required properties ["justification"] are not present at '/promotion_basis'`. The first result was a flawed test method (in-memory PSObject removal didn't persist), not a schema defect. Disclosed here because I nearly accepted a false pass.
4. `git status --porcelain` before/after scratch work — live repo untouched.
5. Live `check-schemas.ps1` + `validate-cockpit-state.ps1` after all edits — clean.

### Results

1. Section correctly absent in both artifacts (grep count 0).
2. `[PASS]` x3; "Auto-Promotion Basis" section rendered with lane, priority/plan reference, and justification.
3. Second (correct) test: `[FAIL]` with the specific missing-property error, exit 1 — schema enforces the full nested shape.
4. Clean both times.
5. `[PASS]` x3; `PCC state validation OK`.

### Evidence

Mapping to completion criteria:

* **"Approved lane" defined concretely, grounded in existing repo truth** — the rules cite owner-approved phase-plan deliverables (`docs/BRR_PLAN.md`, `DECISION-022`/`DECISION-028`) and owner-ranked backlog priority (`backlog/IDEAS.md`), and explicitly exclude unreviewed ideas.
* **All-must-be-true gate, tied to existing policy not duplicating it** — the eight conditions reference the Owner Review Matrix and Stop-Instead-of-Guess Policy rather than restating them; condition 7 is "no Owner Review Matrix before-execution case applies."
* **Falsifiable justification, and where it's recorded** — `promotion_basis` field, schema-enforced, rendered for the reviewer, archived with the task; demonstrated in Result 2-3.
* **Fork trips the capture flow** — stated explicitly, mapped to Owner Review Matrix row 3 / `owner_decision_request` (`DECISION-037`).
* **Drafting-only; unattended run gated behind items 4-5** — stated in the "What these rules do not yet enable" subsection and in the task/forbidden scope; nothing here auto-runs anything.
* **Truth-surface propagation honest** — `docs/BRR_POLICY.md`, `schemas/`, `docs/STATE_MODEL.md`, `docs/HANDOFF_PACKET_SPEC.md`, `docs/REPO_GOVERNANCE.md`, `README.md`, `docs/DECISIONS.md` all updated; `docs/BRR_PLAN.md` reviewed and left unchanged (it carries no per-item completion annotations, consistent with prior cycles).
* **Local validation healthy** — Result 5.

### Known Risks

* The auto-promotion gate is a *rule set*, not yet enforced by any script — nothing today automatically checks the eight conditions or blocks a bad self-promotion. That enforcement is Phase 2 item 4's job (Automatic Stop Triggers). Until then, the rules govern PCC's own judgment and the `promotion_basis` record makes a bad call auditable after the fact, but there is no automatic gate. This is intentional per `DECISION-038`'s sequencing, but worth stating plainly: this task makes auto-promotion *legible and bounded*, not yet *mechanically enforced*.
* `promotion_basis` is populated by whoever drafts the task; nothing cross-checks that the stated lane/justification is actually true (e.g. that the cited phase-plan item really is next and unbuilt). The verifier is the backstop for that, by design — the field exists precisely so the verifier *can* check it — but the field's mere presence is not proof the justification is sound.

### Unresolved Assumptions

* Assumed the eight gate conditions (drawn directly from the owner's stated list plus the plan's item-3 bullets) are the right set; they map 1:1 to what `DECISION-038` recorded, so no invention beyond the decision's own wording.
* Assumed recording the rules in `docs/BRR_POLICY.md` (not a new doc) is correct — it is the established home for BRR policy, per the New Canonical Doc Process (an existing canonical doc covers it).
* This cycle is self-verified under the `DECISION-033`/`DECISION-036` fallback; the verification pass follows immediately, with the standard disclosure.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work. No automatic stop-trigger detection (item 4) or acceptance-boundary enforcement (item 5) was built; no unattended execution was switched on or any task auto-run. No verification verdicts, task safety classes, or BRR Phase 1 policy meaning were changed — the Owner Review Matrix and Stop-Instead-of-Guess Policy are referenced, not rewritten. No existing stop condition was weakened; auto-promotion is additive within already-approved lanes only. No archived history rewritten. The owner was not asked to restate any canonical policy.
