---
status: Proposed
date: 2026-07-22
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0020: Stop PCC burning session usage — cold-process cache rebuild is the root cause; bounded governance plan

## Context and Problem

The 2026-07-20 "usage off the rails" incident (the reason for the ADR-0016 trust proving window) was
finally reconstructed from the **real local Claude Code session JSONL files** (forensic report:
`docs/incidents/2026-07-usage-blowup.md`; tool: `app/tools/reconstruct-incident.js`, read-only).

**Confirmed root cause (data + the owner's own prior words match exactly): PCC relaunches a COLD
`claude -p --resume` process for EVERY owner message.** A cold process has no warm prompt cache, so it
**rebuilds the entire growing conversation context as fresh cache (`cache_creation`) on every message.**
Measured: the incident PCC chat created **10.24M cache tokens over 25 messages
(~410K/msg)**; a continuous desktop Claude Code session created 3.51M over 31 messages (~113K/msg) — ~3×
worse per message. Calibrated to the owner's meter (~113K creation ≈ 1% of the 5-hour limit), that chat
≈ **~90% of a 5-hour limit for 25 messages.** The owner's independent observations corroborate this at
the same magnitude: ~13% of the limit consumed in ~9 minutes; ~16% in under 20 minutes during a single
slice of work; roughly **10.2M cache writes** (matching the measured 10.24M); the sense that PCC is
carrying the entire context every message with no auto-compaction like the desktop app. The desktop app
holds ONE warm process and compacts; **PCC fights the cache.**

**Secondary burns found:** no `--max-turns` (one message → 300–1096 model turns); context grows to
440K–870K; invisible fresh-session background calls (`oneShotWorker`: auto-name fires on chat-LEAVE,
summary, 2-call search); no real usage-based meter / auto-warn; uncapped attachments (200K chars each) /
search evidence (8 transcripts) / queued sends; restart loses worker-session continuity and re-fires
background work. **Debunked:** the enshrined "~252K startup baseline" constant (ADR-0019,
`app/renderer/chat-health.js`, tests) — real turn-1 was ~22K; 252K was **grown late-session context,
mislabeled** — it must be removed.

**Constraints:** everything must be **automatic** (no calculations for the owner; the ONE metric he
watches is the Claude 5-hour usage %); **LLM-agnostic** (owner leaves the paid Claude plan ~2026-07-27 →
free/tight plan; may move the worker off Claude entirely).

## Decision

> **⚠ AMENDED 2026-07-22 — read the Amendment section immediately below first.** The absolute
> zero-required-spend rule disqualifies T3's warm-session mechanism as *required* architecture, and
> the task ordering in the original decision is superseded. The original text is retained below as the
> historical record.

### Amendment — 2026-07-22 (owner decision): zero-required-spend rule; T3 Claude-SDK path disqualified

**1. Absolute zero-required-spend architecture rule.** No PCC feature, architecture, workflow, spawned
project, or *required* worker may DEPEND on: a paid API; a paid subscription; purchased credits; metered
billing; a promotional allowance; or a paid fallback. Paid Claude or Codex access MAY be used *during
development* while the owner happens to have it, but it is **not valid required product infrastructure**.
Optional paid adapters may exist later, but PCC can never REQUIRE them.

**2. T2 is COMPLETE.** The native per-message `--max-turns` cap shipped and merged (PR #53, commit
`4e63983`; on-screen verified). It bounds one message's agentic fan-out — a guardrail, not the root-cause fix.

**3. T3's Claude Agent SDK path is DISQUALIFIED as required core architecture.** Research (official Claude
Code / Agent SDK docs) + independent Codex review established that the ONLY officially-supported warm
multi-turn mechanism is the Claude Agent SDK (`@anthropic-ai/claude-agent-sdk` streaming input) — plain
`claude -p` is one-shot even with `--input-format stream-json`. That SDK requires an API key / cloud-provider
auth and is **not supported on a free `claude.ai` plan** (unproven/unsupported). Because it depends on
proprietary paid-service access, it violates rule (1) and cannot be PCC's *required* warm-worker solution.
No SDK was installed and no SDK-auth probe was run — the investigation was stopped at this finding.

**4. T3 remains an UNMET, OPEN architectural requirement — inactive; NOT fixed, NOT completed, NOT merely
postponed for convenience.** Honest state:
- PCC's current Claude adapter still **cold-starts a `claude -p` process per message**.
- The resulting **cache-rebuild usage burn (the root cause) REMAINS**.
- T3 may be reconsidered ONLY when a genuinely **zero-required-spend** persistent-worker mechanism is
  available AND proven.

**5. Revised containment sequence (supersedes the ordering below).** These tasks REDUCE and BOUND the current
cold-start adapter's burn on ANY plan/provider; they do **not** claim to reproduce a warm worker or fix the
root cause:
- **T6 — Eliminate invisible background LLM calls** (auto-name-on-leave, automatic summary/search). **First.**
- **T7 — Hard-cap** attachments, evidence injection, queued sends, and other payload growth.
- **T1 — Deterministic fresh-session compaction/handoff** — NO LLM summary, NO silent rollover, with explicit
  protection against the previous rollover loop.
- **T8 — Restart continuity.**
- **T4 — Honest usage warnings and protection.**
- **T9 — One logged gateway** + reconciliation of all calls.
- (T5 auto model-switch stays optional/late, unchanged.)

