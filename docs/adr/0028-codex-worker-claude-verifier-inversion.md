---
status: Proposed
date: 2026-07-28
deciders: owner (+ Claude as verifier once inverted)
---

# ADR-0028: Invert the worker/verifier roles — Codex builds, Claude CLI verifies

## Context and Problem

Since DECISION-102 the roles have been fixed: the **worker** is Claude Code
(`claude -p`) and the independent **verifier** is Codex (`codex exec`, read-only
sandbox). That independence is real because the two are *different systems* — the
builder never grades its own work.

The owner is moving to the **free Claude plan** to measure, in real use, how much
plan usage the **verifier** role alone consumes. The intent behind the test is a
role inversion: make **Codex the primary worker** and **Claude CLI the verifier
only**. This is a deliberate, intentional experiment, not a forced migration.

Two facts make this a real decision rather than a config flip:

1. **There is no worker/verifier abstraction.** A wiring audit (2026-07-28) found
   the roles hard-coded, not selected from config:
   - Worker → Claude is deep coupling: one launcher (`app/claude-spawn.js`, binary
     name `'claude'`), the whole Claude-Code argv vocabulary in `app/main.js`
     (`-p`, `--append-system-prompt`, `--session-id`/`--resume`, `--fallback-model`,
     stream-json flags), the stream-json result parser (`app/stream-json.js`,
     `app/persistent-worker.js`), `ANTHROPIC_*` env stripping (`app/worker-env.js`),
     and `claude-*` model IDs (`.cockpit/state/models.json`).
   - Verifier → Codex is shallow string coupling: `codex exec` + sandbox flags are
     embedded inline in ~6 PowerShell scripts (`verify-work.ps1` — which also has an
     `agy`/Antigravity fallback — `codex-verify-watcher.ps1`, `second-opinion.ps1`,
     `new-verification-request.ps1`, `write-verification-receipt.ps1`,
     `run-governance-gate.ps1`) plus role labels in `app/main.js` (~686–689) and
     `app/renderer/renderer.js` (~1236).
   - The closest thing to a "worker=X, verifier=Y" declaration is a label block in
     `main.js` that is never used to dispatch. No single switch exists.

2. **Codex cannot launch the Electron app** (documented limitation;
   `project_codex_cannot_launch_electron`). Today that only scopes Codex's
   *verification* to static review + `check-adr.ps1` + `doctor.ps1`. If Codex becomes
   the *worker*, it also cannot run the app to see its own changes working — yet this
   project's "done" bar is **"proven on the owner's real screen,"** not "code review
   passed." So the builder-can't-launch gap moves from the verifier side to the worker
   side, where it matters more.

### Does driving the real app cost plan usage? (owner's question, answered)

Checked against the actual harness (`app/tests/helpers/launch.js`,
`app/tests/fakebin/`), not from memory:

- **Playwright driving the app itself** — launching Electron, clicking, reading
  rendered state — costs **no plan usage and no tokens**. It is deterministic Node
  automation, no LLM in the loop.
- **The app's internal Claude worker** is the only thing that burns plan usage. The
  E2E harness prepends `tests/fakebin` to PATH, so any `claude`/`codex` the app spawns
  resolves to a **deterministic fake** — **zero real usage**. This is exactly the
  "Playwright + fake worker, zero real Claude usage" method used for the
  `EXPECTATION_AUDIT.md` live click-through.
- **The verifier's own reasoning** (reading the diff, writing/running the Playwright
  script, judging) costs plan usage like any verifier task. Driving the app adds more
  tool round-trips, so "verifier also drives the app" costs **somewhat more verifier
  usage than static-only** — but that added cost is the verifier's own turns, not the
  app, and it triggers **no worker usage** as long as the fake worker is used.
- One honest caveat: the usage-meter path reads the **real** Claude account usage file
  unless stubbed via `PCC_FAKE_USAGE` (this is what made `continue-fresh-chat.spec.js`
  environment-dependent). That is a file read, not a token spend.
- **Correction (Codex consensus, 2026-07-28):** the "zero usage" claim holds ONLY under
  the fake-worker harness. In the **real installed app** (no fakebin on PATH), specific
  UI actions spawn the real `claude -p` via `oneShotWorker` (`app/main.js:1387`) and DO
  burn worker usage: **chat summary** (`main.js:1434`), **chat search / recall**
  (`main.js:1539, 1546`), and **new-project auto-naming**. Plain Playwright driving is
  free; those particular buttons are not. So verifying by clicking around the *real* app
  is NOT universally free.

