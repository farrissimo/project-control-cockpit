# Spec: Agentic-turn cap per message (ADR-0020 T2)

## Objective
Stop a single owner message from fanning out into hundreds of model turns (the 2026-07-20 forensics
saw 300–1096 turns for ONE message — a major, invisible usage burn). The installed Claude CLI
(2.1.186) has **no `--max-turns` flag** (verified against its full flag list), so PCC enforces the cap
itself by counting the worker's agentic turns off the `--output-format stream-json` event stream and
killing a runaway.

## Behavior
- Every chat send now streams (`--output-format stream-json`); PCC counts each `type:"assistant"`
  event as one agentic turn as it arrives.
- When the count reaches the cap, PCC tree-kills the worker (the same `killWorker` path the Stop
  button uses) and returns a plain, non-scary safety message — the chat stays usable.
- The cap is owner-editable via `.cockpit/state/usage-limits.json` (`max_turns`), default **60**;
  a missing/malformed value fails **closed** to the default (never "no cap").
- Reply / cost / usage / context-size parsing is unchanged (the stream's terminal `result` event
  carries the same fields the old `--output-format json` blob did); the plain-text test path still
  falls back to raw stdout.

## Acceptance criteria (EARS) — each has a passing test
1. WHEN a config supplies a valid `max_turns` THE SYSTEM SHALL use it; WHEN it is missing, non-numeric,
   or < 1 THE SYSTEM SHALL fall back to the safe default (never unbounded).
   → `tests/unit/usage-limits.test.js` (max_turns cases).
2. WHEN stream output contains assistant turns THE SYSTEM SHALL count exactly one per assistant event,
   ignoring system/result/tool_result and non-JSON/partial lines, buffering lines split across chunks.
   → `tests/unit/turn-cap.test.js`.
3. WHEN the agentic-turn count reaches the cap THE SYSTEM SHALL breach (at, not before); a non-finite/<1
   cap SHALL be treated as "never breached" (config layer fails bad values closed, not the counter).
   → `tests/unit/turn-cap.test.js`.
4. WHEN a message streams more turns than the cap THE SYSTEM SHALL stop it and return a plain safety
   message (`turnCapped:true`), and SHALL NOT present the runaway's output as a success.
   → `tests/e2e/boundary.spec.js` ("fans out past the agentic-turn cap") with `worker-turn-runaway.json`.
5. WHEN an ordinary message (text, attachment, budget-abort, plan-limit, auth error) runs THE SYSTEM
   SHALL behave exactly as before the streaming switch (reply, cost rollover, context meter, `--max-budget-usd`).
   → `tests/e2e/{boundary,context-meter,cost-rollover,context-rollover}.spec.js` (15 tests, green).

## Not proven (honest boundary)
The runaway fixture emits its turns instantaneously, so tests prove **detection + safety message**.
The mid-stream kill of a still-running worker reuses `killWorker` (tree-kill), which is the same
mechanism the Stop button uses and is E2E-proven there — not separately re-proven here.
