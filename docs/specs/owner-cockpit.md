# Owner Cockpit + Live Worker Feed   (status: draft)

Governed by ADR-0011. Companion spec for the streaming feed: `docs/specs/action-timeline.md`.
Design + rationale + mockups: `docs/proposals/owner-cockpit.md`, `docs/mockups/` (chosen:
`cockpit-e-synthesis.html` + `feed-6-guided.html`). Revised 2026-07-20 per two Codex critiques
(Plan-vs-Actual; then the guided one-active-step model — calm normal, loud problems).

## Objective
Give a non-coder owner full, honest visibility into what the LLM worker is doing — and whether it is doing
**what it was approved to do** — as a calm, guided view, not a spreadsheet. The owner should answer "what
step are we on, what's it doing now, is that allowed, what's next, is there a problem?" in ~5 seconds. **PCC
does the reconciliation** (plan vs. actual) and shows only what matters right now. The cockpit is part of
PCC's trust surface; it never shows a green it can't deterministically back.

## Behavior

**Cockpit (Mockup E):** chat-first, three bands (Project journey / Safe & on track / This task step by step)
+ right rail. Every tile: **plain word + value-with-context + one status color**; jargon only in drill-down;
three tiers (glance → click → slide-out).

**Live Worker Feed = a guided, one-step-at-a-time control surface** (air-traffic control, not a table).
Normal work is compact and calm:
- a **LIVE bar** (e.g. "LIVE · Working normally · on plan so far · last action just now"),
- a short **stepper** (done ✓ / current ● / next ○),
- and **one active-step card** that connects the plan to the live action: *Supposed to happen* (what this
  step allows), *What Claude is doing now*, *Status*, *simple Progress* (e.g. "2 of 3 agreed files changed"),
  and *Next*.

Completed steps collapse to checkmarks; future steps stay minimized; the full action log is **optional
click-to-expand, never the main view**. The owner never scans two columns or inactive rows — PCC advances
the card when a step is satisfied.

