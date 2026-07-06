# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: project-control-cockpit
* Project Name: Project Control Cockpit
* Repo Path: C:\ProjectControlCockpit
* Active Branch: main

## Current Task

* Task ID: pcc-pathD-001
* Task Title: Dashboard Skeleton + Owner Control Board Panel (Read-Only)
* Task Status: insufficient_evidence
* Task Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")

## Owner Decision Needed

* Question: pcc-pathD-001 was verified INSUFFICIENT (ChatGPT manual bridge, DECISION-090): the delivered script is sound, but the mandatory pre-task handoff/backup gate was skipped, so no true pre-task restore point existed. How should this cycle be resolved?
* Reason: This is an owner-facing tradeoff (docs/BRR_POLICY.md Owner Review Matrix), not a worker or verifier call: whether a disclosed, artifact-sound process gap is acceptable to override given git history already preserves the true pre-task state (commit f112fda), or whether the missing safeguard requires a proper redo regardless.
* Options:
* Override-accept: record an explicit owner override, correct DECISION-089's disclosure, and advance pcc-pathD-001 to complete.
* Require redo: keep pcc-pathD-001 at insufficient_evidence and open a corrective follow-up that reruns the handoff gate properly.
* Something else the owner specifies.
* Blocked until: Owner reviews DECISION-090 and .cockpit/result/verification-result.json and decides.
## Auto-Promotion Basis

* Approved lane: Path A / Category D / Phase D1
* Priority / plan reference: docs/PATH_A_PLAN.md section 6 (pcc-pathD-001)
* Justification (continuation, not a fork): Auto-promoted as the explicit next task named in the already owner-approved Path A plan (DECISION-087); this is continuation within an approved lane per DECISION-038/039 Safe Next-Task Drafting Rules, not a new direction fork. The owner separately confirmed readiness to start Path A actual work in this session.
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

Deliver the first Category D (Product Surface) task per docs/PATH_A_PLAN.md section 6, Phase D1: a new, self-contained, read-only script scripts/generate-dashboard.ps1 that reads .cockpit/state/project-state.json and .cockpit/state/task-state.json (paths overridable by parameter) and renders a local static HTML file at dashboard/index.html showing the Owner Control Board panel (original scope section 11): current project, current task, current state, next expected action, current role, current worker, current verdict, and current blocker. This proves the UI's pure-consumer-of-the-file-bridge pattern (DECISION-074/077 extractability rule; DECISION-087 UI form decision) before any other panel is added. The script is read-only over the .cockpit/ bridge: it writes only the new top-level dashboard/ directory, never mutates any .cockpit/ file, and calls no other script (DECISION-088 local-first execution discipline: plain PowerShell + HTML, zero LLM dependency, zero external runtime).

## Allowed Scope

The worker may:

* Create scripts/generate-dashboard.ps1 as a new, self-contained, read-only script over the .cockpit/ file-bridge contract (DECISION-074 extractability rule; DECISION-088 local-first execution), reading only .cockpit/state/project-state.json and .cockpit/state/task-state.json (paths overridable by parameter), writing only to a new top-level dashboard/ directory.
* Create the dashboard/ directory and its generated dashboard/index.html output.
* Edit docs/DECISIONS.md to record the new decision.
* Edit README.md only as needed to note this first Category D deliverable in the doc index or status section.
* Edit .gitignore to exclude the generated dashboard/index.html artifact.
* Edit docs/PATH_A_PLAN.md only to mark pcc-pathD-001 as delivered, not to change its scope or spec.

## Forbidden Scope

The worker must not:

* Do not modify any existing script.
* Do not add any new log event type or write to routing-log.jsonl.
* Do not make the dashboard write to, or otherwise mutate, any .cockpit/ file; it is read-only over the file bridge.
* Do not call any other script from scripts/generate-dashboard.ps1.
* Do not modify any schema.
* Do not change any verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule.
* Do not build Phase D2 or D3 functionality (auto-refresh/watch mode, additional panels, or any write-path/request-file controls) in this task.
* Do not manually invoke 'codex exec' or otherwise self-issue a verification verdict for this task in this cycle.

## Completion Criteria

The task is complete only if:

* scripts/generate-dashboard.ps1 exists, is self-contained, and is strictly read-only: it reads .cockpit/state/project-state.json and .cockpit/state/task-state.json (paths overridable by parameters for testing), writes only dashboard/index.html (a new top-level, non-.cockpit directory), mutates no .cockpit/ file, and invokes no other script.
* The rendered dashboard/index.html shows the Owner Control Board panel: current project (project_name/project_id), current task (task_id/task_title/task_status), current state (current_phase), next expected action, current role (Worker, per the fixed two-role split), current worker (assigned_worker), current verdict (verification_verdict), and current blocker (current_blocker), sourced only from the two state files.
* Regeneration is manual (re-run the script); no auto-refresh/watch mode is built in this task (that is Phase D2, pcc-pathD-004).
* The script exits 0 on well-formed input and prints a clear error with a non-zero exit on missing or malformed state file input, writing/mutating no file in that failure case.
* Functionally tested (not read-through only): run against the real .cockpit/ state (confirms sane, correct-looking output matching actual project/task fields) and against synthetic malformed-JSON and missing-file state in an isolated scratch copy (both fail cleanly, non-zero exit, no dashboard file written or left stale).
* A new decision is recorded in docs/DECISIONS.md documenting the delivery. README.md is updated only as needed to note this first Category D deliverable. .gitignore is updated to exclude the generated dashboard/index.html artifact (it is derived output, regenerated from state, not source). docs/PATH_A_PLAN.md is updated only to mark pcc-pathD-001 as delivered, not to change its scope.
* No existing script, schema, verdict, task status enum, Task Safety Class definition, Owner Review Matrix row, Stop-Instead-of-Guess trigger, or Acceptance Boundary Rule is modified. No new log event type is added; the dashboard generator does not call scripts/log-event.ps1 or any other script.
* The task is handed back through the normal worker path for verification; it is not self-closed in this cycle (owner's stated preference this session is to route verification through the ChatGPT manual bridge per DECISION-086, given remote repo access), and no verification verdict is written by the worker.

## Required Evidence

Return the following evidence:

* Files created or changed.
* Summary of changes.
* Commands run.
* Command/test results, including the functional tests against real and synthetic state.
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
