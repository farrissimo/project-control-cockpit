---
status: Accepted
date: 2026-07-14
deciders: owner (delegated), Claude (worker)
---

# ADR-0001: AGENTS.md is the tool-agnostic operating guide; CLAUDE.md imports it

## Context and Problem

PCC split its instruction files by *tool* by accident (CLAUDE.md = Claude's rules,
AGENTS.md = a Codex-verifier-only file), not by *content* as the AGENTS.md standard
intends. Current-2026 research (External Candidate #2) found AGENTS.md is now a real
multi-vendor standard (60k+ repos; read by Codex, Cursor, Copilot, etc.) whose highest-value
shape is **concrete commands, not architecture prose** — and that architecture write-ups in
that file actually hurt. PCC's operational "how to build/run/test/decide here" knowledge was
scattered across docs and undiscoverable in one predictable place.

## Decision

`AGENTS.md` becomes the **tool-agnostic operating guide**: project overview, concrete
build/run/test commands, code style, the **decision (ADR) policy**, the "done" standard, a
pointer to where architecture lives, and the existing independent-verifier protocol (kept as
a scoped section). `CLAUDE.md` keeps the behavioral/working rules (behavior/tone) and
**imports AGENTS.md** via `@AGENTS.md` plus a human-readable pointer, so the operating guide
loads with it without duplication. Deep architecture stays in `docs/` (ARCHITECTURE,
ENGINEERING_ASSURANCE_PLAN), referenced by pointer only.

## Consequences

- Gain: any agent/tool finds the operating guide in the standard place; the ADR "check
  docs/adr/ before deciding" policy is now where agents actually read it; no duplication
  (one canonical AGENTS.md, CLAUDE.md imports it).
- Give up: a small ongoing duty to keep the command table in AGENTS.md current.
- The `@AGENTS.md` import relies on Claude Code expanding it; the human-readable pointer is
  the fallback if a tool doesn't process the import.

## Confirmation

- Every command in AGENTS.md was taken from the real sources (`app/package.json` scripts and
  `scripts/*.ps1`), not invented.
- `scripts/check-adr.ps1` passes on both ADR-0000 and this ADR-0001 (validator now checks two
  records); `doctor.ps1` still runs clean and reports the ADR finding OK.
- Instruction-file + docs change only — no runtime/app code touched, so the test suite is
  unaffected by construction.

## Engagement

- Claude worker: CLAUDE.md now imports AGENTS.md and carries a Decisions section pointing at ADRs.
- Codex verifier: its protocol is preserved as the "Verification protocol" section of AGENTS.md.
- Other tools (Cursor/Copilot/etc.): AGENTS.md is now the standard operating guide they read.
- Future chats: the operating guide is one predictable file.
- Spawned projects: the scaffolder will seed this CLAUDE.md/AGENTS.md pair (with the broader
  scaffolder work, DECISION-116 Track 3).

## Supersedes / Related

Supersedes the Codex-verifier-only use of AGENTS.md.
Related: ADR-0000 (ADR format), DECISION-117 (rollout discipline), External Candidate #2,
`docs/DECISION_AND_CHANGE_STANDARD.md`.
