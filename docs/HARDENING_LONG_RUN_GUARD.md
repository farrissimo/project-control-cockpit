# Long-run forward-progress guard

**Status:** shipped. Script: [`scripts/run-guarded.ps1`](../scripts/run-guarded.ps1).
Tests: [`app/tests/scripts/guarded.spec.js`](../app/tests/scripts/guarded.spec.js).

## The hole this closes

PCC forbids fake-green, false reassurance, and owner babysitting everywhere — it never takes the
worker's word for a green; it demands a check. But **long-running verification** (the test suite,
the release gate, the mutation / failure-injection proofs) had no enforced check that the run was
actually *moving*. An operator — human **or** AI — could say "still running" while a wedged process
sat dead. That once cost the owner ~7 hours of false reassurance: a stale leftover test Electron
held the app's single-instance lock, a fresh e2e launch could never get the lock and hung forever,
`npm test` never returned, and "still running" was asserted from seeing processes *exist* — not from
any proof they were *progressing*.

The honesty guarantee had a hole: trust rested on the operator's word for one specific thing.

## What the guard does

`scripts/run-guarded.ps1` is the deterministic (no LLM, no network) path that a long run is routed
through. It makes "still running" a **tool-proven fact**, and it can never itself hang forever.

1. **Reaps stale test processes first.** Leftover test Electrons/node from an earlier run are killed
   before start — the exact mechanism that wedged the suite. **Safety wall:** a process is a target
   only when BOTH its executable name is allow-listed (`electron.exe`, `node.exe` by default) AND its
   command line carries the dedicated launch flag `--pcc-test-instance` that `tests/helpers/launch.js`
   adds to every Playwright Electron. That flag is an unmistakable token no real user process ever
   carries — a loose `pcc-test` substring could hit an unrelated app under a `pcc-test-*` path, so we
   match the flag, not the path. A shell, editor, `grep`, or the agent harness can never be a target.
2. **Runs the target command**, streaming its output to log files.
3. **Samples forward progress** every `-SampleSec`. Progress = the child's combined output *grew*
   (primary, cheap) OR — only when output was silent this interval — the child's whole **process tree
   is still burning CPU** (secondary: a hung tree stops accumulating CPU, a working one keeps burning
   it, so a busy-but-quiet phase is never mistaken for a hang). Neither is "a process exists," so the
   signal generalises to any long run, not just Playwright. Each sample updates a machine-readable
   **heartbeat** file. The process-table scan is paid only during output silence, so a normally
   streaming run stays cheap.
4. **Declares HUNG and ABORTS** (kills the whole process tree) if there is no forward progress for
   `-StallSec`. It never silently waits. This is the primary, fast hang-catcher.
5. **Enforces a hard cap** (`-MaxSec`) too — the proven CI-watchdog pattern (inactivity timeout +
   hard cap; cf. Travis CI's "no output in 10 min / 50-min job cap"). The cap is generous because a
   *progressing* run is caught by the stall check, not the cap; the cap only stops a run that emits
   endless output but never finishes.
6. **Emits a machine-readable verdict** (+ the heartbeat) so the outcome is provable evidence.

### Exit codes

| code | state | meaning |
|------|-------|---------|
| 0 | `passed` | child exited 0 |
| 1 | `failed` | child exited nonzero (real exit captured; an unreadable exit is `failed`, never a silent pass) |
| 2 | `setup-error` | could not start the child |
| 3 | `hung` | no forward progress within `-StallSec` (aborted) |
| 4 | `cap` | exceeded the hard `-MaxSec` cap (aborted) |

### Artifacts (git-ignored, under `.cockpit/evidence/guard/`)

- `<label>.heartbeat.json` — live, rewritten every sample; a reader instantly sees `last_progress_at`
  advancing or frozen and `since_progress_sec` climbing. **This is what replaces an operator's word.**
- `<label>.verdict.json` — the final machine-readable outcome.
- `<label>.out.log` / `<label>.err.log` — the child's captured output.

## Usage — the mandatory path for long runs

```powershell
# the full test suite
pwsh -NoProfile -File scripts/run-guarded.ps1 -Label suite -Command 'npm --prefix app test'

# the release gate (also self-guards its internal full suite; see below)
pwsh -NoProfile -File scripts/run-guarded.ps1 -Label gate -Command 'pwsh -NoProfile -File scripts/run-release-gate.ps1'

# the integrity proofs
pwsh -NoProfile -File scripts/run-guarded.ps1 -Label mutation -Command 'pwsh -NoProfile -File scripts/run-mutation-proof.ps1'
pwsh -NoProfile -File scripts/run-guarded.ps1 -Label failinject -Command 'pwsh -NoProfile -File scripts/run-failure-injection.ps1'
```

The command is one string (run via `cmd.exe /c` so `npm`/`pwsh`/`node` resolve normally on Windows),
which sidesteps PowerShell's parameter-binding ambiguity around `-` flags.

## Defense-in-depth (three independent layers)

The 7h wedge is now prevented structurally, then caught behaviourally:

1. **Structural — the wedge can't happen.** A disposable test launch *skips* the single-instance lock
   ([`app/main.js`](../app/main.js)): each Playwright launch already gets its own throwaway
   `--user-data-dir`, so there is no shared storage to protect and no lock for a stale instance to
   hold. The bypass fires only when it is provably a test launch — the `--pcc-test-instance` flag AND
   a throwaway `pcc-test-*` user-data dir — so an accidentally inherited `PCC_TEST_MODE` env var can
   never disable the lock on the owner's real profile. A stale test Electron can never block a fresh
   launch again.
2. **In-tool backstop.** Playwright's `globalTimeout` (45 min, in
   [`app/playwright.config.js`](../app/playwright.config.js)) self-terminates the whole run — a
   wedged launch can never become a multi-hour zombie even without the outer guard.
3. **Behavioural — the guard.** The 180s no-progress stall check catches *any* hang (not just this
   one) in ~3 minutes and aborts with proof, and the release gate routes its internal full suite
   through the guard so even a direct gate run is hang-proof.

## Parity

`scripts/run-guarded.ps1` travels to every scaffolded project (the scaffold kit copies `scripts/`),
so new projects are born with the same guarantee — no operator, on any PCC project, can report
"running" without the tooling proving forward motion.