**6.** These containment tasks bound the burn; they **do not reproduce a warm worker**. The root-cause fix
stays open under rule (1).

### Original decision (2026-07-22 — superseded in part by the Amendment above)

Fix the burn as a set of **bounded, independently-verified tasks**, in the order Codex verified
(2026-07-22, verdict NEEDS-CHANGES → corrected order below; Codex is a standing advisor per the owner's
directive). **The warm persistent worker session is the actual cure and is NOT deferred.** *(Superseded: see
Amendment §3–§4 — the only supported warm mechanism requires paid access, so it is disqualified as required
architecture and T3 is now open/inactive.)*

- **T2 — Cap agentic turns per message (`--max-turns`).** No message can fan out into hundreds of model
  turns. Immediate, small.
- **T3 — Warm persistent worker session.** Stop cold-starting `claude -p` per message; hold one warm
  session so the prompt cache survives instead of being rebuilt every message. **THE root-cause fix.**
  Biggest change/risk; Codex insists it comes early — T1 alone only makes each rebuild smaller, it does
  not stop the rebuild.
- **T1 — Auto-compaction / roll to a fresh session before context balloons.** Handoff MUST be
  **local/deterministic, NOT an LLM summary** (an LLM summary would be a new hidden burn).
- **T6 — Kill invisible background calls.** Local chat-naming (0 tokens; nothing fires on chat-switch),
  cached summaries (no re-run on unchanged chats), local-default search. Essential, not cleanup.
- **T7 — Hard caps** on attachments / search evidence / Capture-Decisions injection / queued sends.
- **T8 — Fix restart session continuity** + honest recovery message + no re-fired background work.
- **T4 — Real usage meter + automatic warn/rollover** driven by the **real 5-hour % signal** (never a
  laggy inferred token formula). Remove the 252K constant; calibrate from the real usage log.
- **T9 — One logged execution gateway** (no hidden `claude` spawns) + **final proof**: PCC's usage ledger
  reconciles to the owner's real 5-hour meter with nothing unexplained.
- **T5 — Auto model-switch (Sonnet/Opus) with owner override.** OPTIONAL, late; Codex says NOT part of
  the core fix.

Foundation already built (uncommitted on `feat/owner-cockpit`): `app/usage-log.js` + instrumented spawn
sites (the T9 gateway down-payment), and the forensic/measurement tools.

## Consequences

- **Gain:** the other tasks bound the remaining leaks and make spend visible. *(Superseded re: the root
  cause — see Amendment §3–§6: the silent cache rebuild is NOT structurally removed, because the only
  supported warm mechanism requires paid access and is disqualified. The containment tasks bound the burn;
  they do not eliminate the per-message cold-start rebuild. That root-cause fix stays OPEN.)*
- **Cost / risk:** T3 changes how the worker is invoked (a persistent session lifecycle vs one-shot
  `-p`), the largest change surface; GPT cautioned against leading with a full persistent-SDK rewrite, so
  T2 lands first and T3 is scoped tightly with crash/recovery handled. T1's context reset is inherently
  lossy (carried handoff, not perfect memory) — stated plainly, not glossed.
- **Supersedes/aligns:** replaces the dollar-based framing of ADR-0014/0015/0017 (dollars are a phantom
  on a flat plan); removes the 252K constant that mis-calibrates ADR-0019's meter.

## Confirmation

**Proposed — nothing built yet beyond diagnostics; this is the proof plan and the bar.** Per ADR-0016,
CI-green is necessary but never sufficient: each task is not done until proven, and the phase closes only
when **PCC's ledger reconciles to the owner's real 5-hour meter (T9) with no material unexplained
movement.** Each bounded task gets: its own tests (the diagnostic `app/usage-log.js` already captures
per-call `usage` — input/cache_creation/cache_read/output/num_turns — so before/after token deltas are
measurable, not estimated); an independent Codex diff-review; and, for the usage-facing behavior, an
on-the-owner's-screen check. The plan itself was already Codex-verified (2026-07-22).

## Engagement

- **Owner:** protected automatically; watches only the real 5-hour % and never does token math; can
  override model choice (T5) even when the app suggests Sonnet.
- **Claude worker:** builds the T-tasks one at a time, each verified, consulting Codex throughout (owner
  directive: Codex is a regular advisor, not just a final check).
- **Codex verifier:** already verified this plan (NEEDS-CHANGES → corrected order applied); diff-reviews
  each task (static + lint + doctor; cannot launch Electron — E2E is worker-attested, re-run live).
- **Spawned projects (DECISION-113 parity):** the warm-session invocation, turn caps, local naming,
  gateway, and usage ledger are shared home-app logic and travel to scaffolded projects.
- **LLM-agnostic:** all tasks measure/limit in tokens and worker-process behavior, so they hold if the
  worker becomes a free-plan Claude or a different provider (owner's imminent plan change).

## Supersedes / Related

Related: ADR-0016 (trust proving window — this is the core proving-window fix), ADR-0019 (context
auto-rollover + the 252K constant this ADR removes), ADR-0014/0015/0017 (dollar-based caps, superseded in
framing by usage/tokens), ADR-0013 (Stop). Forensic basis: `docs/incidents/2026-07-usage-blowup.md`.
