# Governor Surface — live change-stakes card   (status: active)

## Objective
Show the owner, live while working, what **stakes tier** the current change carries —
decided by which files it touches (a git fact via `scripts/classify-stakes.ps1`), not an
LLM's self-rating. This is the "Surface" touchpoint of ADR-0006: it lets the owner SEE the
classifier judge real changes **before** the later "Gate" slice ever gives it teeth. It
**never blocks** anything.

## Behavior
A "Change stakes (governor)" card appears at the top of the Signals tab (refreshed on view
and on the Signals refresh button). It runs the shipped classifier in git mode
(`baseline..HEAD` + uncommitted, baseline `main`) and renders its verdict:
- **A change in flight:** the tier (T0 most critical … T4 noise) + owner-legible tier name,
  the reasons it got that tier, any escalation rules that fired, and the touched files with
  their per-file tiers. Tier color communicates *weight* (how much proof a change deserves),
  never alarm.
- **No change in flight** (clean tree, no diff vs baseline): an honest "nothing to classify"
  state — NOT a fabricated T3.
- **Unreadable / UNKNOWN:** fails closed to UNKNOWN (treat as high-stakes), never a low tier.

The classifier is consumed read-only and verbatim; the app never re-derives or overrides the
tier. Rendering logic is a pure, unit-tested view-model (`app/renderer/stakes-view.js`); the
classifier script (`scripts/classify-stakes.ps1`) is **not** modified by this slice, so this
change itself stays off the T0 `governor_self_edit` path.

## Acceptance criteria
- AC-1: WHEN the current change touches classified files THE SYSTEM SHALL surface the highest
  matching tier (T0–T4) with its reasons and the touched files.
- AC-2: WHEN there is no change in flight (no diff vs baseline, clean tree) THE SYSTEM SHALL
  show a "no change in flight" state, not a tier.
- AC-3: IF the classifier is unreadable or returns UNKNOWN THE SYSTEM SHALL fail closed to
  UNKNOWN and never present a low tier.
- AC-4: WHILE surfacing THE SYSTEM SHALL never block — the `pcc:stakes` channel is read-only
  and always resolves with a verdict (the classifier always exits 0).
- AC-5: WHEN an escalation rule fires THE SYSTEM SHALL surface it (id + forced minimum tier).

## Tests
- `app/tests/unit/stakes-view.spec.js` — AC-1/2/3/5 against the pure view-model with crafted
  classifier output (classified, empty, UNKNOWN, null/malformed fail-closed, escalations).
- `app/tests/e2e/ipc.spec.js` — AC-1/4: `stakes` channel returns a readable verdict shape and
  always resolves; the bridge exposes the channel.
- `app/tests/scripts/classify-stakes.spec.js` (existing) — the classifier always exits 0.
