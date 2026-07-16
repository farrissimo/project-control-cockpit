# Audit grid — Incident response, diagnostics & supportability   (ADR-0009 category; status: done)

**Scope:** when something breaks, can a **non-coder owner** (or the worker) tell WHAT broke and WHY, without
hand-holding? Yardstick: reduce-babysitting *when things go wrong*. Graded against the integrity contract Part 1
(esp. **no-swallowed-failures**, displayed-truth-provenance). Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped the diagnostic surfaces (`doctor.ps1`, `log-event.ps1` +
routing-log, the detectors, in-app error surfacing) and hunted specifically for **swallowed failures** (empty /
comment-only `catch`) that leave no trace. The honesty discipline is strong, but the probe found a **real,
consequential break**: security-relevant app failures were swallowed silently with no durable record, and there
was no app-level error log at all. **Verdict: found a real break → built the minimum control.**

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Health report** — `doctor.ps1` (read-only, always exit 0, honest N/A) | machinery-enforced | reports its own inability to run as ISSUE/WARN (never a fake all-clear); scaffold-aware N/A keyed off real `Test-Path`; `scaffold-kit.spec.js` (fresh scaffold → no ISSUE) | One plain-language "is this safe to trust now?" | it is a **report, not a gate** (documented); the real gate is `enforce-handoff-restart-safety.ps1` |
| **Workflow audit log** — `log-event.ps1` → `.cockpit/logs/routing-log.jsonl` | machinery-enforced (append-only) + evidence-leaving | round-trips JSON before append (malformed line can't corrupt); callers surface a visible `[LOGGING WARNING]` on failure (`finalize-worker-handback.ps1`) — an honest non-fatal path | A durable, tamper-evident record of workflow events, surfaced as Metrics | records **workflow** events only — not app/runtime errors (that was the gap, now closed below) |
| **Honest detectors** — six `detect-*.ps1` (Observed / might mean / NOT proven / what to do) | machinery-enforced | fail closed to `unknown` (never guess CLEAR); `detect-drift.ps1` literally tells the owner what to do; run via `pcc:detections` into Signals + trust strip | A non-coder "smoke alarm" with plain next steps | scoped to **repo/work** health, not app-runtime failures |
| **In-app error surfacing** — IPC returns honest `{ok:false,message}`; detector/stakes/verification fail closed to UNKNOWN | machinery-enforced | `main.js` handlers render visible red error bubbles; trust strip is commit-bound and refuses false green (CRIT-2 lesson) | The owner sees failures, not a painted green | renderer error bubbles are **transient** (vanish on next action) — no durable record |
| **App-level error log** — `app/error-log.js` → `.cockpit/logs/app-error.log`, surfaced by `doctor.ps1` | **machinery-enforced (NEW — built this category)** | `app/tests/unit/error-log.test.js` (6): writes JSONL, appends-not-clobbers, creates dir, **never throws / returns false when unwritable**; doctor "App errors" check verified live (clean → OK, present → WARN); app boots green (`ipc.spec.js` 27) | Otherwise-silent app failures now leave a durable, owner-visible trace | surfaced via `doctor.ps1` (owner runs it); a richer always-on in-app card is a disclosed follow-up |
| **Restore points + state-journal + `.prev`** (recovery machinery) | machinery-enforced | see `docs/audit/backup-recovery.md` + `recovery-rollback-damage-repair.md` | Damage is recoverable | protects canonical **state files**; not a forensic "what did everything look like" capture |
| **Forensic incident bundle** (`C:\PCC-Incidents\…`) | **prose/manual — accepted-residue** | one-time hand-assembled during crisis recovery; no script creates it; "forensic record" is explicitly a *future* vision item | — | no repeatable capture tool; **judged not worth building now** (see below) |

## The break found → FIXED (the minimum control)
**Security-relevant app failures were swallowed with ZERO trace, and there was no app-level error log** — a
direct violation of the integrity contract's **no-swallowed-failures** rule, and the exact failure a non-coder
owner could not diagnose. The worst offenders (comment-only `/* best effort */` catches in `app/main.js`):
- **`authority-store.write` (main.js:715)** — a failed persist of the **execution-authority** store was dropped
  silently. Consequence: a **revoke** that fails to write means build authority the owner cut can quietly return
  on the next app restart (disk keeps the stale grant), with nothing recorded anywhere. (Bounded by grant
  expiry, but real, and silent.)
- **`importScaffoldedInbox` (main.js:638)** — a malformed/failed project inbox read was discarded silently.
- **`chat-summary.mirror` (main.js:916)** — the durable recall corpus silently failed to write.

**Built (minimum, additive — no behavior removed):**
1. `app/error-log.js` — an append-only JSONL recorder (`.cockpit/logs/app-error.log`) that **never throws** (a
   logger that can crash the failure path it serves is worse than none). Unit-pinned (6 tests).
2. Rerouted the three swallows above from silent to `appErr(context, e)` — they stay non-fatal (best-effort
   preserved) but now leave a durable trace.
3. `doctor.ps1` "App errors" check — surfaces the log in plain language as a **WARN** (handled failures, not
   current-state corruption; never a false ISSUE), so the owner actually sees that something failed.
4. `.gitignore` — the log is local per-machine runtime output (paths/stack traces), never committed (unlike the
   workflow routing-log).

## Disclosed residues (probed, judged — not built)
- **No repeatable forensic incident-capture tool.** The `C:\PCC-Incidents\…` bundle was hand-made once; the
  "project archaeology" concept is explicitly a future vision item. **Judged not worth building now**: the
  now-durable app-error log + restore points + state-journal + git history already cover diagnosis and recovery
  for the realistic failures; a full state-snapshot capture tool is speculative until a real incident needs one
  (yardstick #2). Recommend building it *if/when* an app incident actually can't be diagnosed from the above.
- **The remaining best-effort swallows** (killAllWorkers, shadow seed, interview protocol, last-project restore,
  ~renderer panels) are lower-consequence (no security state, no data loss) and several are fail-closed by
  design. Left as-is to avoid churn; the pattern (`appErr`) now exists if any proves consequential.
- **No owner-facing troubleshooting/runbook doc.** Low priority; the detectors already carry per-signal "what to
  do." Noted.

## Verdict against the integrity contract
The honesty of what PCC *does* surface is strong (doctor never fakes an all-clear; detectors fail closed; IPC
returns honest errors). The real gap was **durability + owner-visibility of app-level failures** — a
no-swallowed-failures violation on security state. That is **fixed**: the worst swallows now leave a durable,
doctor-surfaced trace, unit-pinned and proven never to throw. **This category found a real break and closed it
with the minimum control** — the audit doing its job on PCC's own code.
