---
status: Accepted
date: 2026-07-14
deciders: owner (approved parity step), Claude (worker)
---

# ADR-0004: The scaffolder seeds all standards into every spawned project (parity)

## Context and Problem

The standardization foundation (MADR ADRs + validator, AGENTS.md operating guide,
ESLint tripwire, lean spec-shape, the rollout/trust standards) lived only in PCC. Without
seeding them, spawned projects would be born WITHOUT the standards — breaking parity
(DECISION-113: whatever PCC gets, spawned projects get) and leaving the "every project gets
it for free" payoff unrealized (DECISION-116 Track 3).

## Decision

`scripts/bootstrap-project.ps1` seeds the full standard set into every new project. Most of it
already travelled via the existing wholesale copies (`scripts/`, `schemas/`, `.github/`,
`.githooks/`, `app/`, `CLAUDE.md`, `AGENTS.md`) — so the validator, the CI ADR+lint steps, the
pre-commit gate, and the ESLint config already inherit. The gaps, now closed: copy the three
standard docs (`DECISION_AND_CHANGE_STANDARD.md`, `TRUST_CALIBRATION.md`, `specs/README.md`),
create `docs/adr/` with a well-formed generic starter ADR-0000, and repoint the seeded
`docs/DECISIONS.md` to `docs/adr/` (kept only as a legacy archive for the bootstrap record).

## Consequences

- Gain: every new project is born with the identical, enforced standard set from day one — no
  hand-porting, no drift. This is the parity payoff.
- Give up: three more files + one directory per scaffold (negligible).
- The seeded eslint config carries PCC-app-specific globals; harmless for other projects but a
  candidate to genericize when the deferred clone-app decision is settled.

## Confirmation

- Scaffolded a throwaway project into an isolated temp dir (never a real location; `-NoInbox
  -NoGit`). All ten standard artifacts present: `docs/adr/0000`, the three standard docs,
  AGENTS.md, CLAUDE.md, `app/eslint.config.js`, `scripts/check-adr.ps1`,
  `.github/workflows/ci.yml`, `.githooks/pre-commit`.
- `scripts/check-adr.ps1` run INSIDE the scaffolded project PASSES on the seeded ADR-0000
  (exit 0) — the inherited enforcement validates a real record from day one.
- The scaffolder completed successfully ("Done"), so project creation is not broken. PCC's own
  ADRs (0000–0004) still validate.

## Engagement

- New/spawned projects: inherit the whole standard set automatically at scaffold time.
- The seeded ADR-0000 exemplifies the format in each project; AGENTS.md carries the ADR + spec
  policies; check-adr + CI + pre-commit enforce from the first real commit.
- Future chats in a spawned project: `docs/adr/` is the decision store; `docs/specs/` the spec home.

## Supersedes / Related

Related: DECISION-113 (parity), DECISION-116 Track 3 (scaffolder propagation), ADR-0000..0003
(the standards being seeded), `scripts/bootstrap-project.ps1`.
