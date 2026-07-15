---
status: Accepted
date: 2026-07-15
deciders: owner (product lead), Claude (worker), Codex (independent verifier), GPT (independent 3rd verifier)
---

# ADR-0008: Judge governor changes from `main`'s trusted copy (self-modifying enforcement)

## Context and Problem

The governor's server-side teeth (ADR-0007) are the CI trailer audit + branch protection. But **CI
checks out the PR branch and runs THAT branch's copy** of the machinery that judges it: the classifier
(`scripts/classify-stakes.ps1`), the auditor (`scripts/audit-verification-trailers.ps1`), the shared
libs (`scripts/lib/*`), and the stakes manifest (`.cockpit/state/stakes-manifest.json`).

So a single PR can **weaken the judge and have the weakened judge approve itself**: e.g. re-tag the
governor files to T4 in the manifest, or make the auditor's re-derivation always return PASS, in the
same PR that carries an unverified change. Tagging those files T0 (`governor_self_edit`) does **not**
help — the *modified* auditor is what runs. GPT's independent third verification flagged this as the
deepest finding (Critical #1). It is the classic self-referential-enforcement hole.

The honest boundary (adopted from GPT, ADR-0007): governance holds for a **cooperative** worker; an
**adversarial** worker with repo write access is not fully contained. This ADR closes as much of that
gap as code can in a single-owner repo, and states plainly what only an owner-side setting can close.

## Decision

**Judge every PR with the governor fetched from `main`, not the PR's own copy.**

1. In CI, after fetching `origin/main`, materialise `main`'s governor via
   `git worktree add --detach <trusted> origin/main` (a worktree shares the object store, so it can
   see the PR's fetched commits while its *files* are `main`'s).
2. Run the trailer audit **from `<trusted>`**: `<trusted>/scripts/audit-verification-trailers.ps1`,
   whose dot-sourced libs, the classifier it invokes, and the manifest it reads all come from
   `<trusted>` (= `main`). Only the **commit objects being judged** come from the PR.
3. Compute the audit **range** inline in the CI workflow from GitHub's event context, using EXPLICIT
   SHAs, and pass it to the auditor's stable `-Range` interface. The range is *what to judge*, not
   *how*; its INPUTS (`github.sha`, `github.event.before`, `github.event.pull_request.head.sha`,
   `github.ref_name`) are set by GitHub and un-forgeable by a PR — but the bash that reads them lives
   in `ci.yml`, which is PR-controlled until O1/O2 are active, so the computation itself is trusted
   only under those owner-side controls (it is not independently "trusted CI"). On a `pull_request`
   event `github.sha` is the ephemeral merge commit, so the PR's **real head SHA** is
   `github.event.pull_request.head.sha` (and `github.sha` on a push); the range is
   `merge-base(origin/main, head)..head`, or the push's `before..sha` on a direct push to the default
   branch (**fail closed** on an empty range). Computing the range inline — rather than running a
   resolver script from the worktree — is deliberate: a detached worktree's literal `HEAD` resolves
   to `main` (an empty range / vacuous pass, caught on the first live CI run), and running a resolver
   from the PR checkout would let a PR narrow its own audit range. The stable `-Range` interface also
   avoids a **bootstrap** where a range-interface change could not judge its own introducing PR.
   *Honest edge:* a `workflow_dispatch` or a feature-branch push whose head == `origin/main` can yield
   an empty merge-base range and a 0-commit audit — not a merge route (so not a bypass), but such a
   0-commit pass is not evidence any commit was examined.
4. A change that *improves* the governor therefore takes effect **only after it is itself merged** —
   judged on the way in by the prior, trusted copy. This is the correct, conservative direction: the
   governor can be strengthened, but a PR cannot install a weaker judge and be waved through by it.

**Honest limits (stated, not hidden — expanded per GPT's 2026-07-15 review):**
- **`ci.yml` still runs from the PR branch.** GitHub runs the workflow file from the PR head for
  same-repo PRs, so a PR that edits `ci.yml` to *remove or neuter the trusted-audit step itself* is
  NOT closed by this decision. This shrinks the trusted surface to exactly **`ci.yml` + branch-
  protection settings** — no longer the whole governor. Those two are closed only by owner-side
  **O2** (required human review / CODEOWNERS on `ci.yml` + governor files) and **O1** (branch
  protection active + required). Code makes self-weakening require getting past `main`'s auditor
  **AND** an owner review gate; it cannot make it impossible in a repo where the owner holds admin.
- **O2 is not self-satisfiable in a single-account repo.** GitHub generally does not let a PR's own
  author satisfy a required-review rule. So required review on the governor files is either (a)
  **unenforceable** if the owner is the only identity (an author cannot approve their own PR, so the
  rule blocks *every* governor change including legitimate ones), or (b) it demands a **second
  trusted reviewer identity**. O2 is therefore a real operational decision, not a checkbox: the owner
  must decide between a second reviewer identity and accepting that governor changes are
  self-approved (admin-merged) with only the trusted-`main` audit + CI as the check. This ADR does
  not pretend O2 is free.
- **The trusted judge is only as trustworthy as `main` itself.** Judging from `origin/main` protects
  against a PR *weakening the governor relative to an already-trusted `main`*. It does nothing if
  `main` was **previously compromised, force-rewritten, or an admin bypassed protection to land a
  weakened governor** — the worktree then faithfully runs the compromised judge. This sits beside the
  admin-bypass residue, not merely implied by it.
- **Single-owner admin bypass** remains (branch protection can be toggled by the admin). Accepted.

## Consequences

- **Gain:** the classifier / auditor / libs / manifest can no longer be weakened by the same PR that
  benefits — the trusted surface shrinks from "the whole governor" to "`ci.yml` + branch-protection
  settings," which the owner-side review gate covers.
- **Cost:** one `git worktree` step in CI; the audit runs against `main`'s auditor (a bootstrap
  assumption: `main` must already carry the auditor — true post-Hardening-A). A governor *improvement*
  is enforced one merge late (by design).
- **Residue (accepted, documented — carried forward, not re-solved):**
  - `ci.yml` self-edit + branch-rules/required-check config are the **final trusted surface**;
    closed only owner-side (O1/O2), never by code.
  - **Admin bypass** and a **pre-compromised/force-rewritten `main`** (the trusted judge runs whatever
    `main` holds).
  - **Forged PASS** stays accepted (ADR-0007) — unchanged by this ADR.
  - **Merge-only content is unaudited:** the audit skips merge commits, so conflict-resolution content
    introduced *only* in a merge commit is not checked (low practical risk; noted, not over-built).
  All belong on the future Known Residual Risks billboard. This ADR is **necessary but not
  sufficient** without O1/O2.

## Confirmation

Independent review (GPT, remote repo read, 2026-07-15) judged the trust model **SOUND** and
recommended **BUILD** — with the two honest limits above (O2 self-satisfiability; trust is relative to
an uncompromised `main`) folded in as conditions of acceptance. **Owner approved BUILD 2026-07-15**
(Accepted). It is confirmed **in its slice**: an adversarial
regression test proves a PR that re-tags/weakens the governor in its own tree is still judged by
`main`'s copy and FAILS the CI audit; CI green on the exact commit; independent `codex exec` review
per ADR-0005. **Success metric:** a crafted "self-weakening" PR that passes under the current
PR-checkout audit must FAIL under the trusted-`main` audit — demonstrated red→green. If the machinery
adds disproportionate CI complexity for the residual (single-owner) threat, it is not built; the
owner-side review gate (O2) is then the primary mitigation and this ADR records that choice.

## Engagement

- **Claude worker:** builds the trusted-worktree CI step + the adversarial test; unchanged otherwise.
- **Codex verifier:** code-review authority (ADR-0005/DECISION-105); CI is execution + audit.
- **CI / branch protection:** runs the audit from `main`'s copy; branch protection blocks the merge on
  failure. Its guarantee is conditional on O1/O2 (see Related).
- **Owner:** owns O1 (confirm branch protection) and O2 (required review on `ci.yml` + governor
  files) — the half of this defense that code cannot provide. Approves Proposed → Accepted.
- **Spawned projects:** the trusted-worktree audit step travels via the scaffolder (DECISION-113
  parity, ADR-0004), so new projects inherit the same self-modification defense.

## Supersedes / Related

Completes ADR-0006 (governor) and ADR-0007 (durable trailer) by closing the code-half of the
self-modifying-enforcement hole. Related: `docs/proposals/governance-hardening.md` (T2 + O1/O2),
`docs/specs/governance-hardening.md`, and the GitHub branch-protection backstop. Does not change the
accepted forged-PASS residue (ADR-0007).
