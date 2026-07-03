# Worker Result

### Summary

Completed task `pcc-v1-005` by removing the hardcoded operational facts from `scripts/generate-worker-directive.ps1` and sourcing the directive's "Current Truth" section entirely from canonical state. The canonical source is `project-state.json.worker_context_facts` (a new field, already present in the live `project-state.json` and recorded as `DECISION-017`, and already documented with a field definition in `docs/STATE_MODEL.md`). I added the field to `schemas/project-state.schema.json` (as a required property, matching the pattern of `active_constraints`), updated the generator to read it instead of a fixed in-script array, added a guard that refuses to draft a directive if the field is missing or empty, and added the field to `examples/sample-project-state.json` for consistency. The generator now has zero hardcoded Current Truth content.

### Files Changed

* Updated: `scripts/generate-worker-directive.ps1` (replaced the hardcoded three-fact array with `$projectState.worker_context_facts`; added a guard requiring that field to be non-empty)
* Updated: `schemas/project-state.schema.json` (added `worker_context_facts` as a required array-of-strings property)
* Updated: `examples/sample-project-state.json` (added a `worker_context_facts` array for consistency with the schema)
* Updated: `.cockpit/result/worker-result.md` (this file)

Not changed by me (already present before this task started, done directly by the owner/advisor ahead of handing off this directive): `docs/HANDOFF_PACKET_SPEC.md`'s cross-reference note, `docs/STATE_MODEL.md`'s `worker_context_facts` field definition and example JSON shape, `.cockpit/state/project-state.json`'s live `worker_context_facts` values and `DECISION-017`.

### Commands / Tests Run

All tests used `-OutputPath` to redirect generated output to scratch locations and never overwrote the live `.cockpit/handoff/worker-directive.md` (the directive this task was executed from). The missing-field guard test used a disposable scratch copy of state, never the live repo state.

1. **Regenerate from live state, redirected to scratch:**
   `pwsh -NoProfile -File scripts/generate-worker-directive.ps1 -OutputPath <scratch>/pcc-generated-directive-v005.md`
2. **Compare generated Current Truth section** against the live directive's Current Truth section (string split on `## Exact Next Action`).
3. **Missing-`worker_context_facts` guard** (scratch copy of state with `project-state.json.worker_context_facts` set to `[]`):
   `pwsh -NoProfile -File generate-worker-directive.ps1 -OutputPath out.md`
4. **Full-repo sanity check:** `pwsh -NoProfile -File scripts/validate-cockpit-state.ps1` run against the live, modified repo.
5. `git status --porcelain` after all testing to confirm only the intended files changed.

### Results

1. Exit code `0`. Output: `Drafted worker directive for task 'pcc-v1-005' at <scratch path>`.
2. The generated Current Truth section was:
   ```
   * Project Control Cockpit is a local-first AI project control board.
   * Reduce owner babysitting.
   * Keep V1 lean.
   * State updates require verifier PASS or explicit owner override.
   * Prefer local deterministic tools before model usage.
   * Avoid fake intelligence scoring and fake truth detection.
   * Worker claims are evidence, not truth.
   * Claude Code is ready and pointed at this repository workspace.
   * PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.
   ```
   This is byte-for-byte identical to the live `worker-directive.md`'s Current Truth section — the first six lines from `project_name` + `active_constraints` (unchanged), the last three now sourced from `worker_context_facts` in state instead of a hardcoded array in the script.
3. Exit code `1`. Script failed with: `project-state.json worker_context_facts is empty. Current Truth's standing worker facts must come from canonical state (DECISION-017), not a script fallback.` No output file was written.
4. `PCC state validation OK`, exit code `0` — confirms the schema/field addition did not break cross-file consistency checks on the live repo.
5. `git status --porcelain` showed only `examples/sample-project-state.json`, `schemas/project-state.schema.json`, and `scripts/generate-worker-directive.ps1` modified, plus this result file — no state files, unrelated docs, or the live directive were touched.

### Evidence

Mapping to the directive's completion criteria:

* **The directive-generation workflow no longer relies on hardcoded Current Truth facts inside the helper** — confirmed by the script diff: the `foreach ($fixed in @(...))` block with literal strings was removed and replaced with `foreach ($f in $projectState.worker_context_facts)`.
* **The canonical source for generated Current Truth content is explicit and documented** — `worker_context_facts` is defined in `docs/STATE_MODEL.md` (field definition + example JSON shape), recorded as `DECISION-017`, and now formally typed in `schemas/project-state.schema.json`.
* **`scripts/generate-worker-directive.ps1` reads that canonical source and still drafts a worker-ready directive successfully** — confirmed by Test 1/2: output is well-formed and matches the live directive exactly.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell/JSON, no model calls, same input always produces the same output.
* **The helper stays within the approved V1 scope and uses local deterministic logic** — same as above.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* `schemas/project-state.schema.json` now requires `worker_context_facts`, but nothing in the repo currently validates live JSON against these schemas at runtime (`validate-cockpit-state.ps1` is hand-rolled consistency logic, not a schema validator). The schema is accurate documentation, not an enforced gate, until a future task wires schema validation into the pipeline.
* The generator's new guard treats an empty `worker_context_facts` array as fatal. If a future project genuinely has zero standing worker-context facts to declare, the generator would need an explicit opt-out rather than silently proceeding — I judged fail-loud to be the safer default given this task's intent (no silent fallback to hardcoded values).
* I did not modify `docs/HANDOFF_PACKET_SPEC.md` or `docs/STATE_MODEL.md` further, since both already documented `worker_context_facts` and its purpose before I started this task; re-editing them risked duplicating or diverging from wording already approved.

### Unresolved Assumptions

* Assumed the field name `worker_context_facts` (already present in the live `project-state.json` and `docs/STATE_MODEL.md` before this task began) is the intended canonical name, rather than something I should independently choose — I aligned the schema and script to that existing name rather than inventing a different one.
* Assumed adding `worker_context_facts` to `examples/sample-project-state.json` counts as "docs directly related to ... canonical state" (explicitly allowed) — this file wasn't strictly required by the completion criteria, but I judged it worth keeping in sync with the schema for anyone using it as a template.
* Assumed the schema change (making `worker_context_facts` a required property) is the correct strictness level, matching how `active_constraints` is already required, rather than making it optional.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, canonical project goals and verification verdicts were not changed, and no unrelated docs were modified — `examples/sample-project-state.json` and `schemas/project-state.schema.json` are both directly related to the canonical-state source this task implements. The live `.cockpit/handoff/worker-directive.md` and `.cockpit/state/*.json` were left untouched by this task's execution (confirmed via `git status`); all directive-drafting tests were redirected to scratch output paths or run against disposable scratch copies of state.
