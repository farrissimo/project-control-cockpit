## Progress — status corrected 2026-07-21 (clean rebuild). PROVEN ON THE OWNER'S SCREEN is the only "done".
> The prior "SHIPPED / complete / no residue" markers were CLAIMS from the 2026-07-20 session, not
> proof — and several were false (the usage meter was "shipped" while it was broken; steer is not
> even exposed). Authoritative status: the feature-status ledger in `PROJECT.md`. Corrected below to
> what is actually proven. "Built" means code + tests exist; it is NOT done until proven on-screen.
- **R1 — usage meter: ✅ PROVEN 2026-07-21.** Shows the owner's real 5-hr % (matched Claude's own
  23% within the ~5-min refresh lag). NOTE: the 2026-07-20 ADR-0012 build was actually **broken** on
  the owner's machine (Claude desktop is MSIX; `%APPDATA%\Claude` is an un-traversable junction) —
  fixed to read the real package path and proven on his screen 2026-07-21. Reset time still not shown.
- **R2 — stop + steer (ADR-0013): PARTIAL.** Stop = ✅ owner-tested working. **Steer = ❌ NOT working:
  no steer control is exposed in the app (owner-confirmed).** The send-queue exists in code but is not
  a usable, discoverable steer feature. NOT "shipped".
- **R3 — per-turn cap (ADR-0014), cross-turn rollover (ADR-0015), cross-restart durability (ADR-0017):
  ⬜ BUILT, functional proof PENDING.** Code + tests exist; none proven on the owner's screen yet. The
  prior "substantively complete / no remaining cost residue" claims are **withdrawn** until proven.
- R4, R6: not started.

# Proposal: Core parity with the Claude Code desktop app (owner-stated, locked)

**Status:** Proposed — owner-directed 2026-07-20 ("make it exactly the same goddamn
thing with all the safety and invisible stuff that is done but hidden from me").

## Why this exists
PCC drives the **same `claude` engine** as the desktop app the owner uses daily. The
desktop app is a harness that does context management, cost control, and interrupt
*invisibly*. PCC has been building the visible layer (chat panel, trust chips, signals,
a message-count "health" meter) while leaving the invisible-but-critical layer raw. The
result: on 2026-07-20 a ~4-hour session grew to a **426K-token context** and burned a
large share of the owner's usage with **no visible warning and no way to stop it** — the
chat-health meter watches message count (≤40) and hours (≤6) and *explicitly does not
measure tokens*, so it stayed green the whole time.

This is a standing failure mode: the owner keeps having to **uncover, repeat, and chase**
these gaps himself. That IS the babysitting PCC exists to kill. An entire "token savings"
phase shipped without a visible token meter ever surfacing. These requirements are
recorded here so the machinery carries them, not the owner's memory.

## Cross-cutting mandate (applies to EVERY requirement below)
**Honest & accurate. No fake green. No lying.** Every number, meter, and status must be
provable from real data or it fails CLOSED to "unknown" — never a reassuring green it
can't back up. This is the whole reason PCC exists; it binds all of R1–R5.

## The replacement bar & the three kinds of parity  *(Codex V2, 2026-07-20)*
PCC is **NOT** a near-desktop replacement until **R1–R3 are implemented AND verified** — they are
the **trust floor**. R4–R6 add usefulness and efficiency but never substitute for the floor. (No
fixed "% confidence" is claimed — that would be its own fake-precise number, the very thing this
effort kills.)

Three kinds of parity, and they are **not equal**:
- **Observability** — the owner can SEE what's happening (the meter's display, the live feed).
- **Intervention / control** — the owner can ACT (stop, steer).
- **Automatic protection** — the system acts to protect him with **zero owner action** (auto
  rollover before a runaway; auto model right-sizing).

Only the third preserves trust **when the owner isn't watching**. A meter you have to read is
observability, not protection. The 2026-07-20 incident was an **automatic-protection** failure, not
a visibility one. Mapping: **R1 = observability, R2 = intervention, R3 = the automatic-protection
floor.** Visible parity improves usability; invisible-safeguard parity preserves trust — and
replacement confidence rests more on the second.

## Requirements (owner's own words, structured)

