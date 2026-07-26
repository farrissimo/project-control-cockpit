# Incident: 2026-07-25 Land Evaluator trust-window early block (TRIAL-LE-01)

**Written:** Saturday, July 25, 2026  
**Scope:** PCC-as-cockpit behavior during the owner's first hours of the 7-day trust trial while working in the Land Evaluator project.  
**Method:** read-only reconstruction from PCC repo truth plus live inspection of the Land Evaluator repo/runtime artifacts at `C:\LandEvaluator\Land-Evaluator`. No claims below rely on memory alone.

## Summary

Within roughly the first 2 hours of the trust window, the owner encountered an **unexpected hard stop**
while the visible dashboard signals still looked healthy. The visible state showed chat length around
23% and Claude 5-hour usage around 10%, yet the worker emitted:

> "Stopped automatically — this message hit its per-message turn limit (it reached 31 agentic turns) before finishing."

This was **not** a chat-length problem and **not** a 5-hour usage-limit problem. It was a separate
per-message `--max-turns` guard firing from inherited PCC protection. In Land Evaluator, the local
owner-tunable `usage-limits.json` file was missing, so the project fell back to PCC's safe default
`max_turns = 30`.

## Verdict

**For Land Evaluator as a product:** not a fatal blocker.  
**For the 7-day trust trial:** this is blocker-shaped and should be treated as a real trial incident
unless explicitly waived after diagnosis.

Reason: the owner was blocked by cockpit behavior that did not match the visible dashboard story,
very early in the trust window, while trying to use PCC exactly as intended.

## What Went Right

- **Real product progress existed.** Land Evaluator did not fake movement; the repo contains real
  work from July 24, 2026 across specs, research, parcel lookup, hazard grading, evaluation logic,
  and app scaffolding.
