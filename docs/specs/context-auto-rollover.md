# Context-triggered auto-rollover + truthful chat-health meter   (status: draft)

Desktop-parity R3. Direct fix for the 2026-07-20 incident: a ~4-hour chat grew to a
**426K-token context**, burning the owner's Claude usage with no warning and no stop,
because the "Chat length" meter measures only message-count and wall-clock and
**explicitly ignores tokens** (`app/renderer/renderer.js:1515` `computeChatSignal`,
thresholds `ROLLOVER_TURNS=40` / `ROLLOVER_HOURS=6`). So it stayed green the whole time.

## Objective
Give the owner a **chat-health meter he can trust** (his words: "one of the most truthful
signals I have"), and make the app **automatically protect him from context runaway** by
rolling a too-large chat over into a **fresh chat** seeded with a carried-forward handoff —
with zero required action, honest about what it did, and **no chat history deleted** (the old
chat stays in the list; the carried summary is lossy, so "nothing lost" would overclaim).

The owner is on a **flat monthly plan**, so **dollars are not a signal he cares about**. The
signals that matter to him are **context fullness** (the runaway) and his **usage-limit %**.
Raw token/dollar numbers feed the meter but are **not shown** to him.

## Behavior

**The meter (owner-visible piece).** The existing "Chat length" gauge is upgraded from a
message/hours guess to a **truthful chat-health reading** that also accounts for real context
size. **Context fullness is the CURRENT prompt size, not a running sum** (codex-caught): each
turn's `usage` block already reflects the whole accumulated context sent that turn, so the
meter reads the **latest** turn's context tokens — `input_tokens + cache_read_input_tokens` —
**NOT** a cumulative total à la `recordChatCost` (summing would overstate fullness and trigger
dishonest rollovers). That figure comes from the result envelope's `usage` block, which PCC
already receives but currently drops (`app/turn-output.js:22`). Chat-health = the **worst-of**
{message-count ÷ limit, elapsed-hours ÷ limit, latest-context-tokens ÷ the **rollover
threshold**} — so the gauge reads 100% exactly when protection fires, not a calm-looking % of a
huge window. **General across models and plans** (corrected 2026-07-21 after a hardcoded-200K bug):
the context window is **per-model and ESTIMATED** — headless can't report it and it also depends
on the plan (Max auto-gets 1M; a non-Max plan is 200K) — so it defaults to a **conservative**
value, always labeled estimated. The **rollover threshold** is **whichever comes first: an
absolute usage-burn floor (~350K) OR 75% of the estimated window** — which catches usage burn on
a big-window plan AND protects a small-window plan before the wall, and is **safe either way**
(under-estimating the window only rolls over sooner). A **hover** shows the real token count, the
estimated-window %, and the threshold. Two honest signals stay separate: **context pressure**
(this meter) and **plan usage** (the existing 5-hour "Usage" chip). The owner never sees dollars.

**The rollover (automatic protection).** When chat-health crosses the rollover threshold, PCC
**automatically starts a brand-new chat** (not a hidden same-session re-mint — a real new
chat, which is the more honest, scalable design and also fixes new chats starting
unpredictably). The new chat is **seeded with both**: (a) the deterministic handoff briefing
(`scripts/generate-handoff.ps1`, no-LLM), and (b) an LLM **context summary** of the chat being
left (`buildSummaryPrompt` + `oneShotWorker`, faithful/invent-nothing). The owner is switched
to the new chat and told plainly what happened; the **old chat stays in the chat list**,
untouched, reachable. The new chat's meter reads a truthful low value for its fresh context.

**Honest limits (disclosed, not hidden).**
- Per-turn token count is available **only at turn end**. It is currently **not extracted** on
  the attachment/stream path (`app/stream-json.js` — which already extracts *cost*, just not
  tokens) and the live incremental feed (`app/stream-parser.js`) carries **no per-turn token
  counts** at all. So the meter updates **per completed turn**, not live mid-turn — a single
  monster turn can still overshoot before PCC can react. Mitigation: a conservative threshold
  with headroom, the existing Stop, and the per-turn budget cap.
- Claude Code exposes **no context-window/percentage field** (per 2026-07-21 research of
  Anthropic docs + issue #8011, "not planned"), and the effective window is **plan-dependent**
  (Max auto-gets 1M; a non-Max/Pro-without-credits account is 200K). So PCC **estimates** it from
  the current model (Opus/Sonnet declared 1M, Haiku 200K, unknown conservative), **capped by a
  conservative plan default** — always labeled estimated, never a false green. This is safe: the
  absolute usage-burn floor protects even when the window is wrong, and under-estimating only rolls
  over sooner. Opus 4.8 does **not** auto-compact early (it waits until the window limit), so this
  app-side protection is the only early guard.
- The carried summary is **lossy** — the new chat knows what the summary carried, not every
  detail. This is inherent to any context reset (the same-chat version has it too); the
  new-chat design is simply honest about it.

## Acceptance criteria
- AC-1: WHEN a turn completes THE SYSTEM SHALL read the turn's **latest** context size
  (`input_tokens + cache_read_input_tokens`) from the result `usage` block — the current prompt
  size, **not a cumulative sum** — and update the chat-health meter to reflect context fullness.
- AC-2: THE SYSTEM SHALL compute chat-health as the **worst (highest)** of {turns÷limit,
  hours÷limit, context-tokens÷**rollover-threshold**}, so no single blind spot can keep it green
  and the gauge reads full exactly at the rollover point.
- AC-2b: THE SYSTEM SHALL set the rollover threshold to **min(absolute usage-burn floor ~350K,
  75% of the estimated per-model window)** — general across models/plans; a small-window model
  (Haiku 200K → ~150K) rolls over before its wall, a big-window model (Opus/Sonnet → ~350K) rolls
  over on usage burn — and SHALL never let under-estimating the window roll over later, only sooner.
- AC-3: THE SYSTEM SHALL estimate the context window **per current model** (Opus/Sonnet 1M, Haiku
  200K, unknown → conservative), capped by a conservative plan default, and **always label it
  estimated** — never a falsely-reassuring green, and never hardcoded to one model.
- AC-4: WHEN the owner hovers the chat-health meter THE SYSTEM SHALL show a plain-language
  breakdown of how the number is calculated and which input is driving it.
- AC-5: WHERE per-turn token data is unavailable for a turn THE SYSTEM SHALL keep the last known
  context reading and mark it stale, never fabricate a value or silently reset to green.
- AC-6: WHEN chat-health crosses the rollover threshold THE SYSTEM SHALL automatically start a
  **new chat** with zero required owner action.
- AC-7: WHEN an auto-rollover starts a new chat THE SYSTEM SHALL seed it with the deterministic
  handoff briefing (**required**), and with the LLM context summary **when available**; IF the
  summary cannot be generated THE SYSTEM SHALL still roll over with the handoff alone and disclose
  the summary was unavailable. (The handoff is the reliable floor; blocking protection on a
  best-effort LLM summary would leave the runaway unguarded — worse for the owner.)
- AC-8: WHEN an auto-rollover fires THE SYSTEM SHALL tell the owner plainly what happened and why,
  and leave the previous chat intact and reachable in the chat list.
- AC-9: WHEN the new chat opens THE SYSTEM SHALL show its chat-health meter at a truthful low
  reading for the fresh context, not the old chat's value.
- AC-10: WHEN a rollover fires THE SYSTEM SHALL build the carried context **FIRST while the
  current chat is still active** (handoff **required**, summary best-effort); only after the
  handoff is in hand SHALL it create the new chat, seed it, and switch to it; IF the handoff
  cannot be built, OR the new chat cannot be created or switched to, THE SYSTEM SHALL remain in
  the current chat, warn, clean up any orphan chat, and NOT mark the chat rolled-over (so it
  retries) — never continue the runaway silently, never leave an empty/orphan chat.
- AC-11: WHEN the latest context reading first reaches the threshold THE SYSTEM SHALL roll over
  **exactly once per source chat** (not on every subsequent turn); it SHALL NOT re-trigger unless
  the owner deliberately keeps working in a chat already over threshold.
- AC-12: WHERE the app is restarted mid-chat THE SYSTEM SHALL restore the chat's last context
  reading so the meter cannot falsely drop to green after a restart (durability per ADR-0017).
- AC-13: THE SYSTEM SHALL never assert certainty ("stuck"/"runaway") as proof; the trigger is a
  disclosed threshold on real measured tokens, and the meter/notice speak in that honest register.

## Open questions for codex review
- Q1 (automatic vs proposed): R3 mandates "automatic, no button," but the owner also said the
  summary "gets handed off (or proposed to)". Recommend: **automatic by default**, carried
  content **visible**, with an optional one-tap review that never blocks. Confirm or adjust.
- Q2 (unify with ADR-0015): the cost rollover keeps the **same** chat; this keeps a **new** one.
  Two behaviors is confusing. Recommend **unifying on new-chat-with-handoff**, with context as
  the **primary** trigger and cost demoted to a secondary backstop (owner is flat-plan). Agree?
- Q3 (thresholds): propose an honest default rollover threshold (~75% of window, headroom for one
  more turn) and a model→window table; how to treat the 1M-token beta window.
- Q4 (mid-turn overshoot residue): we can only measure at turn end. Is "conservative threshold +
  Stop + per-turn budget cap" an acceptable disclosed residue, or is a streaming pre-turn estimate
  worth the cost?

## Related
`docs/proposals/desktop-parity.md` (R3), ADR-0015 (cost rollover — same-chat, superseded on the
UX by this), ADR-0017 (durable per-chat tracking — the token total needs the same durability),
ADR-0013 (Stop — the mid-turn backstop). Reuse map: handoff `scripts/generate-handoff.ps1`;
summary `app/chat-summary.js`; token read `app/turn-output.js`; rollover pattern
`app/main.js` `recordChatCost` + `app/renderer/renderer.js` `remintSession`.
