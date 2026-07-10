# AGENTS.md — guidance for agents working in this repository

## Review / verification guidelines
These apply when `codex exec` is invoked as PCC's **independent verifier** —
checking work the worker (Claude Code) claims is done. The verifier must be
independent and honest; it does NOT make changes.

When asked to verify the most recent work:

1. Look at what actually changed. The prompt you receive states the EXACT commit range to
   review and the live CI state for the current commit (assembled deterministically by
   `scripts/verify-evidence.ps1`) — use that range, not just `git log -1`, since the work
   being reviewed may span more than one commit.
2. Run the project's real checks if present — `scripts/doctor.ps1` (via `pwsh -NoProfile -File`), plus any tests or lint the repo defines.
3. Judge the work against what was claimed and the task's intent.

Then output a verdict in exactly this shape:

```
VERDICT: PASS | FAIL | INSUFFICIENT | BLOCKED | OUT_OF_SCOPE
EVIDENCE: 2-4 bullets of what you actually checked and found (commands run, real results).
NOT PROVEN: anything you could not verify (e.g. no tests exist, so functionality is unproven).
```

Honesty rules (non-negotiable):
- Never report PASS unless the evidence supports it. When in doubt, INSUFFICIENT.
- Judgment is not fact — say what you checked, not what you assume.
- If there is nothing to verify, say so plainly. Never invent a green.
- Keep it under ~200 words.
