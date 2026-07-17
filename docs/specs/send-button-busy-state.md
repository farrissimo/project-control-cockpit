# Send-button busy-state resync   (status: active)

## Objective
After a completed chat turn, the Send button can be left permanently disabled even
though no turn is in flight and nothing in the UI says why — the owner cannot send a
second message without restarting the app. Traced statically to a real, deterministic
control-flow path in `app/renderer/renderer.js` (not merely prior evidence from the
abandoned PR #38): `setRecoveryState()` is the ONLY place that sets
`sendBtn.disabled = inRecovery || busy` (line 101). `runSend()` sets `busy = true`
(line 348) BEFORE persisting the assistant's reply; that persist (`appendMessage` ->
`chatCmd` -> `refreshCanonical` -> `setRecoveryState`) runs WHILE `busy` is still true,
so it sets `sendBtn.disabled = true`. `runSend()`'s `finally` block then sets
`busy = false` (line 370) but never re-invokes `setRecoveryState()` or otherwise
resyncs `sendBtn.disabled` — so the button is left disabled from a stale mid-turn
snapshot, with no drainable queue to fix it (the queue only drains when
`sendQueue.length` is nonzero at that point, which it normally isn't).

## Behavior
The Send button's disabled state must always reflect the CURRENT `inRecovery`/`busy`
state at the moment a turn finishes, not a snapshot taken mid-turn. When a turn
completes (success, worker error, or exception) and no further message is queued,
the button must be re-enabled (unless still in recovery).

## Acceptance criteria
- AC-1: WHEN a chat turn completes (assistant reply persisted, no exception) AND no
  message is queued AND the store is not in recovery THE SYSTEM SHALL leave the Send
  button enabled, provable by successfully sending and receiving a SECOND reply via an
  actual click on the Send button (not internal state inspection).
- AC-2: WHEN a chat turn's worker call throws/errors THE SYSTEM SHALL still leave the
  Send button enabled afterward (the same resync applies on the error path).
- AC-3: WHEN the store IS in recovery (servedGeneration === 'prev') THE SYSTEM SHALL
  keep the Send button disabled after a turn, unchanged from today.

## Test
`app/tests/e2e/buttons.spec.js` — launches the real Electron app (existing harness,
faked worker), sends a first message, waits for the assistant reply's semantic
completion (bubble present, not the transient "thinking" indicator), asserts Send is
enabled, then sends a SECOND message via an actual `.click()` on `#send` and asserts
it produces a second user bubble + reply. Per the canonical workflow's UI-repair rule:
proves the lived owner path, not internal `busy`/`disabled` state.
