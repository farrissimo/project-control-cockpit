# Audit grid — External dependency / tool availability & failure behavior   (ADR-0009 category; status: done)

**Scope:** what PCC does when an external tool or service is missing, unauthenticated, unreachable, or errors —
the worker (Claude Code), the verifier (Codex), `gh`, git/remote/network, CI, and node/npm. The trust question:
does it degrade **honestly** (surface unavailable/UNKNOWN) or silently break / fake a green? Graded against the
integrity contract Part 1 (esp. no-swallowed-failures, malformed-fails-closed) and the ADR-0009 yardstick.

**Method (probe freely, standardize rarely):** enumerated every external-tool call site and classified its
failure path as machinery-enforced+tested / handled-but-untested / unhandled. **Verdict: tested, holds** — this
is a strong, well-covered category. Every dependency degrades to an honest UNKNOWN/error and is proven to never
produce a false green. The one flagged weak point sits in a **retired advisor-track, owner-run** helper and is
disclosed, not built.

## Grid

| Dependency | Failure behavior | State | Proof |
|---|---|---|---|
| **Claude Code (worker) — presence** | `where`-probe; missing → honest preflight banner naming what breaks | machinery-enforced | `tool-preflight.spec.js` (real bare-PATH detection, no seam) |
| **Claude Code (worker) — spawn/run** | spawn error → "Could not launch"; nonzero → real stderr; empty → `(no output)`; stale session → friendly recovery | machinery-enforced | `boundary.spec.js` (worker-nonzero / auth / empty never fabricate a reply) |
| **Codex (verifier) — release/verify path** | never a fake PASS on failure; malformed/out-of-usage/FAIL surfaced honestly | machinery-enforced (app path) | `boundary.spec.js` (verifier FAIL/malformed/out-of-usage never → PASS); `crosscheck.spec.js` |
| **gh CLI — branch protection** | `Resolve-Gh` PATH+install-dir fallback; absent/unreachable/unauthorized/unparseable → **UNKNOWN** (exit 2), never fake PASS | machinery-enforced | `check-branch-protection.spec.js` (malformed / unparseable → UNKNOWN exit 2) |
| **gh / network — CI status** | `no_remote`/`not_github`/`unreachable` → UNKNOWN; REST in try/catch, 8s timeout, never throws; only exact-SHA `test=success` → passed | machinery-enforced | `fi6-ci-authority-unavailable.js`, `ci-status.spec.js`, `ci-consumers.spec.js` |
| **git / remote — repo sync (backup)** | not-a-repo / git-unavailable → `unknown`, never "Backed up"; no upstream → notice, never `clear` | machinery-enforced | `fi5-git-remote-unavailable.ps1` |
| **git / remote / network — release gate** | remote head / CI unavailable → UNKNOWN; receipt write fail → FAIL; policy any-FAIL→FAIL else any-UNKNOWN→UNKNOWN else PASS | machinery-enforced | `release-gate.spec.js` (unavailable/pending/missing/wrong-SHA all → UNKNOWN or FAIL, never PASS) |
| **git — in-app sync/backup** | git unreadable → `{_error:'git_unreadable'}`, never `clean:true`; push/pull failures surfaced verbatim; ff-only refuses silent merges | machinery-enforced | `sync.spec.js`, `backup.spec.js` |
| **node/npm — release-gate suites** | app/ absent or npm throw → UNKNOWN; missing hang-guard → UNKNOWN + stderr warning (fail-closed) | machinery-enforced | `release-gate.spec.js` (missing hang guard → UNKNOWN) |
| **Codex — `codex-verify-watcher.ps1`** (retired advisor track) | bare `codex exec` (no timeout), `-s workspace-write`, `$ErrorActionPreference=Stop`; on failure leaves lock, **never fabricates a PASS** | **prose/untested — disclosed residue** | no test; see below |

## Disclosed residue (probed, judged — not built)
**`scripts/codex-verify-watcher.ps1` is the one Codex caller without a timeout wrapper** (every other —
`verify-work.ps1`, `second-opinion.ps1` — wraps the CLI in a timed `Start-Job`/`Wait-Job -Timeout`). A Codex
hang could wedge a poll tick; codex-absent (with `$ErrorActionPreference=Stop`) kills the loop. **Why it is not
built now:**
- **It is a retired advisor-track helper, off the current critical path.** Its own header states it is "never
  started automatically by any other script; the owner runs it (or schedules it) deliberately." It polls
  `task-state.json`'s `returned_for_verification` state — the DECISION-066 advisor track that the current
  branch→PR→CI→`codex exec` flow (what this very audit uses) does not depend on. All its references live under
  `.cockpit/handoff/archive/` and `.cockpit/result/archive/`.
- **It is a silent stop, not a false green.** It writes its lock before invoking Codex and, on any failure,
  leaves the lock without writing a verdict — so it can never fabricate a PASS. The failure mode is that an
  owner-run cadence quietly stalls, visible to whoever ran it.
- **Recommendation (owner's call):** if the watcher is ever put back on an unattended path, wrap Codex in a
  timed job like the other callers (or route it through `run-guarded.ps1`), and add a preflight so codex-absent
  doesn't kill the loop. Otherwise consider retiring the script as dead-weight. Building a hang-guard for a
  retired, owner-run, fails-visible helper would move no current-flow number (yardstick #2).

Secondary lower-severity note: `verify-work.ps1`'s degraded chain ("Both verifiers unavailable") and
`second-opinion.ps1`'s codex-absent branch are **honest but script-level-untested** (the test fakebin always
puts `codex` on PATH). They degrade honestly (no `VERDICT: PASS` line is emitted, so no gate can read a PASS),
just unproven in software. Noted, not built — low consequence.

## Verdict against the integrity contract
External-dependency failure behavior is **strong and tested-holds.** Every dependency on the current critical
path degrades to an honest UNKNOWN/error and is proven never to fake a green (malformed-fails-closed,
no-swallowed-failures). The single weak point is a retired, owner-run helper that fails to a visible stop, not a
false green — disclosed with a recommendation, not painted over. **No control built** — the expected outcome.
