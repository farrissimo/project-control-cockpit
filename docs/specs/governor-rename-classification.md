# Governor rename classification   (status: active)

## Objective
The stakes manifest declares one rule named **`delete_or_rename`** (min tier T1, "removal is easy
to miss and hard to undo"). It fires for deletions but has **never** fired for renames: the
classifier derives its change lists with `git diff --diff-filter=A` / `--diff-filter=D`, and git
reports a rename as **`R`** — which is neither `A` nor `D`. So the rule's own name has been half
false since slice 1. Make the local classifier see a tracked rename, so the declared policy is the
enforced policy and the local gate agrees with trusted-main CI.

## Why it matters (the live failure, not a hypothetical)
CI's auditor classifies a commit from `git diff-tree` (plumbing: rename detection **off**), so it
sees a rename as delete + add and correctly calls it **T1**. The local gate classifies from
`git diff` (porcelain: rename detection **on** by default), sees `R`, and calls it **T3** — which
requires no receipt, so no `Verified-Receipt` trailer is emitted. The commit is then **impossible
to make compliant**: local refuses to ask for the trailer that CI demands. This is live now —
`9623e14` (a `git mv` of the owner-brain prompt) fails PR #37's CI for exactly this reason.

## Behavior
In git mode (no explicit `-Files`/`-Added`/`-Deleted` lists), the classifier reads rename status
**explicitly**: for each `R` entry, the **old** path counts as deleted and the **new** path counts
as added. Rename detection is forced on with `-M` rather than left to the `diff.renames` config, so
the verdict is deterministic on any machine. Deletions, additions and ordinary edits are unchanged.

Git output is taken **verbatim** (`Add-Path`), never comma-split. Git emits one path per line, so
splitting it would turn a tracked path legitimately containing a comma into two invented paths —
inflating the touched-file/area counts (which could trip `large_cross_cutting`) and possibly
glob-matching something the real path never would. `Add-Tokens`' comma splitting remains only where
its contract says so: the operator-supplied `-Files`/`-Added`/`-Deleted` lists.

Scope boundaries (deliberate):
- Only the **git-mode derivation** changes. The explicit-list path (`-Files`/`-Added`/`-Deleted`)
  is untouched, so CI's auditor — which passes explicit lists — keeps its current, correct verdict.
  The two converge on T1 from opposite directions.
- The `diff_id` / change-identity mechanism is **not touched**. `scripts/lib/change-identity.ps1`
  pins `--no-renames` on purpose, so the receipt binding stays byte-stable regardless of config.
  Tier classification and diff binding are separate concerns and stay separate.

## Honest residue (not pretended solved)
- **The explicit-list contract still cannot express a comma path.** `-Files`/`-Added`/`-Deleted` are
  documented as comma-separated, so a path containing a comma passed that way is still split into
  fragments. CI's auditor uses that path (`-Files ($files -join "\n")`), so for the exotic case of a
  tracked comma path, CI's file list can still fragment where local git mode no longer does. Tier
  impact is unlikely (fragments match no glob, so they land on the default tier, and the
  `delete_or_rename` count still fires) but it is not zero: fragments inflate the file/area counts
  `large_cross_cutting` reads. Fixing it means changing the documented CLI contract — out of scope
  here, and recorded rather than silently "handled".
- Paths are not un-quoted: under `core.quotepath` git may emit a non-ASCII path in quoted form. That
  is unchanged, pre-existing behavior on every derivation path, not introduced here.

## Acceptance criteria
- AC-1: WHEN a change stages a tracked rename THE SYSTEM SHALL classify it at least T1 and name
  the `delete_or_rename` escalation, identifying the vanished OLD path.
- AC-2: WHEN a change deletes a tracked file THE SYSTEM SHALL classify it at least T1 and name
  the `delete_or_rename` escalation (existing behavior preserved).
- AC-3: WHEN a change only edits the content of an existing ordinary file THE SYSTEM SHALL NOT
  report a `delete_or_rename` escalation.
- AC-4: WHERE the local classifier and CI's auditor derivation examine the same tracked rename
  THE SYSTEM SHALL classify both at least T1 (the local/CI deadlock is closed).
- AC-5: IF the local git config disables rename detection (`diff.renames false`) THE SYSTEM SHALL
  still classify a tracked rename as at least T1 (deterministic, not config-dependent).
- AC-6: WHEN the fixture test runs the copied classifier THE SYSTEM SHALL classify the fixture
  repository's own change, proven by a fixture-unique path appearing in the reported `files`
  (never PCC's working tree).
- AC-7: WHEN a renamed tracked path contains a comma THE SYSTEM SHALL report that path intact and
  SHALL NOT split it into fake paths.

## Tests
`app/tests/scripts/classify-stakes.spec.js` — drives the REAL classifier, copied into a throwaway
git repo (the proven `makeRepo` pattern from `governance-gate.spec.js`), so `$PSScriptRoot`
resolves inside the fixture and `Set-Location $repo` lands there. AC-1, AC-2, AC-3, AC-5, AC-6 and
AC-7 run real `git mv` / `git rm` / content edits in that fixture; AC-4 asserts the auditor's
`git diff-tree` derivation and the local git-mode derivation agree on the same rename.

Test honesty (why these can't be vacuous): the fixture pins `diff.renames` explicitly rather than
inheriting the machine's config. AC-1/AC-4/AC-7 pin it **true** — the exact condition that was
broken — and assert git really returned `R` before trusting the verdict; without that pin they
could pass against the PRE-FIX classifier on a machine with rename detection off (where git reports
a plain D+A the old code already caught). AC-5 pins it **false** and is a config-independence guard,
green both before and after the fix, not a red-before-green test. Verified red-before-green against
the pre-fix classifier at HEAD: the two AC-1 tests, AC-7 and AC-4 fail (4 failed / 16 passed);
AC-2, AC-3 and AC-5 stay green. AC-7 was separately proven to bite by reintroducing only the
comma-splitting defect, which made it report the invented fragments `docs/renamed` / `with comma.md`.
