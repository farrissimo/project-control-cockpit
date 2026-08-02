# Worker Provider Selection   (status: draft)

Governed by ADR-0029: Make Codex the live worker and keep Claude as a disabled backup.

## Objective

Make **Codex CLI** the real chat worker in PCC, while keeping **Claude Code** visible only as a disabled backup so the app stays honest about what can actually be used.

## Behavior

PCC already has the routing needed for Codex and Claude, but the owner-defined behavior is stricter than a normal two-worker selector.

This slice must:

- default normal app use to **Codex**
- keep **Claude** in the app as a visible **backup only**
- show Claude as **disabled / unavailable**, not as a normal live choice
- reuse the existing worker logic instead of inventing a second system
- keep local tools and all non-worker behavior unchanged

This slice is intentionally bounded:

- **Claude** keeps its existing wiring underneath, but is not presented as selectable while it is unavailable.
- **Codex** is the active chat worker path.
- Codex's default model option is **account default**. In that mode PCC must omit
  `--model` so it does not pin a Codex model the current account cannot use.
- Codex in this slice is still **not** presented as having Claude-style attachment support. If the owner tries to send attachments while Codex is selected, PCC must say so plainly instead of pretending it worked.
- In test mode, the suite may default to Claude to preserve the established Claude-specific regression coverage; production behavior is the real requirement.

## Acceptance criteria

- AC-1: WHEN PCC starts in a normal app run with no saved worker preference THE SYSTEM SHALL select the repo-configured default worker.
- AC-2: WHEN PCC renders the Worker selector THE SYSTEM SHALL show Claude as visible but disabled if Claude is backup-only and unavailable.
- AC-3: WHEN Claude is disabled in the Worker selector THE SYSTEM SHALL NOT let a stale saved preference silently re-select it, and SHALL fall back to Codex.
- AC-4: WHEN the active worker is Codex THE SYSTEM SHALL run the chat turn through Codex CLI and render Codex's reply in the chat.
- AC-4a: WHEN the selected Codex model is `auto` THE SYSTEM SHALL omit `--model` from the Codex CLI launch and let the signed-in account use its default supported model.
- AC-5: WHEN Codex is selected and the owner sends attachments THE SYSTEM SHALL fail plainly and SHALL NOT claim the attachments were sent.
- AC-6: WHEN PCC renders worker-facing copy THE SYSTEM SHALL stop claiming the owner is always talking to Claude; the labels SHALL reflect Codex or use generic wording.
- AC-7: WHEN Claude becomes usable again in a future change THE SYSTEM SHALL be able to re-enable the existing Claude path instead of needing a new implementation.

## Tests

- `app/tests/e2e/buttons.spec.js`
- `app/tests/e2e/chat-worker-provider.spec.js`
