# Worker Result

### Summary

Created `.cockpit/handoff/claude-worker-runbook.md`, a bounded operating-procedure document for the Claude Code worker cycle in this repo. It specifies what Claude reads first, where it writes results, the required evidence/return format, blocked-behavior handling, and scope discipline — making the handoff contract system-owned rather than something the owner must restate each cycle.

### Files Changed

* Created: `.cockpit/handoff/claude-worker-runbook.md`
* Updated: `.cockpit/result/worker-result.md` (this file)

### Commands / Tests Run

None. This task is documentation-only; no build, test, or shell commands were required or run.

### Results

N/A — no commands were run.

### Evidence

* `.cockpit/handoff/claude-worker-runbook.md` exists and contains five sections: "What Claude Reads First," "Where Claude Writes the Result," "Required Evidence / Return Format," "What Claude Does When Blocked," and "Scope Discipline."
* The runbook explicitly names the read order (`worker-directive.md` → `project-state.json` → `task-state.json`), the write target (`.cockpit/result/worker-result.md`), the required return-format headings, and the blocked-report contents.
* This `worker-result.md` file itself follows the required return format from `.cockpit/handoff/worker-directive.md`.

### Known Risks

* The runbook is a static document; if the directive/result file paths ever change, the runbook must be updated manually — there is no automated sync check yet.
* No verifier has yet reviewed this cycle's output; verdict is pending.

### Unresolved Assumptions

* Assumed "docs directly related to the worker handoff procedure" refers only to the new runbook file and this result file, not other repo docs (e.g., top-level README), which were left untouched.
* Assumed no update to `.cockpit/state/task-state.json` or `.cockpit/state/project-state.json` should be made by the worker itself, since state updates require verifier PASS or explicit owner override.

### Out-of-Scope Confirmation

Confirmed: no forbidden-scope work was performed. No application code was built, no dependencies were added, no orchestration/automation was introduced, V1 scope was not redesigned, no canonical verification verdicts were changed, and no unrelated docs were modified.
