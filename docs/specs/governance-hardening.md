# Governance Hardening — honesty + fail-closed fixes   (status: active)

## Objective
Close real defects an independent third verification (GPT, remote repo read) found in the governor
(ADR-0006 Gate, ADR-0007 Trailer) that the local suite and `codex exec` both missed, and fix the
overclaiming ("fake-green") wording that is precisely the disease PCC exists to kill. Source of the
fix list: `docs/proposals/governance-hardening.md`.

**Sub-slice A** (shipped): the honesty wording (H1–H5), the direct-push empty-range bug (T1), and the
fail-open-without-`pwsh` hook (T3). **Sub-slice B** (this section, T2 / ADR-0008): the deepest finding
— self-modifying enforcement — closed by judging every PR from `main`'s trusted governor copy.

## Behavior

### T1 — the CI audit range must never vacuously pass on a push to the default branch
The CI trailer audit ran over `base=$(git merge-base origin/main HEAD); "$base..HEAD"`. On a `push`
event **to `main`**, the pushed commit *is* `origin/main`, so the range collapses to `HEAD..HEAD`
(empty) and the audit passes without inspecting the pushed commit. Masked today only by branch
protection blocking direct pushes — a latent hole if that protection is off.

`scripts/resolve-audit-range.ps1` computes the range from the CI event context (deterministic, git
only, no LLM):
- `pull_request` → `merge-base(<base-ref>, HEAD)..HEAD` (the PR's own commits; unchanged behavior).
- `push` to the **default branch** → the push's real range `<before>..<sha>`. **Fail closed** (exit
  non-zero) if that range is empty/unusable (a zero `before`, or an **empty range** — no commits at
  all, e.g. `before == sha`) — never emit an empty range that would pass vacuously. Emptiness is
  measured on the TOTAL commit count, not the non-merge count: a legitimate **merge-only** push (the
  merge commit introduces no new non-merge commits) still passes, because the audit skips merge
  commits and correctly finds nothing crucial to check.
- `push` to a **non-default branch** → `<before>..<sha>` when `before` is real, else
  `merge-base(<base-ref>, HEAD)..HEAD`. An empty range here is allowed (the PR audit is the gate).
- `workflow_dispatch` / anything else → `merge-base(<base-ref>, HEAD)..HEAD` (re-measure context; not
  a gate, so an empty range is allowed).

CI calls the resolver, aborts the job if it fails closed, then runs the existing audit over the
resolved range.

### T3 — the pre-commit hook must fail closed, not vanish, when `pwsh` is missing
`.githooks/pre-commit` guards the ADR + governance gate with `command -v pwsh`. With no PowerShell the
gate silently skips and the commit proceeds — a supposedly always-on gate that disappears (a
cross-platform / stripped-environment fail-open; Windows-first, so `pwsh` is normally present).

When `pwsh` is absent, the hook cannot run the classifier, so it approximates "is this crucial?"
from git facts readable in `sh` and fails **closed**: it BLOCKS the commit when **any** staged
deletion/rename is present (the classifier escalates `delete_or_rename` to ≥ T1, and `archive/**`
deletions to T2), or when **any** staged path falls outside a small, conservative **noise allowlist**
(`backlog/**`, `docs/proposals/**`, `docs/brainstorms/**` — pure T4 paths with no path-based
escalation; `archive/**` is deliberately excluded because its deletions/rewrites escalate).
Default-block resists manifest drift — a newly-added crucial path is blocked by default. If **either
`git` query itself fails** (non-zero exit), the hook fails **closed** rather than read the empty
output as "nothing crucial staged". The fallback is coarse on purpose (it does not detect exotic
escalations like 26+ noise files); the CI audit, which HAS `pwsh`, is the real net. The block message
states the cause and the escape (`git commit --no-verify`, which CI still audits).

### T2 — CI must judge a PR from `main`'s trusted governor, not the PR's own copy (ADR-0008)
CI checked out the PR branch and ran **that branch's** copy of the classifier / auditor / libs /
manifest / resolver — so a PR could weaken the judge and have the weakened judge approve itself.
The CI audit step now:
- fetches `origin/main` and materialises it via `git worktree add --detach <trusted> origin/main` (a
  worktree shares the object store, so `main`'s scripts can inspect the PR's fetched commits);
- runs the **resolver from `<trusted>`**, passing `-Head <the PR's real head SHA>` so the range is
  anchored to the PR's own commits by explicit SHA (on a `pull_request` event `github.sha` is the
  ephemeral merge commit, so CI passes `github.event.pull_request.head.sha`; `github.sha` on a push).
  Literal `HEAD` in the worktree would resolve to `main`;
- runs the **auditor from `<trusted>`** over that range — its libs, the classifier it invokes, and the
  manifest it reads all come from `main`. Only the commit objects being judged come from the PR.

A governor *improvement* therefore takes effect only after it is itself merged (judged on the way in
by the prior trusted copy). **Honest limit:** `ci.yml` itself still runs from the PR branch, so a PR
that edits `ci.yml` is closed only by owner-side required review (O2) + branch protection (O1); the
`.github/CODEOWNERS` file marks the governor files for that review. See ADR-0008 for the full trust
model and residues.

