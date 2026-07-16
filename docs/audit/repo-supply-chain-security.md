# Audit grid — Repo & supply-chain security   (ADR-0009 category; status: done)

**Scope:** the CI pipeline and dependency posture — is the build itself a trustworthy, un-tamperable authority,
or an attack surface? Phase 3 shipped the hardening; this audit confirms it holds. Graded against the integrity
contract Part 1 and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** verified least-privilege permissions, action pinning, `npm audit`
gating, dependency/lockfile posture, and the judge-from-trusted-main supply-chain angle — each checked directly,
not trusted from the Phase-3 record. **Verdict: tested, holds.** No unpinned action, no missing-permissions
workflow, `npm audit` genuinely gates. No control built.

## Grid

| Practice | State | Proof (verified this audit) | Benefit | Gaps |
|---|---|---|---|---|
| **Least-privilege CI token** | machinery-enforced | `ci.yml`: top-level `permissions: contents: read` (verified); no job-level re-grant | A compromised step can't write to the repo | — |
| **All actions SHA-pinned** | machinery-enforced | the only two `uses:` (`actions/checkout`, `actions/setup-node`) are pinned to 40-char commit SHAs (verified); floating tag is a trailing comment only | A hijacked upstream tag can't inject code | — |
| **Dependabot keeps pins fresh** | machinery-enforced | `.github/dependabot.yml`: `github-actions`-only, monthly (npm bump noise deliberately declined, delegated to `npm audit`) | Pinned actions don't rot silently | — |
| **`npm audit` gates on high/critical** | machinery-enforced | `ci.yml` `npm audit --audit-level=high`, a plain `run:` with **no `continue-on-error`** (verified) → a high/critical advisory fails the build | Known-vulnerable deps block the merge | runs after tests (still fails the job) |
| **Reproducible install** | machinery-enforced | `ci.yml` uses `npm ci` from the committed `app/package-lock.json` (`lockfileVersion 3`) | Clean-room, lockfile-bound installs | — |
| **Minimal dependency surface** | machinery-enforced (by construction) | `app/package.json` has **zero** production `dependencies` (`{}`); 362 lockfile entries all `dev: true` (verified) | Nothing ships to the user but Electron + PCC's own code | — |
| **Single hardened workflow** | machinery-enforced | only `ci.yml` exists (verified) — no second, less-locked-down workflow | No unhardened backdoor pipeline | — |
| **Judge-from-trusted-main** (ADR-0008) | machinery-enforced | the trailer auditor runs from a detached `origin/main` worktree; audit range computed from un-forgeable GitHub event inputs → a PR can't weaken/re-derive its own audit | The self-governing CI can't be neutered by a PR's own tree | see residue |

## Disclosed residue (already owner-accepted — cross-reference, not re-litigated)
The ADR-0008 self-modifying-enforcement boundary: the trusted surface narrows to exactly **`ci.yml` itself +
branch-protection settings**, which run from the PR branch and are therefore NOT closed by the trusted-`main`
audit. A PR that edits `ci.yml` to neuter the audit/permissions/pins is closed only by **owner-side O1 (branch
protection, DONE/confirmed) + O2 (Code-Owner review, deliberately LEFT OFF in a single-account repo)**. This is
an **already-disclosed, owner-accepted residue** (ADR-0008 "Honest limits"; PROJECT.md O1/O2) — an owner-side
GitHub-settings activation gap, not a code hole. `.github/CODEOWNERS` is in place for a one-toggle enable if a
second human ever gets write access. Not re-decided here.

## Verdict against the integrity contract
Repo & supply-chain security is **strong and tested-holds** — every Phase-3 hardening claim was verified directly
this audit: least-privilege token, SHA-pinned actions, gating `npm audit`, `npm ci` from a committed lockfile,
zero production deps, a single hardened workflow, and a judge-from-trusted-main auditor a PR can't re-derive. The
one residue (ci.yml self-edit) is the already-owner-accepted ADR-0008 boundary, not a new hole. **No control
built** — the expected outcome.
