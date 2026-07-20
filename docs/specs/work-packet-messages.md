# Work-packet messages (collapsible sections)   (status: draft)

## Objective
Stop forcing every worker reply into one long wall of text. When a reply is structured as a
work report (understood / inspected / changed / tests / problems / decisions / proof / next),
render each part as a separately collapsible section so the owner expands only what matters and
sees a short summary otherwise. This is the CHEAP version: it parses the worker's own final
text — the worker already emits this structure (it is the reporting shape required by
`AGENTS.md`). It does NOT depend on live tool events (that is the separate action-timeline spec).

## Behavior
Assistant replies are rendered by `renderAssistant()` (`app/renderer/renderer.js:212`), which
already splits fenced code into copy blocks. This feature adds a layer: if the reply text
contains recognised work-packet section headers, split it into sections and render each inside a
collapsible `<details>` element, collapsed by default with the section name as its summary line.
Code-block copy behaviour must still run inside each section (reuse the existing renderer, do not
fork it).

Recognised headers (case-insensitive, tolerant of `#`/`**` markup): *What I understood*,
*What I inspected*, *What I changed*, *Tests run*, *Problems found*, *Decisions needed*, *Proof*,
*Next legal action*. Text before the first recognised header stays visible as a normal lead-in.

Edge/error cases: a reply with NO recognised header renders exactly as today (single bubble, no
regression) — this must be the common-case default, never a downgrade. Partial packets (only some
headers present) render only the sections that exist. The owner's expand/collapse of a section is
a view state and need not persist across turns.

## Acceptance criteria
- AC-1: WHEN an assistant reply contains one or more recognised work-packet headers THE SYSTEM
  SHALL render each recognised part as a separately collapsible section, collapsed by default.
- AC-2: WHEN a collapsed section is shown THE SYSTEM SHALL display that section's name as a
  visible summary so the owner can choose what to expand without expanding it.
- AC-3: WHEN an assistant reply contains NO recognised header THE SYSTEM SHALL render it as a
  single plain bubble, identical to today's behaviour (no regression).
- AC-4: WHEN a recognised section contains fenced code THE SYSTEM SHALL still render that code as
  a working copy block inside the section (existing copy behaviour preserved).
- AC-5: WHEN only some recognised headers are present THE SYSTEM SHALL render only the sections
  that exist and keep any pre-header lead-in text visible.

## Test
`app/tests/e2e/*.spec.js` — launch the real Electron app (faked worker). Feed a reply containing
several recognised headers and assert one collapsible section per header, all collapsed, with
visible summaries (AC-1, AC-2). Feed a plain reply with no headers and assert a single bubble
with no `<details>` (AC-3). Feed a section containing a fenced block and assert a working copy
button inside it (AC-4). Feed a partial packet and assert only present sections render plus the
lead-in text (AC-5).
