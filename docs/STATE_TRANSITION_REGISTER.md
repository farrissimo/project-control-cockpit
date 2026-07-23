# State-transition / pre-mortem register

A lightweight register for **deferred, non-blocking state-transition risks** surfaced during review —
things not worth fixing inside the current bounded task, recorded here so a later bounded correction
can pick them up instead of them being lost. Each entry: what, why deferred, and the bounded fix.

Not a bug tracker and not a residual-risk billboard for the owner — it is an engineering note for the
next task in the affected area. Keep entries short.

| # | Date | Area | Status |
|---|------|------|--------|
| 1 | 2026-07-22 | Chat naming state (ADR-0020 T6) | OPEN — deferred |

---

## 1 — Redundant canonical-store writes from `reconsiderChatName()` after T6

**Surfaced:** GPT review of PR #55 (ADR-0020 T6), 2026-07-22.

**What:** `reconsiderChatName()` (app/renderer/renderer.js) still re-runs whenever a chat has GROWN by
≥2 messages since it was last named (its original AI-era growth guard) and, on a "successful" rename,
writes the canonical chat store and bumps its revision. After T6, the name is derived by
`chatSummary.localTitle()`, which **always uses the chat's FIRST user message** — so the computed title
**cannot evolve** as the chat grows. The growth-triggered re-runs therefore recompute the *same* title
and can produce **redundant canonical-store writes / revision bumps** after additional messages or an
app restart.

**Impact:** low — no wrong data, no LLM/token cost (naming is local now), no user-visible defect; only
avoidable write churn / revision inflation. This is why it is **non-blocking** and was NOT fixed inside
T6 (T6's bounded scope was removing the invisible LLM call, not redesigning naming state).

**Bounded fix (later):** make the local rename a no-op when the computed title is unchanged (skip the
`chatsRename` write if `cur.name === title`), and/or retire the now-pointless growth-triggered re-run
for local naming (name once from the first user message; only re-run if that message changes). Add a
test that a grown chat does not re-write the store when the local title is unchanged.
