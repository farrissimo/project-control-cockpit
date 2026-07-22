# Continue in fresh chat   (status: active)

## Objective
Give the owner a one-click escape from a heavy chat that ACTUALLY carries the
thread forward — no surprise automation, no hidden context injection, and no
manual re-briefing. A fresh chat that does not carry context is an empty room;
this feature exists to make sure it never is.

## Behavior
PCC shows an owner-controlled `Continue in fresh chat` action beside Chat
Health. It is subdued while chat length is clear and highlighted when Chat
Health reaches a warning/notice state.

When the owner clicks it, PCC builds the carried context FIRST, while the source
chat is still active: it assembles a handoff briefing from repo truth via
`window.pcc.handoff()`. The handoff is REQUIRED. Only after it exists does PCC
create and switch to a new chat named `Continued chat` and drop the carried
context (handoff, plus an in-memory conversation summary if one is already
available) VISIBLY into the new chat's composer as editable text. Nothing is
sent to the worker until the owner presses Send.

If the handoff cannot be built, PCC does NOT open a new chat. It HOLDS in the
source chat and says so plainly, so the owner never lands in an empty
"Continued chat." The source chat is always kept intact and reachable.

## Acceptance Criteria
- AC-1: WHEN Chat Health renders THE SYSTEM SHALL show a `Continue in fresh chat` action.
- AC-2: WHEN the owner clicks `Continue in fresh chat` AND the handoff is built THE SYSTEM SHALL create and activate a new chat named `Continued chat`.
- AC-3: WHEN the owner clicks `Continue in fresh chat` THE SYSTEM SHALL keep the source chat intact and reachable in the chat list.
- AC-4: WHEN a new chat is created by this action THE SYSTEM SHALL pre-fill its composer with the visible carried context (the handoff, plus the in-memory summary when one is available).
- AC-5: IF the handoff cannot be built THE SYSTEM SHALL NOT create a new chat, SHALL remain in the source chat, and SHALL disclose that it is holding rather than opening an empty chat.
- AC-6: WHEN the owner clicks `Continue in fresh chat` THE SYSTEM SHALL NOT send any message to the worker until the owner presses Send, and SHALL NOT rely on automatic rollover or hidden context injection.
