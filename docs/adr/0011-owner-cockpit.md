---
status: Proposed
date: 2026-07-20
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
---

# ADR-0011: Owner Cockpit + Live Worker Feed

## Context and Problem

PCC's job is to let a non-coder owner build with an LLM worker without babysitting. PCC already holds
real, deterministic truths — authority state, trust strip, lifecycle, honest detectors/signals,
`doctor.ps1`, the verification record, per-SHA CI, git/repo-sync — but they are **scattered across tabs
and worded for engineers**. When the owner asks "what's going on right now?", the answer is a text wall in
jargon. That directly defeats the #1 goal (reduce babysitting) and is a *trust-surface* gap, not cosmetics.

Two specific problems surfaced repeatedly in the 2026-07-20 design session:
1. **Jargon on the glass.** "Verified 23m / On track / CI green / Operate / Fresh" are meaningless to the
   owner; "64% of chat memory" is instantly clear. A value needs built-in context or it's noise.
2. **No live visibility into the worker.** The owner cannot see what the worker is doing *now* or tell
   whether it is healthy, stuck, or looping — the exact thing needed to dive in and troubleshoot. Today the
   worker is run one-shot and its tool events are discarded (`app/stream-json.js`), so there is no live feed.

## Decision

Build an owner-facing **Cockpit** (chosen mockup `docs/mockups/cockpit-e-synthesis.html`) as PCC's primary
visibility surface, plus a **Live Worker Feed** as its headline feature. Two decisions are recorded here:

1. **Cockpit as trust surface, under a fixed design contract.** A chat-first cockpit: three bands (Project
   journey / Safe-&-on-track vital signs / This-task step-by-step) + a right rail. Every tile follows one
   rule — **plain word + value-with-context + one status color**; jargon lives only in drill-down. Three
   tiers of **progressive disclosure** (glance → click popover → "see more" slide-out). The **honesty
   contract** is binding: proven ≠ inferred (inferred styling distinct, never green); unknown = gray, never
   green; proof bound to exact commit + time; "Done" = proof-matched-stakes (+ owner acceptance), not
   "worker stopped"; conflicting facts show a dominant attention state; no ETA / no fake progress. The
   cockpit is a **pure consumer** of existing state — it introduces **no new canonical authority**.
2. **The live feed is a guided Plan-vs-Actual control surface — one active step at a time, not a table.**
   PCC does the reconciliation and shows only what matters now: a compact **LIVE bar**, a done/current/next
   **stepper**, and **one active-step card** binding the plan (what this step allows) to the live action
   (what Claude is doing now), with status + simple progress + next. Completed steps collapse to checkmarks;
   the full log is click-to-expand, never the main view. **Normal is tiny; problems are huge.** Binding
   rules: (a) **owner-facing language only** on the glass — no tool_use/stdout/CI/SHA/receipt/diff/parse/
   event; those live in the drawer; big labels plain, filenames as small detail. (b) **Activity is not
   proof** — edited ≠ correct, ran ≠ passed, "said done" ≠ done; a `tool_use` is only *tried*, a
   `tool_result` only *returned*. (c) **Two problem tiers** — a **soft warning** (no progress / repeated
   step / claimed-done-without-checks / checks-not-run / second-AI missing) shows an amber CHECK with
   "Show me why" and lets the worker continue; a **hard stop** (forbidden/authority file, self-verify,
   read-only conflict, command denied, clear scope violation) replaces the normal card with a dominant red
   STOP that isolates the action, shows allowed-vs-happened, and offers "Show me why" + "Pause worker" (real
   — `main.js` already tracks the worker process to terminate it). (d) **No chain-of-thought** — observable
   actions only; safe labels for non-action time. (e) **Honest plan boundary** — the plan derives from real
   approved plan-as-data; where a task declares none, show "no plan to compare against", never a fake "on
   plan".
3. **Worker-invocation change to enable the feed.** Run the worker in **streaming mode** and parse its stdout
   **line-by-line as it arrives**, emitting safe worker-action events to the renderer, instead of parsing
   only the final buffer and discarding tool events. This is the one genuinely new capability; every other
   tile is backed by data PCC already owns. It is **additive and must not regress** `parseStreamJson`'s
   final-text extraction. Auto-refresh (event-driven + the streamed feed) is required.

**V1/V2 boundary (resolves the earlier stuck/loop ambiguity):** V1 already surfaces conservative, honest
risk signals — the soft-warning triggers above (**repeated step, recurring error/denial,
claimed-done-without-checks**) plus a **quiet / no-visible-progress banner** (process-alive + long-running
allowance) that **never asserts "stuck" on silence alone** — and a **real hard-stop / Pause**. V2 adds a
richer *formal* stuck/loop classifier, the Thinking/Verification lane, and the tab restructure.

**Correction (Codex V2, 2026-07-20):** the 2026-07-20 runaway was **not** a plan-pattern loop — it was
**token-burn / context growth**, which none of these plan-heuristics watch. That signal, and the *automatic
protection* it must trigger, is **R1/R3** in the desktop-parity track (`docs/proposals/desktop-parity.md`) —
not a deferred cockpit nicety. This ADR is the **enabling substrate** for it: R1's usage meter rides on this
ADR's streaming parser (the `rate_limit_event` capture already landed on `app/stream-parser.js`). The cockpit
is **observability + intervention**; it is **not** the automatic-protection layer, which exists independently
under R3.

