# Pre-Checkpoint Kernel Quality Audit

`pcc-checkpoint-001` (IDEA-014), bundled with `DECISION-074`'s required extractability audit. Read-only report; no fixes applied here by design (see `backlog/details/idea-014-pre-checkpoint-kernel-audit.md`'s explicit non-goals).

## Scope and Method

All 23 scripts under `scripts/` were read in full (2,759 lines total): `advance-cockpit-state.ps1`, `archive-held-cycle.ps1`, `backup-protected-files.ps1`, `check-autonomous-gate.ps1`, `check-schemas.ps1`, `check-stop-conditions.ps1`, `classify-routing.ps1`, `close-out-verified-task.ps1`, `codex-verify-watcher.ps1`, `doctor.ps1`, `enforce-handoff-restart-safety.ps1`, `finalize-worker-handback.ps1`, `generate-advisor-restart-brief.ps1`, `generate-worker-directive.ps1`, `log-event.ps1`, `refresh-live-handoff-artifacts.ps1`, `return-inadequate-work.ps1`, `safe-stop.ps1`, `summarize-routing-log.ps1`, `validate-cockpit-state.ps1`, `verify-dual-restart-safety.ps1`, `verify-handback-guardrails.ps1`, `verify-worker-restart-safety.ps1`.

No archived artifacts, no doc rewrites beyond this report, no speculative redesign — per `IDEA-014`'s scope guardrails. Each script was judged against six PCC-native standards (correctness, verification-friendliness, leanness, modularity/extractability, maintainability, failure clarity), and every script's inputs/outputs were checked against `DECISION-074`'s extractability rule specifically.

## Review By Standard

### 1. Correctness

The kernel behaves reliably on the workflows it claims to support. One real defect was found and fixed during a live task cycle rather than surfacing here for the first time: `doctor.ps1` (before `pcc-pathC-001`) never actually loaded `project-state.json`, silently defeating its own branch-hygiene comparison. That is now fixed and confirmed working. No other correctness defect was found across the 23 scripts read for this audit; the verdict-to-status mappings (`advance-cockpit-state.ps1`), archive-collision handling (`close-out-verified-task.ps1`/`return-inadequate-work.ps1`), and schema/consistency checks all behave as their own comments and the surrounding docs claim.

### 2. Verification-friendliness

Strong. `verification-result.json` is schema-validated (`check-schemas.ps1`); `verify-handback-guardrails.ps1` gives the verifier one deterministic pre-check path rather than requiring it to remember which scripts to run; `doctor.ps1` composes state/restart/schema checks into one advisory report. Nothing found relies on hand-wavy reasoning — every claim a script makes about repo health is backed by a concrete file read or subprocess check.

### 3. Leanness

No bloat found. Every script is single-purpose and short (median well under 150 lines); none does more than its name claims. `backup-protected-files.ps1`'s protected-file list is a small, explicit, hand-maintained set rather than an attempt to snapshot the whole repo.

### 4. Modularity / extractability

**Holds, with one universal implicit assumption worth naming explicitly.** Every script communicates only through: (a) reading/writing `.cockpit/state/*.json`, `.cockpit/result/*`, `.cockpit/handoff/*`, `.cockpit/logs/*.jsonl`; (b) reading `schemas/*.json` for validation; (c) composing other scripts exclusively as subprocesses (`& pwsh -NoProfile -File "scripts/X.ps1"`), checking `$LASTEXITCODE` and parsing stdout — never dot-sourcing, never sharing in-process variables or state across script boundaries. No script reaches into another script's internals. This is the real thing the CCB audit (`DECISION-074`) found CCB's own modularity claim failed to be, and it holds here.

The one shared, undocumented assumption every script relies on: **each script assumes it is invoked with the target repo root as the current working directory** (all paths are relative: `.cockpit/state/task-state.json`, `scripts/doctor.ps1`, etc.). This is not itself a violation of the file-bridge contract — cwd-as-repo-root is a reasonable, minimal precondition, and `codex-verify-watcher.ps1` already handles it correctly via `Push-Location $RepoPath`/`Pop-Location`. But it is not stated in any individual script's own header comment, so "run against a different repo given only its documented inputs" (`DECISION-074`'s own phrasing) is true only if the caller also knows to `cd` into that repo first — a fact nowhere written down per-script. Recorded below as a maintainability smell, not a real risk, since it is a cheap documentation gap rather than a structural coupling problem.

### 5. Maintainability

