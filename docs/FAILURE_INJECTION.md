# Targeted Failure Injection (Phase 5 Slice 1)

## What this is
A small, deterministic harness that answers one question with repeatable evidence:

> When a real **dependency or persistence boundary fails** — an interrupted write, a
> corrupt file, an unreadable remote, a bad CI signal — does PCC **fail closed or
> recover**, with prior good data intact and **no false success / no false green**?

Phase 4 (the mutation proof) proves the tests catch broken *source logic*. This proves
the system does the safe thing when the *world around it* breaks — the failures you can't
fix with better code, only by handling them. It is **not** a chaos-testing framework and
**not** exhaustive fault coverage.

## How it works
- `scripts/failure-injection-manifest.json` — a declarative list. Each case names a
  boundary, the real fault injected, and the expected safe result.
- `scripts/failure-injection/*.{ps1,js}` — one self-contained **scenario** per case. Each
  runs the **real production code** in a throwaway temp dir/repo and prints ONE JSON
  result: `baselineOk`, `injectionTriggered`, `expected`, and `checks[]` (the
  post-injection safety assertions). Real product data, chats, `.cockpit` state, the
  project registry, and real git history are **never touched** — only temp copies.
- `scripts/run-failure-injection.ps1` — a thin orchestrator. It runs each scenario and
  classifies **honestly**:
  - `INVALID` — the scenario timed out, crashed, produced no JSON, failed to establish a
    baseline, failed to *prove the fault triggered*, or made no assertions. **A harness
    problem is never a success.**
  - `EXPOSED` — baseline ok + fault fired, but a safety check FAILED (a real defect).
  - `RECOVERED` / `CONTAINED` — baseline ok + fault fired + ALL checks passed, matching
    the case's declared expected safe result.

Output: a git-ignored, commit-bound receipt at `.cockpit/evidence/failure-injection.json`.
Exit `0` **only if every case reached its expected safe result** (no EXPOSED, no INVALID).

## The current cases
| id | boundary broken | expected |
|----|-----------------|----------|
| FI-1 | an interrupted paired task/project write → journal replay completes both | RECOVERED |
| FI-2 | a corrupt/incomplete state journal → refused, canonical files untouched | CONTAINED |
| FI-3 | a corrupt current chat store with a valid `.prev` → serves prev, mutations blocked | RECOVERED |
| FI-4 | an atomic-write `.prev` install failure → fails closed, prior good data preserved | CONTAINED |
| FI-5 | git/remote truth unavailable (non-repo / no remote) → honest UNKNOWN, never "backed up" | CONTAINED |
| FI-6 | CI evidence malformed / mismatched-SHA / unreachable → never green; only exact-SHA passed is | CONTAINED |

## What a RECOVERED/CONTAINED result proves — and does NOT
- **Proves:** that specific real boundary, when the real fault is injected, fails closed
  or recovers — with prior good data intact and no false success/green — and a baseline
  passes before and after.
- **Does NOT prove:** anything about boundaries not listed, other fault modes, or overall
  robustness. In particular **FI-4 proves handling of the injected `fs.renameSync`
  failure only — NOT universal power-loss durability across every OS/filesystem.**

## If a case is EXPOSED
That is a genuine product defect, not a number to average away. Fix the smallest real
defect, add the narrowest regression protection, and re-run the same injection until it is
CONTAINED or RECOVERED — reporting both the original exposure and the final result.

## Running it
```
pwsh -NoProfile -File scripts/run-failure-injection.ps1        # human-readable
pwsh -NoProfile -File scripts/run-failure-injection.ps1 -Json  # receipt JSON to stdout
```
The orchestrator's own classification logic (all four outcomes, incl. crash→INVALID) is
covered by `app/tests/scripts/failure-injection.spec.js` — a fast synthetic fixture that
does not run the real six.