### H1–H5 — wording must match behavior (anti-fake-green)
- **H1** "un-bypassable" is qualified everywhere it appears: the server-side backstop is un-bypassable
  **only if** branch protection is active + required, work enters via PR (not direct push), and the PR
  does not weaken the audit machinery — none of which the system self-verifies today.
- **H2** "catches a forged trailer" → catches a **malformed / mismatched / invalid-BYPASS** trailer;
  it does **not** catch a correctly-bound *fabricated PASS* (accepted residue, ADR-0007).
- **H3** "verified" is renamed to **attestation / attested** in the audit output, spec, and PROJECT.md.
  The audit proves a valid, diff-bound *claim of* verification, not that verification happened.
- **H4** the manifest `weakened_tests` rule prose is aligned to the actual behavior (escalates on test
  **deletion**; assertion-level weakening is explicitly NOT auto-detected — as the classifier's
  `not_proven` already admits).
- **H5** "ungameable" / "one place a chat can't dodge" are qualified: the local gate IS dodged with
  `--no-verify`, and path-tagging is explicitly not ungameable.

## Acceptance criteria
- AC-1: WHEN the event is a `push` to the default branch AND the resolved `<before>..<sha>` range is
  empty (no commits at all, e.g. `before == sha`) THE resolver SHALL exit non-zero (fail closed),
  never emit an empty range.
- AC-2: WHEN the event is a `push` to the default branch with a real multi-commit range THE resolver
  SHALL emit `<before>..<sha>` so the pushed commits are audited (not `HEAD..HEAD`).
- AC-3: WHEN the event is a `pull_request` THE resolver SHALL emit `merge-base(<base-ref>,HEAD)..HEAD`.
- AC-3b: WHEN the event is a `push` to the default branch whose range contains commits but only a
  merge commit (no new non-merge commits) THE resolver SHALL emit the range (exit 0), not fail closed
  — the audit skips merges and correctly passes.
- AC-4: WHEN `pwsh` is absent AND a crucial (non-noise) path is staged THE pre-commit hook SHALL exit
  non-zero (block) with a message naming the cause and the `--no-verify` escape.
- AC-4b: WHEN `pwsh` is absent AND a staged deletion is present (even of a noise path) THE pre-commit
  hook SHALL exit non-zero (block) — deletions escalate to ≥ T1.
- AC-4c: WHEN `pwsh` is absent AND a `git` query used to inspect the staged change fails (non-zero
  exit) THE pre-commit hook SHALL exit non-zero (block) — empty output from a failed command SHALL
  NOT be read as "noise only".
- AC-5: WHEN `pwsh` is absent AND every staged path is a non-deleting noise-allowlist path THE
  pre-commit hook SHALL exit 0 (allow).
- AC-6: THE governor wording (scripts, hooks, specs, ADRs, manifest, PROJECT.md) SHALL contain no
  unqualified "un-bypassable" / "ungameable" / "catches a forged trailer" / bare "verified"-as-proof
  claim — each is qualified or renamed per H1–H5.
- AC-B1: WHEN the resolver is given an explicit `-Head <sha>` THE emitted range SHALL end at that SHA
  (never literal `HEAD`), so it is correct when run from a detached `origin/main` worktree.
- AC-B2: WHEN a PR weakens the classifier in its own tree alongside an unverified T0 change, THE audit
  run from the PR's own copy SHALL wrongly PASS, but THE audit run from a trusted `origin/main`
  worktree SHALL FAIL — self-modifying enforcement is closed for the governor scripts.

## Tests
- `app/tests/scripts/governance-hardening.spec.js` — drives the REAL `resolve-audit-range.ps1` and the
  REAL `.githooks/pre-commit` in throwaway git repos:
  - AC-1: a push-to-`main` whose range is empty → resolver exits non-zero.
  - AC-2: a push-to-`main` with commits → resolver emits `<before>..<sha>`.
  - AC-3: a `pull_request` event → resolver emits the merge-base range.
  - AC-3b: a push-to-`main` whose range is a single merge commit → resolver emits the range (exit 0).
  - AC-4: `pwsh` scrubbed from PATH + a staged T0 path → hook blocks (exit 1).
  - AC-4b: `pwsh` scrubbed from PATH + a staged deletion of a noise path → hook blocks (exit 1).
  - AC-4c: `pwsh` scrubbed from PATH + a failing `git` query (run in a non-git dir) → hook blocks (exit 1).
  - AC-5: `pwsh` scrubbed from PATH + only a `backlog/` add staged → hook allows (exit 0).
  - AC-B1: resolver with `-Head <sha>` → range ends at that SHA, never literal `HEAD`.
  - AC-B2: a self-weakening "PR" (weakened classifier + unverified T0, no trailer) → audit from the
    PR's own copy PASSES (the hole), audit from a trusted `main` worktree FAILS (the fix).
- AC-6 is verified by review + the resolver/hook tests; the wording changes carry no runtime surface.
