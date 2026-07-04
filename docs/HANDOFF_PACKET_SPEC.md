# Handoff Packet Spec

## Purpose

A handoff packet transfers project/task context from one role or session to another without relying on messy chat history, memory, or manual owner restatement.

The handoff packet exists to solve:

* new-chat handoff nightmares
* copy/paste chaos
* role confusion
* missing task context
* weak worker directives
* lost project truth

---

## Core Rule

A handoff packet must be specific enough that the receiving role can understand the current task, the current truth, the next required action, and the boundaries without asking the owner to restate the project.

---

## Handoff Packet Location

V1 handoff packets should live at:

```text
.cockpit/handoff/
```

The active worker directive should live at:

```text
.cockpit/handoff/worker-directive.md
```

Optional archived handoffs may use:

```text
.cockpit/handoff/archive/
```

---

## Required Sections

Every handoff packet must include:

1. Receiving Role
2. Project Identity
3. Current Task
4. Current Truth
5. Objective
6. Exact Next Action
7. Allowed Scope
8. Forbidden Scope
9. Completion Criteria
10. Required Evidence
11. Expected Return Format
12. Blocked / Failure Instructions

---

## Handoff Template

```markdown
# Worker Directive

## Receiving Role

Worker

## Project

- Project ID:
- Project Name:
- Repo Path:
- Active Branch:

## Current Task

- Task ID:
- Task Title:
- Task Status:
- Task Safety Class:

## Owner Decision Needed (only present when one is pending)

- Question:
- Reason:
- Options:
- Blocked until:

## Auto-Promotion Basis (only present when PCC self-promoted the task)

- Approved lane:
- Priority / plan reference:
- Justification (continuation, not a fork):

## Objective

State the exact task objective in plain language.

## Current Truth

List only verified truth that the worker should rely on.

## Exact Next Action

Tell the worker exactly what to do next.

## Allowed Scope

The worker may:
- 

## Forbidden Scope

The worker must not:
- 

## Completion Criteria

The task is complete only if:
- 

## Required Evidence

Return the following evidence:
- files changed
- summary of changes
- commands/tests run
- command/test results
- known risks
- unresolved assumptions
- confirmation that forbidden scope was not touched

## Expected Return Format

Return your result in this structure:

### Summary

### Files Changed

### Commands / Tests Run

### Results

### Evidence

### Known Risks

### Unresolved Assumptions

### Out-of-Scope Confirmation

Confirm whether anything outside the allowed scope was touched.

## Blocked / Failure Instructions

If blocked, do not improvise broad changes. Return:
- blocker
- what you tried
- what evidence you have
- recommended next action
```

---

## Directive Generation Is a Local Deterministic Step

`scripts/generate-worker-directive.ps1` drafts `.cockpit/handoff/worker-directive.md` directly from `.cockpit/state/project-state.json` and `.cockpit/state/task-state.json`, following this template. Worker-facing standing truth should come from canonical state rather than hidden script-only facts. The generator refuses to draft a directive if the two state files disagree on the active task, or if the task's objective, allowed scope, forbidden scope, completion criteria, or BRR task safety class (`docs/BRR_POLICY.md`, `docs/STATE_MODEL.md`'s `task_safety_class`) are missing or not one of `A`/`B`/`C`/`D`. When `task-state.json`'s `owner_decision_request` (`docs/STATE_MODEL.md`, `DECISION-037`) is populated, the generator renders an "Owner Decision Needed" section with the question, reason, options, and what stays blocked; the section is omitted entirely when no owner decision is pending. Likewise, when `promotion_basis` (`DECISION-039`) is populated on a self-promoted task, the generator renders an "Auto-Promotion Basis" section (approved lane, priority/plan reference, in-lane justification); it is omitted for owner-drafted tasks.

---

## Handoff Quality Rules

A handoff is valid only if it includes:

* one clear task
* explicit scope
* explicit forbidden scope
* explicit completion criteria
* explicit required evidence
* no vague “improve this” language without boundaries
* no hidden reliance on prior chat history
* no permission to rewrite unrelated project areas

---

## Bad Handoff Example

```markdown
Fix the app and make it work better. Check everything and improve whatever seems wrong.
```

