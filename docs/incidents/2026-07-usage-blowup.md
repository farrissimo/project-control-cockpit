# Incident: 2026-07-20 usage blow-up — forensic reconstruction (USAGE-00)

**Method:** read-only analysis of the local Claude Code session JSONL files
(`~/.claude/projects/C--ProjectControlCockpit/*.jsonl`), which carry the real per-turn `usage`
objects (input / cache_creation / cache_read / output). Tool: `app/tools/reconstruct-incident.js`.
Nothing was changed. **Claude Code version on record: 2.1.186.** Attribution is by session id:
files whose id matches a `.cockpit/chats/<id>` are PCC-app chats; one-shot calls are identified by
their first-message marker (auto-name / summary / recall); everything else is a **direct Claude Code
assistant session** (the owner working with an assistant, like this document's own session).

## What actually spent the tokens on 2026-07-20

| Session | Tokens processed | Model turns | Class |
|---|---:|---:|---|
| Session A | 226.4M | 676 | Direct Claude Code assistant session (longest of the day) |
| Session B | 53.6M | 316 | Direct Claude Code assistant session |
| Session C | 35.9M | 262 | **PCC app chat** (Opus; feature brainstorm) |
| Session D | 11.3M | 170 | Direct Claude Code assistant session |
| Session E | 1.9M | 43 | PCC app chat (handoff-seeded) |
| 3× auto-name | 0.13M | 3 | PCC background (Sonnet) |
| 1× summary | 0.20M | 8 | PCC background (Sonnet) |
| **Day total** | **~329M** | ~1,479 | |

**Split:** PCC app ≈ **38M (~12%)**; direct raw-Claude-Code sessions ≈ **291M (~88%)**.

## Findings (ground truth)

1. **The ~252K "startup baseline" constant is wrong for this setup.** The incident PCC chat's real
   turn-1 context was **22,374 tokens**. Context then *grew* to ~241,000 by turn 262. The 252K figure
   baked into ADR-0019, `app/renderer/chat-health.js:63`, and the chat-health tests equals the *grown
   late-session context*, mislabeled as "turn one." **Action: remove/replace the 252K constant** with a
   live first-turn reading (USAGE-01 already logs it). Scope of claim: disproven for this chat/setup and
   Claude 2.1.186 — not asserted universal across all models/plans.

2. **Unbounded agentic fan-out.** 38 visible owner messages in the PCC chat became **262 model turns**
   (~7×) because PCC passes no `--max-turns`. One typed message = ~7 hidden inference cycles (tool reads,
   grep, web). This is the USAGE-04 target.

3. **Context growth, not a fixed baseline, is the visible-chat driver.** The PCC chat processed ~35.9M
   tokens in 1h42m as context grew 22K→241K and was re-read every turn (95% cache reads, but on Opus at
   that scale it still burns hard). This is the USAGE-05 (enforced rollover) target.

4. **The biggest driver of the day was OUTSIDE PCC.** ~88% of usage was direct raw-Claude-Code sessions
   with the same disease (long context, hundreds of agentic turns) but **zero governance**. The
   USAGE-00..06 plan is scoped to the PCC app and does **not** touch these.

## Honest scope (per independent Codex review, 2026-07-22)

- It would be **scope fraud** to claim the PCC governance plan "fixes the usage blow-up." Honest claim:
  it fixes **PCC's ~12% share** and creates a *governed alternative* to the ungoverned raw-CC path.
- The real strategic question (owner's call): should PCC's mission be to **replace raw Claude Code** as
  the owner's primary interface, so its governance covers where the usage actually goes? Sound in
  principle; only real if PCC matches raw CC on speed, autonomy, long-run flow, and tool competence —
  otherwise the owner returns to raw CC and the governance protects nothing.

## UNKNOWN / not established (never estimated as fact)

- Exact 5-hour-meter readings before/after each session (not recoverable from JSONL).
- Whether raw-CC sessions A / B / D were partly PCC-adjacent work
  (e.g., debugging PCC) — likely, but the token spend was raw CC regardless.
- The precise quota WEIGHT of cache-reads vs creation vs output toward the 5-hour limit (Anthropic
  accounting; the diagnostic captures the categories so this can be calibrated in USAGE-06).
- Whether 07-20 was a single continuous "4-hour" incident or several sessions (data shows ~13:38–20:29
  spread across several sessions, not one).
