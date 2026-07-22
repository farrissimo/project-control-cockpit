---
status: Accepted
date: 2026-07-21
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0019: Context-triggered auto-rollover to a fresh chat + a truthful chat-health meter — desktop-parity R3

## Amendment (2026-07-21, GROWTH revision — the shipped design)

The first cut of this ADR metered **absolute** context tokens (`input_tokens + cache_read +
cache_creation`) against a rollover threshold. That was **wrong and shipped a loop**: every turn PCC
sends carries a large **FIXED baseline** — the system prompt + all tool definitions + CLAUDE.md/
AGENTS.md — re-sent unchanged each turn (~252K tokens for the owner's setup). Counting that fixed
overhead as "chat length" made a **fresh chat trip the threshold on turn one** and auto-roll into a
new chat that had the **same** baseline — an infinite loop on the owner's real screen (13 chats deep).

**Corrected decision (implemented):** the meter measures conversation **GROWTH past each chat's own
first-turn baseline**: on a chat's first measured turn, record that turn's context tokens as the
baseline (the fixed overhead) and freeze it; the gauge and the rollover trigger use
`growth = max(0, currentContextTokens − baseline)`. A fresh chat reads ~0% and climbs only as the real
back-and-forth accumulates; because each new chat records its **own** baseline, a rolled-over chat also
starts at ~0% — **the turn-one loop is structurally impossible**. Growth is window-independent for the
trigger; the estimated-window %/tokens remain only as secondary "approaching the hard wall" hover
detail (and the meter now says so honestly when the raw total already exceeds the conservative window
estimate — proof the real window is larger). Persisted per chat in `localStorage`
(`pcc.chatContextBaseline`), same cache tier as the token map.

**Survival-trial decision (2026-07-21, owner + Codex, during the ADR-0016 trust proving window):
forced auto-rollover stays OFF for the window.** The window is a survival trial, not a feature sprint:
PCC must not take control or surprise the owner during normal use. So even though the growth meter
makes the loop structurally impossible, the meter is used as a **WARNING only** — it never switches
chats automatically. Auto-rollover was disabled behind the `AUTO_ROLLOVER_ENABLED` kill-switch
(commit 1d474cd) to stop the live loop, and is **kept off** (`AUTO_ROLLOVER_ENABLED = false`); the
automatic switch is replaced by an **owner-controlled** action ("start a fresh chat" today; a
one-click "continue in a fresh chat with handoff" once the owner approves that flow). This is the
direct application of ADR-0016's decision rule (does this reduce the chance PCC itself interrupts real
work?). Proven: unit suite (`app/tests/unit/chat-health.test.js`, incl. the loop-prevention case) +
E2E (`context-meter.spec.js` fresh-chat-stays-calm-then-climbs; `context-rollover.spec.js` proves
growth past the threshold does NOT auto-switch — no surprise — and the meter warns instead).

## Amendment (2026-07-21, owner approves the one-click continue-with-handoff flow)

The owner approved the owner-controlled **"Continue in fresh chat"** action this ADR anticipated,
after finding its first cut was theater: it only pre-filled the new chat when a summary already sat
in memory, and otherwise opened an empty chat named "Continued chat" that carried nothing. That
violated this ADR's required floor (points 3–4): a "continued" chat with no carried context is an
empty room. **Implemented to the floor:** on click, `continueInFreshChat` builds the handoff FIRST
via `window.pcc.handoff()` while the source chat is still active; the handoff is **required**, so if
it cannot be built PCC **holds in the source chat** and never opens an empty one. On success the
carried context (handoff + the in-memory summary when available) is placed **visibly in the new
chat's composer** as editable text — no hidden seed — and **nothing is sent** until the owner presses
Send. This stays inside the survival-trial rule (owner-initiated; PCC never takes control). Proven:
`app/tests/e2e/continue-fresh-chat.spec.js` (4/4 green) — handoff lands in the composer before/after
the chat is heavy, cached summary appended on top, old chat intact, no auto-send, and the
**hold-path** (forced handoff failure → stays in source chat, no "Continued chat" created).
Spec: `docs/specs/continue-fresh-chat.md`.

## Context and Problem