Why this is invalid:

* no bounded task
* no completion criteria
* no evidence requirement
* no forbidden scope
* invites drift
* impossible to verify cleanly

---

## Good Handoff Example

```markdown
Task: Fix the verification result writer so it records PASS, FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE in .cockpit/result/verification-result.json.

Allowed scope:
- app/verify.*
- schemas/verification-result.schema.json
- tests related directly to verification result writing

Forbidden scope:
- do not change routing behavior
- do not modify project-state schema
- do not redesign CLI commands

Completion criteria:
- verification result file is written to the expected path
- verdict value is one of the allowed enum values
- invalid verdict values are rejected
- test or command output proves the behavior

Required evidence:
- files changed
- command/test run
- result output
- known risks
```

---

## Role-Specific Notes

### Advisor / Verifier Handoff

When handing to an advisor/verifier, include:

* current state
* worker result
* evidence path
* completion contract
* verification question
* required verdict

Before issuing that verdict, the advisor/verifier independently re-runs the
relevant local guardrails against the state actually being reviewed, rather
than relying only on the worker's report about those checks. `scripts/verify-handback-guardrails.ps1`
gives this one deterministic, read-only path: it runs `scripts/validate-cockpit-state.ps1`,
`scripts/check-schemas.ps1`, and `scripts/doctor.ps1` against the live
handback state (`DECISION-031`), and additionally runs
`scripts/enforce-handoff-restart-safety.ps1` only when `task_status` is
`ready_for_worker` — printing an explicit `[SKIP]` with its reasoning
otherwise, since that gate is not applicable once a worker has already
returned a task for verification. It never writes to state and never issues
a verdict; a non-zero exit means the repo-health guardrails found a real
problem and the verifier should not issue `PASS` yet, not that the verdict
itself has been decided. This duplication is justified because it checks a
different role boundary and sometimes a later repo state than the worker
last saw; it is not process theater for its own sake (`DECISION-032`).

The normal advisor/verifier is Codex (`DECISION-023`). If Codex is unavailable and the owner wants work to continue, `DECISION-033` allows a degraded fallback where Claude Code also performs the verifier role. In that case, the verification artifact must say plainly that it was self-verified with no independent second-party review, and the verifier pass must still independently re-run the relevant local guardrails and evidence review rather than merely endorsing the worker narrative.

During such a fallback, ChatGPT may act as a **secondary review input** (`DECISION-036`), with remote repo access only — no local file or script execution. Its review is additive context, not a replacement for the local guardrail re-run above, and repo truth must not describe it as independent verification or as equivalent to Codex's normal role. The standard self-verification disclosure wording (`docs/VERIFICATION_RESULT_SPEC.md`) states explicitly whether GPT review was performed for a given cycle. For ChatGPT's remote access to see completed work at all, `DECISION-036` also pre-authorizes committing *and* pushing every verified `PASS` for the remainder of the current BRR phase specifically — a time-boxed exception to `DECISION-020`'s normal per-time push approval, not a permanent change to it.

### Worker Handoff

When handing to a worker, include:

* task objective
* allowed scope
* forbidden scope
* exact action
* required evidence

### Fresh-Chat Handoff

When starting a fresh chat, include:

* project goal
* current phase
* current task
* verified truth
* unresolved issues
* next expected action
* files/paths to read first

`scripts/generate-advisor-restart-brief.ps1` drafts this handoff for a fresh advisor/verifier session directly from `.cockpit/state/project-state.json`, `.cockpit/state/task-state.json`, and `.cockpit/result/verification-result.json`, writing to `.cockpit/handoff/advisor-restart-brief.md`. It surfaces the active task's BRR task safety class alongside its status, and the same "Owner Decision Needed" section as the worker directive when `owner_decision_request` is populated (`DECISION-037`). It refuses to draft a brief if project/task state disagree on the active task, if project state and the live verification result disagree on the last verdict, or if the task safety class is missing or not one of `A`/`B`/`C`/`D`.

---

## Worker Handback Is a Local Deterministic Step

