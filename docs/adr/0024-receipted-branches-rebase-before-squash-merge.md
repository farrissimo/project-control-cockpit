---
status: Proposed
date: 2026-07-25
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0024: Receipted branches rebase (fresh receipt) before a squash-merge, or merge as a merge commit

## Context and Problem

On 2026-07-25 the post-merge CI on `main` HEAD (`183e98c`, the squash-merge of PR #73 / ADR-0022)
went **red** on one step only — "Audit verification trailers" — with
`trailer diff_id does not match the commit content (tampered or forged)`. The app itself was healthy
(doctor OK, unit 349/349, lint clean); the trailer audit runs first and aborted the job, so lint/unit/
E2E were skipped, not failed.

Root cause (diagnosed from the scripts + commit graph, confirmed by Codex): a `Verified-Receipt`
trailer binds `diff_id = hash(base + git diff base..commit)`, where `base` is the merge-base recorded
when the receipt was written on the feature branch. PRs #72 and #73 both branched from the same point
(`d3627f2`) and recorded `base=d3627f2`. #72 squash-merged first, moving `main` to `4480a20`. #73 then
squash-merged **on top of** #72, but its receipt still said `base=d3627f2`; the audit re-derives
`git diff d3627f2..183e98c`, which now also contains #72's changes, so the hash no longer matches.
It passed on #73's own PR (base was still the parent there) and only tripped on the post-merge push.

Generalized (Codex): this bites whenever **a receipted branch is squash-merged after `main` has moved
past the receipt's recorded base** — not only the same-fork-point case. The disclosed-bypass ledger
(ADR-0008) cannot retroactively rescue such a commit: the audit fails the diff_id re-derivation
*before* the bypass lookup, and the ledger entry would have to live inside that already-merged commit.
Merge commits (e.g. PR #71 / `d3627f2`) are immune because the branch's original non-merge commits
keep their real ancestry, which is what the audit checks.

## Decision

**A receipted (T0/T1) branch must be up to date with `main` and carry a freshly regenerated receipt at
the moment it is squash-merged — or it is merged as a merge commit instead of a squash.**

Operationally, before merging a receipted PR:
1. Ensure the branch is rebased onto the current `origin/main` (so the receipt's `base` equals the
   commit's parent at land time), and regenerate the receipt with
   `scripts/write-verification-receipt.ps1` after any rebase; **or**
2. merge it as a real merge commit (the branch's original commits retain their recorded base).

We deliberately do **not** weaken the governor to "tolerate base drift" — that would erode the
diff-binding contract (ADR-0007/0008) that makes a receipt meaningful. The self-healing property is
noted for operators: CI audits only each push's own range (there is no scheduled/full-history
re-audit), so a historically red squash-merge commit is never re-checked, and the next correctly
receipted commit on `main` returns HEAD to green. A red mark left in history is still a governance
smell to avoid, which is what this policy does.

## Consequences

- Sequential in-flight receipted PRs no longer red `main` on merge; the diff-binding contract is kept
  intact rather than loosened.
- Small added merge-time step (rebase + fresh receipt, or choose merge commit) for receipted PRs only;
  trivial for a solo, one-PR-at-a-time cadence.
- No code/runtime change and no governor change — this is a process/policy record, kept separate from
  the ADR-0023 product behavior so repo hygiene doesn't blur with product design.

## Confirmation

- The failure and mechanism are proven from the live artifacts: the red CI step on `183e98c`, the
  matching `base=d3627f2` in both #72's and #73's trailers, and the audit logic in
  `scripts/audit-verification-trailers.ps1` (re-derive-then-fail before the BYPASS path) and
  `scripts/lib/change-identity.ps1` `Get-CommitDiffId` (diffs recorded-base → commit).
- Self-heal is proven from `.github/workflows/ci.yml`: the audit range is `before..sha` on a push to
  `main` and `merge-base(origin/main, head)..head` on a PR — no `schedule`/full-history re-audit — so
  the next well-based commit greens HEAD (this ADR's own PR is that commit).
- Policy adherence is operational, not a runtime test: this PR was branched from the current `main`
  tip and is the only receipted PR in flight, so its recorded base equals its landed parent.

## Engagement

- **Owner:** no action; a red `main` from this class of merge stops recurring. Merges stay a one-click
  step; PCC's own machinery no longer looks broken during the trust trial.
- **Claude worker:** rebases each receipted branch onto current `main` and regenerates the receipt
  right before the owner merges (or requests a merge commit), and diagnosed/recorded this policy.
- **Codex verifier:** confirmed the root cause, corrected its scope (any post-base-move squash), and
  advised against weakening the governor.
- **Future chats:** follow this before merging any T0/T1 PR; do not add governor tolerance for base
  drift.

## Supersedes / Related

Related: ADR-0007 (verification receipts / diff-binding), ADR-0008 (disclosed-bypass ledger — cannot
rescue an already-merged base-drift commit), and ADR-0022/ADR-0023 (the receipted PRs whose merge
sequence surfaced this). No decision is superseded.