**Plain, honest state language.** On the glass: *Allowed · On plan · Started · Passed · Not yet · Needed
before done · Outside the plan · Claimed, not proven · Looks quiet · Needs you.* "On plan" means only that
**the current action is allowed by the plan** — never "done" or "proven." Big labels are plain ("Changing
the screen-wiring file"); the filename is a small detail ("app-routes.js"). Banned on the glass: tool_use,
stdout, stream-json, IPC, target, CI, SHA, receipt, diff, parse, event — those live only in the drawer.

**Activity is not proof.** "Changed a file" ≠ correct; "ran checks" ≠ passed; "said done" ≠ done. Wording:
"Tried to change this file", "Command started/finished", "Check passed/failed", "Claimed done — not verified".

**Normal is tiny; problems are huge.** A problem changes the whole panel's state — the owner never scans rows
to find danger:
- **Soft warning → amber CHECK card** ("Something needs proof", e.g. claimed-done-without-checks, no visible
  progress, repeated step, required checks not run, second-AI review still missing). The worker may keep
  going; one obvious **[Show me why]** button. No auto-stop unless policy says so.
- **Hard stop → red STOP card that replaces the normal card** (forbidden/authority file touched, worker
  self-verifies, read-only conflict, command denied, clear scope violation, "do not edit X" then edits X).
  It isolates the offending action, shows *allowed vs. what happened*, explains *why it matters*, recommends
  pause+verify, and offers **[Show me why]** and **[Pause worker]** — pausing is real (PCC already tracks the
  worker process; `main.js`), offered where technically possible.

**Quiet ≠ stuck.** Keep the LIVE bar, but silence alone is weak evidence (a long build/test can be quiet and
healthy). V1 says only "Looks quiet / No visible progress / Quiet longer than usual", weighing process-alive
and known long-running commands; it escalates to stronger language only with stronger evidence (same step
repeats with no progress, worker error, command denied, process died, claimed-done-without-proof).
First-class stuck/loop detection as a formal signal is **V2**.

**No chain-of-thought.** Observable actions only; never display or summarize the worker's hidden reasoning.
Non-action time shows a safe label ("Preparing next step", "Waiting on worker").

**No-plan boundary.** Where a task declares no approved plan/scope, the feed shows **"No plan to compare
against"** — PCC can show what Claude is doing but cannot say whether it's allowed — never a fake "on plan".

**Everything auto-refreshes;** a crashed read shows *unknown*, never a fake all-clear.

## Acceptance criteria
- AC-1: WHEN any tile / step / feed element renders THE SYSTEM SHALL use a plain-language big label with no
  raw jargon token (tool_use, stdout, stream-json, IPC, CI, SHA, receipt, diff, parse, event) on the glass.
- AC-2: WHERE a fact cannot be read or is unknown THE SYSTEM SHALL render it gray "unknown", never green.
- AC-3: WHEN an inferred value is shown THE SYSTEM SHALL render it distinct (dashed) AND SHALL NOT let it set
  any element to a proven/green state.
- AC-4: WHEN the owner clicks an element THE SYSTEM SHALL open a detail with a plain summary, the technical
  detail, and an explicit "not proven" statement.
- AC-5: WHEN the owner opens "see more" / "show me why" THE SYSTEM SHALL open a drawer with the full
  plain-language breakdown.
- AC-6: WHILE no owner decision is pending THE SYSTEM SHALL keep Owner Attention compact/calm; IF a decision
  is required THE SYSTEM SHALL surface it prominently with the decision, why, and what is paused.
- AC-7: WHEN a proof element shows a passed state THE SYSTEM SHALL bind its detail to the exact saved commit
  and time it covers.
- AC-8: WHERE the completion contract (proof matched to stakes, plus owner acceptance where required) is not
  satisfied THE SYSTEM SHALL NOT show "Done" as green/complete.
- AC-9: WHEN underlying state changes (authority, verification, backup, task, lifecycle, worker events) THE
  SYSTEM SHALL refresh the affected elements without an owner action.
- AC-10: WHERE the OS reduced-motion preference is set THE SYSTEM SHALL disable animation and use instant
  state changes while preserving every state's icon + word.
- AC-11: WHEN two facts conflict (worker active while read-only; "verified" while the code changed since) THE
  SYSTEM SHALL show a dominant attention/conflict state, not a green.
- AC-12: WHILE a worker turn is in flight AND the worker emits an action THE SYSTEM SHALL bind it to the
  current active step ("what Claude is doing now") before the final reply is shown.
- AC-13: WHEN a step is satisfied THE SYSTEM SHALL collapse it to a checkmark, advance to the next step, and
  keep future steps minimized (normal mode stays compact; the full log is click-to-expand only).
- AC-14: WHEN there has been no visible worker action for longer than the configured threshold AND the worker
  process is still alive THE SYSTEM SHALL show a careful "looks quiet / no visible progress" state (never
  "stuck" on silence alone), and clear it when activity resumes.
- AC-15: WHEN the worker emits no parseable actions THE SYSTEM SHALL show an empty/neutral state and leave
  the chat behaving exactly as today.
- AC-16: WHEN a turn completes THE SYSTEM SHALL render the same final reply text today's parser produces
  (the `stream-json` real-capture test stays green — byte-identical, no regression).
- AC-17: WHEN an approved plan exists THE SYSTEM SHALL derive the stepper + active-step card from it (allowed
  areas, required checks, required verification, completion criteria) and show the current step's status.
- AC-18: WHEN a live action is a HARD-STOP condition (forbidden/authority file, self-verify, read-only
  conflict, command denied, clear scope violation) THE SYSTEM SHALL replace the normal card with a dominant
  red STOP card that isolates the action, shows allowed-vs-happened, explains why, and offers "Show me why"
  and (where possible) "Pause worker".
- AC-19: WHEN a SOFT-WARNING condition holds (no visible progress, repeated step, claimed-done-without-checks,
  required checks not run, second-AI review missing) THE SYSTEM SHALL show an amber CHECK state with a "Show
  me why" affordance and SHALL NOT auto-stop the worker unless policy requires it.
- AC-20: WHEN the worker performs an activity or makes a claim THE SYSTEM SHALL present it as activity/claim,
  never as proof; a "done" claim lacking backing proof SHALL read "Claimed done — not verified".
- AC-21: THE SYSTEM SHALL NOT display the worker's internal reasoning/thinking; non-action time SHALL show
  only a safe label.
- AC-22: WHERE no approved plan/scope is declared THE SYSTEM SHALL show "No plan to compare against" and SHALL
  NOT mark anything "on plan".
- AC-23: WHEN normal (no warning/stop) THE SYSTEM SHALL keep the panel compact — LIVE bar + current step +
  what Claude is doing + on-plan + simple progress + next — and SHALL make a problem state dominate the panel
  (normal tiny, problem huge).
- AC-24: WHEN the current step is an earlier step (e.g. "Read the approved files") AND the worker performs an
  action belonging to a later step (e.g. edits an allowed edit-file before the read step is satisfied) THE
  SYSTEM SHALL NOT report "on plan"; it SHALL report a soft sequencing warning ("Doing a later step early").

## Test
**Unit** (`app/tests/unit`, pure + injectable clock): the **plan-step model** — given an approved plan +
live events, computes current/done/next step, current allowed actions, the actual action, per-step progress,
and a status of allowed / on-plan / soft-warning / hard-stop / waiting / unknown, with the owner-facing
message; enforces activity-never-proof (AC-20), the no-plan boundary (AC-22), hard-stop classification
(AC-18) and soft-warning classification (AC-19). The **quiet detector** (clock + process-alive + long-running
allowance) raises "looks quiet" without ever asserting "stuck" (AC-14). Cockpit view-model: AC-1/2/3/7/8/11.

**Incremental parser, strengthened** (against real captured output): partial JSON split across flushes;
malformed lines; stderr mid-stream; tool/permission denial; worker crash mid-event; final-result fallback
when assistant text is absent; no tool events; **final reply byte-identical** to current `parseStreamJson`;
actions emitted before the final reply (AC-12/15/16).

**E2E** (`app/tests/e2e`, real app, faked streaming worker across flushes): compact normal card + stepper;
a step satisfying → collapse + advance (AC-13); amber CHECK on a soft condition (AC-19); dominant red STOP
replacing the card on a forbidden-file event with "Show me why" + "Pause worker" (AC-18/23); drawer opens
(AC-4/5); reduced-motion (AC-10); no thinking shown (AC-21); collapsed/expanded log preference persists.

**Every AC above needs a passing test before "done."**
