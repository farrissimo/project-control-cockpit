# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-brr2-006
* Task Title: BRR Governance: Secondary Workflow Canon
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

Formalize the degraded secondary-workflow model in repo truth so work can continue cleanly when Codex is unavailable: define exactly when Claude Code may perform both worker and verifier roles, how GPT repo-access review fits as a secondary review input, what that does and does not count as for independence/disclosure purposes, and what artifact wording the repo requires in that mode. Keep it bounded to workflow truth and verification-language clarity rather than broad automation changes.

## Allowed Scope

The worker may:

* Update docs/DECISIONS.md, docs/VERIFICATION_RESULT_SPEC.md, docs/HANDOFF_PACKET_SPEC.md, docs/REPO_GOVERNANCE.md, and closely related workflow-truth surfaces as needed to formalize the degraded secondary workflow.
* Clarify verification-result wording requirements and role-language requirements for fallback-mode cycles.
* Adjust live state, handoff artifacts, and logs only insofar as the active task flow needs to carry the bounded workflow clarification honestly.
* Run the relevant local checks to prove the clarified workflow truth leaves the repo healthy.

## Forbidden Scope

The worker must not:

* Do not redesign doctor.ps1, check-schemas.ps1, validate-cockpit-state.ps1, or the broader PCC state model into generic orchestration unless a direct contradiction is found.
* Do not change the five verification verdicts, task safety classes, or BRR Phase 1 policy content unless a direct contradiction is found.
* Do not broaden into owner-decision capture flow, automatic stop-trigger detection, autonomous next-task drafting, or general worker automation.
* Do not rewrite archived history or retrofit old archived tasks outside what the active task's own honest demonstration requires.
* Do not silently declare GPT repo review to be equivalent to full local independent verification unless the repo truth explicitly says so after this task.

## Completion Criteria

The task is complete only if:

* Repo truth states clearly when the degraded fallback may be used, and distinguishes the normal two-role path from the fallback without ambiguity.
* Repo truth states clearly whether GPT repo-access review counts as secondary review input, independent verifier-of-record, or something narrower, and the answer is propagated consistently across the touched truth surfaces.
* The required verification-result disclosure language for Claude self-verification in fallback mode is made explicit enough that future cycles do not have to improvise the wording.
* The change stays bounded to governance, verification-language, and workflow-truth clarification; no unrelated automation, verdict expansion, or broader orchestration redesign is introduced.
* The resulting task draft and touched truth surfaces leave the repo healthy under the applicable local checks.
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
