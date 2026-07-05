# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-checkpoint-001
* Task Title: Pre-Checkpoint Kernel Quality Audit (bundled with DECISION-074's extractability audit)
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

## Communication Defaults

The owner's standing communication preferences (apply these without being asked; DECISION-009 / §7.16):

* Tone: direct
* Language level: mixed
* Chattiness: concise
* No cheerleading: True
* Concise by default: True
* Explicit uncertainty: True
* Separate facts from inference: True
## Exact Next Action

Perform a one-time, tightly bounded read-only audit of PCC's core kernel scripts (all 23 files under scripts/) against IDEA-014's six PCC-native standards (correctness, verification-friendliness, leanness, modularity/extractability, maintainability, failure clarity) to answer one narrow question: is the kernel solid enough to freeze, preserve, and branch from with confidence, ahead of DECISION-074's Maturity Checkpoint. This task also satisfies DECISION-074's own required extractability audit (confirming every script communicates only through the documented .cockpit/ file-bridge contract, with no hidden shared state or undocumented cross-script assumptions), bundled into the same pass per IDEA-014's own noted overlap rather than run as two separate reviews of the same files. This is read-only and produces a report only -- it changes no script's behavior. Findings must sort into exactly three buckets (real risks / maintainability smells / optional polish), per IDEA-014's guardrail against open-ended rewrite churn; polish items are recorded but not acted on. Task Safety Class B: the findings are judgment calls (code-quality assessment), not mechanically checkable, so this task may execute unattended but must not be self-accepted -- independent verifier review is required before acceptance.

## Allowed Scope

The worker may:

* Create docs/PRECHECKPOINT_KERNEL_AUDIT.md (new file) containing the audit report.
* Edit docs/DECISIONS.md to record the audit's bottom-line decision.
* Edit backlog/IDEAS.md to update IDEA-014's status/notes to reflect delivery.

## Forbidden Scope

The worker must not:

* Do not modify any file under scripts/.
* Do not modify any schema.
* Do not modify .cockpit/state/project-state.json or task-state.json content beyond the normal task-cycle fields the handoff/handback scripts themselves manage.
* Do not act on any finding (no fixes, no refactors, no cleanup) -- this task reports only.
* Do not expand scope into archived artifacts, broad doc rewrites outside docs/PRECHECKPOINT_KERNEL_AUDIT.md, or speculative architecture redesign, per IDEA-014's explicit non-goals.
* Do not manually invoke 'codex exec' for this task's own verification -- let the live PCC-CodexVerifyWatcher scheduled task handle it.

## Completion Criteria

The task is complete only if:

* A new report document (docs/PRECHECKPOINT_KERNEL_AUDIT.md) reviews all 23 scripts under scripts/, organized by the six IDEA-014 standards, and states a plain-language bottom-line verdict in IDEA-014's own required shape: solid enough to freeze with no material concerns / solid enough if N concrete issues are fixed first / not yet checkpoint-ready because of specific named risks.
* The report's findings are sorted into exactly three sections: Real risks (could undermine checkpoint confidence, trust, extractability, or correctness), Maintainability smells (not broken now, future babysitting multipliers), and Optional polish (ignored by default unless it unlocks major value). No finding may be left unsorted or split across sections.
* The report explicitly addresses DECISION-074's extractability rule for every script: confirms (or names exceptions to) the claim that each script communicates only via documented .cockpit/ file-bridge inputs/outputs (or schemas/ and docs/ read access) plus subprocess composition (invoking another script and reading its stdout/exit code), with no shared in-process state, no dot-sourcing, and no hidden cross-script assumptions beyond 'run from the repo root as current working directory' (which must itself be named explicitly as the one implicit, shared assumption every script relies on, since it is not enforced or documented per-script today).
* The audit is read-only: it must not modify any script, schema, or state file, and must not fix any of the findings it identifies -- fixing is explicitly out of scope for this task and belongs to separate future bounded tasks if the owner chooses to act on a finding.
* A new decision is recorded in docs/DECISIONS.md summarizing the audit's bottom-line verdict and citing the report. backlog/IDEAS.md's IDEA-014 entry is updated to note delivery and link the report.
* No verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, Acceptance Boundary Rule, or schema is changed. No new log event type is added. No script under scripts/ is modified by this task.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of the audit's method (which scripts were read, how the six standards were applied).
* The bottom-line verdict and its justification.
* Known risks.
* Unresolved assumptions.
* Confirmation that forbidden scope was not touched (no fixes applied, no scripts modified).

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
