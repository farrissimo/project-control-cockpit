# Worker Result

### Summary

Completed task `pcc-v1-008` by creating `scripts/verify-dual-restart-safety.ps1`, a local deterministic PowerShell check that proves both a fresh advisor/verifier session and a fresh Claude worker session can resume from canonical repo truth and complete one PCC cycle without owner re-briefing. It checks the advisor side (the live `.cockpit/handoff/advisor-restart-brief.md` is structurally complete and matches what `generate-advisor-restart-brief.ps1` produces from canonical state right now) and reuses `scripts/verify-worker-restart-safety.ps1` unchanged for the worker side, rather than duplicating that logic. Running it against the live repo surfaced a genuine finding: the advisor restart brief had not been regenerated since `pcc-v1-006` and was actually stale relative to canonical state (state had since moved through `pcc-v1-007` to `pcc-v1-008`). I regenerated it (an in-scope runtime-file update, not a new artifact) so the dual-restart proof could demonstrate an honest pass rather than a false one. Added a short cross-reference in `docs/HANDOFF_PACKET_SPEC.md`.

### Files Changed

* Created: `scripts/verify-dual-restart-safety.ps1`
* Updated: `.cockpit/handoff/advisor-restart-brief.md` (regenerated from current canonical state via the existing `scripts/generate-advisor-restart-brief.ps1`; it was stale, still reflecting `pcc-v1-006`)
* Updated: `docs/HANDOFF_PACKET_SPEC.md` (added a short paragraph after the `generate-advisor-restart-brief.ps1` cross-reference, describing the new dual-restart check)
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

The check is read-only against the live directive and brief (it regenerates comparison copies to OS-temp scratch paths and deletes them in `finally` blocks). Guard-condition tests used disposable scratch copies of state/artifacts, never the live repo files, except where noted.

1. **First run against the live repo (expected pass, actually failed):**
   `pwsh -NoProfile -File scripts/verify-dual-restart-safety.ps1`
2. **Root-caused the failure** by regenerating a debug copy and diffing line-by-line against the live brief (`Compare-Object` after normalizing the timestamp line) — this showed the live brief still described `pcc-v1-006`/`pcc-v1-005` verification data, while canonical state had already moved to `pcc-v1-008`/`pcc-v1-007`. Confirmed this was genuine staleness, not a bug in the comparison logic.
3. **Design fix applied during development, before the staleness finding:** the brief embeds a live `Generated <timestamp>` line that changes on every regeneration; an unmodified byte-for-byte diff would fail on that line alone almost every time. Added a `Normalize-GeneratedTimestamp` helper that strips the timestamp token from both sides before comparing, so the diff reflects actual content drift, not regeneration time.
4. **Fixed the real staleness** by running `pwsh -NoProfile -File scripts/generate-advisor-restart-brief.ps1` directly (no `-OutputPath` override, writing to the live path) to refresh the brief from current state.
5. **Re-run against the live repo (expected and actual pass):**
   `pwsh -NoProfile -File scripts/verify-dual-restart-safety.ps1`
