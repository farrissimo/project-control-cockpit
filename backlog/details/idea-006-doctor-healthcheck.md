# IDEA-006 Detail: `doctor` / Health-Check Command (Advisory, Non-Gating)

Placeholder detail for IDEA-006. Non-canonical. Not an active task.

## Problem

PCC already has several deterministic checks — `validate-cockpit-state.ps1`, `verify-worker-restart-safety.ps1`, `verify-dual-restart-safety.ps1`, `enforce-handoff-restart-safety.ps1`. But answering the simple question "is this repo safe to trust and hand off right now?" currently means *remembering which scripts to run and in what order*. That remembering is itself babysitting.

## Idea

One command that runs the existing checks and returns a single, readable health answer: schema/state alignment, artifact freshness, restart-safety, known warning classes. It consolidates what already exists rather than inventing new truth.

## CRITICAL design constraint: advisory, read-only, non-blocking

This idea only clears the owner's filter (reduce babysitting, no bloat, **must not risk blocking task completion**) if it is built as a **report, not a gate**:

* `doctor` **reads** state and **summarizes** health. It must not halt, reject, or gate a work cycle.
* It should exit in a way that surfaces status to a human without being wired as a mandatory precondition that can stall completion over a minor/false finding.
* The existing hard gate (`enforce-handoff-restart-safety.ps1`) stays a separate, deliberately-invoked step. `doctor` is the *at-a-glance* view; it does not replace or duplicate that gate's blocking behavior.

If `doctor` ever becomes a mandatory blocking precondition, it has failed this constraint and should be reconsidered.

## Why it ranks #2

* **Reduces babysitting:** replaces "which of these 4 scripts do I run?" with one answer. High leverage per the CCB list.
* **Low bloat:** it composes existing scripts; little new logic.
* **Non-blocking by design (as constrained above):** a read-only summary cannot stall a cycle.

Ranked below IDEA-005 only because a backup is *structurally* incapable of blocking, whereas `doctor` stays non-blocking by design discipline, which is a slightly weaker guarantee.

## Natural home for adjacent ideas

* **Runtime schema enforcement (IDEA-003)** is best surfaced *here* as an advisory line ("schema: OK / drift found"), rather than as a separate hard-halting step — see IDEA-003's warn-by-default note.
* Known-warning classes from the original scope §7.20 (structural warning signals) could report through `doctor` over time, staying observational, never mind-reading.

## Rough shape (non-binding)

* A local deterministic script that calls the existing validators/checks, collects pass/warn/fail per check, and prints a compact summary plus an overall read.
* Warnings distinguished from hard failures so a warning never reads as "stop."

## Related

* CCB lesson #11 (doctor/health-check as first-class truth verifier); original scope §12.7 (repo health diagnostics).
* [[idea-005-pretask-backup]], [[idea-007-safe-stop]] — Tier-1 companions.
* IDEA-003 (runtime schema enforcement) — fold in as advisory here.
