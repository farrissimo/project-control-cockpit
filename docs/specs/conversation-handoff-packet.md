# Conversation handoff packet   (status: draft)

## Objective
Kill the daily copy-paste ferrying between Claude and another agent (Codex/GPT). The
owner selects a chunk of the current conversation, clicks one button, and gets a
self-contained, formatted packet on the clipboard — source boundaries and the standard
PROOF line already filled in — ready to paste into another chat without hand-editing.

This is DISTINCT from the existing "Generate handoff" button (`app/renderer/index.html:581`),
which builds a *fresh-chat briefing from repo truth*. That answers "orient a brand-new chat";
this answers "hand THIS conversation slice to another agent." They complement, not replace.

## Behavior
The chat log (`#log`) holds message bubbles. The owner makes an ordinary text selection
across one or more bubbles and clicks a "Handoff packet" action. PCC gathers the selected
bubbles (by role), and copies to the clipboard a Markdown packet with:
- a **header** boundary — chat name + chat id, repo SHA at send time, and timestamp — so the
  receiving agent knows exactly what state the slice came from;
- the selected messages, each labelled by role (You / Claude / Codex);
- a **PROOF footer** — the project's standard "run this exact command and paste the output,
  then STOP" block — so a rushed handoff never forgets it.

Edge/error cases: an empty selection produces no packet and shows a one-line hint instead of
copying nothing. Fenced code inside selected messages is preserved verbatim (not re-wrapped).
The packet is copied; nothing is sent anywhere and no worker is invoked.

## Acceptance criteria
- AC-1: WHEN the owner has selected one or more chat messages and clicks "Handoff packet"
  THE SYSTEM SHALL copy to the clipboard a packet containing each selected message labelled by
  its role, in order.
- AC-2: WHEN a packet is generated THE SYSTEM SHALL include a header boundary carrying the chat
  id, the repo SHA at generation time, and a timestamp.
- AC-3: WHEN a packet is generated THE SYSTEM SHALL append the project's standard PROOF footer
  block verbatim.
- AC-4: WHEN the owner clicks "Handoff packet" with no text selected THE SYSTEM SHALL NOT copy
  an empty packet and SHALL show a visible hint to select first.
- AC-5: WHEN selected messages contain fenced code THE SYSTEM SHALL preserve that code verbatim
  in the packet.

## Test
`app/tests/e2e/*.spec.js` — launch the real Electron app (existing harness, faked worker),
seed a chat with known user/assistant messages, programmatically select a range in `#log`,
click the action, and read the clipboard (Playwright `clipboard` permission) to assert: role
labels present and ordered (AC-1), header carries chat id + a SHA-shaped token + timestamp
(AC-2), PROOF footer present verbatim (AC-3). A separate case clicks with no selection and
asserts the clipboard is unchanged and the hint is shown (AC-4). A case with a fenced block
asserts it survives byte-for-byte (AC-5).