`scripts/finalize-worker-handback.ps1` gives the worker one command for the final worker-to-verifier handback, instead of relying on memory for the correct order of state update, artifact regeneration, and health checks. This exists because that exact ordering, done by hand, produced a real defect during `pcc-brr2-001`: the worker regenerated `.cockpit/handoff/advisor-restart-brief.md` before moving `task-state.json` to `returned_for_verification`, so the artifact handed back for review was stale at the moment it mattered (`DECISION-030`).

Calling `scripts/finalize-worker-handback.ps1` performs, in this fixed order, and stops at the first failure rather than continuing past it:

1. Sets `task-state.json`'s `task_status` to `returned_for_verification`, clears `current_blocker` on both state files, and sets `next_action`/`next_expected_action` (optionally overridden via `-NextAction`) — refusing to run at all if the task is not currently `ready_for_worker` or `in_progress`, so it cannot be called twice by accident against an already-returned task.
2. Runs `scripts/validate-cockpit-state.ps1` immediately against that just-written state.
3. Regenerates `.cockpit/handoff/worker-directive.md` and `.cockpit/handoff/advisor-restart-brief.md` from the state written in step 1, via the shared `scripts/refresh-live-handoff-artifacts.ps1` helper — this is what guarantees the artifacts describe the actual returned state rather than whatever state existed when they were last generated.
4. Runs `scripts/check-schemas.ps1` and `scripts/doctor.ps1` last, against the exact state now being handed back, and fails if `check-schemas.ps1` reports a violation or `doctor.ps1`'s report contains any `[ISSUE]` line.

`scripts/enforce-handoff-restart-safety.ps1` is deliberately not part of this sequence: it gates the opposite direction (a fresh `ready_for_worker` task being handed to a new worker session) and would fail by design the moment `task_status` moves to `returned_for_verification`. It remains the correct gate for its own purpose; it is simply not applicable to this handback path.

This script does not change `doctor.ps1`'s own behavior — `doctor.ps1` still always exits `0` and never gates anything for any other caller (`DECISION-020`). `finalize-worker-handback.ps1` only refuses to certify *its own* handback as clean if `doctor.ps1`'s report contains an `[ISSUE]`; it does this by inspecting the report's text after calling `doctor.ps1` normally, not by modifying `doctor.ps1` itself.

`scripts/refresh-live-handoff-artifacts.ps1` is the one shared helper behind step 3 above: it exists specifically so "regenerate both live artifacts after a status change" has a single call site instead of being hand-rolled inside every script that changes `task_status`. This exact defect — regenerating only one of the two artifacts — was found and fixed twice in this same BRR sub-thread (`pcc-brr2-001` on the worker handback side, `pcc-brr2-004` again on the verifier close-out side) before being centralized here (`DECISION-035`). It is also called internally by `scripts/advance-cockpit-state.ps1` itself, so *any* path that ends up advancing state — not only the two wrapper scripts documented on this page — refreshes both artifacts automatically.

`scripts/verify-dual-restart-safety.ps1` proves both restart paths at once: it checks the live advisor restart brief is complete and matches what `generate-advisor-restart-brief.ps1` would produce right now (ignoring only the brief's own generation timestamp), then runs `scripts/verify-worker-restart-safety.ps1` for the worker side. It passes only if a fresh advisor session and a fresh worker session could both resume from canonical repo truth today.

`scripts/enforce-handoff-restart-safety.ps1` is the enforcement gate: it must be run, and must pass, before the live handoff artifacts (`.cockpit/handoff/worker-directive.md` and `.cockpit/handoff/advisor-restart-brief.md`) are treated as ready to hand to a fresh session. It fails immediately if `.cockpit/state/task-state.json`'s `task_status` is anything other than `ready_for_worker` — this catches the case where a handoff packet is content-valid but describes a task that is already `complete` or otherwise not actually ready to hand off, which the content-only dual-restart proof cannot catch on its own. It then delegates to `scripts/verify-dual-restart-safety.ps1` for the content checks. Either way, it records its verdict to `.cockpit/state/handoff-gate.json` (`gate_result`: `PASS` or `FAIL`, with `reason`, `checked_at`, and the `task_id` it checked), so the gate's outcome is itself canonical repo truth rather than a claim that only existed in a terminal.

`scripts/doctor.ps1` is the advisory counterpart to the gate: a read-only report that composes `validate-cockpit-state.ps1`, `verify-dual-restart-safety.ps1`, `scripts/check-schemas.ps1`, the last recorded `.cockpit/state/handoff-gate.json` verdict, and the active task's status into one "is this repo safe to trust right now?" summary. Each finding is labeled `OK`, `WARN`, or `ISSUE`; the script always exits `0` and never halts or blocks anything — it exists so the owner/advisor does not have to remember which of the individual checks to run and in what order. It is deliberately not wired as a precondition for any other step; `scripts/enforce-handoff-restart-safety.ps1` remains the only script allowed to gate a handoff.

`scripts/check-schemas.ps1` validates `project-state.json`, `task-state.json`, and `verification-result.json` against `schemas/*.schema.json` using PowerShell's `Test-Json` cmdlet (which requires `pwsh`; it does not exist in Windows PowerShell 5.1, so `check-schemas.ps1` must run under `pwsh`, same as PCC's other composed checks). It catches structural drift — invalid enum values, disallowed extra fields (`additionalProperties: false`), missing required fields — that `validate-cockpit-state.ps1`'s cross-file consistency checks do not, since that script checks agreement between files, not each file's shape against its schema. Like the other composed checks, it is informational only: `doctor.ps1` reports its result as one `OK`/`ISSUE` finding and always exits `0` regardless.

