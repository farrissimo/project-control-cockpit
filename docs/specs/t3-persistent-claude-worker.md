# Spec: T3 — persistent Claude worker for text chat turns (emergency slice)

Status: Proposed (bounded emergency slice of ADR-0020 T3). Precondition: the Phase 1
capability gate below must PASS on real Claude, or this slice is **BLOCKED** and not built.

## Objective
Stop PCC launching a brand-new cold `claude -p` process for **every** owner text message.
Normal text-only messages in one PCC chat reuse **one** persistent `claude` process
(`--input-format stream-json --output-format stream-json --verbose`, stdin held open), so
the prompt cache survives instead of being rebuilt each message — while preserving owner
authority, tool restrictions, per-message turn/budget safety, Stop, session continuity,
usage attribution, and zero-required-spend (session auth only).

Non-goals (explicitly out of scope): worker pool; multiple simultaneous workers; provider
abstraction; LLM gateway; multimodal stream protocol; T4/T8/full-T9; Agent SDK; paid API.

## Reference
`app/tools/measure-direct.js` already runs multiple text turns through one warm streaming
process using `workerEnv()` (session usage only). This slice adapts that mechanism into the
production chat path (`app/main.js` `askClaude` / `pcc:send`).

## Worker identity (reuse key)
A live worker is reused only while ALL of these are unchanged (any change ⇒ deliberate
restart): project path · PCC chat id · Claude session id · model · fallback model ·
tool-authority profile (read-only/build) · channel prompt.

## Behavior
- **Reuse:** same identity, text-only send ⇒ write exactly one JSONL user message to the
  live process, await exactly one matching `result`. No new process spawned.
- **Restart (kill then start/resume):** owner changes chat/project; model or fallback
  changes; tool authority changes; worker exited/failed; an attachment message arrives;
  owner presses Stop; PCC exits.
- **Attachments:** cleanly terminate the persistent process, use the existing
  attachment-capable one-shot `stream-json` path on the same Claude session, return exactly
  one result, launch no extra hidden call; the next text send starts/resumes a persistent
  worker (`--resume`). Never two workers alive at once.
- **Idle:** after returning a result the process stays alive but performs **no** model work
  until the next explicit owner message. A live idle process is not a background LLM call.
- **Stop:** kills the active process + child tree, resolves the pending turn honestly,
  ignores late output, leaves no worker, performs no automatic restart.
- **Shutdown:** app exit kills the active worker + children; nothing survives.
- **Failure:** malformed output / crash / non-zero exit ⇒ one honest failure, logged
  locally, worker marked dead, **no** automatic retry, no automatic resend; wait for owner.
- **Fidelity:** full `CHANNEL_PROMPT`, owner bytes, model+fallback, cwd, session id,
  allowed/disallowed tools, `--max-budget-usd` + `--max-turns` all preserved and passed only
  through `app/claude-spawn.js` (no raw `spawn('claude', …)`).
- **Attribution:** every owner message yields exactly one usage record mapped 1:1 to it
  (chat id, session id, pid, timestamps, input/cacheCreate/cacheRead/output, num_turns,
  status). No hidden LLM call for naming/summary/rollover/recovery/startup/shutdown/error.

## Acceptance criteria (EARS) — every one needs a passing test
- WHEN a 2nd+ text message is sent in the same unchanged chat THE SYSTEM SHALL reuse the
  existing Claude process (proven by process-launch count == 1, not by matching session id).
- WHEN a result completes THE SYSTEM SHALL remain idle (no model work) until the next send.
- WHEN chat/project/model/authority changes THE SYSTEM SHALL terminate the incompatible
  worker before starting/resuming another.
- WHEN a message has an attachment THE SYSTEM SHALL use exactly one bounded
  attachment-compatible worker and no simultaneous persistent worker.
- WHEN the owner presses Stop THE SYSTEM SHALL kill the active worker and not auto-restart.
- WHEN PCC exits THE SYSTEM SHALL leave no `claude` process running.
- WHEN a worker crashes / emits malformed output THE SYSTEM SHALL report one failure and
  not retry automatically.
- WHEN an owner message completes THE SYSTEM SHALL record usage attributable to that message.
- WHEN Claude is launched THE SYSTEM SHALL use session auth with paid-API creds stripped.
- WHEN the full evidence is reviewed THE SYSTEM SHALL prove multiple text turns use ONE real
  process, not merely one session id.

## Phase 1 capability gate (must pass before implementation)
One warm process, `--input-format/--output-format stream-json --verbose`, one session id,
read-only profile, channel prompt, small `--max-turns`; send two tiny text messages over the
same stdin. Prove: one PID handles both; two separate `result`s; process idle between them;
no second process; no auto extra turn; per-turn usage+num_turns emitted; **`--max-turns`
allows both messages to complete rather than permanently terminating after the first**;
process kills cleanly with no survivor; no API-key env present. Any failure ⇒ BLOCKED.
