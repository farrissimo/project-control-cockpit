# PCC standardization audit (ADR-0009 category grids)

This directory holds the **per-category audit grids** for the Operational Trust Qualification & Adoption
phase (`docs/adr/0009-trust-signoff-audit.md`). Each grid is the durable, evidence-backed record for one
top-level category; together they compile into the owner-facing sign-off report (ADR-0009 gate a).

## What a category grid is
For each practice in the category, one row:

| Column | Meaning |
|---|---|
| **Practice** | what it is, in one line |
| **State** | one of: **machinery-enforced** (code/CI blocks the bad path) · **evidence-leaving + owner-visible** (leaves a deterministic trail the owner can see, but doesn't block) · **prose-only** (a rule an LLM could skip) · **accepted-residue** (a known limit, owner-accepted) |
| **Proof** | the concrete evidence: test file(s) + count, ADR, schema, or a live check — not "it should" |
| **Benefit** | what it buys PCC, tied to the yardstick |
| **Gaps** | what is NOT proven/enforced — disclosed, never hidden |

## The rules each grid grades against
- **Integrity contract** — `docs/ENGINEERING_ASSURANCE_PLAN.md` Part 1 (the 7 permanent engineering
  rules: one-authority-per-domain, claims-match-implementation, no-swallowed-failures,
  malformed-fails-closed, recoverable-mutations, displayed-truth-provenance, commit-bound-verification).
- **Canonical principles yardstick** — ADR-0009 (reduce babysitting #1, lean/no over-governance,
  local-first, honesty/anti-fake-green, verify-don't-trust, truth-in-files, protect-data/reversibility,
  prior-art-first, plain-language, parity).

## Rules of the audit itself (ADR-0009)
- **Risk-based depth.** Deeply verify / mechanize / test only where a failure would be **silent, costly,
  or babysitting-creating**. Low-consequence practices get documentation + review, not the full loop —
  running the heavy verify-and-merge loop for every trivial thing would itself be the over-governance
  this phase forbids.
- **Record fine as fine.** A practice that is already sound is recorded as sound, not re-engineered.
- **Disclose, don't paint green.** A gap or accepted residue is stated plainly. Calling a category
  "all standardized" when it isn't would be the exact fake-green this phase exists to kill.
- **Fix real gaps proportionally.** Where the audit finds a genuine hole (e.g. a T0 file with no test),
  close it in the same governed loop; where the fix would be over-governance, disclose + recommend and
  let the owner decide.

## Categories (22 audit categories + 2 sign-off gates — tracked in `.cockpit/state/phase-manifest.json`)
| Category | Grid | Status |
|---|---|---|
| Communication contracts | `docs/specs/communication-contracts.md` | ✅ done (category 1) |
| State & data integrity | `docs/audit/state-data-integrity.md` | ✅ done |
| _(21 remaining)_ | — | pending |

The live `% complete` is computed from the phase manifest by `scripts/new-milestone-update.ps1` — never
hand-counted here.