**Build feed-first, in slices:** (1) a pure **plan-step model** (approved plan + live events → current/done/
next step, allowed actions, actual action, status on-plan/soft/hard/waiting/unknown, progress, owner
message); (2) the **incremental stream parser** (safe action events, final reply preserved, no hidden
reasoning); (3) the **compact chat UI** (LIVE bar + stepper + one active-step card, no wall of text);
(4) the **problem states** (amber CHECK, red STOP, "Show me why" drawer, "Pause worker" where possible);
(5) an **optional expanded log** (full history on click, not the main view). The cockpit shell then consumes
the feed as one vital sign.

## Consequences

- **Gain:** the owner gets honest, glanceable, plain-language visibility and, for the first time, a live
  view of the worker (healthy / looks-stuck) to troubleshoot with — the largest babysitting reduction on
  the table. Consolidating status also removes duplicated pills across surfaces.
- **Cost:** a new streaming/incremental parse path on the worker spawn (more moving parts than one-shot),
  a live renderer subscription + feed rendering, and one new evidence surface to keep honest. The
  Plan-vs-Actual comparison also **depends on the approved plan existing as machine-readable data** (allowed/
  forbidden areas, required checks, completion criteria); where a task declares none, the feed shows "no plan
  to compare against" rather than inventing one — an honest boundary, not a silent gap.
- **Honest residue:** the cockpit is UI over main-owned truth — if the renderer is wrong the *display* could
  mislead, but authority/verification/CI remain enforced by their stores, never by the cockpit. The live
  feed reflects the worker's self-reported actions (what it says it did), surfaced live; it is visibility,
  not proof, and is labelled as such. Until the streaming path ships, the feed is honestly shown as "not yet
  wired" rather than faked. **The feed and cockpit are observability + intervention, not automatic
  protection** (Codex V2): they do not by themselves prevent usage runaway and do not replace automatic
  rollover or hard-stop policy, which must exist independently under desktop-parity R3.

## Confirmation

Tests pass before merge (functional proof on the owner's screen still PENDING — see PROJECT.md; per `docs/specs/owner-cockpit.md`, every AC test-backed):
- **Unit** (`app/tests/unit`, pure + injectable clock): the cockpit view-model never emits a jargon label
  and never greens an unknown/inferred value; proof tiles carry exact commit+time; "Done" stays non-green
  until the completion contract holds; conflicting facts yield an attention state. The pure **Plan-vs-Actual
  classifier** labels events on-plan / not-in-plan / forbidden / missing / claimed-but-not-proven / waiting /
  quiet / repeated / needs-owner, treats activity as never-proof, and honors the **no-plan boundary** ("no
  plan to compare", never "on plan"). The **quiet detector** (injectable clock + process-alive + long-running
  allowance) raises a quiet banner without ever asserting "stuck" on silence alone, and clears on activity.
- **E2E** (`app/tests/e2e`, real app, faked streaming worker across flushes): tile/row → detail → slide-out;
  Owner Attention calm vs. prompting; live refresh; reduced-motion; incremental feed entries before the reply;
  the out-of-plan red STOP state renders on a forbidden-file event; no thinking content shown; empty feed
  leaves chat unchanged; the collapsed-feed preference persists.
- **Incremental parser, strengthened** (against real captured output): partial JSON split across stdout
  flushes; malformed lines; stderr during the stream; tool/permission denial; worker crash mid-event;
  final-result fallback when assistant text is absent; no tool events; and the **final reply byte-identical**
  to current `parseStreamJson`.
- Full-suite CI green on the exact commit before merge; independent Codex verification of the diff.

## Engagement

- **Owner:** the audience — sets intent, reads the cockpit, and uses the live feed to dive in; his sign-off
  on the plain-language + honesty being right is the acceptance bar.
- **Claude worker:** implements the cockpit view-model, the streaming/incremental parse, the feed, and all
  tests, in verified slices (feed-first recommended for earliest value).
- **Codex verifier:** diff-reviews each slice (static + lint + doctor; it cannot launch Electron, so E2E
  behaviour is worker + CI).
- **Security-model note:** the streaming change touches the worker-invocation path but **not** the
  authority model — the read-only/build tool profile (`authority-tool-profile.js`) and DECISION-112 bounds
  are unchanged; the feed only observes. Flagged for owner awareness; the ADR-0009 GPT secondary check
  applies if the owner wants it.
- **Spawned projects:** the cockpit + feed **UI is inherited automatically** — it lives in the shared home
  app (`app/`), which opens every project, so it is **not** copied per-project. The scaffolder seeds only the
  **per-project state/config/schemas** the feed depends on (DECISION-113 parity). (Codex V2 correction; the
  same clarification applies wherever shared-app UI is loosely described as "scaffolded", e.g. ADR-0010.)

## Supersedes / Related

New surface; supersedes nothing. Related: `docs/specs/owner-cockpit.md`, `docs/specs/action-timeline.md`
(the streaming feed), `docs/proposals/owner-cockpit.md`, DECISION-102 (chat-centered app), DECISION-107
(Owner/Visionary Overview — the deterministic meaning layer this extends), DECISION-112 (execution
authority, unchanged), DECISION-113 (parity to spawned projects).
