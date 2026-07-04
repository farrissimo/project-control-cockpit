# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-003
* Task Title: BRR Verification: Deterministic Verifier Guardrails
* Task Status: returned_for_verification
* Task Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")

## Objective

Read this directive from `.cockpit/handoff/worker-directive.md`, complete the bounded task below, and return your result to `.cockpit/result/worker-result.md` using the required evidence format.

## Current Truth

* Project Control Cockpit is a local-first AI project control board.
* Reduce owner babysitting.
* Keep V1 lean.
* State updates require verifier PASS or explicit owner override.
* Prefer local deterministic tools before model usage.
* Avoid fake intelligence scoring and fake truth detection.
* Worker claims are evidence, not truth.
* Claude Code is ready and pointed at this repository workspace.
* PCC owns the worker handoff contract through repo files; the owner should not need to restate the instructions manually.

## Exact Next Action

Operationalize verifier-side independent guardrails in the same concrete way pcc-brr2-002 operationalized worker handback. Build the lightest viable verifier-side helper or equivalent repo-native mechanism that runs the applicable independent local checks against the actual handed-back state before a verdict is issued, so verifier guardrails are a repeatable repo path rather than a memory-based checklist. Keep it bounded to normal verifier-side health checks and close review of applicability, without redesigning verdicts, worker flow, or broader BRR policy.

## Allowed Scope

The worker may:

* Add or update a narrowly scoped local script or equivalent repo-native helper for verifier-side independent guardrails before verdict.
* Update verifier-facing workflow docs or closely related repo-truth surfaces only as needed to make that verifier path explicit and durable.
* Adjust live handoff or state artifacts only insofar as the active task flow needs to demonstrate the new verifier path honestly.
* Run the relevant local checks to prove the verifier-side path works on the active task flow.

## Forbidden Scope

The worker must not:

* Do not redesign doctor.ps1, check-schemas.ps1, or validate-cockpit-state.ps1 into broad gates for unrelated workflows.
* Do not change the five verification verdicts, task safety classes, worker handback script behavior, or BRR Phase 1 policy content unless a direct contradiction is found.
* Do not broaden into owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually arbitrate routine verifier-side guardrail choice when the repo can express the normal path directly.

## Completion Criteria

The task is complete only if:

* The repo gains one concrete verifier-facing mechanism for independent guardrail review before a verdict is issued, making the usual verifier-side checks explicit and repeatable rather than memory-based.
* That mechanism is local-first and bounded: it does not redesign the verification verdict model, re-run worker handback logic, or broaden BRR scope beyond operationalizing verifier-side guardrails.
* The mechanism handles applicability honestly rather than blindly running every check in every state; status-specific checks such as scripts/enforce-handoff-restart-safety.ps1 are included only when they fit the state being reviewed, and skipped with explicit reasoning when they do not.
* The verifier-facing docs and any touched workflow truth surfaces tell Codex exactly what to run and when, including repo-health and repo-sync duties already recorded in decisions.
* The resulting verifier path is demonstrated against the active task flow and leaves the repo healthy under the applicable local checks.
* No new autonomy, owner-decision capture flow, acceptance-boundary policy, or unrelated workflow redesign is introduced.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run, if any.
* Command/test results, if any.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched.

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
