# max-turns auto-continue (once)   (status: draft)

## Objective
The native `--max-turns` cap is a real runaway backstop — a spiralling message that fans out
into hundreds of hidden model turns burns the owner's actual Claude usage. But when *approved*
work is genuinely mid-task and simply ran long, a bare stop on that cap is a FALSE stop: it
halts work that only Anthropic's real 5-hour usage should ever hard-stop (ADR-0022). This
feature lets already-approved (build-authorized) work **auto-continue exactly once** past the
turn cap, under hard ceilings, so the backstop still fires against a true runaway but no longer
stops honest work on its first long message. This is trust-trial finish-line item (4): demote
`--max-turns` from a hard stopper of approved work without removing the runaway guard.

## Behavior
Normal path: a warm text turn stops with the native turn cap (`subtype: error_max_turns`). If
the chat is build-authorized, has no attachments, and every ceiling still permits it, PCC sends
**one** guarded continuation segment on the **same chat and same Claude session** (`--resume`),
with the resumed segment's `--max-turns` lowered to the remaining cumulative-turn budget. The
owner sees a visible notice that work continued because the turn cap fired, and can Stop anytime.

Ceilings (all must hold): at most one auto-continue per owner message; a cumulative-turn cap
across the original + resumed segment; a wall-clock cap. There is **no** dollar gate — the flat
plan makes per-turn USD advisory (ADR-0020/0022).

Edge/error cases: auto-continue is DENIED for every non-`max_turns` stop (budget, usageLimit,
authError, stoppedByOwner, cancelled, sessionInUse, generic error, malformed), for non-build
chats, for attachment turns, once the single auto-continue is used, once the cumulative-turn cap
is reached, and once the wall-clock cap is exceeded. The resumed segment runs at the SAME
authority (no escalation, no cap-raising). If the resumed segment itself stops for any reason,
PCC does not auto-send another segment. Cold/non-warm paths are out of scope for this slice and
still hard-stop.

## Acceptance criteria
- AC-1: WHEN a warm text turn stops with `kind:'max_turns'` AND the chat is build-authorized AND
  no attachments are present AND all ceilings still permit it, THE SYSTEM SHALL send exactly one
  guarded continuation segment on the same chat and the same Claude session.
- AC-2: WHEN PCC sends the resumed segment, THE SYSTEM SHALL use the authority/tool profile
  already in force and SHALL NOT escalate permissions or raise the turn cap.
- AC-3: WHEN PCC auto-continues, THE SYSTEM SHALL cap the resumed segment's `--max-turns` to the
  remaining cumulative-turn budget (`min(perMessageMaxTurns, cumulativeCap - cumulativeTurns)`).
- AC-4: WHEN PCC auto-continues, THE SYSTEM SHALL show a visible notice stating that work
  continued because the turn cap fired and that the owner can stop anytime.
- AC-5: WHEN a stop reason is `budget`, `usageLimit`, `authError`, `stoppedByOwner`, `cancelled`,
  `sessionInUse`, a generic error, or malformed output, THE SYSTEM SHALL NOT auto-continue.
- AC-6: WHERE the chat is not build-authorized OR attachments are present, THE SYSTEM SHALL NOT
  auto-continue and SHALL surface the normal stop result.
- AC-7: IF one auto-continue has already been used, OR the cumulative-turn ceiling is reached, OR
  the wall-clock ceiling is exceeded, THEN THE SYSTEM SHALL NOT auto-continue and SHALL surface
  the normal max-turns stop.
- AC-8: WHEN the resumed segment itself stops or errors, THE SYSTEM SHALL NOT auto-send any
  further segment.

## Tests
- Pure unit (`app/tests/unit/auto-continue.test.js`) on `decideAutoContinue`: AC-1, AC-3, AC-5,
  AC-6, AC-7 (one case each ceiling), plus the allow case returning `resumeMaxTurns = 15` for the
  default `30 -> 45` budget.
- e2e/IPC (`app/tests/e2e/boundary.spec.js`): the `sequence` fixture
  `worker-max-turns-then-success.json` proves AC-1/AC-2/AC-4 (resumed segment on the same session,
  notice text present, no escalation), and the existing single max_turns fixture proves AC-7/AC-8
  when auto-continue is exhausted or the chat is read-only.
