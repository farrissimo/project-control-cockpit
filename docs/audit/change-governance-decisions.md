# Audit grid — Change governance & decisions   (ADR-0009 category; status: done)

**Scope:** are significant decisions actually recorded, and is change-rollout disciplined — or can the record be
silently skipped? Graded against the integrity contract Part 1 and the ADR-0009 yardstick. Columns:
`docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped the ADR validator (`check-adr.ps1`), its pre-commit + CI
gating, the decision+change standard, and whether an ADR is ever *required* (not just validated-if-present).
**Verdict: the format gate is strong but found a real gap — the T0 validator itself had ZERO tests → built the
regression lock.** The "ADR-not-required" gap is a deliberate accepted-residue.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **ADR format validation** (front matter status+date, `# ADR-NNNN:` title, 5 required sections incl. Confirmation + Engagement) | machinery-enforced (**now tested** — this category) | `check-adr.ps1`; gated in `.githooks/pre-commit` **and** `ci.yml` (fails closed, exit 1); reported in `doctor.ps1`. **NEW:** `app/tests/scripts/check-adr.spec.js` (8) pins PASS-on-valid + FAIL on missing front matter / bad status / missing date / missing title / missing section / one-bad-in-batch | A decision that IS written can't be malformed or missing a pillar; the validator can't silently break unnoticed | validates section **headers**, not their *content* (an empty "## Confirmation" passes) — low consequence, disclosed |
| **T0/T1 change carries a diff-bound receipt** | machinery-enforced | governance gate (pre-commit) + CI trailer audit (see bypass-evidence grid) | High-tier changes carry independent verification | orthogonal to whether a *decision* was recorded (below) |
| **Frozen decision archive cutover** | machinery-enforced | `DECISIONS.md` (000–117) frozen; `docs/adr/` canonical via ADR-0000; `destructive_history_edit` escalation forces ≥T2 on a rewrite of the archive | Clean, protected decision history | — |
| **Change-rollout discipline** (Part B: restore point → green baseline → build → confirm → wire into every actor → keep baseline) | **prose-only** | `DECISION_AND_CHANGE_STANDARD.md` Part B; the `## Engagement` header is required, its *claims* aren't verified | A repeatable rollout habit | nothing checks the wiring actually happened — disclosed, see residue |
| **An ADR is REQUIRED for a significant change** | **accepted-residue (not enforced)** | — | — | see below |

## The break found → FIXED (the minimum control)
**`check-adr.ps1` is classified T0 (constitutional / trust root) and gates every commit + CI, yet had ZERO
automated tests** — while every peer governance script (`governance-gate`, `classify-stakes`,
`verification-trailer`, `governance-hardening`) is regression-pinned. ADR-0000's Confirmation even claims the
validator was *"proven to BITE"* via a one-time manual malformed-ADR demo — **never captured as a test.** That
is exactly the self-certified-not-regression-locked anti-pattern PCC exists to kill, sitting in PCC's own
decision-governance gate: if a future edit silently broke the validator, a malformed decision record would slip
through and nothing would catch it. **Fixed:** `app/tests/scripts/check-adr.spec.js` (8 tests) encodes the
"proven to bite" claim durably — a well-formed ADR passes; every defect class (missing/invalid front matter,
missing title, missing a required pillar) fails closed (exit 1); one bad ADR fails the whole batch. Travels to
spawned projects via the wholesale `scripts/` copy. Verified: 8/8 green, and the FAIL tests genuinely bite (a
gutted validator would fail them).

## The "ADR-not-required" gap — a DELIBERATE accepted-residue (not a build)
`check-adr.ps1` is **validate-if-present**: an empty `docs/adr` passes (`exit 0`), and it never inspects the
diff, so it cannot know a significant change happened. The governance gate requires a *receipt*, not an ADR.
Concretely, `docs/ARCHITECTURE.md` is T2 (not commit-gated), so an architectural change can ship with **no ADR**
and every gate stays green. **Why this is accepted-residue, not a build:** requiring "an ADR for a significant
change" means mechanically detecting *significance* — a judgment, not a path fact. A tier-based "T0/T1 needs an
ADR" gate would force ceremony on routine changes (over-governance, yardstick #2); a "detect an architectural
change" heuristic would be fake-intelligence (DECISION-008). The backstop is the strong prose rule (CLAUDE.md /
AGENTS.md: "record significant choices"; "check `docs/adr/` before deciding") + the owner as product lead. The
new test *does* pin this boundary explicitly (an empty dir passing is now an intentional, known behavior).
Surfaced for the owner's active acceptance at sign-off.

Minor disclosed drift (benign, not fixed): ADR-0000's Confirmation omits the pre-commit gate (implementation is
*stronger* than the record); `DECISION_AND_CHANGE_STANDARD.md` slightly over-claims the validator special-cases
`Accepted` (it checks headers regardless of status). Noted; low consequence.

## Verdict against the integrity contract
For ADRs that are written, the format gate is genuine defense-in-depth (pre-commit + CI + doctor), fails closed,
and now **can't silently break** (regression-locked). The archive cutover is clean and protected. The real hole
was the T0 validator's own missing test — **closed.** The "ADR-not-required" and "rollout is prose" gaps are
disclosed as deliberate accepted-residues (mechanizing them would be over-governance / fake-intelligence). **This
category found a real break and closed it with the minimum control.**
