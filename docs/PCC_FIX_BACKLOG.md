# PCC parent fix backlog

**Rule:** These are parent (PCC) fixes. They are NOT worked now. They get done ONLY when the
owner says so, one bounded task at a time, through PCC's own governed workflow. This file is the
durable running tally so nothing is lost and nothing is "remembered" only in chat.

Because each child project (e.g. Land Evaluator) runs a **scaffolded copy** of PCC's app code —
not a live hook — a fix proven in a child must be **ported upstream into PCC here** so the source
and every future child inherit it. Otherwise we hand-patch copies forever (the reactive trap).

## Open items

1. **Port the chat-length meter fix upstream.** — **SUPERSEDED (2026-07-26, ADR-0025).** The
   chat-length meter was REMOVED from PCC entirely (merged to main `4d47784`), so there is no
   meter to port a fix to and the meter-jump bug is moot. New form of this item: **port the
   meter REMOVAL down to scaffolded children (LE, ITM), which still carry the old meter**, so
   they lose it too rather than keeping a hand-patched divergent copy.
   (Original: once the meter-jump fix is proven in Land Evaluator, apply the identical fix to
   PCC's `app/renderer/renderer.js` + `app/renderer/chat-health.js` so future children inherit
   it. Origin: LE meter reads ~100% then drops to ~18-21% in the same chat, reproduced twice
   2026-07-25 — trust/legibility bug, not a burn bug.)

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

