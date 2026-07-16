# Audit grid — Verification & proof-of-done   (ADR-0009 category; status: done)

**Scope:** the machinery that decides whether work is actually "done" and proven — independent
verification, the diff-bound receipt, the governance gate, the CI-audited trailer, the release gate, CI
as clean-machine execution proof, and the proof taxonomy. Graded against the integrity contract
(`ENGINEERING_ASSURANCE_PLAN` Part 1, esp. rule 7 "verification is commit-bound") and the ADR-0009
yardstick.

**Method (ADR-0009 operating rule — probe freely, standardize rarely):** this category was **built over
the whole governance arc in response to real, repeated failures** (fake-green incidents, a 7-hour hang,
GPT catching defects Codex + the local suite missed). So the honest headline is **"tested, holds"** for
almost everything — it already cleared the bar the hard way. The probe found **one** gap that cleared the
build bar and **one** trivial honesty drift; everything else is recorded as holding, briefly.

## Probe results

| Practice | Verdict | Evidence |
|---|---|---|
| **Independent verification (Codex)** — verifier reviews the exact diff, returns `VERDICT/EVIDENCE/NOT PROVEN` | **tested, holds** (with an accepted residue) | ADR-0005; `AGENTS.md` protocol; `verify-evidence.ps1` assembles the commit range/CI state (`verify-evidence.spec.js`, 12). **Residue (already accepted):** it's a process rule — nothing forces that an independent verifier actually ran; the receipt is worker-attested. Disclosed, not new. |
| **Verification receipt** — verdict bound to the exact staged diff via `diff_id` | **tested, holds** | `schemas/verification-receipt.schema.json`; `write-verification-receipt.ps1`; `receipt-check.ps1` + `change-identity.ps1`. `diff_id` = SHA-256 over the staged index vs base, re-derived byte-identically at audit time. Exercised in `governance-gate.spec.js` (13). |
| **Governance gate** — blocks a T0/T1 staged change lacking a valid receipt; fail-closed on UNKNOWN | **tested, holds** | `run-governance-gate.ps1`, pre-commit-wired; ADR-0006; `governance-gate.spec.js` (13), `classify-stakes.spec.js` (13), `governance-hardening.spec.js` (5, drives the real fail-closed path). |
| **CI-audited trailer** — durable `Verified-Receipt` re-derived + enforced in CI from trusted `origin/main` | **tested, holds** | ADR-0007/0008; `emit-verification-trailer.ps1`, `audit-verification-trailers.ps1`; CI runs the auditor from a detached `origin/main` worktree (judge-from-main); `verification-trailer.spec.js` (10) + adversarial self-weakening case. |
| **Release gate** — one fresh-run PASS/FAIL/UNKNOWN over CI truth + suites + sync + detectors | **tested, holds** | `run-release-gate.ps1`; `release-gate.spec.js` (19), `ci-consumers.spec.js` (13), `ci-status.spec.js` (8). On-demand by design (not per-push) — correct: it answers "is THIS commit releasable now?", a release question, not a commit gate. |
| **CI as clean-machine execution proof** | **tested, holds** | `.github/workflows/ci.yml`: SHA-pinned actions, least-privilege `contents: read`, runs adr-check + trailer-audit + lint + unit + full guarded E2E + `npm audit`. DECISION-105 (execution proof and code-review never wear the same green). |
| **Proof taxonomy / commit-bound trust surface** | **tested, holds** | `app/ci-status.js` (green only on exact-SHA live CI), `app/renderer/verification-parse.js` (record-file execution claims rejected as forgery surface); `ci-status.spec.js` (8), `verification-parse.spec.js` (8). |
| **Branch protection is actually ON** (the precondition every "un-bypassable" claim rests on) | **gap found → control built** | see below |

## The one gap that cleared the build bar → FIXED
**Nothing checked that GitHub branch protection was actually on.** Every server-side "un-bypassable"
claim (required `test` check, CI-enforced trailer, no direct pushes) rests on it, yet it was an
**owner-asserted setting (O1)** that no script verified — and `ci.yml`/ADR-0008 both state "the system does
not self-verify it." That is the single highest-leverage unproven precondition in the whole trust surface:
one toggle silently voids the guarantee. It clears the bar decisively — credible (a settable GitHub
option), consequential (everything downstream), cheap, and testable.

**Built:** `scripts/check-branch-protection.ps1` queries the GitHub rulesets API and verifies the real
contract — an **active** ruleset covering the default branch, **empty bypass list**, requiring the `test`
check + a pull request, blocking deletion + force-push. It **fails closed**: `PASS` only when every
requirement holds; `FAIL` only when protection is definitively absent/weakened (with reasons); `UNKNOWN`
(never PASS, and never a false "unprotected" FAIL) when the API/auth/`gh` is unavailable or a read can't be
parsed. Tests: `app/tests/scripts/check-branch-protection.spec.js` (9, fixture-driven verdict logic + the
fail-closed list/read classification). **Run live 2026-07-15 → PASS** (`ruleset 'protect-main'`), converting
O1 from an assertion into a **checked fact**. *Honest limitation (in the script header):* it evaluates each
ruleset individually (one ruleset must satisfy the whole contract — PCC's case); protection split across
multiple rulesets could read as a false FAIL — fail-safe (a false alarm, never a false green). Union
evaluation deferred until a project needs it.

*Recommendation (not auto-built — owner decides the enforcement surface):* wire this into the release gate
and/or surface it on the app trust strip, so the "un-bypassable" chip reflects a live check rather than an
assumption. Building the detector was the minimum durable control; choosing where to enforce it is a
separate, cheap follow-up.

## Trivial honesty drift → FIXED
`PROJECT.md` said `governance-gate.spec.js` had **(11)** tests; it has **13**. Stale count corrected
(claims-match-implementation, Rule 2). Cheap; not a functional gap.

## Accepted residues (already disclosed elsewhere — recorded here, not re-litigated)
Forged-PASS (a correctly-bound hand-written PASS trailer is accepted — CI checks binding, not
truthfulness; signing deferred until a real forgery occurs) · worker-attested receipt · path-granularity
gaming (file-level tiering) · assertion-level test weakening not auto-detected · `ci.yml` self-edit +
branch-protection config are the final owner-side trusted surface · admin bypass / pre-compromised `main`
(single-owner repo). These are the honest boundary: **governance holds for a cooperative worker; an
adversarial worker with write access is not fully contained** — stated, not painted over.

## Verdict
Rule 7 (commit-bound verification) and the proof taxonomy are enforced by tested machinery, earned by real
past failures. The probe added the one missing live check (branch protection) and corrected one stale
count. **Tested, holds — with one control built and the boundary disclosed.**
