# Live action timeline   (status: draft)

## Objective
Let the owner see what the worker is actually DOING during a turn — "Read main.js", "Ran git
status", "Edited 2 files", "Test failed" — as it happens, instead of staring at one static
"Claude is working…" bubble and trusting the summary afterward. This directly serves the
project's core goal (know what the LLM did without watching every command) and its truth stance.

## Behavior
Today a turn is one-shot: `runSend()` shows a single "Claude is working…" bubble and awaits the
whole reply (`app/renderer/renderer.js:349-362`); the worker's stdout is parsed only after it
completes, and `parseStreamJson()` deliberately keeps ONLY the final assistant text, discarding
tool_use / tool_result blocks (`app/stream-json.js:16-31`). This feature keeps that raw material
instead of dropping it and surfaces it live.

Required changes: (a) always spawn the worker in `stream-json` mode (today it is used for the
attachments path); (b) parse stdout **incrementally**, line by line, as it arrives rather than on
the full buffer; (c) for each tool_use / tool_result, emit an IPC event to the renderer naming
the action and its primary target; (d) render those as timeline entries during the turn. The
timeline is a collapsible panel and hideable — per the owner's clutter constraint, its shown/
hidden state persists across turns. NOTE: this changes the worker-invocation path (always-stream
+ incremental parse), so it warrants its own ADR before build.

Edge/error cases: the final reply text MUST remain byte-identical to today's extraction — the
timeline is additive and must not regress `parseStreamJson`'s result (its real-capture unit test
must stay green). If the worker emits no parseable tool events (e.g. a plain fallback), the
timeline is simply empty and the chat behaves exactly as today.

## Acceptance criteria
- AC-1: WHILE a worker turn is in flight AND the worker emits a tool_use event THE SYSTEM SHALL
  append a timeline entry naming the tool and its primary target BEFORE the final reply is shown.
- AC-2: WHEN a turn completes THE SYSTEM SHALL render the same final reply text that today's
  parser produces (no regression), and the existing stream-json unit test SHALL stay green.
- AC-3: WHEN the worker emits no parseable tool events THE SYSTEM SHALL show an empty timeline
  and leave the chat behaving as today.
- AC-4: WHERE the owner has hidden the timeline THE SYSTEM SHALL keep it hidden on subsequent
  turns (persisted preference).
- AC-5: WHEN tool events arrive over multiple stdout flushes THE SYSTEM SHALL render each entry
  incrementally (proving line-by-line parsing, not one post-completion dump).

## Test
`app/tests/e2e/*.spec.js` — launch the real Electron app with a faked worker scripted to emit a
stream-json sequence: several tool_use/tool_result lines across separate flushes, then a final
result. Assert timeline entries appear naming each tool+target and appear before the reply
(AC-1, AC-5), the final reply equals the expected text (AC-2), and a persisted "hidden" state
keeps the panel hidden on a second turn (AC-4). A no-tool-event script asserts an empty timeline
and unchanged chat (AC-3). Unit: extend `app/tests/unit` (or the stream-json spec) so the
incremental parser yields the same final text as `parseStreamJson` on the real captured envelope
(AC-2).