The standout item is the `close-out-verified-task.ps1` / `return-inadequate-work.ps1` near-duplication (detailed under Real risks below) — a future human or verifier can understand either script individually without difficulty, but modifying the shared sequence correctly requires knowing it lives in two places, which is not obvious from either file alone. Comments throughout the kernel are unusually good: nearly every script explains *why*, cites the task/decision that shaped it, and discloses known fragilities candidly (e.g. `summarize-routing-log.ps1`'s own comments naming its substring-matching limits). This is a real strength that offsets most of the maintainability smells below.

### 6. Failure clarity

Consistently good. The shared `Fail` helper pattern writes to stderr and exits non-zero without swallowing errors; scripts that are deliberately always-exit-0 (`doctor.ps1`, `safe-stop.ps1`, `check-stop-conditions.ps1`) say so explicitly in their own header comments, so a reader never has to guess whether a given exit code means something. No script found buries a real failure inside a generic catch-and-continue.

## Findings

(Sorted into the three required buckets; each finding traces back to one or more of the six standards above.)

### Real risks

1. **`close-out-verified-task.ps1` and `return-inadequate-work.ps1` are near-duplicates, and the duplication has already caused a real bug once.** Both scripts implement the identical four-step sequence (archive directive/result/verification with attempt-suffix collision handling → call `advance-cockpit-state.ps1` → run `doctor.ps1` and check for `[ISSUE]` → log the event → optional `-Commit`/push), differing only in which verdicts they accept and their log/commit message wording. The attempt-suffix archive-collision fix (documented identically in both files' comments, dated the same day) had to be applied twice by hand because the logic lives in two places instead of one. This is exactly the kind of babysitting-inducing pattern `PROJECT_CHARTER.md`'s Non-Negotiable Rule exists to catch: the next bug fix to this sequence requires remembering to apply it in both files, and nothing currently enforces that the two stay in sync. **Recommendation if the owner chooses to act:** extract the shared four-step sequence into one script parameterized by verdict-acceptance predicate and message templates, called by two thin wrappers — this stays inside the extractability rule (still one bounded unit, still communicating only via the same file-bridge) while removing the duplicate-fix risk. Not fixed here; this is a finding, not a task.

### Maintainability smells

1. **The cwd-as-repo-root assumption is universal but undocumented per-script** (see Extractability Audit above). Low cost, easy fix if ever addressed: a one-line comment per script, or a single shared convention note in `docs/STATE_MODEL.md` or `docs/ARCHITECTURE.md`.
2. **Cross-process contracts rely on string/substring matching of another script's stdout**, not a structured format. Examples: `doctor.ps1`'s callers (`close-out-verified-task.ps1`, `return-inadequate-work.ps1`, `finalize-worker-handback.ps1`, `verify-handback-guardrails.ps1`) all detect failure by grepping output for the literal substring `"[ISSUE]"`; `check-autonomous-gate.ps1` greps `check-stop-conditions.ps1`'s output for `"STOP recommended"` and re-parses bullet lines with a regex; `summarize-routing-log.ps1` matches fixed substrings inside `stop_condition_fired` event details (disclosed candidly in that script's own comments as a known fragility). None of this is hidden — every instance is either self-evident from the code or explicitly commented — but a future wording change to any producer's output silently breaks its consumers with no schema or type system to catch the drift. This is the natural cost of composing scripts via stdout rather than structured file exchange for these specific signals (as opposed to the `.cockpit/*.json` files, which are schema-validated). Not a defect today; a risk if any of these output strings are ever "cleaned up" without checking who parses them.
3. **`verify-handback-guardrails.ps1` and `doctor.ps1` both directly invoke `validate-cockpit-state.ps1` and `check-schemas.ps1`, and `verify-handback-guardrails.ps1` also invokes `doctor.ps1` itself**, which invokes those same two checks again. Each guardrail run therefore executes `validate-cockpit-state.ps1` and `check-schemas.ps1` twice. Both are cheap and idempotent, so this is not a performance concern, but it reads as accidental redundancy rather than deliberate double-confirmation, and a future reader might reasonably wonder whether it's a bug.
4. **The per-script `Read-Json`/`Read-JsonSafe`/`Fail` helper functions are copy-pasted verbatim across roughly 15 of the 23 scripts.** This looks like an obvious DRY violation at first glance, but it is very likely the *correct* choice given `DECISION-074`: extracting these into a shared dot-sourced module would create exactly the kind of shared, hidden coupling the extractability rule forbids (a script's behavior would then depend on an external file being present and unchanged, not just its own documented `.cockpit/` inputs). This is recorded here explicitly so a future reviewer does not "clean up" this duplication under standard refactoring instincts and accidentally violate `DECISION-077`/`DECISION-074` in the process. Recommend leaving as-is; noted as a smell only in the sense that it looks wrong without this context.

### Optional polish

1. `doctor.ps1`'s "Handoff gate (last known)" check and several other advisory findings use slightly inconsistent phrasing conventions (e.g., some sentences end with a period inside the detail string, some don't); purely cosmetic.
2. A few scripts (`safe-stop.ps1`, `check-stop-conditions.ps1`) duplicate a small `Strip-AnsiAndCollapse`/`Strip-AnsiAndLastLine` ANSI-stripping helper with near-identical logic to `doctor.ps1`'s version. Same reasoning as the `Read-Json` duplication above applies — likely correct to leave alone for extractability, flagged only for completeness.
3. `backup-protected-files.ps1`'s protected-file list is hand-maintained (the two state files, live handoff artifacts, latest evidence/verification pair, plus all of `scripts/*.ps1` dynamically) — fine as-is; no action suggested.

## Bottom-Line Verdict

**Kernel is solid enough if one concrete issue is fixed first** (per `IDEA-014`'s second success shape) — though the owner may reasonably choose to accept the risk as-is and freeze anyway, since the one real risk found is a maintainability/correctness-duplication concern, not an active defect or an extractability violation:

- The extractability rule (`DECISION-074`) holds across all 23 scripts, with one cheap documentation gap (cwd-as-repo-root, unstated per-script).
- The one real risk (`close-out-verified-task.ps1` / `return-inadequate-work.ps1` duplication) is proven, not hypothetical — the same fix already had to be applied twice by hand once. It has not caused an accepted-in-error PASS or any data loss to date, but it is the one place a future bug fix could easily be applied to only one twin and silently regress the other.
- No finding here rises to "not yet checkpoint-ready" — nothing found threatens trust, correctness, or the file-bridge contract itself.

This report does not fix the duplication finding; per this task's own bounded scope, that is left for a separate, explicitly-scoped future task if the owner chooses to pursue it.
