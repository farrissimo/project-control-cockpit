# Continue in fresh chat   (status: active)

## Objective
Give the owner a one-click escape from a heavy chat without surprise automation,
hidden context injection, or manual re-briefing work.

## Behavior
When Chat Health reaches a warning/notice state, PCC shows an owner-controlled
`Continue in fresh chat` action. Clicking it creates and switches to a new chat
named `Continued chat`, keeps the old chat intact, and pre-fills the composer
with an existing in-memory summary when one is already available. If no summary
is available, PCC still creates the fresh chat and says so plainly. Nothing is
sent to the worker until the owner presses Send.

## Acceptance Criteria
- AC-1: WHEN Chat Health is in notice THE SYSTEM SHALL show a `Continue in fresh chat` action.
- AC-2: WHEN the owner clicks `Continue in fresh chat` THE SYSTEM SHALL create and activate a new chat named `Continued chat`.
- AC-3: WHEN the owner clicks `Continue in fresh chat` THE SYSTEM SHALL keep the source chat intact and reachable in the chat list.
- AC-4: IF the source chat already has a summary in memory THE SYSTEM SHALL pre-fill the new chat composer with visible continuation text based on that summary.
- AC-5: IF no summary is available THE SYSTEM SHALL still create the fresh chat and disclose that no summary was available.
- AC-6: WHEN the owner clicks `Continue in fresh chat` THE SYSTEM SHALL NOT send hidden context to the worker or rely on automatic rollover.
