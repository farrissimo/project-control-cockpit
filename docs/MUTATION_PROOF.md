# Targeted Mutation Proof (Phase 4 Slice 1)

## What this is
A small, deterministic harness that answers one question with repeatable evidence:

> When an **integrity-critical behavior is deliberately broken, does the test that is
> supposed to catch it actually fail?**

A green test suite only proves the tests *pass today*. It does **not** prove the tests
would *notice* if the protected behavior regressed — a test can pass for the wrong
reason, or assert nothing that matters. This harness closes that gap for a **fixed,
hand-picked set** of the behaviors PCC most depends on.

It is **not** a mutation-testing rollout and **not** a mutation-score dashboard.

## How it works
- `scripts/mutation-manifest.json` — a declarative list. Each entry names one behavior,
  the **exact single-site source edit** that breaks it, and the **existing focused test**
  that must catch it. The harness never invents mutations.
- `scripts/run-mutation-proof.ps1` — a thin orchestrator. For each mutation it:
  1. mirrors `app/` source into a **throwaway scratch copy** nested at
     `app/.pcc-mut-tmp/<id>/` (git-ignored). `node_modules` is never copied or linked —
     a Playwright detector resolves it by Node's normal **upward** module resolution to
     the real `app/node_modules`, which is only ever **read**;
  2. requires the `find` string to occur **exactly once** (else `INVALID`);
  3. requires the detector test to **PASS** on the un-mutated copy (baseline; else `INVALID`);
  4. applies the mutation, and requires `node --check` to still parse (else `INVALID`);
  5. runs the detector: a real test **failure → `KILLED`**; still **passing → `SURVIVED`**;
     a **timeout / crash / no-test-ran → `INVALID`** (never a false kill);
  6. restores the original bytes and requires the detector to **PASS again** (determinism).

**Real data and tracked source are never modified.** The app's real source, `node_modules`,
and project data (`chats.json`, `PROJECT.md`, `.cockpit/state`, any tracked file) are only
ever **read**. The tool's only writes are to two **git-ignored, designated output** locations:
the ephemeral scratch copy under `app/.pcc-mut-tmp/` (created per run and deleted at the end
unless `-KeepTemp` is passed, like `test-results/`) and the receipt under `.cockpit/evidence/`
(same convention as the release gate). The scratch copy contains **no links** (nothing is junctioned or symlinked), so its
recursive cleanup can never follow a link into real data, and a guard confirms it only ever
deletes under `app/.pcc-mut-tmp/`.

Output: a git-ignored, commit-bound receipt at
`.cockpit/evidence/mutation-proof.json` (and, with `-Json`, the same to stdout). Exit
code is `0` **only if every mutation is `KILLED`**.

## The current target set (one per integrity priority)
| id | behavior deliberately broken | detecting test |
|----|------------------------------|----------------|
| M1 | atomic write fails closed on an unreadable current file (preserve prior generation) | `atomic-store.test.js` |
| M2 | CI chip is green only for the **exact** commit sha (identity mismatch rejected) | `ci-status.spec.js` |
| M3 | build authority is granted only to the **approved chat** (mis-scoped state denied) | `authority-logic.spec.js` |
| M4 | a **forged** `ci_execution` proof line is not trusted from a hand-editable file | `verification-parse.spec.js` |
| M5 | a **dirty working tree** invalidates a prior verification | `verification-parse.spec.js` |

## What a KILLED result proves — and does NOT
- **Proves:** that specific test genuinely fails when that specific behavior breaks, and
  passes when it is restored. The test/behavior pairing has real detection power.
- **Does NOT prove:** anything about coverage elsewhere, other ways the same behavior
  could break, or the quality of any test not listed. This is a spot-proof of a few
  load-bearing beams, not a survey of the whole structure.

## If a mutation SURVIVES
That is a real test-confidence finding, not a number to average away. The fix is to add
or strengthen the **smallest** relevant regression test until the mutation becomes
`KILLED` — never to hide or down-weight the survivor.

## Running it
```
pwsh -NoProfile -File scripts/run-mutation-proof.ps1        # human-readable
pwsh -NoProfile -File scripts/run-mutation-proof.ps1 -Json  # receipt JSON to stdout
```
The orchestrator's own classification logic is covered by
`app/tests/scripts/mutation-proof.spec.js` (a fast synthetic fixture — it does not run
the real 5).
