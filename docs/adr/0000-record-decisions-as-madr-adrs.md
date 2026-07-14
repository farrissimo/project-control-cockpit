---
status: Accepted
date: 2026-07-14
deciders: owner (delegated), Claude (worker), Codex (verifier)
---

# ADR-0000: Record decisions as MADR ADRs, enforced by a validator

## Context and Problem

PCC's decision history lived in one 300KB `docs/DECISIONS.md` in a format that was
*followed by discipline, not enforced* — a few entries were missing fields, and other
projects (CCB, DHv4) used entirely different systems or none. Forensic review found this
is the "guessing" the owner wants gone (DECISION-115). Going forward we need one locked,
machine-checkable decision format that every project inherits, so a decision can't be
recorded wrong and a new chat can find just the record it needs.

## Decision

New decisions are recorded as **MADR-style ADRs**, one file per decision at
`docs/adr/NNNN-kebab-title.md`, with YAML front matter (`status`, `date`, `deciders`) and
the sections below. Two fields beyond stock MADR are **required** so every change also
proves it works and reaches every actor (DECISION-117):

- **Context and Problem** — what forced the choice
- **Decision** — what we chose
- **Consequences** — what we gain and what we give up
- **Confirmation** — how we proved it works and didn't break what we have
- **Engagement** — where it's wired so every actor knows how to use it

The historical `docs/DECISIONS.md` (DECISION-001…117) stays as the frozen archive; it is
not converted. Status vocabulary: `Proposed → Accepted → Deprecated / Superseded by ADR-NNNN`.

## Consequences

- Gain: one enforced, findable, machine-checkable decision format; a new chat can load a
  single ADR instead of a 300KB log; the two required fields bake in "prove it + roll it out."
- Give up: a small amount of ceremony per decision (two extra fields), and two parallel
  stores during the transition (the frozen `DECISIONS.md` archive plus new `docs/adr/`).
- One-file-per-decision means more files, but each is small and independently linkable.

## Confirmation

- `scripts/check-adr.ps1` validates every `docs/adr/*.md`: front matter with a valid
  `status` + `date`, an `# ADR-NNNN:` title, and all five required sections. Prints
  `[PASS]`/`[FAIL]` per file and exits nonzero on any failure.
- Proven to BITE (not just render green): a deliberately malformed ADR (a required section
  removed) makes the validator FAIL; this well-formed ADR-0000 makes it PASS.
- Wired as a hard gate in CI and a reported finding in `doctor.ps1`; the existing suite is
  unaffected (the validator is additive and touches no runtime code).

## Engagement

- Owner: decisions are now short single files under `docs/adr/`; the archive is untouched.
- Claude worker / Codex verifier: the format + the two required fields are the standard in
  `docs/DECISION_AND_CHANGE_STANDARD.md`; `DECISIONS.md` header now points new decisions here.
- Future chats: `docs/adr/` is the canonical decision store going forward.
- Spawned projects: the scaffolder will seed `docs/adr/` + this validator (deferred with the
  broader scaffolder-propagation work, DECISION-116 Track 3).

## Supersedes / Related

Supersedes the informal "Decision Format" convention in `docs/DECISIONS.md`.
Related: DECISION-115 (MADR + validator), DECISION-117 (Confirmation/Engagement fields),
`docs/DECISION_AND_CHANGE_STANDARD.md`, `docs/TRUST_CALIBRATION.md`.
