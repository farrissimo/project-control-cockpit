# Worker Result

### Summary

Completed task `pcc-brr2-004` ("BRR Verification: Deterministic Close-Out") by adding `scripts/close-out-verified-task.ps1`, which performs the post-`PASS` close-out sequence already recommended in `docs/HANDOFF_PACKET_SPEC.md` ("Recommended Close-Out Order") in one deterministic run: archive the cycle artifacts first, advance state with the archived path, refresh both live handoff artifacts, run the post-close-out health check, and log the event. This is the third and last of the three deterministic scripts this BRR Phase 2 sub-thread produced (`finalize-worker-handback.ps1` for the worker, `verify-handback-guardrails.ps1` for pre-verdict guardrails, this one for post-`PASS` close-out).

Scratch testing this script surfaced a real, non-obvious finding worth calling out directly: my first draft only regenerated `advisor-restart-brief.md` after advancing state, not `worker-directive.md`. `doctor.ps1` correctly flagged the live directive as stale relative to canonical state — the same class of defect `pcc-brr2-001` surfaced, just on the verifier's close-out side instead of the worker's handback side. Fixed by regenerating both artifacts, matching the pattern `finalize-worker-handback.ps1` already established.

**Important limitation, disclosed directly:** this script only operates on an already-written `PASS` verdict. Since `pcc-brr2-004` itself has no `PASS` yet at the time of this evidence (it's being requested right now), I could not demonstrate a full live close-out of *this task's own* cycle — that would be a logical impossibility (the tool can't close out a verdict that doesn't exist yet). What I *could* and did do: thoroughly exercise the full mechanism end-to-end (including the real bug found and fixed) against disposable scratch copies carrying the real repo's actual data, synthesizing only the one field that couldn't yet exist (a `PASS` verdict for this task). Codex, as the actual verifier, is the natural party to run this script for real once `pcc-brr2-004` itself receives `PASS` — that would be the first genuine live-flow use.

### Files Changed

* Created: `scripts/close-out-verified-task.ps1`.
* Updated: `docs/HANDOFF_PACKET_SPEC.md` — rewrote the "Recommended Close-Out Order" section to describe the script's five fixed steps directly (in place of the prior manual checklist), and to state the `-Commit`/never-push distinction explicitly.
* Updated: `docs/REPO_GOVERNANCE.md` — added a new step 12 to the Task Process's Standard task workflow naming the script as the close-out path.
* Updated: `docs/DECISIONS.md` — added `DECISION-034`.

### Commands / Tests Run

1. **Full happy-path test (disposable scratch copy, first attempt):** copied live repo state/scripts, synthesized a matching `PASS` verdict for `pcc-brr2-004`, ran the script — surfaced the real `doctor.ps1` `[ISSUE]` (stale worker directive after state advance) described above.
2. **Fix and full retest (fresh scratch copy):** same setup, with the fix (regenerate both artifacts) applied — confirmed exit `0`, all five steps completed, archive files correctly created and named, `task_status` correctly advanced to `complete`, `last_verified_handoff` correctly pointing at the archived directive, log entry correctly appended.
3. **Idempotency guard test (same scratch copy, immediate rerun):** confirms the script refuses with a clear error when an archive path already exists, rather than silently overwriting archived history.
4. **Task-ID / verdict mismatch guard test (separate scratch copy, using the real live verification-result.json which is for a different task):** confirms the script refuses when the live verification result doesn't match the active task.
5. `git status --porcelain` before and after all scratch testing, to confirm the live repo's `.cockpit/` state and archives were untouched by scratch work.
6. **Real handback for this task:** `pwsh -NoProfile -File scripts/finalize-worker-handback.ps1` — the established worker path from `pcc-brr2-002`, used here since `close-out-verified-task.ps1` cannot act on this task's own not-yet-issued verdict.

### Results

1. Exit `1`. `doctor.ps1` reported `[ISSUE] Restart safety (advisor + worker): ... Restart-safety check FAILED: .cockpit/handoff/worker-directive.md does not match what generate-worker-directive.ps1 currently produces...` — a real, correctly-caught defect in my first draft, not a false positive.
2. Exit `0`. All five steps completed (`Step 1/5` through `Step 5/5`), `doctor.ps1` reported `Overall: no issues, 1 warning(s) found` (the one warning was an expected scratch-environment artifact — no `handoff-gate.json` present, since the enforcement gate was never run in that scratch copy — not a defect). Archive listing showed `pcc-brr2-004-worker-directive.md`, `pcc-brr2-004-worker-result.md`, and `pcc-brr2-004-verification-result.json` all correctly created; `task_status` was `complete`; `last_verified_handoff` was `.cockpit/handoff/archive/pcc-brr2-004-worker-directive.md`; the log's last line correctly recorded a `verified_pass` event for `pcc-brr2-004`.
3. Exit `1`, with `Refusing to close out: archive path '.cockpit/handoff/archive/pcc-brr2-004-worker-directive.md' already exists. This script never overwrites archived history...`.
4. Exit `1`, with `Refusing to close out: verification-result.json task_id 'pcc-brr2-003' does not match active task-state.json task_id 'pcc-brr2-004'...` — this incidentally also confirms why the synthetic `PASS` in tests 1–2 was necessary rather than optional: the real live verification result genuinely doesn't match this task yet.
5. Clean both times — no scratch artifacts appeared in the live repo's `git status`.
6. Exit `0`. The four-step success sequence from `pcc-brr2-002`, `doctor.ps1` fully clean (`Overall: OK. No issues or warnings found.`).

### Evidence

Mapping to the directive's completion criteria:

* **One concrete verifier-facing mechanism for post-PASS close-out, explicit and repeatable** — `scripts/close-out-verified-task.ps1`, demonstrated in Results 1–4 to perform the fixed five-step sequence, correctly refuse on bad input, and correctly refuse to double-run.
* **Local-first and bounded; does not redesign the verdict model, replace verifier judgment, or broaden scope** — the script only composes existing scripts (`advance-cockpit-state.ps1`, `generate-worker-directive.ps1`, `generate-advisor-restart-brief.ps1`, `doctor.ps1`, `log-event.ps1`) plus file copies and optional `git` commands; it never decides a verdict itself and requires one to already exist.
* **Preserves the archived handoff path correctly on state advance; leaves the repo commit-ready** — Result 2 confirms `last_verified_handoff` correctly points at the archived directive after advance, and the script's final message states the repo is commit-ready, distinguishing the deliberate `-Commit` step (and the always-separate, never-automated push) explicitly.
* **Verifier-facing docs tell Codex exactly what to run and when, including what remains manual vs. automated** — `docs/HANDOFF_PACKET_SPEC.md`'s rewritten "Recommended Close-Out Order" and `docs/REPO_GOVERNANCE.md`'s new step 12 both state this directly: the script does steps 1–5, committing is opt-in via `-Commit` or manual, and pushing is always separate and manual.
* **Demonstrated against the active task flow; leaves the repo healthy under applicable checks** — see the disclosed limitation above: full end-to-end demonstration used realistic scratch data rather than this task's own (not-yet-existing) `PASS`, since the two are chronologically incompatible. This is the honest and correct way to test a tool whose precondition is the very outcome this evidence is requesting.
* **No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign** — confirmed; the script only automates an already-documented, already-authorized manual sequence.

### Known Risks

* Same `[ISSUE]`-text-match coupling to `doctor.ps1`'s output format as the two prior scripts in this sub-thread (`finalize-worker-handback.ps1`, `verify-handback-guardrails.ps1`) — all three would need updating together if `doctor.ps1`'s finding-label format changes.
* This script has not yet been exercised in its real, intended context: Codex actually closing out a real `PASS`. The scratch demonstration proves the mechanism works correctly against realistic data, but "first real use" risk (an edge case only a genuine live cycle would surface) remains until that happens. Recommending this be watched the first time it's actually used for real.
* The `-Commit` path (`git add -A` + `git commit`, never `git push`) was reasoned through and code-reviewed but **not executed against the real repo** during this task, per the standing instruction that I should not run `git commit` myself unless explicitly asked — that instruction sits above and outside this specific PCC task's own authorization (`DECISION-020` authorizes the *verifier* to commit verified work; it doesn't instruct me, the worker in this session, to commit on my own initiative). This is disclosed as an explicit, deliberate gap in this task's own testing, not an oversight.

