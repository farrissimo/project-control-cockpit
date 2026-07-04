# IDEA-007 Detail: `safe-stop` / Clean-Rollover Command

Placeholder detail for IDEA-007. Non-canonical. Not an active task.

## Problem

Most sessions end because a human gets tired, interrupted, or runs out of context — not because work reached a clean boundary. Without a deliberate stopping step, the next session pays "where were we?" overhead: re-reading, re-deriving next action, re-confirming what was verified. That overhead is babysitting.

This is also a **named-but-unbuilt V1 component**: the original scope §7.14 (manual compact/restart/fork/rollover), V1_Scope.md §9 (Manual Rollover / Reset), and DECISION-010 (fresh-thread rollover as a core safety mechanism) all call for it. PCC has the *ingredients* (canonical state, `next_action`, restart-safety proofs) but no single "end here, cleanly" action.

## Idea

One command that ends a session in a guaranteed-resumable state: confirm/refresh `next_action`, confirm evidence and gate status, and leave canonical truth accurate so a fresh advisor or worker session can cold-start from repo truth alone.

## Why it ranks #3

* **Reduces babysitting:** turns session end from chaos into routine; directly kills "where were we?" cost.
* **Low bloat:** it orchestrates existing state/restart-safety pieces rather than adding new truth surfaces.
* **Does not block completion:** it runs *after* work, as a wrap-up. It is not a gate on the cycle itself.

Ranked below IDEA-006 because the "is it safe now?" question (doctor) is needed more often than the "end cleanly" action (safe-stop), and doctor is a dependency-free read.

## Rough shape (non-binding)

* A local deterministic script that: verifies state consistency (reuse `validate-cockpit-state.ps1`), confirms the live handoff artifacts are restart-safe (reuse the dual-restart / gate checks in advisory form), ensures `next_action` is present and current, and prints a short "safe to stop; resume by reading X, next action is Y" summary.
* Should not *write* new canonical truth beyond refreshing derived/next-action fields already owned by state; must not invent status.

## Boundaries / cautions

* Must not become a mandatory step that blocks finishing a task — it is a convenience for clean handoff, not a gate.
* Must respect state-write discipline (DECISION-006): it does not advance task status; only verification does.

## Related

* CCB lesson #12 (safe stop as a first-class state).
* Original scope §7.14; V1_Scope.md §9; DECISION-010; DECISION-018 (fresh-session restart safety).
* [[idea-005-pretask-backup]], [[idea-006-doctor-healthcheck]] — Tier-1 companions.
