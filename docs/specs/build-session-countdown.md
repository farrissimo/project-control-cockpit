# Build-session countdown + activity renewal   (status: draft)

## Objective
A build (command-execution) session is bounded by a timer, but today it expires **silently** —
command access just vanishes mid-work with no warning, which repeatedly stranded the owner
("what is going on / work randomly stopped"). Make the timer **visible** (a live countdown in the
chat-header authority badge), **warn** as it runs low and state plainly when it has expired, and
**renew the idle window on the worker's own activity** so an actively-working long turn doesn't
idle out. The 2-hour absolute hard cap is a deliberate safety bound (DECISION-112) and is
**unchanged** — this refines how the bound is surfaced and how the idle sub-window slides, per
ADR-0010.

## Behavior
The authority state (`authority-store.js` → `main.js` `authoritySnapshot`) now carries both
deadlines (`idleExpiresAt`, `hardExpiresAt`) when a chat is authorized — read-only display data
that can never grant or extend authority. The renderer's authority badge (`loadAuthorityBadge`)
hands an authorized state to `startAuthorityCountdown`, which ticks once a second and shows
`Build session — <time> left` (with the job name). Under 5 minutes it switches to an urgent
(warning) style; at zero it stops and shows `Build session expired — re-enable to continue`
instead of tools disappearing with no signal.

While a worker turn is in flight (`busy`), the countdown heartbeats `touchActivity`, which slides
the idle window forward for an **already-authorized** chat only. `touchActivity` can never grant
authority (a read-only or merely-pending chat is a no-op) and never extends past the hard cap
(checked first). So an actively-working long turn tracks the fixed 2-hour ceiling, never idles out
mid-task, and the ceiling still ends the session on schedule.

Edge/error cases: a read-only chat shows the existing static "Read-only — safe to paste context"
label and no countdown. A malformed/absent deadline falls back to the static label (never a
perpetual or fake countdown). Switching to an unauthorized chat stops the countdown.

## Acceptance criteria
- AC-1: WHEN a chat is authorized THE SYSTEM SHALL expose both `idleExpiresAt` and `hardExpiresAt`
  in its authority state so the UI can render a countdown.
- AC-2: WHEN a chat is read_only or pending THE SYSTEM SHALL expose no deadlines (nothing to count
  down) and keep the static read-only label.
- AC-3: WHEN the authority badge renders an authorized session THE SYSTEM SHALL show a live
  `Build session — <time> left` countdown (with the job name), not the static read-only label.
- AC-4: WHEN the worker is actively working THE SYSTEM SHALL renew the idle window from that
  activity (`touchActivity`) so the session does not idle out mid-turn.
- AC-5: WHERE a chat is read_only or only pending THE SYSTEM SHALL treat `touchActivity` as a no-op
  — it can never grant authority.
- AC-6: WHEN activity is relentless THE SYSTEM SHALL still end the session at the fixed 2-hour hard
  cap — `touchActivity` never extends past it.

## Test
- Unit (`app/tests/unit/authority-store.spec.js`, injectable clock — no app): deadlines exposed
  when authorized / absent when read_only (AC-1, AC-2); `touchActivity` renews idle for an
  authorized chat (AC-4), is a no-op for read_only/pending and never grants (AC-5), and never
  beats the hard cap under relentless activity (AC-6); renewal is chat-scoped.
- E2E (`app/tests/e2e/authority.spec.js`, real app): an approved session's state carries finite
  deadlines with the hard cap beyond the idle window (AC-1); the header badge renders a live
  `Build session — … left` countdown with the job name and not the read-only label (AC-3).
- Contract (`app/tests/e2e/ipc.spec.js`): the `touchActivity` bridge channel is present and
  exact-channel-listed.