### Unresolved Assumptions

* Assumed the correct scope for "archive" is exactly the three files (`worker-directive.md`, `worker-result.md`, `verification-result.json`) already named in `docs/HANDOFF_PACKET_SPEC.md`'s pre-existing manual order — no additional files were added to what gets archived.
* Assumed refusing outright (rather than warning and continuing) when an archive path already exists is correct, consistent with the same no-overwrite principle `finalize-worker-handback.ps1` and `verify-handback-guardrails.ps1` already apply to their own guard conditions.
* Assumed making `-Commit` opt-in (rather than automatic on every close-out) is the right level of automation for this first version — `DECISION-020` authorizes the verifier to commit, but the completion criteria's own phrasing ("leaves the repo in a clean commit-ready state") reads as stopping short of the commit itself by default, treating it as a deliberate final step available on request.
* Recommend independent (Codex) review specifically on: (a) whether the fix for the worker-directive staleness bug is the right one (regenerate both artifacts) versus some other approach, (b) whether `-Commit` being opt-in rather than automatic is the correct default, and (c) — most importantly — using this script for real the first time `pcc-brr2-004` (or any subsequent task) actually receives a `PASS`, since that is the one thing this cycle's testing could not itself prove.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. `doctor.ps1`, `check-schemas.ps1`, `validate-cockpit-state.ps1`, and `advance-cockpit-state.ps1` were not redesigned — none were modified; the new script only composes and calls them. No verification verdicts, task safety classes, or worker handback script (`finalize-worker-handback.ps1`) behavior were changed. No owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation was introduced. No archived history was rewritten or retrofitted — the script's own guard explicitly refuses to overwrite any existing archive file, and all testing used disposable scratch copies rather than the live archive. No claim was made that repo commit/push policy changed beyond what `DECISION-020` already authorizes — `-Commit` only automates an already-authorized action, and pushing remains untouched, always separate, and always requiring explicit owner approval.
