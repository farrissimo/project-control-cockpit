# Remove chat-length meter   (status: draft)

## Objective
Remove the chat-length / chat-health meter and the automatic context-rollover behavior it fed
(ADR-0025), because neither signal available to it is both honest and built. The owner rotates a
chat manually via the existing "Continue in fresh chat" button. Removing a dishonest signal is the
deliverable — no replacement meter ships.

## Behavior
Normal path: the chat page renders with **no** chat-length/chat-health gauge tile, and completing a
turn **never** auto-starts a fresh chat based on context size or age. The manual "Continue in fresh
chat" button behaves exactly as before (ADR-0021 build-authority continuity intact). The separate
usage meter (ADR-0012) and cost surfaces (ADR-0014/0015/0017) are untouched.

Edge/error cases: no dead references remain (lint clean); removing the meter must not break the
manual continue button, the usage/cost surfaces, or turn output parsing that other features rely on.
(Exact DELETE / EDIT / KEEP file list is finalized from the surface-map before editing; the manual
continue button and any shared dependency of `turn-output.js` are KEEP.)

## Acceptance criteria
- AC-1: WHEN the chat page renders THE SYSTEM SHALL NOT display the chat-length/chat-health gauge
  tile (asserted absent in E2E — removed from the DOM, not merely hidden).
- AC-2: WHEN a turn completes THE SYSTEM SHALL NOT automatically start or switch to a fresh chat
  based on context tokens, message count, or elapsed time (auto-rollover trigger removed).
- AC-3: WHEN the owner clicks "Continue in fresh chat" THE SYSTEM SHALL still create and seed a fresh
  chat with build-authority continuity preserved (existing behavior, existing test stays green).
- AC-4: WHEN `npm run lint` runs THE SYSTEM SHALL report no undefined-reference errors for removed
  symbols (`PCCChatHealth`, `computeGauge`, `chatContext*`, auto-rollover machinery).
- AC-5: WHEN the unit + E2E suite runs THE SYSTEM SHALL pass with meter-specific tests removed and
  the new "gauge absent" E2E green.
- AC-6: WHEN the app runs THE SYSTEM SHALL leave the usage meter and cost surfaces functioning
  unchanged (no regression in their existing tests).