7. **Chat composer doesn't collapse after a large paste is sent.**
   **STATUS (2026-07-26): BUILT on branch `fix/itm-backlog-legibility-7-8`; pending CI + Codex verify + merge.**
   Root cause was NOT a missing reset-on-send — the submit handler already calls `growComposer()`.
   It was the composer `mouseup` handler persisting ANY click-height as the saved floor, so a click
   after a big paste promoted the auto-grown height to the floor and it stuck tall across restarts.
   Fixed at the `mouseup` seam: only a genuine grip drag (height changed DURING the mouse press)
   updates the floor. (A floor already polluted on the owner's machine self-heals after one drag-down.)
   The composer textarea auto-grows to fit a big pasted block (e.g. a copy-block directive) but
   does NOT reset to its normal height after the message sends — it stays expanded, filling most
   of the screen, and the owner must manually drag it back down ("I can resize it manually but
   that's a pain"). Reset the composer height on send, at the same seam that auto-grows it
   (`growComposer()` in `app/renderer/renderer.js`). Low-priority usability. Observed 2026-07-26.

8. **Turn-limit message wording is misleading.**
   **STATUS (2026-07-26): BUILT on branch `fix/itm-backlog-legibility-7-8`; pending CI + Codex verify + merge.**
   Reworded all four `max_turns` surfaces in `app/main.js` + the auto-continue notice: "per-message
   turn limit" / "agentic turns" → "limit on internal work steps" / "internal steps", with an explicit
   "NOT a limit on how many messages you can send" clause. `boundary.spec.js` assertions moved to match.
   The auto-continue / max-turns surface (ADR-0023)
   says "per-message turn limit," which the owner reasonably reads as a cap on his own chat
   messages; it actually counts internal agentic steps within one working stretch. Reword so it is
   obvious it counts internal steps, not owner messages. Owner (ITM chat): "how do you calculate we
   reached a per message turn limit? we've only had 5 messages." Truthfulness/legibility; relates to
   item 2. Observed 2026-07-26.

9. **Governance classifier blind spot: test-assertion changes go ungoverned.**
   **STATUS (2026-07-26): DEFERRED — violates current core principles.** Adds governance/classifier
   machinery (builder-facing assurance), which is secondary under ADR-0016's "does it reduce the chance
   PCC itself interrupts real work?" rule and is exactly the "more governance/detection machinery" that
   `docs/proposals/radical-simplification.md` rejects. Codex concurred (read-only advisement, 2026-07-26).
   Revisit only once the trust-model direction (simplify vs. harden) is settled by the owner.
   `classify-stakes`
   escalates on test-file DELETION only, not on changes to a test's assertions/expectations — so a
   commit that weakens or alters what a test checks can pass as T3 with NO independent verification.
   Treat assertion/expectation edits in test files as escalating. This ships to every child via the
   scaffold. Found in the ITM audit; the same hole is in PCC's own classifier. Observed 2026-07-26.

10. **No gate checks scope/roadmap docs for architectural coherence.**
    **STATUS (2026-07-26): DEFERRED — violates current core principles.** New scope/roadmap-policing
    detection layer; same ADR-0016 + radical-simplification tension as item 9, more speculative. Codex:
    "same problem, worse." The motivating constraint violation (a child scope requiring a PCC parent
    change, breaking its read-only law) is real, but the fix as framed grows the trust surface. Revisit
    with the trust-model direction.
    PCC's gates verify only the
    current CODE diff, never the roadmap/scope for constraint violations. A child's scope can carry a
    dependency that violates a hard constraint (ITM V2 was scoped as "requires a PCC parent change,"
    which directly breaks ITM's read-only "never modifies PCC" law) and it hid through intake,
    bootstrap, and 4 build chats with zero detection. Candidate: a cheap deterministic check that
    flags parent-modifying / constraint-conflicting language in a child's scope docs. Observed 2026-07-26.

11. **Intake must surface consequential scope decisions for explicit owner sign-off.**
    **STATUS (2026-07-26): ADR-FIRST.** Real owner-value (stops consequential scope decisions being
    buried in a delegated paste), but it changes the intake/runtime contract and adds decision-surfacing
    machinery — needs a bounded ADR so it does not become another bureaucratic layer. Codex upgraded this
    from "discuss" to ADR-first. Not built this session.
    When the LLM
    decomposes an idea into scope/versions, the calls that change what the owner actually GETS
    (deferring the real payoff to a later version, cross-project dependencies, big architectural forks)
    get buried in a paste the owner delegates and does not line-read. Extract and flag the 2-3
    consequential decisions in plain language for a yes/no. Keeps the visionary's delegate-the-detail
    workflow intact while anchoring the choices that matter. Observed 2026-07-26.

12. **Remote-less projects need an honest local verification mode.**
    **STATUS (2026-07-26): ADR-FIRST (NOT deferrable like 9/10).** The honesty exception: PCC currently
    overclaims CI-backed protection for remote-less projects — a live fake-green, the exact disease PCC
    exists to kill. Honesty outranks "shrink the surface," so this must be addressed. But it is a
    trust-MODEL change and needs a deliberate ADR (must never imply CI guarantees where no remote exists).
    Codex: the one item here that is not deferable the way 9/10 are. Recommend it be the next bounded task.
    PCC's trust model treats CI +
    branch protection as the un-bypassable backstop, but many projects (especially in trial) have no
    remote, so CI never runs and the scaffolded governance docs OVERCLAIM a protection that is not
    present. Fix: intake asks whether the project has a remote/CI; if not, the child adapts — the local
    guarded test run becomes the execution authority AND is required for "done," and the docs +
    "Verified" surface say "local run," never implying CI. Likely wants an ADR. Owner engaged this
    directly; leaning "ADR/plan first." Observed 2026-07-26.

## Log
- 2026-07-25: Created. Items gathered from the LE trust-trial session + Codex parent findings.
- 2026-07-25: Added item 6 (owner-as-relay) as highest priority after the LE meter task hit the
  40-turn cap mid-cycle. LE meter fix left DRAFTED but uncommitted on LE `master`
  (chat-health.js / renderer.js / chat-health.test.js) — unproven, not committed, not verified.
  Owner stopped work for the day (cannot babysit). Resume point: secure that fix on a branch,
  run unit tests, then decide whether to reorder toward item 6 first.
- 2026-07-26: Item 1 marked SUPERSEDED — the chat-length meter was removed from PCC entirely
  (ADR-0025, merged to main `4d47784`); its new form is porting the REMOVAL to children. Added
  item 7 (chat composer doesn't collapse after a large paste is sent; owner-observed).
- 2026-07-26: Added items 8-12 from the ITM trial-observation session (all PCC-specific,
  non-blocking, deferred): turn-limit message wording (8), test-assertion classifier blind spot
  (9), no roadmap/scope coherence gate (10), intake must surface consequential decisions (11),
  remote-less honest local verification mode (12).
- 2026-07-26: Owner cleared scoping of items 7-12. Claude + Codex (read-only advisement) jointly
  decided against PCC's core principles (ADR-0016 "does it reduce PCC interrupting real work?" +
  `docs/proposals/radical-simplification.md`): **BUILD 7** (composer floor-pollution) and **8**
  (turn-limit wording) now; **DEFER 9 + 10** (governance/detection machinery — secondary, opposed
  by the simplification proposal); **ADR-FIRST for 11** (intake decision-surfacing) and **12**
  (remote-less honest verification — the honesty exception, not deferrable). 7 + 8 built on branch
  `fix/itm-backlog-legibility-7-8` (unit 341 green, lint clean; E2E + CI + Codex verify pending).
  Also landed the trial-observation docs into repo truth: the TRIAL-LE-01 incident and the two
  Codex proposals (as-is assessment, radical simplification) — recorded as **Proposed / evidence,
  NOT adopted** (the owner has pushed back on the flat "PCC is dead" framing).
