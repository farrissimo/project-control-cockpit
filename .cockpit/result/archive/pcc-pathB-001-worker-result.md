# Worker Result — pcc-pathB-001

**Task:** Behavior Controls: Communication Preferences Stored And Surfaced In Worker Directive
**Worker:** Claude Code
**Task Safety Class:** C (owner-approved before execution — edits a schema/truth surface)

## Files created or changed

- **Edited** `schemas/project-state.schema.json` — added `communication_prefs` (additive: new object property with `additionalProperties:false`, enum-constrained `tone`/`language_level`/`chattiness` + four boolean toggles; added to top-level `required`).
- **Edited** `.cockpit/state/project-state.json` — added the `communication_prefs` values (seeded defaults) and pointed `current_task_id` at `pcc-pathB-001`.
- **Edited** `scripts/generate-worker-directive.ps1` — renders a guarded "Communication Defaults" section from `communication_prefs`.
- **Edited** `docs/DECISIONS.md` — recorded `DECISION-076`.
- **Edited** `README.md` — added a "Communication Defaults" note.
- No `backlog/IDEAS.md` edit: checked; no existing IDEA entry corresponds to §7.16, so none needed a delivered-status note.

## Summary of changes

Fields the original scope's Tone/Chattiness/Language Controls (§7.16), which `DECISION-009` had recorded as a principle but never implemented. The owner's standing communication preferences now live in canonical state (`project-state.json` → `communication_prefs`, schema-required) and are auto-rendered into the deterministically generated worker directive. A fresh worker session therefore applies the owner's tone/language/behavior defaults without the owner restating them — the repeated correction §7.16 exists to remove. Consistent with `DECISION-017` (worker-facing standing truth lives in state, not hardcoded) and `DECISION-018` (restart-safe fresh sessions).

Seeded defaults (owner-chosen, trivially changeable in state): tone `direct`, language_level `mixed`, chattiness `concise`, `no_cheerleading`/`concise_by_default`/`explicit_uncertainty`/`separate_facts_from_inference` all `true`.

## Commands run

Functional tests (not read-through only):

1. `pwsh -NoProfile -File scripts/check-schemas.ps1`
2. `pwsh -NoProfile -File scripts/generate-worker-directive.ps1` + inspect the rendered section
3. `pwsh -NoProfile -File scripts/validate-cockpit-state.ps1`
4. Absent-field guard: backup `project-state.json` → remove `communication_prefs` → run generator → restore → re-run.

## Command/test results

| Test | Expected | Actual |
|---|---|---|
| check-schemas | project-state validates with new required field | PASS (all three files) |
| generate-worker-directive | directive contains Communication Defaults with seeded values | Section present: tone direct, language mixed, chattiness concise, all toggles True |
| validate-cockpit-state | consistent | `PCC state validation OK` |
| guard: field absent | generator exits 0, omits section | exit 0, section correctly OMITTED |
| guard: restored | section back + schema PASS | section restored, schema PASS |

## Known risks

- Preferences are advisory guidance rendered into the directive; nothing enforces that a worker actually honors them. This is intentional (§7.16 controls are guidance, not a gate) and consistent with `DECISION-008` (no fake enforcement of behavior).
- `communication_prefs` is now schema-required: any live `project-state.json` must carry it. The live file does; older backups are not schema-validated (`check-schemas.ps1` only validates the three live canonical files), so this does not break them.

## Unresolved assumptions

- Seeded default values reflect the owner's documented preferences; the owner may adjust any of them directly in `project-state.json` (e.g. `language_level` `plain` vs `mixed`). No code change is needed to change a preference — that is the point of storing them in state.

## Confirmation that forbidden scope was not touched

- Only `scripts/generate-worker-directive.ps1` was modified among scripts; no other script changed.
- Only the additive `communication_prefs` change was made to `project-state.schema.json`; no other schema touched.
- No new log event type; no write to `routing-log.jsonl`.
- `communication_prefs` gates/blocks nothing — it is worker-facing guidance only.
- No verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule changed.
- No manual `codex exec` invoked — verification is left to the live PCC-CodexVerifyWatcher.
