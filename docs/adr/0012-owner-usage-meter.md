---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0012: Owner usage meter (desktop-parity R1)

## Context and Problem

On 2026-07-20 a single Claude Code chat grew to a ~426K-token context over ~4 hours and burned a
large share of the owner's 5-hour usage limit with **no visible warning** — PCC's only chat-health
signal (`chat-rollover`) counts messages (≤40) and elapsed hours (≤6) and explicitly disclaims
measuring tokens, so it stayed green throughout. The owner could not stop the runaway short of
force-closing the app, and was furious that he had to discover and diagnose this himself.

The owner was explicit about the fix (2026-07-20, verbatim direction):
- **No token math for him.** "10.2M cache writes" and raw token counts "mean nothing to me."
- **The one metric he watches** is his real Claude usage stat — the same number the Claude
  desktop app's "Plan usage limits" panel shows (owner screenshot: *Current session 23% used,
  resets in 3h 45m*; *All models (weekly) 26% used, resets in 14h 25m*).
- **It has to be compact** — not a full-height panel like the desktop app's; a small,
  always-visible indicator.
- **No fake green, ever.** Every number must be provably real or the meter fails closed to
  unknown — never a fabricated percent.

## Decision

**Mirror the desktop app's own real number**, not a derived token estimate. Investigated and
confirmed live (2026-07-20): the Claude desktop app itself polls Anthropic's usage and writes the
result to a local, undocumented cache — `%APPDATA%/Claude/plan-usage-history.json` — roughly every
5 minutes: `{ version, samples: [{ t, org, u: { fh, sd } }] }`, where `fh` = five-hour (session) %
and `sd` = seven-day (weekly) %, both 0–100. Verified against a live owner screenshot: `fh` climbed
20→29% over an hour of real work while `sd` held at 26%, matching the panel exactly. **This is the
real number**, not a proxy — PCC reads the same source of truth the desktop app itself reads.

Implementation (`app/usage-meter.js`):
1. `parseUsageSample(raw, nowMs)` — **pure**, mirrors `app/ci-status.js`'s honest-mapper pattern.
   Picks the sample with the greatest timestamp (not array order); accepts only a finite 0–100 `fh`
   and `sd`. Any shape surprise (missing file, malformed JSON, empty `samples`, missing/out-of-range
   fields) degrades to `{ available:false, reason }` — **never a fabricated 0% or fake green.**
   Every available reading carries `ageMs` and a `stale` flag (>15 min, ~3× the observed poll
   cadence) so freshness is always told straight, never implied to be instantaneous.
2. `readPlanUsage(nowMs)` — impure file read, wired to `ipcMain.handle('pcc:usage', ...)` /
   `window.pcc.usage()`.
3. Renderer: a **compact trust-strip chip** (`Usage: 29%`), matching the existing chip pattern
   (`app/renderer/index.html`/`renderer.js`) rather than a drawer. Color rule: `<70%` good, `70–89%`
   warn, `≥90%` bad — **but a `stale` reading always shows as `unknown`** (gray), regardless of its
   percent, because a color we can't currently vouch for is worse than none. An unavailable reading
   shows `Usage: unknown` with the real reason in its tooltip. A standalone 60s poll keeps it current
   independent of chat activity (the file updates on its own cadence, not tied to a PCC turn).

**Honest residue, disclosed not hidden:**
- **Reset time is NOT yet shown.** The cache file has no reset timestamp; the live worker stream's
  `rate_limit_event` (`resetsAt`, captured 2026-07-20 on `app/stream-parser.js`) has it, but only
  during a **streaming** worker turn — PCC's normal text sends do not run in stream mode today.
  Wiring that in is `ADR-0011`'s "run in streaming mode always" slice, a larger structural change
  to the worker-invocation path. Until then the chip omits reset time rather than guessing it.
- **Undocumented source.** `plan-usage-history.json` is a private Claude-desktop-app cache, not a
  published API — it could move or change shape in a future release. The parser fails closed on any
  shape mismatch, so an upstream change degrades to honest `unavailable`, never a wrong number.
- **Single-org assumption.** All observed samples share one `org`; a multi-org machine is unhandled
  (disclosed simplification, not a silent bug).
- **This is R1 (observability) only.** It does not by itself stop a runaway — that is R3
  (`docs/proposals/desktop-parity.md`), the automatic-protection layer this meter's data will drive.

## Consequences

- **Gain:** the owner sees the exact stat he already watches, with zero token math, updated
  automatically — the visibility gap that let the 2026-07-20 incident run unnoticed is closed.
- **Cost:** one new local file read (cheap, no network) on a 60s timer + after trust-strip refreshes;
  one new IPC channel (`usage`, exact-channel-listed in `ipc.spec.js`).
- **Honest residue:** see above — no reset time yet; source is undocumented and could break; single
  org assumed; this is observability, not the automatic-protection floor.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md):
- **Unit** (`app/tests/unit/usage-meter.test.js`, 10 tests): a real sample yields the exact
  percent/age; the latest sample wins by timestamp, not array order; a stale-but-present reading is
  shown and flagged, never hidden; missing/non-object/malformed/empty input is `unavailable` with a
  distinct honest reason each time — **never a fabricated 0%**; out-of-range or non-numeric percents
  are rejected, never clamped into a fake number; 0 and 100 are valid boundaries.
- **Contract** (`app/tests/e2e/ipc.spec.js`): `usage` is in the exact-channels list.
- **Lint clean; full unit suite 160/160** (150 prior + 10 new) on the exact commit.

## Engagement

- **Owner:** the audience — the chip mirrors exactly the stat he already watches; no interpretation
  required.
- **Claude worker:** implemented `usage-meter.js`, the IPC wiring, and the trust-strip chip, in a
  tested slice.
- **Codex verifier:** diff-reviews the change (static + lint + doctor; cannot launch Electron, so
  live-panel rendering is worker-attested + the unit/contract tests above).
- **Security-model note:** read-only local file access, no new write path, no change to the
  authority model. Not flagged for the ADR-0009 GPT trigger.
- **Spawned projects:** the chip is **shared home-app UI** — it is not per-project scaffolding
  (Codex V2 correction applied here too, per ADR-0011's fix); every project opened in PCC sees it
  automatically because it lives in `app/`, not in a per-project copy.

## Supersedes / Related

New surface. Related: `docs/proposals/desktop-parity.md` (R1, the controlling requirement),
`app/stream-parser.js` (the `rate_limit_event` capture the reset-time follow-up will consume),
`app/ci-status.js` (the honest-mapper pattern this module follows), ADR-0011 (the streaming-mode
slice that will complete the reset-time gap).
