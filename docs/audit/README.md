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
- **Probe freely, standardize rarely (the governing rule — ADR-0009 amendment 2026-07-15).** Unbundle two
  activities: **probing** (finding out whether it works) is cheap and always worth it — the knowledge is
  the payoff, so **"tested, holds" is a first-class outcome and expected to be the most common one**.
  **Building durable standardization/control** is expensive and clears a high bar: only when it *clearly*
  improves the process or project (moves a measurable number / removes a real consequential risk).
  Otherwise, note it and move on. Golden rule: *proactively test the known weak points of LLM-led
  development, then build only the minimum durable control needed for failures that testing proves
  credible and consequential.*
- **Three verdicts per practice.** **Tested, holds → note + move on** · **tested, found a real +
  consequential break → build the minimum control** · **can't tell yet → say so** (never paint it green).
  The category list is a **checklist of where to look**, not a set of grids to fill for completeness.
- **Risk-based depth.** Deeply verify / mechanize / test only where a failure would be **silent, costly,
  or babysitting-creating**. Low-consequence practices get a note, not the full loop.
- **Record fine as fine.** A practice that is already sound is recorded as sound, briefly, not re-engineered.
- **Disclose, don't paint green.** A gap or accepted residue is stated plainly. Calling a category
  "all standardized" when it isn't would be the exact fake-green this phase exists to kill.

## Categories (22 audit categories + 2 sign-off gates — tracked in `.cockpit/state/phase-manifest.json`)
| Category | Grid | Status |
|---|---|---|
| Communication contracts | `docs/specs/communication-contracts.md` | ✅ done (category 1) |
| State & data integrity | `docs/audit/state-data-integrity.md` | ✅ done |
| Verification & proof-of-done | `docs/audit/verification-proof-of-done.md` | ✅ done (built the branch-protection live check) |
| Execution authority & worker safety | `docs/audit/execution-authority-worker-safety.md` | ✅ done (pinned the read-only deny-list) |
| Honesty & anti-fake-green | `docs/audit/honesty-anti-fake-green.md` | ✅ done (pinned the phase-progress meter's fail-closed logic) |
| Bypass evidence & tamper-detection | `docs/audit/bypass-evidence-tamper-detection.md` | ✅ done (fixed + surfaced the branch-protection linchpin) |
| Backup & recovery | `docs/audit/backup-recovery.md` | ✅ done (tested-holds; no control built) |
| Recovery, rollback & damage-repair | `docs/audit/recovery-rollback-damage-repair.md` | ✅ done (tested-holds; most-proven area) |
| Multi-project scaffolding & parity | `docs/audit/scaffolding-parity.md` | ✅ done (tested-holds; derived anti-drift guards) |
| Privacy, secrets & access control | `docs/audit/privacy-secrets-probe.md` | 🔍 quick probe only (found + fixed the `.env` fake-green; full category still open) |
| Requirements / intent & acceptance correctness | `docs/audit/requirements-intent-acceptance.md` | ✅ done (accepted-residue by ADR-0003; risk named for owner acceptance) |
| External dependency / tool availability & failure | `docs/audit/external-dependency-availability.md` | ✅ done (tested-holds; retired-watcher residue disclosed) |
| Incident response, diagnostics & supportability | `docs/audit/incident-response-diagnostics.md` | ✅ done (found + fixed: durable app-error log for swallowed failures) |
| _(12 of 22 audit categories done; 10 remaining)_ | — | pending |

The live `% complete` is computed from the phase manifest by `scripts/new-milestone-update.ps1` — never
hand-counted here.