6. **Sanity-pass test in an isolated scratch copy** of state + both artifacts + scripts — first attempt failed due to a fixture gap (I hadn't copied `.cockpit/result/worker-result.md`, which the brief generator conditionally references), then passed once the fixture was corrected.
7. **Staleness test** (scratch copy, brief hand-edited so all `pcc-v1-008` references became `pcc-v1-999-stale`, still structurally complete): confirms the advisor-side freshness check fires independently.
8. **Worker-side propagation test** (scratch copy, `worker-directive.md` truncated to drop `## Blocked / Failure Instructions`): confirms a failure from the reused `verify-worker-restart-safety.ps1` script propagates through the composed check with the underlying detail visible.
9. `git status --porcelain` after all testing, to confirm only the intended files changed.

### Results

1. Exit code `1`. Failed with: `Dual-restart proof FAILED (advisor side): .cockpit/handoff/advisor-restart-brief.md does not match what generate-advisor-restart-brief.ps1 currently produces from canonical state. A fresh advisor session would read stale content.`
2. `Compare-Object` confirmed the live brief's "Active Task"/"Last Verified" sections referenced `pcc-v1-006`/`pcc-v1-005`, while a fresh regeneration correctly reflected `pcc-v1-008`/`pcc-v1-007` — a genuine drift, not a false positive.
3. Confirmed via direct diff that after normalizing the timestamp line, content still differed for the reason in step 2 (i.e., normalization alone did not mask the real staleness — it only removed the spurious timestamp-only noise).
4. Exit code `0`. Output: `Drafted advisor restart brief for task 'pcc-v1-008' at .cockpit/handoff/advisor-restart-brief.md`.
5. Exit code `0`. Output ended with: `Dual-restart proof OK: a fresh advisor session and a fresh worker session can both resume from canonical repo truth and complete one PCC cycle without owner re-briefing.`
6. First attempt: exit code `1`, spurious failure traced to the missing `worker-result.md` fixture (the brief generator's "Read First" list conditionally includes that path only if the file exists, so a scratch copy missing it will never byte-match a live brief generated when it did exist). After copying the fixture, exit code `0`, matching the live-repo pass.
7. Exit code `1`. Failed with: `Dual-restart proof FAILED (advisor side): ... does not match what generate-advisor-restart-brief.ps1 currently produces from canonical state (ignoring the generation timestamp). A fresh advisor session would read stale content.`
8. Exit code `1`. Output showed the underlying `verify-worker-restart-safety.ps1` failure (`... is missing required section(s): ## Blocked / Failure Instructions`) followed by the composed script's own failure message (`Dual-restart proof FAILED (worker side): ...`), confirming detail is preserved through composition rather than swallowed.
9. `git status --porcelain` showed only `scripts/verify-dual-restart-safety.ps1` (new), `.cockpit/handoff/advisor-restart-brief.md` (modified — the legitimate refresh), `docs/HANDOFF_PACKET_SPEC.md` (modified), plus this result file.

### Evidence

Mapping to the directive's completion criteria:

* **A bounded dual-restart proof artifact or helper exists** — `scripts/verify-dual-restart-safety.ps1` created this cycle.
* **The proof uses the generated advisor restart brief, the generated worker directive, and canonical repo truth as its primary inputs** — confirmed by the script body: it reads `.cockpit/handoff/advisor-restart-brief.md`, regenerates via `generate-advisor-restart-brief.ps1`, and delegates to `verify-worker-restart-safety.ps1` for the worker directive side.
* **The result clearly shows how both a fresh advisor session and a fresh worker session can resume cold and complete one PCC cycle without owner re-briefing** — confirmed by the final passing run (Result 5), which only succeeds when both the advisor brief and the worker directive are simultaneously complete and non-stale.
* **The change stays within the approved V1 scope and preserves local deterministic behavior** — pure PowerShell, no model calls, no network access.
* **The helper stays within the approved V1 scope and uses local deterministic logic** — same as above.
* **Claude returns evidence in `.cockpit/result/worker-result.md` using the required format** — this document.

### Known Risks

* This proof demonstrates restart safety at the moment it's run, not continuously. If `worker-directive.md` or `advisor-restart-brief.md` is hand-edited after a passing run, the proof would need to be re-run to catch it — nothing currently triggers it automatically before every fresh session.
* The regenerated `.cockpit/handoff/advisor-restart-brief.md` will itself go stale again the next time state advances (exactly as it did between `pcc-v1-006` and this task). This check makes staleness detectable and fixable, but does not prevent it from recurring — regenerating the brief is still a manual step someone has to remember to run.
* `Normalize-GeneratedTimestamp`'s regex (`Generated \S+ from canonical repo truth`) is coupled to the exact wording `generate-advisor-restart-brief.ps1` uses for its timestamp line. If that wording changes, this normalization would silently stop matching and the timestamp would leak back into the diff, causing the same spurious-failure problem this task fixed.

### Unresolved Assumptions

* Assumed regenerating the live, already-stale `.cockpit/handoff/advisor-restart-brief.md` (rather than leaving it stale and reporting the dual-restart proof as correctly failing) is the right call, since the completion criteria ask for a result that "clearly shows how both ... can resume cold and complete one PCC cycle" — an affirmative demonstration, not just evidence that the failure-detection logic works. Regenerating a previously-generated artifact via its own existing generator is squarely "update `.cockpit` runtime files only as needed for the helper," not a new artifact or scope expansion.
* Assumed composing (calling `verify-worker-restart-safety.ps1` as a subprocess) rather than duplicating its logic is the right design, consistent with staying bounded and avoiding the kind of redundant-check problem found in `pcc-v1-007`.
* Assumed the timestamp-normalization fix belongs in this new script rather than in `generate-advisor-restart-brief.ps1` itself (e.g., by removing the timestamp from the brief entirely) — I judged that changing the existing, already-verified generator's output format was a larger and less bounded change than normalizing the comparison in the new consumer script.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No UI or broader application code was built, no dependencies were added, no broad orchestration was introduced, canonical project goals and verification verdicts were not changed, and no unrelated docs were modified — `docs/HANDOFF_PACKET_SPEC.md` is directly related to the restart proof this task implements, and `.cockpit/handoff/advisor-restart-brief.md` is a runtime artifact regenerated by its own existing generator, not new scope. The live `.cockpit/handoff/worker-directive.md` and `.cockpit/state/*.json` were left untouched by this task's execution (confirmed via `git status`); all guard-condition tests were run against disposable scratch copies of state and artifacts.
