# Spec: T1 — deterministic local compaction/rollover (ADR-0020)

Status: Proposed · 2026-07-23 · Owner-approved to build (reconciled sequence, T1)

## Objective
Protect medium-length chats from the real usage burn (a large, growing conversation context re-sent every
turn) by rolling a chat over into a fresh worker session **before the context balloons**, carrying forward
a **deterministic, local, no-LLM** continuation context so the conversation stays usable. Strictly bounded:
no T8, T4, full-T9, Gate 0, T3, or unrelated cleanup.

## What exists today (and the gaps T1 closes)
ADR-0019 already built the machinery: a growth-based chat-health gauge (`app/renderer/chat-health.js`,
`overRollover`), an owner-triggered **"Continue in fresh chat"** button (`continueInFreshChat()`), and an
automatic `autoRolloverToNewChat()` which creates a "Continued chat", seeds it, switches, keeps the old chat,
and announces it. **Three problems make it fall short:**
1. **The automatic path's seed uses an LLM summary** — `window.pcc.summarizeChat()` (a `claude` one-shot) —
   which T1 forbids (an LLM summary is itself a hidden burn).
2. **The automatic path is disabled** (`AUTO_ROLLOVER_ENABLED = false`) under the ADR-0016 survival-trial
   "no auto-switch" stance.
3. **The manual path carries PROJECT truth but not the CONVERSATION** — it seeds the composer with the
   deterministic handoff (repo/git state) plus a cached LLM summary *if one happens to exist*. So the
   owner's actual working thread is what gets lost on a switch — the exact "fresh-chat dumbness" problem.

## Owner decision — 2026-07-23 (supersedes the earlier open question)
The owner was asked whether rollover should be automatic, manual, or two-threshold. **Decision: warn +
easy manual switch now, with automatic left a one-line flip away.** Consequences, recorded so this is not
re-litigated:
- `AUTO_ROLLOVER_ENABLED` stays `false`. The ADR-0016 survival-trial "PCC must never auto-switch chats"
  stance **holds** — T1 does not supersede it.
- The automatic machinery is kept, wired, and made deterministic, so enabling it later is literally
  `const AUTO_ROLLOVER_ENABLED = true`. It is not dead code to be "cleaned up".
- **Post-T1 Gate 0 decides** whether automatic is warranted.
- Threshold **confirmed at ~150K growth** (the conservative default: no `planWindowCap` is passed, so the
  window reads 200K and `rolloverTokensFor` returns `min(350K, 75% × 200K)` = 150K). Kept configurable in
  code; **no settings UI is built now** — Gate 0 decides whether it needs lowering.

Because PCC never switches on its own, the anti-surprise guarantee is direct: the meter warns, and the
owner clicks. The carried context lands **visibly and editably in the composer**; nothing is sent until Send.

## Behavior
- **Deterministic seed builder (no LLM):** `app/renderer/rollover-seed.js` — a pure, local module that
  carries the **recent conversation verbatim, bounded** (last N messages, capped total chars). Same input →
  same output, every time. No `claude` call.
- **Manual path (what ships to the owner):** `continueInFreshChat()` adds the deterministic recent-conversation
  transcript to the carried context, **additively** — the required handoff and any already-cached summary are
  untouched, and no *new* LLM call is made anywhere.
- **Automatic path (built, off):** `autoRolloverToNewChat()` uses `buildContinuationSeed()` in place of
  `summarizeChat()`, so the LLM-summary burn is gone whether or not the flag is ever flipped.
- **Owner-visible:** the climbing gauge warns beforehand and its wording states plainly that PCC will not
  switch chats; the old chat stays in the list; nothing is deleted or silently swapped.
- **Loop-safe (protection retained for the automatic path):** the gauge measures GROWTH past each chat's OWN
  first-turn baseline, so a new "Continued chat" records its own baseline (seed included) and reads ~0%
  growth — it cannot immediately re-trigger. Plus `rolledOverChats` (a source rolls over at most once),
  `rolloverInFlight` (no concurrent rollover), and a trigger only on a real measured `contextTokens`. The
  seed is BOUNDED so a fat baseline can't defeat the usage saving.

## Acceptance criteria (EARS — each needs a passing test)
1. WHEN a completed turn's growth crosses the rollover threshold THE SYSTEM SHALL warn via the meter and
   offer "Continue in fresh chat", and SHALL NOT switch chats by itself.
   → `context-rollover.spec.js` test 1.
2. WHEN the owner takes the offered switch THE SYSTEM SHALL open a fresh chat carrying the recent
   conversation verbatim plus the handoff, visible in the composer, sending nothing until Send.
   → `context-rollover.spec.js` test 2.
3. WHEN the carried context is built THE SYSTEM SHALL build it deterministically and locally with NO
   `claude`/LLM call (same messages → identical text).
   → `rollover-seed.test.js` (determinism) + `context-rollover.spec.js` test 2 (no summary generated).
4. WHEN the carried conversation would exceed the bound THE SYSTEM SHALL cap it (compact), never carrying
   the full grown history, and SHALL mark any truncation rather than cut silently.
   → `rollover-seed.test.js` (bound + `…[trimmed]` marker).
5. WHEN the handoff cannot be built THE SYSTEM SHALL hold in the source chat with an honest notice and never
   open an empty/broken chat.
   → `continue-fresh-chat.spec.js` test 4 (pre-existing, still passing).
6. WHEN automatic rollover is enabled (flag flipped) THE SYSTEM SHALL roll over at most once per source
   chat and SHALL NOT loop, because the fresh chat's own baseline reads ~0 growth.
   → **NOT covered by a shipping test** — the flag is off, so this path is unexercised. See limitations.

## Verification (proportional)
Affected unit tests (rollover-seed determinism + bound) + the rollover e2e rewritten to the owner-chosen
warn-only behavior, plus the pre-existing `continue-fresh-chat` suite kept green; independent final-diff
Codex review; one diff-bound receipt; one exact-SHA CI authority. No new correction cycle for
wording/cleanup/theoretical residue unless it can realistically break compaction, lose context, loop
rollover, or increase usage.

## Honest limitations (carried forward, not fixed here)
- **AC-6 is unproven in the shipping configuration.** With `AUTO_ROLLOVER_ENABLED = false`, the automatic
  rollover path — including its loop-safety — is not exercised by any test in the suite. It was observed
  working in a development build before the owner chose manual, but that is not a standing proof. Flipping
  the flag requires re-proving it.
- The deterministic carry-forward is the recent conversation verbatim, not an LLM-quality summary — older
  detail beyond the bound is dropped (the old chat is still preserved for reference).
- Because the switch is owner-triggered, **the usage saving only happens when the owner acts on the warning.**
  T1 makes the switch cheap and lossless; it does not make it automatic.
- The manual path still appends a *cached* LLM summary when one already exists (pre-existing behavior, no new
  call). Left as-is, deliberately out of T1 scope.
- The rollover trigger uses the estimated-window/growth gauge (ADR-0019), which is an estimate, never asserted.
- This does not address restart continuity (T8), the usage meter (T4), or the Gate 0 experiment — out of scope.
