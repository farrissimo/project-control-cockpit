# PCC parent fix backlog

**Rule:** These are parent (PCC) fixes. They are NOT worked now. They get done ONLY when the
owner says so, one bounded task at a time, through PCC's own governed workflow. This file is the
durable running tally so nothing is lost and nothing is "remembered" only in chat.

Because each child project (e.g. Land Evaluator) runs a **scaffolded copy** of PCC's app code —
not a live hook — a fix proven in a child must be **ported upstream into PCC here** so the source
and every future child inherit it. Otherwise we hand-patch copies forever (the reactive trap).

## Open items

1. **Port the chat-length meter fix upstream.**
   Once the meter-jump fix is proven in Land Evaluator, apply the identical fix to PCC's
   `app/renderer/renderer.js` + `app/renderer/chat-health.js` so future children inherit it.
   Origin: LE meter reads ~100% then drops to ~18-21% in the same chat (reproduced twice,
   2026-07-25). Trust/legibility bug, not a burn bug (auto-rollover is off).

2. **Legible "binding limiter" surface.**
   The owner has four limiters — `max_turns`, `max_turn_usd`, `max_chat_usd`, and the real
   5-hour plan usage — and cannot tell which one is closest to firing or which one actually
   stopped a turn. Surface the active/nearest limiter in plain language. (Codex findings #4, #6.)

3. **Live turn-cost visibility during a long turn.**
   The owner can watch a turn run 7-8+ minutes with no view of cost climbing or which cap is
   near. Show live turn spend / progress so the owner and worker can stop at a natural boundary
   instead of being cut off or flying blind. (Codex finding #3.)

4. **New-project scaffolding must include `.cockpit/state/usage-limits.json`.**
   TRIAL-LE-01 root cause: LE never got a local limits file, so it fell back to hidden code
   defaults (`max_turns = 30`) and hard-stopped while the visible meters looked healthy. Ensure
   the scaffold writes the owner-tunable limits file every new child reads.

5. **Build-authority carryover across "Continue in fresh chat."**
   Owner rates this "annoying but predictable" (low priority). Continued chats land read-only;
   the owner must re-click "Enable build session" and forgets. Either inherit authority safely
   or make re-approval a visible step in the continue flow. (Codex finding #1.)

6. **[HIGHEST] The parent makes the owner the manual relay for multi-step work.**
   Observed 2026-07-25: a single governed task (reproduce -> fix -> prove -> commit -> Codex
   verify) exceeds `max_turns` (hit the 40-cap at 41 turns) and stops mid-task. The owner then
   has to shuttle a continuation directive from the parent chat into the child chat, catch the
   next cap-stop, and repeat. THAT relaying is the babysitting the whole project exists to kill.
   Need: let a bounded, governed task run to completion without the human in the loop — e.g. safe
   auto-continue past a turn-cap stop for a whitelisted governed task, with live visibility of
   progress and cost, so the owner is informed, not operating the machine.
   This likely should be fixed BEFORE the cosmetic items above — revisit fix ORDER accordingly.

## Log
- 2026-07-25: Created. Items gathered from the LE trust-trial session + Codex parent findings.
- 2026-07-25: Added item 6 (owner-as-relay) as highest priority after the LE meter task hit the
  40-turn cap mid-cycle. LE meter fix left DRAFTED but uncommitted on LE `master`
  (chat-health.js / renderer.js / chat-health.test.js) — unproven, not committed, not verified.
  Owner stopped work for the day (cannot babysit). Resume point: secure that fix on a branch,
  run unit tests, then decide whether to reorder toward item 6 first.
