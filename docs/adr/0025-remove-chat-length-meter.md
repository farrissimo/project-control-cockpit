---
status: Proposed
date: 2026-07-26
deciders: owner (+ Codex verifier)
---

# ADR-0025: Remove the chat-length meter (no dishonest replacement)

## Context and Problem
The main chat page has carried a "chat length" / chat-health meter (ADR-0019) that tried to
tell the owner when a chat was nearing the end of its usefulness. In practice it could not be
displayed honestly, and after a ~3-hour design session (2026-07-26) the owner decided to remove
it rather than ship a prettier version of a signal PCC does not trust.

The core problem is that **"is this chat still safe to continue?" cannot be measured from inside
the chat** — the chat is the very thing that would be lying. Working the candidate signals down:

- **Context-token fullness / % of window (and its cousin, message-count/time "age")** — already
  built, but *not honest*. The context window is an unconfirmable estimate on headless `claude -p`
  (model- and plan-dependent), the token reading suffered aggregate-usage corruption, and the whole
  thing measures a chat's *size*, not its *safety* — while looking like it measures safety.
- **Model/agentic "work distance" (per-invocation steps)** — the genuinely better proxy, but *not
  built*: there is no reliable per-session step telemetry on the current stack, and building it is a
  rabbit hole the owner explicitly declined.

So the only two signals we could reasonably use are one that isn't honest and one that isn't built.
Detecting a chat that has *actually* gone bad (lies, out-of-scope work, drift) needs semantic
judgment — an LLM grading the LLM — which burns the usage PCC is trying to protect and is itself an
unreliable judge. The owner already catches those cases by babysitting. Keeping a meter we cannot
make truthful is exactly the fake-green disease PCC exists to kill.

## Decision
We will **remove the chat-length / chat-health meter entirely** — both the visible gauge and the
**automatic context-rollover behavior it fed** (ADR-0019), because that automation was driven by the
same untrusted metric and would otherwise keep acting on the owner invisibly.

We will **keep the manual "Continue in fresh chat" button** (ADR-0021 is unaffected): the owner
rotates a chat when *he* decides. No replacement meter ships now; removing a dishonest signal is the
deliverable.

## Consequences
**We gain:** no dishonest signal on the owner's screen; a simpler chat surface; less code and fewer
edge-case states (MEASURING/UNKNOWN/stale/estimated-window) to maintain; and alignment with PCC's
anti-fake-green principle — nothing we don't trust drives a display or a behavior.

**We give up:** the at-a-glance chat-age cue, and the automatic rollover safety net. Chat rotation
becomes an owner judgment call (backed by the manual button) rather than a system nudge. This is an
accepted trade: the automatic net was steering off a metric we just classified as untrustworthy, so
losing it removes a hidden risk, not a proven protection. Early "off-the-rails" detection remains
out of scope (owner-babysat; reliable automated detection is a declined rabbit hole).

## Confirmation
Proof this removal is complete and breaks nothing (to be finalized on verify — build → CI → verify → done):
- The full test suite stays green after removal, with meter-specific unit/e2e tests removed and a new
  E2E asserting the gauge tile is **gone** from the rendered app (not merely hidden).
- `npm run lint` (no-undef) stays clean — no dangling references to removed symbols
  (`PCCChatHealth`, `computeGauge`, `chatContext*`, auto-rollover machinery).
- The manual "Continue in fresh chat" button still works (covered by its existing test), and the
  usage meter / cost surfaces are untouched (they are separate from the chat-length meter).
- CI is green on the exact merge commit, and an independent verifier (Codex) reviews the diff and
  returns a verdict. This ADR is flipped to Accepted only after that.

## Engagement
- **Owner:** the chat-length meter is gone; PCC no longer guesses when to start a fresh chat. Use the
  "Continue in fresh chat" button whenever you decide a chat has run its course.
- **Claude worker:** no chat-health/auto-rollover code to maintain; do not re-introduce a size- or
  age-based chat meter without a new ADR. Recorded in PROJECT.md.
- **Codex verifier:** confirm the meter and auto-rollover trigger are removed, the suite is green, the
  manual button and usage/cost surfaces are intact, and no dead references remain.
- **Future chats:** this ADR plus a note in PROJECT.md record the removal and the reasoning (docs/DECISIONS.md is the frozen pre-ADR archive and is left unchanged).
- **Spawned projects:** N/A — the chat-length meter is app-renderer UI, not part of the scaffolder's
  seeded assurance kit, so nothing changes for bootstrapped projects.

## Supersedes / Related
- **Supersedes ADR-0019** (context-auto-rollover-new-chat): both its visible meter and its automatic
  rollover trigger are removed.
- **Related ADR-0021** (build-authority-continuity-on-continue-fresh-chat): UNAFFECTED — the manual
  "Continue in fresh chat" flow stays, and this ADR keeps its build-authority continuity intact.
