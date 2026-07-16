# Audit grid — Honesty & anti-fake-green   (ADR-0009 category; status: done)

**Scope:** the discipline PCC exists to enforce — *never claim proven when it isn't; fail visibly.*
Every visible claim (chip, card, gauge, number) must prove source + freshness and read grey/amber/red
(or the literal string `UNKNOWN`) when it can't prove the thing, never green over unknown/stale/false
state. This is the highest-consequence category: a false green here is the exact failure mode the whole
phase is meant to retire.

**Method (probe freely, standardize rarely):** this category was already substantially audited on
2026-07-14 (`docs/proposals/metric-honesty-audit.md` — every visible metric traced to source and
classified BACKED / DECLARED / SOFT-SPOT; the 3 soft-spots fixed). So the work here was two-fold:
(1) **verify, don't trust** — confirm the claimed fixes actually hold *and are pinned by tests* (an
anti-fake-green claim with no regression test is itself a soft green); (2) **attack for what a
visible-metrics inventory would miss** — a green-painting surface that isn't a chip on screen.

The visible surfaces hold and are now confirmed test-pinned. The attack found **one** real, consequential
gap that cleared the build bar: the meter that computes the phase-progress **`% complete` number itself**
— the number that gates the owner's trust sign-off — had its entire fail-closed logic proven only by
inspection, with **zero** tests.

## Probe results

| Surface | Verdict | Evidence |
|---|---|---|
| **Metric-honesty inventory** — every visible chip/card/number classified backed/declared/soft-spot | **tested, holds** | `docs/proposals/metric-honesty-audit.md`; most surfaces are a real deterministic check that fails closed. |
| **Soft-spot #1 — lying authority banner** (persisted "build enabled" message outliving the bounded session) | **fixed + test-pinned** | `d75eef3`: banner is now transient/non-persisted; historical banners filtered on render. Pinned by `app/tests/e2e/authority.spec.js` — a seeded banner is asserted NOT rendered. (Checkable: the test is in the e2e suite CI runs.) |
| **Soft-spot #2 — stale-docs green over ZERO rules** | **fixed + test-pinned** | `90cd2e0`: returns `unknown`. Pinned by `detectors.spec.js` "stale-docs degrades to UNKNOWN when no rules are defined" (`.toBe('unknown')`). |
| **Soft-spot #3 — high-stakes green on missing baseline** | **fixed + test-pinned** | `90cd2e0`: returns `unknown`. Pinned by `detectors.spec.js` "high-stakes degrades to UNKNOWN when the baseline ref is missing" (`.toBe('unknown')`). |
| **Anti-forgery origin seam** — a hand-edited `TYPE: ci_execution`/`live_boundary` is never trusted as executed; only `local_execution` counts | **tested, holds** | metric-honesty audit §Design strengths; verification-proof-of-done grid. |
| **Exact-SHA CI binding + dirty-tree downgrade** — uncommitted edits CI never saw can't wear a "ran in CI" green | **tested, holds** | `scripts/ci-status.ps1`; verification-proof-of-done grid. |
| **Owner Overview never fails open to "Healthy"** — `factsReadable`/`syncUnknown`/`detectorUnknown`/`!rulesLoaded` all block the green terminal | **tested, holds** | `app/renderer/overview-logic.js` (unit-tested, zero-LLM); metric-honesty audit. |
| **Verification trailer says "attestation", not "verified"** — a valid diff-bound *claim*, not proof verification happened | **tested, holds** | Governance Hardening sub-slice A (PR #11); `verification-trailer.spec.js`. |
| **Release gate: missing network truth ⇒ UNKNOWN, never PASS** | **tested, holds** | `scripts/run-release-gate.ps1`; docs/HARDENING_RELEASE_GATE.md. |
| **Phase-progress `% complete` meter** — the number measuring THIS phase, feeding the trust sign-off | **gap found → control built** | see below |

## The one gap that cleared the build bar → FIXED
`scripts/new-milestone-update.ps1` computes the phase `% complete` = done slices / total from
`.cockpit/state/phase-manifest.json`. Its explicit reason to exist is anti-fake-green: the % must be a
real count or the honest string `UNKNOWN` — never invented, never a silent 0. The script's own header
lists the defenses (missing / malformed / wrong-schema / empty / **done-without-evidence** → `UNKNOWN`)
and even documents `-ManifestPath` as *"overridable for tests"* — but **no test existed**. The entire
fail-closed contract was proven only by reading the code.

The failure this leaves open is precisely the disease this phase exists to kill, sitting in the tool that
*measures* the phase: a regression that counted a `done:true` slice with empty evidence, or fell for
PowerShell's truthy-string trap (the JSON string `"false"` casts to `$true`), would ship **green** and
silently inflate the phase number the owner reads to decide whether to sign off. Nothing would catch it.

**Built the durable control:** `app/tests/scripts/milestone-generator.spec.js` (12 tests) pins every
defense — honest count (a valid 1-of-2 manifest reads 50%), done-with-empty-evidence → UNKNOWN,
whitespace-only evidence → UNKNOWN, non-boolean `done` ("false" string) → UNKNOWN, missing `done` →
UNKNOWN, scalar `slices` → UNKNOWN, empty `slices` → UNKNOWN, wrong schema → UNKNOWN, malformed JSON →
UNKNOWN, missing file → UNKNOWN, and the rendered header reading `UNKNOWN% complete` (no digits-percent
slipping through). These 12 pinned cases ARE the adversarial manifests — the durable, CI-checkable form
of the manual probe. **The checkable proof is the test's presence + its green run** (the guarded
script-contract suite runs it; CI re-runs on push).

*Method note (dev-time, not a durable artifact):* before writing this grid the suite's bite was checked
by a one-time mutation — setting `$hasEvidence = $true` in the generator turned exactly the
evidence-guarding tests red, then reverted. That is a self-report of a development step, not something the
committed diff proves; the standing guarantee is the CI-run test, not the mutation.

## Disclosed surfaces (not built — probed and judged)
- **DECLARED self-reports** (vision-promise cards, the sycophancy keyword scan, the chat-length proxy
  gauge, the "watchers" count blending real detectors + a hardcoded 2). The metric-honesty audit already
  ruled these **honestly labeled** ("declared: …", "not machine proof", "a keyword heuristic … not
  proof"). The only residual risk is presentational — an owner reading a color/number at a glance. **Not
  a correctness bug; no control warranted** (adding machinery to a correctly-labeled declaration would be
  the over-governance the yardstick forbids).
- **"Rules loaded" proves the file exists, not that the LLM obeys it.** Labeled as such in the UI
  ("proves load, not obey"). Irreducible — an LLM can't be made to provably obey; disclosed, not painted.

## Verdict
The honesty surface is genuinely strong and now more honest than a "fake metrics everywhere" fear implies:
the visible metrics fail closed, the three known soft-spots are fixed **and test-pinned** (the tests are in
the CI-run suites), and the anti-forgery seams hold. The one untested fail-closed contract — the
phase-progress meter itself, the number that gates the owner's sign-off — is now pinned by a
CI-run regression suite. The residues are honest labels on declared self-reports, not hidden greens.
