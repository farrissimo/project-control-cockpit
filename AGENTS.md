# AGENTS.md — how to operate in this repository

Tool-agnostic operating guide for any coding agent (Claude Code, Codex, etc.).
Behavior/tone rules live in `CLAUDE.md`; deep architecture lives in `docs/`. This file
is the concrete "how to build, run, test, and decide here." Keep it short and command-first.

## Project overview
PCC (Project Control Cockpit): a local-first **Electron desktop app** for building projects
with LLMs while preventing the usual failure modes (fake completion, drift, lost context,
babysitting). Windows-first. Plain JavaScript (no TypeScript yet). App code in `app/`;
PowerShell script-contracts in `scripts/`.

## Commands
Node commands run from **`app/`**; PowerShell checks run from the **repo root** via `pwsh -NoProfile -File`.

| Task | Command | Where |
|---|---|---|
| Install (clean, from lockfile) | `npm ci` | `app/` |
| Run the app | `npm start` | `app/` |
| Full test suite (guarded Electron E2E + IPC + scripts) | `npm test` | `app/` |
| Data-integrity unit suite | `npm run test:unit` | `app/` |
| Lint (no-undef hallucination check) | `npm run lint` | `app/` |
| PowerShell script-contract tests | `npm run test:scripts` | `app/` |
| Build the Windows installer | `npm run dist` | `app/` |
| Health report (never gates) | `pwsh -NoProfile -File scripts/doctor.ps1` | root |
| Release gate | `pwsh -NoProfile -File scripts/run-release-gate.ps1` | root |
| Validate decision records | `pwsh -NoProfile -File scripts/check-adr.ps1` | root |
| Take a restore point | `pwsh -NoProfile -File scripts/backup-protected-files.ps1 -Action Backup` | root |

`npm test` is the CANONICAL guarded entrypoint (`app/tools/guarded-test.js` → `scripts/run-guarded.ps1`):
it reaps stale test Electrons and aborts a hung run with a machine-readable verdict. The full suite
LAUNCHES the real app, so run it deliberately, not on every tiny commit.

## Code style
- Match the surrounding code (naming, comment density, idiom). Plain JS; no new deps without prior-art justification.
- PowerShell checks print `[PASS]`/`[FAIL]` lines and set a real exit code (a caller decides whether to gate).
- **Tests must never touch real data** — temp dirs + synthetic fixtures only, checked before and after.
- Windows-first: use `pwsh`, forward `$null` into piped stdin (codex/interactive tools block on open stdin).

## Decision policy (ADRs) — check before you choose
Before any choice about **architecture, scope, workflow, verification, or owner expectations**:
1. Check `docs/adr/` for an existing decision (and the frozen archive `docs/DECISIONS.md`).
2. For a NEW significant decision, draft a `Proposed` ADR at `docs/adr/NNNN-kebab-title.md` using the
   locked format in `docs/DECISION_AND_CHANGE_STANDARD.md` — it MUST include the required
   **Confirmation** (proof it works + suite stays green) and **Engagement** (where it's wired for every
   actor) sections. `scripts/check-adr.ps1` must pass, or CI/pre-commit will block it.
Don't make an architectural decision silently — record it, or you'll re-litigate it later.

## What "done" means here
Nothing is done on a worker's word. See `docs/TRUST_CALIBRATION.md`: match the proof to the stakes —
a real test / CI-green-on-the-exact-commit / a live check beats "two AIs agree." Risky/irreversible
work needs the top of that ladder.

## Where the architecture lives (pointers, not prose)
- `PROJECT.md` — current brief (read first; durable state only, live facts checked directly)
- `docs/ARCHITECTURE.md` — structure
- `docs/ENGINEERING_ASSURANCE_PLAN.md` — integrity contract (read Part 1 before integrity-critical code)
- `docs/DECISION_AND_CHANGE_STANDARD.md` — decision + change-rollout standard
- `docs/BACKUP_POLICY.md` — restore-point rules

## Security
Never commit real secrets. Env is git-ignored. If an approach requires a real secret, stop and report
instead of committing it.

---

## Verification protocol (independent verifier)
Applies when `codex exec` (or any independent verifier) is checking work the worker claims is done.
The verifier is independent and honest; it does NOT make changes.

When asked to verify the most recent work:
1. Look at what actually changed. Use the EXACT commit range and live CI state given in the prompt
   (assembled by `scripts/verify-evidence.ps1`), not just `git log -1` — the work may span commits.
2. Run the project's real checks if present — `pwsh -NoProfile -File scripts/doctor.ps1`, plus any tests/lint the repo defines.
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
