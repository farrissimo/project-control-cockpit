# Composer usable while another chat is busy   (status: active)

## Objective
A worker turn runs one chat at a time, but the owner has many chats. Today a single global
`busy` flag locks the composer's controls in **every** chat while any one chat is running — so
after switching to a different chat, Send, New chat, and the correction chips go **silently
dead** (no error, typed text kept, no self-recovery). This is the fake-green failure this app
exists to kill: a control that looks alive but does nothing. This fixes it so a chat you switch
to stays usable, and any control that genuinely cannot run mid-turn says so instead of dying
silently. This restores the already-decided steering intent (ADR-0013: "the composer never
locks mid-turn"; ADR-0020 T7: sends queue in order).

## Behavior
The app already commits + queues a send made while a turn is in flight and drains the queue in
order, each item routed to its own chat. The defect is purely in the UI guards:
- The Send button is disabled on global `busy` (renderer.js:104).
- New chat (830) and the correction chips (1205) early-`return` on `busy`, silently.
- Controls that start a **separate** worker/verifier call — Second opinion (1227), Capture
  decisions (1288) — genuinely cannot run a second turn concurrently with the single worker;
  they also early-`return` on `busy` silently.

Normal path: while chat A runs, switching to chat B leaves B fully usable — Send queues behind
A's turn, New chat and chips work. Edge/honesty case: a control that would start a second
concurrent worker/verifier turn is refused with a visible one-line reason, never a silent no-op.

## Acceptance criteria
- AC-1: WHILE another chat's turn is in flight THE SYSTEM SHALL keep the Send button enabled in
  the viewed chat (disabled only during recovery), and a Send SHALL commit + queue the message.
- AC-2: WHILE another chat's turn is in flight THE SYSTEM SHALL let "New chat" create and switch
  to a new chat.
- AC-3: WHILE another chat's turn is in flight THE SYSTEM SHALL let a correction chip commit +
  queue its message in the viewed chat (no silent no-op).
- AC-4: WHEN a turn completes and a message was queued from another chat THE SYSTEM SHALL run
  that queued message against its own chat and leave that chat's composer usable afterward
  (self-recovers — never a stuck-disabled Send).
- AC-5: WHILE a turn is in flight AND the owner triggers a control that cannot run mid-turn
  (Second opinion, Capture decisions, Continue in fresh chat, Resume build — each starts a
  separate worker/verifier turn or changes authority) THE SYSTEM SHALL refuse with a visible
  one-line reason (an honest message), never a silent no-op.