**Net answer (corrected):** driving the app for verification is zero worker usage **only
via the fake-worker E2E harness** (fakebin on PATH). In the real app, avoid the
summary / recall / new-project paths — they fire real `claude -p`. The verifier's own
reasoning turns are a separate, unavoidable cost, and are what the free-plan test measures.

## Decision

We will **conditionally invert the roles**: Codex becomes the primary worker; Claude
CLI becomes the independent verifier only — **contingent on the free-plan usage test
showing the verifier role is sustainable on that plan.**

This ADR records the decision, the wiring it touches, and the constraints. **Implementation
is deferred** until (a) the usage measurement is in, and (b) the two open design
questions below are answered. We do not rewire anything on this ADR.

Open design questions to resolve before building:
- **Who drives the real app for on-screen proof** once the worker (Codex) can't launch
  Electron? Options: Claude-as-verifier drives it via Playwright+fake-worker (zero
  worker usage), or the owner clicks the residual native-dialog / real-`.lnk` items.
- **Verifier launcher**: extract a shared Claude-verifier invocation (there is no
  shared verifier launcher today) rather than string-swapping `codex exec` → `claude -p`
  in ~6 scripts independently.

## Consequences

**Gain:**
- Potentially much lower Claude plan usage — the verifier role is a few focused reads
  plus one judgment per task, versus the worker's long multi-turn build loops.
- A real measurement of whether the free plan can host PCC's verification role.
- Independence is preserved: Codex-builds / Claude-verifies is still two different
  systems; the builder still never grades its own work.

**Give up / risks:**
- **Worker inversion is high-effort.** The Claude-worker path has no abstraction; a
  Codex worker needs a new launcher, a new session/continuity model, and a new
  streaming/result parser. This is the hard half.
- **On-screen proof needs a new driver.** With Codex as worker, "proven on the owner's
  real screen" can no longer lean on the builder; it must come from Claude-as-verifier
  driving Playwright, or from the owner.
- **Verifier inversion is medium-effort** but spread across ~6 scripts and two label
  spots; a shared launcher should be built rather than duplicating the swap.
- Model config, receipts (`-Verifier` field), and doctor labels all name the current
  roles and would need updating.

## Confirmation

**Not built — this is a Proposed decision record; proof is deferred by design.** When
(and if) it is implemented, confirmation will require, at the right trust level:
- real tests for the new worker launcher + verifier path + CI green on the exact commit;
- the existing suite staying green (no regression);
- **an independent verifier's verdict** — which under the inversion is now Claude CLI,
  reviewing Codex's work (build → CI → verify → done).

The **gating evidence for whether to proceed at all** is the owner's free-plan usage
measurement of the verifier role. This ADR itself changes no shipped code, so its only
"proof" obligation now is that the wiring map above is accurate (it was produced by a
read-only audit of `app/` and `scripts/`) and that `check-adr.ps1` accepts this record.

## Engagement

- **Owner:** you're moving to the free plan to see if Claude-as-verifier fits inside it;
  nothing in the app changes yet. When we build the swap, the plain-English line will be
  "Codex now does the building; Claude only checks the work."
- **Worker (to become Codex):** N/A until implementation — the worker rule in AGENTS.md
  still names Claude; it will be updated when the swap is built, not before.
- **Verifier (to become Claude):** N/A until implementation — the verifier protocol in
  AGENTS.md still names Codex; updated at build time.
- **Future chats:** this ADR + PROJECT.md's next-chat pointer carry the intent so a fresh
  session does not assume the old fixed roles.
- **Spawned projects:** N/A until implementation — the scaffolder seeds the current roles;
  it changes only when the swap lands.

## Supersedes / Related

- Relates to / adjusts the role assignment in DECISION-102 and the verifier protocol in
  `AGENTS.md`. Does not supersede them until implemented.
- Constrained by `project_codex_cannot_launch_electron` (Codex can't run the app) and
  ADR-0009's "proven on the owner's real screen" done-bar.
- Usage context: the free-plan transition and the "keep it LLM-agnostic / token-frugal"
  direction.
