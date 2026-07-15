---
status: Accepted
date: 2026-07-14
deciders: owner (caught the gap), Claude (worker)
---

# ADR-0005: Independent verification is a required part of "done"

## Context and Problem

Independent verification (worker builds, a separate model verifies) is the spine of PCC's
whole trust model — it's in AGENTS.md's verifier protocol and in TRUST_CALIBRATION.md. But
while building the standardization foundation (ADR-0000..0004) the worker **self-certified
every brick** on its own checks + CI and only ran the independent verifier (`codex exec`)
when the owner explicitly demanded it. Worse, the change-rollout standard's `Confirmation`
field (DECISION-117) did not actually *require* independent verification — so the gap was in
the rule, not just the behavior. The owner caught it. Self-certification is exactly the
failure mode this project exists to stop.

## Decision

Independent verification is now a **required** element of `Confirmation` for any non-trivial
change: it is not "done" until an independent verifier (`codex exec`) has reviewed it and
returned a verdict. The locked sequence is **build → CI → verify → done.** Wired into
`docs/DECISION_AND_CHANGE_STANDARD.md` (both the Confirmation field and the ritual) and into
`AGENTS.md`'s "What done means here."

## Consequences

- Gain: closes the self-certification loophole in the standard; the rule now enforces what the
  trust model always intended.
- Give up: one extra step (a verifier pass) per non-trivial change — deliberately skipped only
  for trivial/reversible work, matching the trust-to-stakes ladder.
- Honest residue: this is a process rule, not machinery a validator can fully enforce; its
  teeth are the documented requirement + the worker/verifier habit. If a worker still skips it,
  that's a rule violation to catch, not a silent pass.

## Confirmation

- Applied the rule to itself: this ADR plus the scaffolder-parity change (ADR-0004) were
  submitted to `codex exec --sandbox read-only` as the independent verifier BEFORE being called
  done. Codex verdict: **PASS** (independently ran check-adr.ps1 → exit 0 on all ADRs, doctor.ps1
  → ADR format OK, `npm run lint` → exit 0, and confirmed the CI working-directory fix + the
  scaffolder seeding by inspection).
- `scripts/check-adr.ps1` passes on all six ADRs (0000–0005); `npm run lint` exit 0; CI green on
  the merge.

## Engagement

- Claude worker: AGENTS.md "What done means here" now states the build → CI → verify → done rule.
- Codex verifier: its protocol (already in AGENTS.md) is now a required gate, not optional.
- Future chats / spawned projects: the requirement is in DECISION_AND_CHANGE_STANDARD.md, which
  the scaffolder seeds into every project.

## Supersedes / Related

Amends DECISION-117 / ADR-0000's Confirmation requirement to include independent verification.
Related: AGENTS.md (verifier protocol), docs/TRUST_CALIBRATION.md, docs/DECISION_AND_CHANGE_STANDARD.md.
