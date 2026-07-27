# Approved work runs to completion   (status: active)

## Objective
Remove the owner-as-relay treadmill (backlog item #6). When approved (build-authorized) work hits the
native single-message `--max-turns` cap mid-task, PCC keeps it going automatically — same chat, same
session, same authority — until the work finishes on its own or a REAL ceiling is reached, instead of
hard-stopping and waiting for the owner to type "keep going." The binding limit is cost/usage and
runaway backstops, never an arbitrary turn count. Supersedes ADR-0023's "auto-continue exactly once."
Full decision: `docs/adr/0026-approved-work-runs-to-completion.md`.

## Behavior
- Only a `max_turns` stop of a **build-authorized, attachment-free warm text** turn qualifies. Every
  other stop (budget, usageLimit, authError, stoppedByOwner, error, malformed) denies and surfaces its
  own normal stop. A **read-only** chat still hard-stops on `max_turns` — no autonomous fan-out.
- On a qualifying stop, PCC re-sends a fixed **guarded continuation prompt** on the same `--resume`
  session with a `--max-turns` chunk clamped so the cumulative total can never exceed the run cap, and
  repeats this each time the worker stops *only* on `max_turns`.
- The run ends when: the worker finishes on its own (any non-`max_turns` end); OR a runaway backstop
  fires — the cumulative-turn cap (`max_chat_turns`, default 200) or the whole-run wall clock (30 min);
  OR the no-substantive-progress guard fires (N=2 consecutive continuations with no change to a git
  completion fingerprint). Dollars never hard-stop the run (advisory only, ADR-0022); the owner's real
  5-hour usage hold remains the only resource hard stop (handled on its own `usageLimit` path).
- Every continuation shows a running notice with cumulative turns + cost so far and "you can Stop
  anytime"; a backstop/guard stop is a plain message naming which ceiling fired and how to raise it —
  never a raw envelope.
- `max_chat_turns` is owner-editable in `.cockpit/state/usage-limits.json` and fails closed to 200.

## Acceptance criteria
- AC-1: WHEN a build-authorized warm text turn stops on `max_turns` and every ceiling still permits it
  THE SYSTEM SHALL continue the work on the same `--resume` session with the guarded prompt. *(tests:
  auto-continue.test.js "allow…"; boundary.spec.js "auto-continues past --max-turns on the SAME session")*
- AC-2: WHILE under all backstops THE SYSTEM SHALL allow MORE than one continuation (not just once).
  *(auto-continue.test.js "run-to-completion: it allows MANY continues")*
- AC-3: WHEN a continuation runs THE SYSTEM SHALL cap it at a normal per-message chunk clamped so the
  cumulative total never exceeds `max_chat_turns`, never raising any limit. *(auto-continue.test.js
  "resumeMaxTurns is clamped…"; boundary.spec.js asserts `--max-turns 30` on the resumed segment)*
- AC-4: WHEN the cumulative-turn cap is reached THE SYSTEM SHALL stop with a plain message naming the
  ceiling and `max_chat_turns`. *(auto-continue.test.js "backstop: cumulative-turn cap"; boundary.spec.js
  "stops at the cumulative-turn BACKSTOP with a plain ceiling message")*
- AC-5: WHEN the whole-run wall-clock cap is exceeded THE SYSTEM SHALL stop. *(auto-continue.test.js
  "backstop: whole-run wall-clock cap")*
- AC-6: WHEN N consecutive continuations show no advance in the completion fingerprint THE SYSTEM SHALL
  stop for no-substantive-progress. *(auto-continue.test.js "guard: deny after N…no-substantive-progress")*
- AC-7: IF the fingerprint cannot be measured (non-git project / git error) THE SYSTEM SHALL fail OPEN
  (no false no-progress halt), staying bounded only by the turn + wall-clock caps. *(main.js
  computeProgressFingerprint returns null → streak 0; guard inactive)*
- AC-8: WHEN the stop is any non-`max_turns` kind, OR the chat is read-only, OR the turn carried
  attachments THE SYSTEM SHALL NOT continue and SHALL surface the normal stop. *(auto-continue.test.js
  "deny every non-max_turns kind" / "not build-authorized" / "has attachments"; boundary.spec.js read-only
  hard-stop)*
- AC-9: WHEN deciding to continue THE SYSTEM SHALL NOT let any dollar value force a stop (advisory only).
  *(auto-continue.test.js "no dollar value ever forces a stop")*
- AC-10: WHEN `max_chat_turns` config is missing/malformed/hostile THE SYSTEM SHALL fall back to the safe
  default (200), never "no cap". *(usage-limits.test.js "max_chat_turns fails closed…"; auto-continue.test.js
  "an invalid injected maxChatTurns fails closed")*
- AC-11: WHILE any continuation is running THE SYSTEM SHALL show a running notice with cumulative turns +
  cost and remain Stoppable. *(boundary.spec.js asserts the notice text + cumulative turns/cost; Stop is the
  existing currentTurn path)*

## Notes / boundaries
- The E2E launches the real app and is worker-attested (Codex cannot launch Electron). The exact ceiling
  arithmetic and every deny path are pinned in the deterministic unit suite.
- The completion fingerprint is git HEAD + porcelain working-tree state. It detects file/commit/evidence
  changes; it deliberately does NOT try to detect "ran tests but changed nothing" — that is not progress
  toward completion, and treating it as no-progress is the honest, fail-open choice.
