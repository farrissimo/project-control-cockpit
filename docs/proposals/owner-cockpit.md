# Owner Cockpit + Live Worker Feed — proposal

**Status:** Proposed (owner-endorsed direction; needs a feature spec + ADR before code)
**Owner:** product lead / non-coder. **Date:** 2026-07-20.
**Mockups:** `docs/mockups/` — chosen direction is **Mockup E** (`cockpit-e-synthesis.html`); live-feed
treatments in `feed-1-stream.html`, `feed-2-pulse.html`, `feed-3-workbench.html`.

## Objective
A chat-first **owner cockpit** that gives the owner full, honest visibility into what the LLM worker is
doing — without a wall of text and without jargon — so a non-coder can answer, in ~5 seconds:
1. What's happening now? 2. Is it authorized and on task? 3. Is it moving normally (or stuck)?
4. What's proven, what's next? 5. Does anything need me?

## The problem it solves
Today PCC's truths (authority, trust strip, lifecycle, signals, doctor, verification, CI, task state) are
real but scattered across tabs and worded for engineers. The owner asks "what's going on?" and gets text.
That defeats the #1 goal: reduce babysitting. The cockpit is part of PCC's **trust surface**, not decoration.

## Design direction (Mockup E)
A calm default where **chat owns the screen**, with three stacked bands above it and a right rail:

- **Band 1 — Project journey** (macro): the 6 phases *Decide · Plan · Build · Check · Ship · Run*. Slow-moving.
- **Band 2 — Safe & on track** (vital signs): ~7 status tiles that are simply OK / attention / stop, no matter
  what step the work is on — like dashboard warning lights. **Separate** from the journey bars on purpose.
- **Band 3 — This task, step by step** (micro): the current job's steps (*You asked → Background → Scope →
  Approved → Building → Health check → Tests → 2nd AI → Safety gate → Save → Re-test → Done*). It is a
  **close-up of the phase you're in on Band 1** (macro↔micro, explicitly connected in the UI).
- **Right rail:** Owner Attention (calm when nothing's needed), Quick proof tiles, Recent activity timeline.

Every bar carries a **"?"** that explains what it is and how it relates to the others.

## The plain-language formula (the core rule)
Every tile on the glass = **plain word + a value that carries its own meaning + one status color.**
No jargon on the surface. "CI green" → "Tests passed." "Verified 23m" → "A 2nd AI checked it · 23m ago."
The technical terms (CI, receipt, SHA, diff, doctor) live **only in the drill-down**, where the owner asked
for them. (Owner is technical — he wants the dirty details on demand, not on the dashboard.)

## Progressive disclosure — three tiers (grounded in proven UX)
1. **Glance** — the tile (word + value + color).
2. **Click → popover** — a plain sentence, then *the technical detail*, then *Not proven*.
3. **"See more" → slide-out drawer** — the full breakdown in plain English (e.g. the actual file list, the
   full agreed scope + acceptance criteria, how the Codex bridge works, what the health check runs).
Prior art: Nielsen/NN-G **progressive disclosure** (~55% less cognitive load); the **5-second / glanceable**
rule + left→right priority; **RAG / traffic-light** + Carbon/HPE **status-indicator** patterns (color always
reinforced by icon + word, never color alone).

## Honesty contract (non-negotiable — this is why PCC exists)
- **Proven ≠ inferred.** Estimates (stall risk; and there is NO time-remaining estimate — we can't honestly
  predict it) live in a dashed "guesses, not facts" area and can **never** turn a tile green.
- **Unknown = gray, never green.** Missing data stays *unknown*, never silently "skipped."
- Every proof tile's detail is bound to the **exact saved version + time**, so a green can't be misread as
  covering unsaved, in-flight work.
- **"Done" = proof matched the stakes (+ owner acceptance where it matters)** — not "the worker stopped."
- **Verify + CI stay visible at rest** (ambient trust), per the Codex review — not folded away.
- **Cut for good:** time-remaining ETA, radar sweep, decorative waveforms, generic "Looks good" rollups.

## Headline feature — the Live Worker Feed
The single most valuable piece: click **"Building it"** to *watch what the worker is doing right now* and
tell at a glance whether it's **healthy, stuck, or looping** — for diving in and troubleshooting.
- **Content:** a live, auto-refreshing stream of the worker's actions (Read *file* · Edit *file* · Run
  *command* · Think), each with a tool, a target, and a time; plus elapsed time, "last action Xs ago," and a
  **healthy / looks-stuck** read (stuck = no new action for a while, or the same step repeating with no
  progress).
- **What's real today vs. new:** PCC currently runs the worker "one-shot" and only reads its output *after*
  it finishes (tool events are discarded — `app/stream-json.js`). The feed requires the worker to be run in
  **streaming mode** and its output **parsed line-by-line as it arrives** — this is the existing draft
  `docs/specs/action-timeline.md`, which correctly flags it **needs its own ADR** (it changes the
  worker-invocation path). Every other cockpit tile is backed by data PCC already owns.
- **Auto-refresh is a hard requirement** (owner: "very important"). The app already live-updates on state
  changes and ticks the session timer per second; the cockpit subscribes to those and adds the streamed feed.
- Three visual treatments to choose from: **Stream** (readable log), **Pulse** (heartbeat + motion), and
  **Workbench** (which files are being touched). See the feed mockups.

## Data sources (all existing except the feed)
Authority store · trust extras (drift/stale, backup, verification record) · `ci-status` · lifecycle state ·
detectors/signals · `doctor.ps1` · task/handoff/result state. **One new capability:** streamed worker stdout
for the live feed. No new canonical authority — the cockpit is a pure consumer; a crashed read shows
*unknown*, never a fake all-clear.

## Codex second opinion (gpt-5.4, this session)
Endorsed building it; position V1 as a **proof-chain from recorded evidence**, not "live motion." Folded in:
bind proof tiles to exact commit/time; "Done" needs the real completion contract; keep ambient Verify/CI
visible; "skipped" must be deterministic (missing → unknown).

## Scope
- **V1:** Mockup-E cockpit (3 bands + rail) with the plain-language formula + 3-tier drill-down + the honesty
  contract, all on existing data — **plus the Live Worker Feed** as the headline (its own slice, needs the
  streaming change + ADR).
- **Deferred to V2:** automatic **stuck/loop detection** as a first-class signal (depends on the feed
  existing first); the Thinking/Verification "lanes" + any message-text lane classifier (pre-live = fake
  precision); GPT's broader tab restructure (Chat/Cockpit/Proof/Project, rename Memory).

## Requirements
Auto-refresh/live · reduced-motion support (motion off → instant state, badges kept) · color never the only
cue · collapse-to-reclaim chat space, preference persisted per project · nothing on the glass that PCC can't
deterministically back.

## Open decisions for the owner
1. Which **live-feed treatment** (Stream / Pulse / Workbench, or a blend)?
2. V1 = the full Mockup-E cockpit, or ship the **Live Worker Feed first** as a standalone slice inside today's
   chat, then the surrounding cockpit? (Feed-first gets the "wow" + the most useful visibility soonest.)

## Next steps (governance — before any code)
1. Owner picks a feed treatment + the V1 cut above.
2. Write the feature **spec** (`docs/specs/owner-cockpit.md`) with EARS acceptance criteria; update
   `docs/specs/action-timeline.md` for the streaming feed.
3. Draft the **ADR** (`docs/adr/NNNN-owner-cockpit.md`, Proposed) — trust-surface + worker-invocation change;
   `scripts/check-adr.ps1` must pass.
4. Build in slices, each with tests, CI, and independent verification, per AGENTS.md.
