# Long-run forward-progress guard

**Status:** shipped. Script: [`scripts/run-guarded.ps1`](../scripts/run-guarded.ps1).
Tests: [`app/tests/scripts/guarded.spec.js`](../app/tests/scripts/guarded.spec.js).

## The hole this closes

PCC forbids fake-green, false reassurance, and owner babysitting everywhere — it never takes the
worker's word for a green; it demands a check. But **long-running verification** (the test suite,
the release gate, the mutation / failure-injection proofs) had no enforced check that the run was
actually *moving*. An operator — human **or** AI — could say "still running" while a wedged process
sat dead. That once cost the owner ~7 hours of false reassurance: `npm test` never returned, and
"still running" was asserted from seeing processes *exist* — not from any proof they were
*progressing*.

The honesty guarantee had a hole: trust rested on the operator's word for one specific thing.

### What actually caused the 7h hang — proven vs unproven

The first write-up recorded the cause as "a stale test Electron held the fresh test's single-instance
lock." That was **not reproduced, and is disproven as stated.** Keep the distinction honest:

- **Proven:** the gate hung; forward progress was never checked; process *presence* was reported as
  *progress*; and no contemporaneous root-cause evidence was captured.
- **Observed:** stale `electron.exe` processes existed at the time.
- **Unproven / disproven-as-stated:** that those processes caused the hang via a lock collision, and
  the exact internal hang point. Electron keys `requestSingleInstanceLock()` through `--user-data-dir`,
  and `tests/helpers/launch.js` gives every launch a fresh random `pcc-test-*` profile, so two test
  Electrons never share a lock. The real-Electron reproduction
  ([`app/tests/e2e/singleton.spec.js`](../app/tests/e2e/singleton.spec.js)) confirms it: two *distinct*
  profiles both open; a *forced* same-profile collision makes the loser exit cleanly (exit 0) and
  Playwright reject promptly — bounded, never a multi-hour wedge. So the lock theory cannot explain
  this hang; the true mechanism is unknown. **This is exactly why the enforced defence is the
  forward-progress guard, not a guess at one specific failure mode.**

## What the guard does

`scripts/run-guarded.ps1` is the deterministic (no LLM, no network) path that a long run is routed
through. It makes "still running" a **tool-proven fact**, and it can never itself hang forever.

1. **Reaps stale test processes first.** Leftover test Electrons/node from an earlier run are killed
   before start as defensive hygiene. (This was once believed to be the wedge's mechanism via a
   single-instance-lock collision; that theory was reproduced and **disproven** — see "What actually
   caused the 7h hang" above — so this reap is cleanup, not the proven fix. The enforced defence is the
   forward-progress abort in step 4.) **Safety wall:** a process is a target
   only when BOTH its executable name is allow-listed (`electron.exe`, `node.exe` by default) AND its
   command line carries the dedicated launch flag `--pcc-test-instance` that `tests/helpers/launch.js`
   adds to every Playwright Electron. That flag is an unmistakable token no real user process ever
   carries — a loose `pcc-test` substring could hit an unrelated app under a `pcc-test-*` path, so we
   match the flag, not the path. A shell, editor, `grep`, or the agent harness can never be a target.
2. **Runs the target command**, streaming its output to log files.
3. **Samples EVIDENCE progress** every `-SampleSec`, and keeps it strictly separate from mere activity:
   - **Evidence progress** = the child's combined output *grew* (a reporter line, a completed
     test/case — "something advanced"). This — and only this — resets the stall clock. It is never "a
     process exists," so it generalises to any long run, not just Playwright. For the mutation and
     failure-injection proofs, each case emits a boundary line, so a completed case is evidence.
   - **Activity** = the process tree is *burning CPU*. CPU proves the tree is *doing something*, not
     that it is *advancing* — a busy infinite loop burns CPU forever. So CPU is recorded as diagnostics
     and buys only a **small, explicitly-bounded silent-work grace** (`-CpuGraceSec`, default 120s):
     while the tree is actively burning CPU, silence is tolerated up to `StallSec + CpuGraceSec`, no
     further. CPU never resets the clock and never postpones hang detection to the `-MaxSec` cap.
   Each sample updates a machine-readable **heartbeat** that reports evidence progress
   (`since_evidence_sec`) and activity (`tree_cpu_ms`, `cpu_active`) as distinct fields. The
   process-table scan is paid only during output silence, so a normally streaming run stays cheap.
