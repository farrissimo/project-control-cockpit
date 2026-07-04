# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-011
* Task Title: BRR Execution: Wire Self-Gate On PCC's Autonomous Path
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

Wire the seam described by pcc-brr2-010 (Acceptance Boundary Rules): build the deterministic gate that PCC's OWN autonomous path - self-promotion of the next task, and unattended self-continuation/self-acceptance - must pass before proceeding. The gate composes the ALREADY-DEFINED stop machinery (scripts/check-stop-conditions.ps1 must report CLEAR) and the already-defined acceptance boundary (self-acceptance requires Class A; Class B must not self-accept). It is narrow by construction: only PCC's autonomous path invokes it, so owner-directed work is never gated by it. It does NOT redesign the stop model, and it does NOT by itself start unattended operation - the first actual gated autonomous run is the SUPERVISED pilot (next task, pcc-brr2-012). Forks route to the owner via owner_decision_request (which trips the stop-check, which blocks the gate), never rationalized into continuation.

## Allowed Scope

The worker may:

* Add a narrowly scoped local gate script for PCC's autonomous path, composing scripts/check-stop-conditions.ps1 and the task safety class / acceptance boundary.
* Update docs/BRR_POLICY.md (the seam text and a gate description), and cross-reference from docs/HANDOFF_PACKET_SPEC.md and docs/REPO_GOVERNANCE.md as needed.
* Update docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, and README.md only as needed to propagate cleanly.
* Regenerate the live handoff artifacts and run the relevant local validation/health scripts; use disposable scratch copies for the blocked-scenario demonstrations.

## Forbidden Scope

The worker must not:

* Do not wire the gate into any owner-directed flow or make it gate owner-directed work in any way; owner work must remain ungated. Do not modify finalize-worker-handback.ps1, close-out-verified-task.ps1, verify-handback-guardrails.ps1, doctor.ps1, advance-cockpit-state.ps1, or enforce-handoff-restart-safety.ps1 to call this gate.
* Do not redesign the stop model or the acceptance boundary; compose them as-is.
* Do not run the supervised pilot in this task, and do not start unattended operation / auto-run any real task; this task only builds and demonstrates the gate. The pilot is pcc-brr2-012.
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy meaning; do not weaken any existing stop condition.
* Do not rewrite archived history or retrofit old archived tasks.
* Do not require the owner to manually restate BRR policy already recorded canonically.

## Completion Criteria

The task is complete only if:

* A deterministic local script (e.g. scripts/check-autonomous-gate.ps1) evaluates whether PCC may take an autonomous step and reports GATE: PROCEED vs GATE: BLOCKED with reasons. It BLOCKS if scripts/check-stop-conditions.ps1 is not CLEAR, or if the intended action is self-acceptance of a task whose class is not A (Class B must not self-accept per the Acceptance Boundary Rules).
* The gate is narrow: it is invoked ONLY on PCC's autonomous path. It is NOT wired into any owner-directed flow (finalize-worker-handback, close-out, verify-handback-guardrails, doctor, etc. are unchanged), so owner-directed work is structurally never gated by it. This is stated in the script and in docs, and verified by leaving those owner-path scripts untouched.
* Unlike the advisory check-stop-conditions.ps1, this gate is ALLOWED to exit non-zero (a real block) - but because only the autonomous path calls it, that block never reaches owner-directed work.
* The gate composes the existing stop machinery and acceptance boundary; it does not redesign or duplicate the stop model, and it does not weaken any existing stop condition.
* The gate is demonstrated: PROCEED on a clean Class A autonomous-accept scenario; BLOCKED when a stop condition is tripped; and BLOCKED when self-acceptance is attempted on a Class B task - using disposable scratch copies for the blocked scenarios, without touching the live repo.
* docs/BRR_POLICY.md's 'seam left for a later task' text is updated to reflect that the gate is now wired (for the autonomous path only), while stating that wiring the gate does not itself start unattended operation - the supervised pilot does, next.
* Truth-surface propagation is handled honestly across docs/DECISIONS.md, docs/BRR_PLAN.md, docs/BRR_POLICY.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, and README.md, updating only what this actually makes stale.
* Local validation remains healthy on the actual returned-for-verification state (scripts/check-schemas.ps1, scripts/validate-cockpit-state.ps1, scripts/doctor.ps1).

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