- **The stop message itself was honest about the immediate trigger.** The owner-facing text plainly
  said the stop came from a "per-message turn limit" and preserved the reported count ("31 agentic
  turns"), rather than surfacing raw CLI internals.
- **The guard did stop a long-running turn before unlimited fan-out.** The underlying protection
  mechanism itself is real and functioning; the problem is alignment and tuning, not total absence
  of protection.
- **Evidence was recoverable after the fact.** The stop text, chat transcripts, app code, tests, and
  runtime artifacts were sufficient to reconstruct what happened without hand-waving.

## What Went Wrong

### 1. Visible signals and blocking behavior were out of alignment

The owner saw healthy visible signals:

- chat length roughly 23%
- 5-hour Claude usage roughly 10%

Yet the turn still hard-stopped. This created an immediate "why did it stop?" trust break.

### 2. A hidden guard mattered more than the dashboard the owner was looking at

The hard stop came from the native Claude Code `--max-turns` cap wired by PCC, not from the visible
usage or chat-growth surfaces. That made the dashboard incomplete as an explanation of actual stop
conditions.

### 3. Land Evaluator appears to have inherited protection behavior without the matching local knob

`C:\LandEvaluator\Land-Evaluator\.cockpit\state\usage-limits.json` was missing at inspection time.
That means the project used fallback behavior from code instead of an explicit project-local policy.

### 4. PCC handoff/scaffolding polluted the new project with false repo-truth references

Early Land Evaluator carried-context chat text referenced PCC files and decisions that do not exist
in that repo, including:

- `docs/COCKPIT_ROADMAP.md`
- `docs/DECISIONS.md -> DECISION-102`

This did not directly cause the turn-cap stop, but it materially damaged trust in what counts as
"repo truth" inside a new project.

### 5. The owner experienced blocking caused by cockpit behavior, not by normal product difficulty

This is important for trial scoring. The early interruption was not "software is hard"; it was the
cockpit surprising the owner about when and why it would stop.

## What Failed

### Trial promise that failed

The trust window is supposed to prove that the owner can keep moving without being surprised,
babysitting hidden rules, or reverse-engineering why the cockpit stopped.

That promise was not met here.

### Specific behavioral failure

PCC failed to make the owner's effective stop conditions legible enough. The owner had to infer from
repo/code analysis that the real blocking condition was a hidden per-message turn cap unrelated to
the two primary visible meters on screen.

### Bootstrap/scaffolding failure

The new-project bootstrap did not leave the Land Evaluator repo with a clearly present, local,
owner-visible tuning file for the same protections the app was actively enforcing.

## What Eventually Blocked

The immediate blocker was the native Claude Code per-message turn cap:

- PCC passes `--max-turns` from `readUsageLimits(...)` in
  [C:\ProjectControlCockpit\app\main.js](C:\ProjectControlCockpit\app\main.js:933)
- Land Evaluator does the same in
  `C:\LandEvaluator\Land-Evaluator\app\main.js`
- the limit resolves through `readUsageLimits(...)`
- when the config file is missing or malformed, the code fails closed to `DEFAULT_MAX_TURNS = 30`

The owner-facing stop message is emitted in:

- [C:\ProjectControlCockpit\app\main.js](C:\ProjectControlCockpit\app\main.js:987)
- `C:\LandEvaluator\Land-Evaluator\app\main.js`

The fallback behavior is defined in:

- [C:\ProjectControlCockpit\app\usage-limits.js](C:\ProjectControlCockpit\app\usage-limits.js:46)
- `C:\LandEvaluator\Land-Evaluator\app\usage-limits.js`

The default values present in PCC at inspection time were:

- `max_turn_usd = 3`
- `max_turns = 30`
- `max_chat_usd = 15`

from [C:\ProjectControlCockpit\.cockpit\state\usage-limits.json](C:\ProjectControlCockpit\.cockpit\state\usage-limits.json:1)

## Evidence

### Owner-visible evidence

- Screenshot supplied by the owner on July 25, 2026 showing:
  - `CLAUDE USAGE` roughly 10%
  - `CHAT LENGTH` roughly 23%
  - the stop banner stating the message reached 31 agentic turns

### Land Evaluator artifacts

- `C:\LandEvaluator\Land-Evaluator\.cockpit\chats\ed620ce6-9a6b-44a5-9615-59d5a7d13a3f\transcript.jsonl`
- `C:\LandEvaluator\Land-Evaluator\.cockpit\chats\62dd3910-f375-44e2-b322-ad735b9c4c46\transcript.jsonl`
- `C:\LandEvaluator\Land-Evaluator\.cockpit\chats\26bfd7d3-edb4-43fb-869f-4d144a61a133\transcript.jsonl`
- `C:\LandEvaluator\Land-Evaluator\.cockpit\chats\2c918c4a-275c-40dd-be80-6e275145abd5\transcript.jsonl`

These show repeated early-session stops, contradictory tool/build-state narration, and carried
context referring to missing PCC-only roadmap/decision files.

### Config/path evidence

- `C:\LandEvaluator\Land-Evaluator\.cockpit\state\usage-limits.json` was absent at inspection time.
- [C:\ProjectControlCockpit\.cockpit\state\usage-limits.json](C:\ProjectControlCockpit\.cockpit\state\usage-limits.json:1) exists and shows the fallback defaults PCC expects.

### Code evidence

- [app/usage-limits.js](/C:/ProjectControlCockpit/app/usage-limits.js:46): `DEFAULT_MAX_TURNS = 30`
- [app/usage-limits.js](/C:/ProjectControlCockpit/app/usage-limits.js:68): missing/broken config falls back to safe defaults
- [app/main.js](/C:/ProjectControlCockpit/app/main.js:933): PCC passes `--max-turns`
- [app/main.js](/C:/ProjectControlCockpit/app/main.js:987): owner-facing "Stopped automatically" message for `max_turns`

## Root-Cause Hypothesis

The most likely failure chain is:

1. PCC protection for per-message agentic fan-out was inherited into Land Evaluator.
2. The corresponding Land Evaluator local policy file (`.cockpit/state/usage-limits.json`) was not
   present or not scaffolded.
3. The app therefore fell back to PCC's generic safe default of `max_turns = 30`.
4. The visible dashboard emphasized chat-length and 5-hour-usage signals, which were healthy.
5. The actual stop came from a third, less visible control.
6. The owner experienced an early, surprising hard stop during the trust trial.

## Trial Scoring

Recommended honest scoring:

- **Land Evaluator project viability:** yellow, still very much alive
- **PCC process reliability for this trial moment:** red
- **Trust-window ruling for this incident:** `trial blocker unless explicitly waived after diagnosis`

This is not because the end product is impossible. It is because the trial is explicitly about
whether the owner can trust the cockpit to behave predictably with low babysitting.

## Investigation / Recovery Plan

### Phase 1 — Confirm the exact failure chain

1. Verify whether Land Evaluator ever had a local `.cockpit/state/usage-limits.json` and, if so,
   whether it was omitted by bootstrap, deleted later, or never scaffolded.
2. Confirm whether the stop was solely `max_turns`, or whether any concurrent chat/session/budget
   state also influenced behavior.
3. Confirm whether the current UI makes the active turn-cap policy visible anywhere before a stop.

### Phase 2 — Fix the trust mismatch

1. Make the active turn-cap value visible in the owner-facing surface, or surface a clear warning
   before a long-running turn is hard-stopped.
2. Ensure new projects scaffold the same owner-tunable policy file that the cockpit actively reads.
3. Reassess whether `30` is a sound default for long-running build/research turns in a trust window.

### Phase 3 — Re-test the trust-window claim

1. Run a real long-turn workflow in a fresh project/session with visible signals on screen.
2. Confirm that either:
   - the turn completes normally, or
   - the owner can see in advance which specific guard is about to intervene and why.
3. Only then treat this class of issue as cleared for trust-trial purposes.

## Non-Negotiable Lessons

- A stop condition that matters to the owner cannot remain effectively hidden behind code-level
  defaults while the dashboard emphasizes different signals.
- New-project bootstrap must not leave active safety policy half-explicit.
- During a trust trial, "works as coded" is not enough. The owner has to be able to predict the
  cockpit's behavior from the visible surface without repo archaeology.
