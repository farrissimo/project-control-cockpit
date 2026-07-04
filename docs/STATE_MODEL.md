# State Model

## Purpose

Project Control Cockpit depends on machine state. The system must know what project is active, what task is active, what the current truth is, what evidence exists, and what action should happen next.

The state model exists to prevent project truth from living only inside chat history.

---

## Core Rule

The latest model response is not project truth.

Project truth lives in canonical state files and is updated only after verification or explicit owner override.

---

## State Files

V1 uses two required state files:

```text id="k7t0hn"
.cockpit/state/project-state.json
.cockpit/state/task-state.json
```

Optional supporting files may be added later, but these two are the V1 backbone.

One optional supporting file, `.cockpit/state/handoff-gate.json`, is written by `scripts/enforce-handoff-restart-safety.ps1`. It records whether the live handoff artifacts were last confirmed restart-safe and ready for fresh-session use (`gate_result`: `PASS`/`FAIL`, plus `reason`, `checked_at`, and `task_id`). It is a derived enforcement record, not a new source of truth — it never disagrees with `task-state.json` or the handoff artifacts without being re-run.

`.cockpit/backups/` is a non-canonical, git-ignored restore-point location written by `scripts/backup-protected-files.ps1`. Each run creates a timestamped folder containing copies of a small, explicit protected file set (the two state files, the live handoff artifacts, the latest evidence/verification pair, and `scripts/*.ps1`) plus a `manifest.json` describing what was captured. It exists purely as cheap, git-independent recovery insurance before risky cycles; it is passive and non-gating — nothing reads it to decide whether a task may proceed, and its absence never blocks anything. Restoring from it is an explicit, deliberate action (`-Action Restore -RestorePoint <name>`), never automatic.

Ideas are not stored in live state until they are promoted into a bounded task.
Idea intake belongs in the controlled backlog process, not in `task-state.json` by default.

---

## Project State

Project state stores durable truth about the overall project.

Required fields:

```json id="4n3hmq"
{
  "project_id": "project-control-cockpit",
  "project_name": "Project Control Cockpit",
  "project_goal": "Build a lean, local-first AI project control cockpit that reduces owner babysitting.",
  "current_phase": "v1-proof",
  "current_task_id": null,
  "active_repo_path": null,
  "active_branch": null,
  "owner_decisions": [],
  "active_constraints": [],
  "worker_context_facts": [],
  "current_blocker": null,
  "last_verified_handoff": null,
  "last_verification_verdict": null,
  "next_expected_action": null,
  "updated_at": null
}
```

---

## Project State Field Definitions

### project_id

Stable project identifier.

### project_name

Human-readable project name.

### project_goal

Short statement of the project’s goal.

### current_phase

Current project phase, such as:

* planning
* v1-proof
* implementation
* verification
* paused

### current_task_id

The active task ID.

### active_repo_path

Local repo path if the project is tied to a repo.

### active_branch

Current Git branch if applicable.

### owner_decisions

List of explicit owner decisions that must be preserved.

### active_constraints

Current rules, boundaries, and non-negotiables.

### worker_context_facts

Stable worker-operating facts that should appear in generated directives but should not live as hardcoded strings inside the generator.

### current_blocker

Current known blocker, or null.

### last_verified_handoff

Path or ID of the last verified handoff packet.

### last_verification_verdict

Most recent verification verdict.

Allowed values:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE
* null

### next_expected_action

The next action the system expects.

### updated_at

Timestamp of last state update.

---

## Task State

Task state stores the current bounded task.

Required fields:

```json id="cjdc6l"
{
  "task_id": null,
  "task_title": null,
  "task_objective": null,
  "task_status": "none",
  "assigned_worker": null,
  "completion_criteria": [],
  "boundaries": {
    "allowed": [],
    "forbidden": []
  },
  "required_evidence": [],
  "attempts": 0,
  "current_directive_path": null,
  "worker_result_path": null,
  "verification_result_path": null,
  "verification_verdict": null,
  "current_blocker": null,
  "next_action": null,
  "updated_at": null
}
```

---

## Task Status Values

Allowed task status values:

* none
* drafted
* ready_for_worker
* in_progress
* returned_for_verification
* verified_fail
* insufficient_evidence
* blocked
* out_of_scope
* complete

---

## Verification Verdict Values

Allowed verification verdict values:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE

---

## State Update Rules

### Worker output does not update state automatically

Worker output is evidence, not truth.

### PASS can advance state

If verification verdict is PASS, the task advances to `complete` and project state may update.

### Non-PASS does not advance state

If verdict is FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE, state must preserve the task and record the next action.

### Owner can override

The owner can explicitly override a verifier verdict. Overrides must be recorded in owner_decisions.

### State advancement is a local deterministic step

`scripts/advance-cockpit-state.ps1` reads `.cockpit/result/verification-result.json` and applies this section's rules to `project-state.json` and `task-state.json` directly, instead of relying on manual reconciliation. A verified `PASS` maps directly to task status `complete`. The helper refuses to act if the verification result's `task_id` does not match the active `task-state.json` task, and it runs `scripts/validate-cockpit-state.ps1` after writing to confirm no drift was introduced.

---

## State Transition Sketch

```text id="u89fd0"
none
→ drafted
→ ready_for_worker
→ in_progress
→ returned_for_verification
→ complete
```

Failure paths:

```text id="zg3lns"
returned_for_verification
→ verified_fail
→ drafted / ready_for_worker
```

```text id="tkh2nx"
returned_for_verification
→ insufficient_evidence
→ ready_for_worker
```

```text id="rp4ev1"
returned_for_verification
→ blocked
```

```text id="hws8qr"
returned_for_verification
→ out_of_scope
```

---

## Truth Source Priority

When sources conflict, use this priority order:

1. Explicit owner decision
2. Current repo/file state
3. Verified project/task state
4. Verified evidence output
5. Current worker directive
6. Handoff packet
7. Unverified worker claim
8. Chat transcript

Unverified worker claims and chat transcript content are not authoritative by default.

---

## V1 Discipline

The state model should stay simple.

Do not add complex workflow machinery until the first proof shows a real need.

Keep ideas separate from active tasks.

Fresh-session restart safety depends on this simplicity: a new advisor or worker session should be able to rehydrate from canonical state and verified artifacts without relying on prior chat memory.
