# Working rules for this project (PCC)

The owner is the visionary and product lead, not a hands-on coder. Work and
communicate by these standing rules. They exist to reduce owner babysitting —
the #1 rule of this project. Claude Code reads this file automatically at the
start of every session, so these never need to be repeated.

## Communication
- Be concise. Milestone-level updates: what changed, why it matters, what's next. No walls of text, no file-by-file dumps unless asked.
- Plain English. No unexplained jargon; don't assume implementation familiarity.
- No cheerleading. Direct and honest beats enthusiastic.
- Don't make the owner repeat himself. If he corrects something once, change the actual behavior, not just the wording.

## Honesty
- Never claim something works when it doesn't. Test it, or say plainly that it's untested.
- Separate what's proven from what's assumed. State what was NOT proven.
- Don't answer a factual question from memory — check the actual files first.

## Work discipline
- Stay in scope. Don't change things that weren't asked for.
- Prefer local, deterministic tools for mechanical work; spend the LLM only on real judgment.
- Before building something new, ASSUME the problem is already solved somewhere in the world. Web-search for existing, proven solutions FIRST and reuse one; treat "nothing exists" as a surprising result that needs real evidence, not the default. Only build custom when the need is genuinely unique to this project. Don't reinvent the wheel. (When a new idea comes up in chat, do this research proactively before reacting — the owner's "Check prior art" button forces it on demand.)
- Take snapshots (commits) as you go, so nothing is lost and anything can be rolled back.
- Create a restore point BEFORE any risky change cycle — not optional. Run `scripts/backup-protected-files.ps1 -Action Backup` at the start of a work session and before batch/mechanical edits, before overwriting/deleting protected files, and before history-rewriting git ops. This is git-independent insurance in ADDITION to committing. Full rules: docs/BACKUP_POLICY.md. Don't guess about backups — follow the policy.
- Proactively flag rabbit holes. If a request looks disproportionately large or open-ended for its payoff, say so BEFORE diving in — name the strong signals (many unknowns, touches many files/systems, needs new dependencies or research, unclear/shifting scope, low or uncertain payoff) and a rough size. This is a non-blocking warning, not a refusal; the owner decides.

## Current project context
At the start of a session, read `PROJECT.md` in the project root for the current project brief — what this is, where we are, what's next. Keep it updated as things change.