### R1 — Mirror the owner's Claude usage stat  *(top priority)*
- **The owner does ZERO calculations. Tokens are internal plumbing and are NEVER the
  headline.** The one metric he watches is the **Claude usage stat** (the 5-hour limit).
  The meter mirrors THAT and speaks in plain meaning ("fine" / "getting close" / "at
  limit" / "resets in 2h 10m") — not token counts, not "10.2M cache writes."
- **Data source (confirmed 2026-07-20):** the live `claude --output-format stream-json`
  stream emits `{"type":"rate_limit_event","rate_limit_info":{"status":...,
  "rateLimitType":"five_hour","resetsAt":<unix>,...}}`. PCC already ingests this stream
  (`app/stream-parser.js`). So the real 5-hour **status + reset time** are readable
  directly — this is the source of truth, not a token estimate.
- **The exact measure to mirror (owner screenshot, 2026-07-20):** Claude Code's *Plan
  usage limits* panel — **Current session: % used + "resets in Hh Mm"** (the 5-hour
  window) and **Weekly / All models: % used + reset**. The panel proves the **% is real
  and displayed** (e.g. session 23% / all-models 26% on Max 5x) — so the meter shows the
  real %, not merely a status ladder.
- **COMPACT — must NOT look like that panel or take that much space** (owner). A small,
  always-visible indicator (≈ one line: session % + reset; weekly on hover/expand), never
  a full drawer.
- Honest boundary that remains: confirm the **machine-readable source** of the % for a
  spawned worker. `rate_limit_event` (status/resetsAt/rateLimitType) is the known hook;
  verify whether it (or a sibling event) carries the numeric %, and read the % from
  wherever Claude Code itself gets it. Show only what is truthfully available — no fake %.
- Tokens/cache numbers live in an optional "details" view for debugging only, never the
  owner's headline.

### R2 — Stop AND steer a running turn  *(both, not either/or — owner, 2026-07-20)*
- WHEN the worker is running THE SYSTEM SHALL let the owner **stop** it (kill the turn)
  without closing the app.
- WHEN the worker is running THE SYSTEM SHALL let the owner **steer** — inject guidance
  while a turn is in flight (partly exists as queue-while-working; extend to true
  mid-turn steer where possible).
- These are **both required.** Not one or the other.

### R3 — Context management (compact or auto-rollover), automatic where possible  *(APPROVED — owner, 2026-07-20)*
- THE SYSTEM SHALL provide a way to **compact** the current conversation, OR
  **auto-switch to a fresh chat** carrying context forward.
- This is **AUTOMATIC — no button, no owner decision** (owner, 2026-07-20: "all of the
  safeguards and compaction and all that has to happen automatically"). A manual control
  may exist as a fallback, but the default path fires itself.
- Trigger off R1's real signal: the **5-hour `rate_limit_event` status** shifting toward
  the limit, and/or the burn-rate/context-size climbing — NOT message count.
- WHEN PCC auto-acts it SHALL tell the owner plainly what it did and why ("rolled this
  chat over to protect your usage limit") — automatic, but never silent/opaque.
- **Also covers conservative runaway-risk intervention** (Codex V2). Trigger on honest,
  observable signals — abnormal **context growth / burn-rate** (the real 2026-07-20 failure),
  recurring failed-tool or denial patterns, prolonged no-progress — WITHOUT claiming certainty;
  "stuck" is never asserted as proof, only suspicious-pattern warnings that fail toward caution.
- **Honest feasibility (what's actually buildable):** the dependable automatic action is
  **auto-rollover** (fresh session + carried-forward summary) and, at clear runaway, **auto-stop**
  (kill the turn). PCC **can** kill a turn but **cannot pause/resume** one, and headless mode may
  not expose true in-place **compaction** — so R3 delivers *rollover*, and any "compaction" claim
  is gated on confirming the mechanism exists. Fail-safe: if rollover can't complete, warn and
  hold, never silently continue a runaway.

### R4 — Flag / command parity
- THE SYSTEM SHALL surface the capabilities the owner can invoke in the desktop app
  (e.g. `/remote-control`, and the broader `claude` flag/command surface) rather than
  hiding them. Expose the high-value ones deliberately; be honest about which are not
  worth surfacing and why.
- **Lowest priority ≠ least useful.** The owner uses `/remote-control` **every day**.
  "Last in sequence" does not mean skippable — `/remote-control` is effectively a
  must-have; the *inventory* of the rest is what's deferred, not the daily-driver flags.

### R5 — Proactively find the gaps the owner HASN'T raised  *(owner, 2026-07-20)*
- "Get as close as possible to the desktop app's features, functionality, safeguards, and
  the invisible machinery — including things we haven't discussed yet."
- THE SYSTEM/CLAUDE SHALL **inventory the desktop app's surface** (features, flags,
  safeguards, invisible behaviors) and surface the gaps **proactively** — the owner must
  NOT be the one who has to discover, repeat, and chase them. Him finding a gap is a
  failure of this process, not his job.
- **Operational, not aspirational** (Codex V2): a **milestone/periodic parity inventory**
  against the desktop app's surface, a durable **gap ledger** (open/closed), and every
  owner-raised gap logged as a **process failure** (the machinery missed it, not him).

### R6 — Per-task model recommendation + auto-switch  *(owner has asked "many times")*
- The owner has **repeatedly** asked for a **model recommendation for the specific task**
  the app is doing (right-size it: cheap/fast for mechanical, top model for hard
  reasoning). This has never been built into PCC — recorded here so it stops being
  re-asked. Him re-asking is the failure, not him.
- THE SYSTEM SHALL recommend the fitting model per task, and — the upgrade he wants —
  **auto-switch** to it **when it makes sense**, automatically. This also protects R1:
  dropping off Opus when a task doesn't need it directly saves the usage limit.
- Honest boundary (DECISION-008, no fake intelligence): base the pick on **declared
  heuristics**, keep the choice **visible**, and let the owner **override/pin** — never
  fake a certainty it doesn't have. Auto-switch defaults on; a pinned model wins.

## Non-goals / honest scope
- **Not** 100% feature-for-feature cloning of an Anthropic-maintained app — that's a
  treadmill. Target = **core workflow + safety parity** plus PCC's own guardrails.
- Caveat on the above: "core" is set by the owner's real usage, not by us guessing —
  e.g. `/remote-control` is core *because he uses it daily*, even though it looked
  peripheral on paper.

## Sequence (recommended, by value × achievability)
1. **R1 session-usage meter** — highest value, data proven available (pulled 2026-07-20).
2. **R2 stop button** — small: `killWorker()` already exists in `app/main.js`; wire it
   to a UI control + IPC. Steer extends the existing queue.
3. **R3 auto context management** — reuses R1's token/size read to trigger compaction or
   rollover; the real protection.
4. **R4 flag/command surface** — inventory the `claude` flag surface, expose the useful
   ones; larger and more open-ended, so last.

Each item ships as its own tested slice with an ADR for the parity decision.