The 2026-07-20 incident (the reason for the trust proving window, ADR-0016) was a **context
runaway**: one ~4-hour chat accumulated a **426K-token context**, burning a large share of the
owner's Claude usage with **no warning and no way to stop it**. The owner-visible "Chat length"
meter (`app/renderer/renderer.js:1515` `computeChatSignal`) measures only user-message count
(≤40) and elapsed hours (≤6) and **explicitly does not measure tokens** — so it stayed green the
entire time the context ballooned.

Two prior slices are the wrong axis for this. ADR-0014 (per-turn `--max-budget-usd`) and ADR-0015
(cross-turn **cost** rollover) protect against **dollars**. The owner is on a **flat monthly
plan** — dollars mean nothing to him; the "$18.00" rollover notice speaks in a currency he does
not care about. The signals he actually feels are **context fullness** (the runaway) and his
**usage-limit %**. This ADR closes the context gap and makes the health meter honest.

Research (2026-07-21, doc-cited) established the feasibility boundary: PCC drives Claude Code in
**headless mode**, where (a) invisible auto-compaction firing inside a one-shot `-p --resume`
turn is **undocumented/unconfirmed** (GitHub #8011, closed "not planned"); (b) there is **no
context-window/% field** to read (also "not planned"); (c) the newer Messages-API compaction and
context-editing betas are **explicitly not available** to `claude -p`. What *is* reliable: the
per-turn **`usage` token block** in the result envelope, and PCC's own ability to start a fresh
session. So the dependable automatic protection is an **app-built rollover**, not inherited
compaction.

## Decision

**1. Make the chat-health meter truthful.** Extend `parseTurnOutput` (`app/turn-output.js:22`) to
read the result envelope's `usage` block (currently dropped) for the **latest** turn's context
size (`input_tokens + cache_read_input_tokens` — the current prompt size, **not** a cumulative
sum; codex-caught that `recordChatCost`'s sum-across-turns pattern fits budget, not context
fullness, and summing would trigger dishonest rollovers), and change `computeChatSignal` to
report **worst-of** {turns÷limit, hours÷limit, latest-context-tokens÷**rollover-threshold**} so
the gauge reads full exactly at rollover. The reading is persisted (durability per ADR-0017) so a
restart cannot falsely drop the meter to green. Add a **hover** with the real token count,
estimated-window %, and threshold. The owner sees plain meaning, never dollars.

**GENERAL across models + plans (corrected 2026-07-21 after a hardcoded-200K bug).** The context
window is **per-model and ESTIMATED** — headless `claude -p` reports no window, and the effective
window is plan-dependent (research: Opus/Sonnet run 1M on Max/Team/Enterprise; a non-Max plan is
200K; Haiku is 200K). `app/renderer/chat-health.js` estimates it from the current model, capped by
a **conservative plan default**, always labeled estimated. The **rollover threshold** is
**min(absolute usage-burn floor ~350K, 75% of the estimated window)** — codex-endorsed: on a
flat/small plan the pain is usage burn, not the wall, and Opus 4.8 does not auto-compact early.
This is **safe on both situations**: under-estimating the window only rolls over sooner, and the
absolute floor protects even if a model's window is wrong. Two honest signals stay separate:
**context pressure** (this meter) and **plan usage** (the existing 5-hour Usage chip, ADR-0012).

**2. Auto-rollover starts a NEW chat, not a hidden same-session re-mint.** This is a deliberate
change from ADR-0015's same-visible-chat behavior. The owner's judgment (2026-07-21): the
same-chat version "sounds like a hack… probably not the right professional solution" — it fakes
continuity while wiping the model's memory underneath. A real new chat is **more honest** (it does
not pretend to remember everything), **more scalable** (no ever-growing transcript), and it
**fixes new chats starting unpredictably** because the new one starts from a known handoff.

**3. Seed the new chat with the existing handoff generator PLUS a context summary.** Reuse
`scripts/generate-handoff.ps1` (deterministic briefing, already wired at `app/main.js:435`) **and**
`buildSummaryPrompt` + `oneShotWorker` (`app/chat-summary.js:36`, `app/main.js:1025`, faithful /
invent-nothing). Both already exist; this ADR wires them to fire at rollover instead of only
on-demand. The **handoff is the required floor; the summary is best-effort** — if the LLM summary
fails, the rollover still proceeds with the handoff alone (disclosed), because blocking protection
on a best-effort summary would leave the runaway unguarded. The previous chat is left intact and
reachable in the chat list; nothing is deleted.