4. **Declares HUNG and ABORTS** (kills the whole process tree) if there is no evidence progress for
   `-StallSec` (+ up to `-CpuGraceSec` more, only while the tree is actively burning CPU). It never
   silently waits, and a CPU-burning infinite loop is aborted at that bound — never postponed to the
   hard cap. This is the primary, fast hang-catcher.
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

## The guard is the CANONICAL path — long runs cannot silently run unguarded

The guard is not an optional wrapper you must remember to add; the commands people actually run route
through it automatically:

- **`npm test`, `npm run test:e2e`, `npm run test:scripts`** go through
  [`app/tools/guarded-test.js`](../app/tools/guarded-test.js), which runs the real suite via the guard.
  The raw runner stays available as **`npm run test:raw`** — a clearly-named implementation detail the
  guard invokes, so nothing recurses. This is what **owner, pre-commit (`.githooks/pre-commit`), and
  CI (`.github/workflows/ci.yml`)** all call, so all three are guarded with no extra step.
- **The release gate** wraps its internal full suite in the guard (`scripts/run-release-gate.ps1`).
- **The mutation and failure-injection proofs** self-guard: run directly, each re-invokes itself
  through the guard before doing any work, so `pwsh scripts/run-mutation-proof.ps1` and
  `pwsh scripts/run-failure-injection.ps1` are bounded canonical commands.

Double-guarding is prevented by a sentinel: the guard sets `PCC_GUARDED=1` for its child subtree, and
every canonical entrypoint runs raw when it sees that flag. You can still invoke the guard directly:

```powershell
pwsh -NoProfile -File scripts/run-guarded.ps1 -Label suite -Command 'npm run test:raw'
```

The command is one string (run via `cmd.exe /c` so `npm`/`pwsh`/`node` resolve normally on Windows),
which sidesteps PowerShell's parameter-binding ambiguity around `-` flags. If the guard script is
absent (an extractable copy shipped without `scripts/`), the canonical entrypoints still run the suite
but print a **loud** unguarded warning — never a silent unguarded run.

## Defense-in-depth (three independent layers)

The hang is prevented structurally, then caught behaviourally:

1. **Structural — test launches can't collide.** Electron keys the single-instance lock through
   `--user-data-dir`, and [`tests/helpers/launch.js`](../app/tests/helpers/launch.js) gives every
   launch its own fresh random `pcc-test-*` profile, so each test Electron simply takes its own lock
   on its own isolated profile — two of them never contend. (An earlier version added a *lock bypass*
   for test launches on the theory that a stale Electron had wedged the suite; that theory was
   disproven by reproduction — see above — and the bypass was **removed** rather than kept merely
   because it had shipped. The `--pcc-test-instance` flag remains, now solely as the reap marker.)
2. **In-tool backstop.** Playwright's `globalTimeout` (45 min, in
   [`app/playwright.config.js`](../app/playwright.config.js)) self-terminates the whole run — a
   wedged launch can never become a multi-hour zombie even without the outer guard.
3. **Behavioural — the guard.** The no-progress stall check catches *any* hang (not just a launch
   wedge) in minutes and aborts with proof. Because the guard is the canonical path, this applies to
   `npm test`, the release gate, and both proofs alike.

## Parity

`scripts/run-guarded.ps1` and the canonical entrypoints travel to every scaffolded project: the
scaffold kit copies the whole `app/` (so `tools/guarded-test.js` and the `test`/`test:raw` scripts come
along) and `scripts/`, `.github/`, `.githooks/` wholesale. So new projects are born with the same
guarantee — no operator, on any PCC project, can report "running" without the tooling proving forward
motion.
