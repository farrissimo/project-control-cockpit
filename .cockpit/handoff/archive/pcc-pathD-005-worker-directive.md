# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-005
* Task Title: Session/Usage Panel, Honest-Only (No Duplication of Existing Panels)
* Task Status: returned_for_verification
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D2
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-005)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner said to keep going until told to stop, with verification paused before each cycle. Scope narrowed from the plan's literal wording to avoid duplicating pcc-pathD-003's already-delivered panels, per the three-filter test in docs/PROJECT_CHARTER.md -- a worker/verifier-discretion judgment call per DECISION-074's own framing, disclosed in this task's objective and to be recorded in the resulting decision.
## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* Favor modularity and extractability: every PCC capability must stay a clearly bounded unit over the .cockpit file bridge with no hidden shared state or undocumented cross-script assumptions.
* Every PCC capability must use a documented .cockpit file-bridge contract with no hidden shared state or undocumented cross-script assumptions.
* State updates require verifier PASS or explicit owner override.
* Prefer local deterministic tools before model usage.
* Avoid fake intelligence scoring and fake truth detection.
* Worker claims are evidence, not truth.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.
* When explaining repo state, workflow, or decisions, use plain language first and translate any necessary jargon immediately.

## Communication Defaults

The owner's standing communication preferences (apply these without being asked; DECISION-009 / §7.16):

* Tone: direct
* Language level: plain
* Chattiness: concise
* No cheerleading: True
* Concise by default: True
* Explicit uncertainty: True
* Separate facts from inference: True
## Exact Next Action

Deliver docs/PATH_A_PLAN.md section 6 Phase D2's Session/Usage panel: the honest home for original scope section 7.17 (Visible Usage / Session Pressure Awareness). Scoping note, checked against repo truth before drafting: section 7.17's honest remainder (per DECISION-075, which already determined real provider usage cannot be measured or estimated pre-checkpoint and that this is fundamentally a Category D/UI concern) is exactly 'current selected model/tool' and 'whether the system is estimating or reading actual usage' -- and 'current route' plus 'routing history' are already fully delivered as the Local Tools Panel and Routing History panel in pcc-pathD-003. Duplicating those tables under a new panel name would be exactly the bloat docs/PROJECT_CHARTER.md's three-filter test exists to catch. This task therefore adds a small, new, honest-only Session/Usage section to dashboard/index.html that (a) references/points to the existing Local Tools and Routing History panels rather than re-rendering their content, and (b) explicitly states, in plain language, that no real session/usage pressure number is tracked, computed, or estimated by PCC -- because PCC has no mechanism to measure real provider usage (DECISION-008: no fake intelligence / no fabricated numbers) -- rather than silently omitting any usage section at all, which is what original scope section 7.17 actually asks for ('must not pretend to know exact provider limits if it cannot measure them').

## Allowed Scope

The worker may:

* Edit scripts/generate-dashboard.ps1 to add the small, non-duplicative Session/Usage section described above.
* Edit docs/DECISIONS.md to record the new decision, including the explicit non-duplication scoping judgment.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-005 as delivered, not to change its scope or spec.
* Regenerate dashboard/index.html as part of normal testing (it is a gitignored, generated artifact).

## Forbidden Scope

The worker must not:

* Do not re-render, duplicate, or re-fetch the Local Tools Panel's or Routing History panel's content in the new Session/Usage section; reference them instead.
* Do not fabricate, estimate, or display any invented usage/session-pressure number, percentage, or count -- this is exactly what DECISION-008 forbids and what this task exists to avoid.
* Do not modify any other existing script.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not introduce any new subprocess call or new file read beyond what is already loaded by the existing panels.
* Do not modify any schema.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build the Handoff/Rollover panel (pcc-pathD-006) or any Phase D3 functionality in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.
* Do not skip the mandatory pre-task handoff/backup gate; it must be run while task_status is 'ready_for_worker', before any code change.

## Completion Criteria

The task is complete only if:

* scripts/generate-dashboard.ps1 gains a new Session/Usage section in dashboard/index.html, positioned after the existing Routing History panel.
* The Session/Usage section does NOT duplicate/re-render the Local Tools Panel's advisory text or the Routing History table; it is short, and it references those existing panels by name (e.g. 'see Local Tools Panel above for the current route; see Routing History above for history') rather than re-fetching or re-printing their data.
* The Session/Usage section explicitly and plainly states that PCC does not track, compute, or estimate any real session/usage pressure number, weekly pressure, or provider-limit percentage, and why: PCC has no mechanism to measure actual provider usage, and DECISION-008 forbids fabricating one. This satisfies original scope section 7.17's actual requirement ('must not pretend to know exact provider limits if it cannot measure them') honestly, as an explicit disclosure rather than a silent gap.
* The section remains strictly read-only and introduces no new file reads, no new subprocess calls, and no new parameters beyond what pcc-pathD-001..004 already established -- this is a small addition to the existing HTML body using data already available from the earlier panels' own already-loaded state, not a new data source.
* Functionally tested (not read-through only): regenerate dashboard/index.html against the real live state and confirm the new section renders with the correct honest-disclosure text and correctly references the existing panels; confirm no existing panel's content changed.
* A new decision is recorded in docs/DECISIONS.md documenting the delivery and explicitly recording the scoping judgment made here (why this task does not duplicate pcc-pathD-003's panels, and how it still satisfies section 7.17's actual honest-disclosure requirement). docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-005 as delivered, not to change its scope.
* No existing script other than scripts/generate-dashboard.ps1 is modified; no schema is modified; no new log event type is added; no new subprocess call is introduced.
* The mandatory pre-task handoff/backup gate is run correctly before any code change, continuing the standing expectation from pcc-pathD-002 onward.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference remains: pause before each verification), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, including confirmation the pre-task handoff gate ran before work began.
* Command/test results, including confirmation the new section renders correctly and does not duplicate existing panel content.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched, including that no fabricated usage number was introduced and no existing panel content was duplicated.

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

* blocker
* what you tried
* what evidence you have
* recommended next action