**4. Honest register throughout.** The trigger is a **disclosed threshold on real measured
tokens**, never an asserted "stuck." Failure to summarize/seed **warns and holds** rather than
silently continuing a runaway.

Full behavior and the eleven acceptance criteria: `docs/specs/context-auto-rollover.md`.

## Consequences

- **Gain:** the exact 2026-07-20 failure mode — silent context growth to a runaway — now triggers
  automatic protection with zero owner action, on the honest signal (real context tokens), and the
  health meter can no longer sit green through a runaway.
- **Cost / change surface:** a `usage`-token read in `turn-output.js` (+ the stream path), a
  cumulative-token tracker in `main.js`, the `computeChatSignal` rewrite + hover, and a new-chat
  rollover path in the renderer (new-chat create + seed + switch + notice).
- **Supersedes on UX:** ADR-0015's same-chat rollover; the recommendation (Q2) is to unify all
  auto-rollover on new-chat-with-handoff, with cost demoted to a secondary backstop trigger.
- **Honest residues (disclosed):** (a) tokens are measured **at turn end** only — a single monster
  turn can overshoot before PCC reacts (mitigated by a conservative threshold + Stop + per-turn
  cap); (b) the model context window is **hardcoded** (no field exists) — a wrong window skews the
  %, so it fails toward a conservative default; (c) the carried summary is **lossy** — stated
  plainly, inherent to any context reset.

## Confirmation

**This ADR is Proposed — no code yet; this is the proof plan, and the bar.** Per the proving
window, CI-green + a valid trailer is necessary but **never sufficient**: this feature is not done
until it is **proven on the owner's real screen** (a real chat driven to the threshold triggers a
real new-chat rollover the owner watches happen). Planned automated proof, one test per acceptance
criterion:
- **Unit:** `usage`-token parsing from the real result envelope (valid shapes → real count;
  malformed/missing → safe null, never fabricated); worst-of health computation; unknown-model
  fallback labeled estimated; fail-closed stale reading.
- **E2E (real app + fixture):** a fixture reporting large `usage` tokens drives chat-health across
  the threshold → a **new chat** is created, seeded with handoff + summary, owner switched, old
  chat still present in the list, new chat's meter reads low; seeding-failure → warn-and-hold, no
  silent continue.
- **Regression:** the full send/close-path E2E sweep re-run live on the exact diff (as ADR-0015
  did), plus the existing `cost-rollover.spec.js` / `chat-rollover-honesty.spec.js` updated for the
  unified new-chat behavior.

## Engagement

- **Owner:** protected automatically from context runaway; sees a **truthful** health meter with a
  plain hover; when rollover fires he is told what happened and lands in a fresh, predictable chat
  with his history one click away. Never watches a number or decides anything (Q1: optional
  non-blocking review of the carried summary, to be confirmed).
- **Claude worker:** implements the token read, the tracker, the meter rewrite + hover, the
  new-chat rollover path, and the full test suite incl. the regression sweep.
- **Codex verifier:** reviews this scope now (the owner's explicit ask) and later diff-reviews the
  implementation (static + lint + doctor; cannot launch Electron — E2E is worker-attested, re-run
  live at review time). **Codex is asked to weigh in on Q1–Q4 in the spec.**
- **Spawned projects (DECISION-113 parity):** the token read, tracker, meter, and rollover are
  shared home-app logic (inherited); the model→window table and threshold live in per-project
  `usage-limits.json`-style state the scaffolder seeds.
- **Security-model note:** no new capability or external IPC; the new-chat create + session mint
  reuse existing mechanisms (`chatsCreate`, `remintSession`/`--session-id`). Not flagged for the
  ADR-0009 GPT trigger.

## Supersedes / Related

Supersedes ADR-0015's same-chat rollover UX (unify on new-chat-with-handoff; see Q2). Extends
desktop-parity R3 (`docs/proposals/desktop-parity.md`). Related: ADR-0014 (per-turn cap, a
mid-turn backstop), ADR-0016 (trust proving window — this is a core proving-window feature),
ADR-0017 (durable per-chat tracking — the token total needs the same cross-restart durability),
ADR-0013 (Stop — the mid-turn overshoot backstop). Spec: `docs/specs/context-auto-rollover.md`.