`scripts/safe-stop.ps1` is the session-end counterpart to `doctor.ps1`: where `doctor` answers "is this repo safe to trust right now," `safe-stop` answers "am I safe to end this session and let a fresh one pick it up cold?" It runs `validate-cockpit-state.ps1` and `verify-dual-restart-safety.ps1`, confirms `task-state.json`'s `next_action` and `project-state.json`'s `next_expected_action` are present (without rewriting either), and prints what a fresh session should read first plus a plain "Safe to stop: YES / NOT CLEANLY" line. Like `doctor.ps1`, it always exits `0`, never advances `task_status`, never writes a verification verdict (DECISION-006 reserves that for the verifier), and never gates anything — it exists to kill "where were we?" overhead at session end, not to enforce it.

`scripts/check-stop-conditions.ps1` is the advisory Automatic Stop Triggers detector (BRR Phase 2 item 4, `DECISION-040`, `docs/BRR_POLICY.md`'s "Automatic Stop Triggers"). It reads live task state and reports `CLEAR TO PROCEED` vs. `STOP` with reasons, detecting the *deterministically-checkable* stop conditions: an unresolved `owner_decision_request`, a `doctor.ps1` `[ISSUE]`, an attention-needed task status, or a self-promoted task whose `promotion_basis.lane` does not reference a recognized approved-lane source. Like `doctor.ps1`, it is advisory and non-gating — it always exits `0` and hard-blocks nothing; a reported STOP is a recommendation to stop instead of guess, not an automatic halt. It deliberately does not fake-detect the judgment-based stop conditions (fork, north-star alignment, whether a new owner decision is needed), which remain judgment surfaced via `owner_decision_request` (`DECISION-008`). `scripts/enforce-handoff-restart-safety.ps1` remains the only script permitted to gate a handoff.

`scripts/check-autonomous-gate.ps1` is the fail-closed self-gate on PCC's *own* autonomous path (`DECISION-042`, `docs/BRR_POLICY.md`). Given `-Action self_promote|self_accept`, it reports `GATE: PROCEED` (exit 0) only when `scripts/check-stop-conditions.ps1` is CLEAR and — for self-acceptance — the task's class permits it (Class A only); otherwise `GATE: BLOCKED` (non-zero). Unlike the other checks it is allowed to block, because **only PCC's autonomous path invokes it** — no owner-directed script calls it, so owner-directed work is never gated. `scripts/enforce-handoff-restart-safety.ps1` remains the only gate on the *owner* handoff path; this is the only gate on PCC's *autonomous* path. Wiring it does not start unattended operation (that is the supervised pilot, `pcc-brr2-012`).

`scripts/log-event.ps1` appends one structured, factual line to `.cockpit/logs/routing-log.jsonl` per meaningful cycle event, instead of relying on hand-typed free-form JSON (which drifted and had to be manually backfilled during the `pcc-v1-013` cycle itself). It validates `event_type` against a small explicit set (`next_task_drafted`, `verified_pass`, `verified_fail`, `verified_insufficient`, `verified_blocked`, `verified_out_of_scope`, `correction_applied`) rather than accepting arbitrary text there, and with `-FromVerificationResult` it derives `task_id`, `event_type`, and `detail` directly from `.cockpit/result/verification-result.json` so a verifier does not have to hand-write JSON for the common case. It is strictly append-only — it only ever calls `Add-Content`, which cannot read or rewrite prior lines — and it never gates or blocks anything; it is a recording tool, not an enforcement tool. Log lines written before this script existed keep their original `route`/`reason`/`result` shape; this is a prospective format improvement, not a rewrite of history (consistent with the plain-language naming convention above: identifiers and past records are not retroactively changed).

### Recommended Close-Out Order

Before the `PASS` / `FAIL` / `INSUFFICIENT` / `BLOCKED` / `OUT_OF_SCOPE`
verdict is written at all, the verifier should independently run the relevant
local guardrails against the handed-back state they are about to judge
(`DECISION-031`) rather than relying only on the worker's claim that those
checks were clean.

Once a `PASS` verdict is written to `.cockpit/result/verification-result.json`, `scripts/close-out-verified-task.ps1` performs the close-out in one deterministic run, in this fixed order (`DECISION-034`):

1. **Archive first** — copies the live `worker-directive.md`, `worker-result.md`, and `verification-result.json` to their `archive/` counterparts (`<task_id>-worker-directive.md`, etc.) *before* advancing state, refusing to run at all if any of those archive paths already exist (never overwrites archived history) or if the live verdict is not `PASS` for the active task.
2. **Advance state**, automatically passing the archive path from step 1 to `scripts/advance-cockpit-state.ps1 -ArchivedDirectivePath ...`. This is what lets `last_verified_handoff` point at the immutable archived copy instead of the live path the next task's directive will overwrite (see `docs/STATE_MODEL.md`). `advance-cockpit-state.ps1` itself now refreshes both live handoff artifacts immediately after writing state (`scripts/refresh-live-handoff-artifacts.ps1`, `DECISION-035`), so this script does not duplicate that call — one shared invariant, one call site.
3. **Run `doctor.ps1`** as the post-close-out health check, failing the whole close-out if it reports any `[ISSUE]`.
4. **Log the event** with `scripts/log-event.ps1 -FromVerificationResult`.

After these four steps, the repo is in a clean, commit-ready state. Committing is the one remaining step this script performs only when explicitly requested via `-Commit` (`git add -A` then `git commit`, using the verification summary as the message) — `DECISION-020` already authorizes the verifier to commit the cycle's own verified changes, but not to have that decided automatically on every close-out run. **Pushing to any remote is never performed by this script itself** — that stays a deliberate, separate `git push` run by the verifier after `-Commit`, not something this script automates. Whether that push may happen without asking the owner each time is governed by `DECISION-020` (default: separate explicit approval every time) or, during the `DECISION-036` fallback window specifically, by that decision's time-boxed pre-authorization.

Archiving before advancing (rather than after, as earlier cycles did) is what makes step 2's archive-path argument available in the first place.

When the verdict is `FAIL` / `INSUFFICIENT` / `BLOCKED` / `OUT_OF_SCOPE` instead, `scripts/return-inadequate-work.ps1` (`pcc-brr3-005`, `docs/BRR_POLICY.md`'s "Inadequate-Work Return Path") performs the equivalent close-out in the same four-step order: archive, advance state via `scripts/advance-cockpit-state.ps1`, run `doctor.ps1`, log the event via `scripts/log-event.ps1 -FromVerificationResult` — with the same refusal properties (refuses on a `PASS` verdict, a `task_id` mismatch, or an existing archive path) and the same optional `-Commit` that never pushes. This exists so a non-`PASS` cycle gets exactly the same one-command, fully-recorded close-out a `PASS` cycle already had, rather than requiring the verifier to remember the individual steps by hand.

---

## V1 Discipline

Handoff packets should stay practical.

Do not add ceremony unless it directly improves task completion, verification, or owner babysitting reduction.
