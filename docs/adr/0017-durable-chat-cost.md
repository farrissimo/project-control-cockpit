---
status: Proposed
date: 2026-07-21
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0017: Durable per-chat cost — cross-turn rollover survives a restart

## Context and Problem

ADR-0015 BUILT automatic cross-turn cost rollover (not yet proven on the owner's screen) but disclosed one residue: the per-chat cost
was tracked **in memory only**, so an app restart reset it to $0. On 2026-07-20 the owner restarted
PCC **repeatedly** during the incident — so a long chat resumed after a restart could balloon again
with no rollover, which is exactly the failure mode the rollover exists to stop. Under the trust
proving window (ADR-0016), a hole in the safety net meant to prevent the incident ranks above any
new feature.

## Decision

Persist each chat's running cost to a small git-ignored file and reload it on startup, so the
rollover protection survives a restart. New module `app/chat-cost-store.js`, **fail-safe by
construction** because it *is* the safety net:
- **Load** returns `{}` on any error (missing file, corrupt JSON) — a fresh start, never a crash.
- **Save** is best-effort and swallows errors — a failed write just keeps the run's in-memory
  total, degrading to *exactly* the pre-persistence behavior, never worse.
- **Values are sanitized on load**: only a finite, non-negative per-chat number survives, so a
  corrupted or hand-edited file can never inject a poison total (e.g. a negative that would force
  endless no-rollover).

Wiring in `app/main.js`: `chatCostUsd` is loaded lazily on first use from `costStoreDir()` and
re-saved after every cost update; a project switch (both `setActiveProject` and the create-flow)
resets it to `null` so the next use reloads from the **new** project's store, never cross-
contaminating one project's totals into another. `costStoreDir()` follows the SAME test-isolation
pattern already used by `chatsDir()`/`memoryPath()`: in `PCC_TEST_MODE` it points at a throwaway,
per-project `userData` dir so the suite **never** writes real project state; in production it is the
git-ignored `.cockpit/evidence`.

**Honest residue remaining:** cost accumulates in the persisted file for chats that are later
deleted (a harmless stale entry — the chat is gone, its key never matches again; no cleanup hook
needed).

**Addendum (same day): attachment-turn cost now tracked too.** ADR-0015's *other* residue —
attachment/image turns (which use the `stream-json` output path, and are the MOST token-expensive
turn type) not counting toward the cap — is also closed now. `app/stream-json.js` gained
`parseStreamCost(raw)` (extracts `total_cost_usd` from the stream's `result` event, same finite/
non-negative validation as `turn-output.js`, unit-proven against the real captured envelope), and
`askClaude`'s attachment success/error branches feed it to `recordChatCost`. So the cost cap now
sees **every** turn type — the most expensive turns are no longer the one blind spot. With this,
**R3's runaway-cost protection has no remaining disclosed cost residue.**

## Consequences

- **Gain:** the cross-turn cost protection now holds across the exact restart pattern that
  characterized the 2026-07-20 incident — the safety net no longer has a restart-shaped hole.
- **Cost:** one small module + one tiny best-effort file write per turn; a test-helper gains opt-in
  fixed-user-data-dir support so a restart can be tested for real.
- **Honest residue:** deleted-chat entries linger (harmless); attachment-turn cost still untracked.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **Unit** (`app/tests/unit/chat-cost-store.test.js`, 6): sanitize keeps only finite non-negative
  per-chat numbers and drops everything else; missing/wrong-shape input returns `{}` and never
  throws; save→load round-trips; a missing file loads as `{}` (fresh start); a corrupted file loads
  as `{}` (no crash); a hostile/negative-valued file loads sanitized (no poison total).
- **E2E** (`app/tests/e2e/cost-rollover.spec.js`, new restart test): two turns ($12) in one app
  instance, then a real **close + relaunch sharing one user-data dir**, then one more turn — the
  rollover fires at the carried-over **$18** total. If cost had reset on restart this would be only
  $6 and the assertion would fail, so a pass proves the total genuinely persisted across the
  restart. The two pre-existing cost-rollover tests still pass unchanged.
- **Isolation verified live:** after the full e2e run, no `chat-costs.json` exists in the real
  repo's `.cockpit/evidence` — the suite wrote only to throwaway `userData`.
- Full unit suite 189/189; lint clean.

## Engagement

- **Owner:** the same automatic, zero-action protection, now not silently defeated by a restart.
- **Claude worker:** implemented the store, the `main.js` wiring + project-switch reset + test
  isolation, the `launch.js` fixed-dir helper, and all tests.
- **Codex verifier:** diff-reviews the change (static + lint; cannot launch Electron — the restart
  E2E is worker-attested, re-run live).
- **Security-model note:** no new capability or IPC channel; a git-ignored best-effort cost file
  with sanitized load. Not flagged for the ADR-0009 GPT trigger.
- **Spawned projects:** `chat-cost-store.js` + the `main.js` wiring are shared home-app logic
  (inherited automatically); the persisted file is per-project runtime state under that project's
  own `.cockpit/evidence`, isolated by `costStoreDir()`.

## Supersedes / Related

Closes the in-memory-only residue disclosed in ADR-0015 (cross-turn cost rollover). Related:
ADR-0014 (per-turn cap), ADR-0016 (the proving window whose rule prioritized this over new
features), `docs/proposals/desktop-parity.md` (R3).
