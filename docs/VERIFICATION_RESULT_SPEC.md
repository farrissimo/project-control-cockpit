# Verification Result Spec

## Purpose

A verification result records whether returned worker output satisfies the task’s completion contract.

It exists to prevent fake completion, unclear task status, and state updates based on weak evidence.

---

## Core Rule

The verifier must issue a clear verdict before project/task state can advance.

No task should be marked complete without a verification result.

---

## Verification Result Location

V1 verification results should live at:

```text id="ntwu9t"
.cockpit/result/verification-result.json
```

Archived verification results may later live at:

```text id="lbewzb"
.cockpit/result/archive/
```

---

## Required Verdicts

The verifier must choose exactly one:

* PASS
* FAIL
* INSUFFICIENT
* BLOCKED
* OUT_OF_SCOPE

---

## Verdict Definitions

### PASS

The worker result satisfies the completion criteria and includes adequate evidence.

### FAIL

The worker result does not satisfy the completion criteria.

### INSUFFICIENT

The worker result might be correct, but evidence is missing, unclear, incomplete, or not checkable.

### BLOCKED

The task cannot proceed because of a blocker, missing input, access issue, dependency, or required owner decision.

### OUT_OF_SCOPE

The worker touched, changed, attempted, or recommended work outside the allowed scope.

---

## Required JSON Shape

```json id="3izz59"
{
  "task_id": null,
  "verdict": null,
  "verified_at": null,
  "completion_criteria_checked": [],
  "evidence_reviewed": [],
  "missing_evidence": [],
  "out_of_scope_findings": [],
  "risks": [],
  "summary": null,
  "next_action": null,
  "state_update_allowed": false
}
```

---

## Field Definitions

### task_id

The task being verified.

### verdict

One of:

```text id="8yqgv4"
PASS
FAIL
INSUFFICIENT
BLOCKED
OUT_OF_SCOPE
```

### verified_at

Timestamp of verification.

### completion_criteria_checked

List of completion criteria reviewed.

### evidence_reviewed

List of evidence items reviewed.

Examples:

* worker result file
* command output
* test output
* changed files
* git diff
* screenshots/artifacts
* logs

### missing_evidence

List of evidence that should have been supplied but was missing.

### out_of_scope_findings

Any evidence that the worker touched or attempted something outside allowed scope.

### risks

Known risks, caveats, or unresolved concerns.

### summary

Plain-English summary of the verification result.

### next_action

The exact next action after the verdict.

For a **PASS** verdict specifically: `next_action` must describe the durable state a reader will find *after* the cycle fully closes out (e.g. "Task complete; owner/advisor selects the next backlog item"), not the verifier's own remaining close-out checklist (advance state, run health checks, archive, commit). A checklist description goes stale the moment those steps are actually performed - it would describe already-completed work as still pending. `scripts/advance-cockpit-state.ps1` defaults to this kind of durable statement automatically for PASS and does not require the verifier to get the wording right by hand; pass `-FinalNextAction` to that script only if a PASS cycle genuinely needs a non-default next step recorded (e.g. a caveat for the next task to consider).

For **FAIL / INSUFFICIENT / BLOCKED / OUT_OF_SCOPE**, `next_action` should describe the corrective action that genuinely still needs to happen - this is not affected by the staleness problem above, since state does not advance and those actions remain outstanding until someone does them.

Examples:

* mark task complete (PASS - durable, not a checklist)
* request missing evidence
* retry with tighter directive
* decompose task
* ask owner for decision
* inspect out-of-scope changes

### state_update_allowed

Boolean.

Allowed values:

* true only when verdict is PASS
* false for FAIL, INSUFFICIENT, BLOCKED, or OUT_OF_SCOPE unless owner override is recorded separately

---

## PASS Example

```json id="ic281r"
{
  "task_id": "pc-v1-001",
  "verdict": "PASS",
  "verified_at": "2026-07-03T00:00:00-06:00",
  "completion_criteria_checked": [
    "worker directive file exists",
    "required sections are present",
    "forbidden scope section is present"
  ],
  "evidence_reviewed": [
    ".cockpit/handoff/worker-directive.md",
    "worker-result.md"
  ],
  "missing_evidence": [],
  "out_of_scope_findings": [],
  "risks": [],
  "summary": "The worker directive was created with the required sections and no out-of-scope changes were reported.",
  "next_action": "Mark task complete and prepare the next bounded task.",
  "state_update_allowed": true
}
```

---

## INSUFFICIENT Example

```json id="1rkmmi"
{
  "task_id": "pc-v1-001",
  "verdict": "INSUFFICIENT",
  "verified_at": "2026-07-03T00:00:00-06:00",
  "completion_criteria_checked": [
    "test command should have been run",
    "changed files should have been listed"
  ],
  "evidence_reviewed": [
    "worker-result.md"
  ],
  "missing_evidence": [
    "test command output",
    "changed files list"
  ],
  "out_of_scope_findings": [],
  "risks": [
    "Worker claimed completion but did not provide enough evidence to verify."
  ],
  "summary": "The result may be correct, but required evidence is missing.",
  "next_action": "Request missing evidence before updating task state.",
  "state_update_allowed": false
}
```

---

## OUT_OF_SCOPE Example

```json id="s29195"
{
  "task_id": "pc-v1-002",
  "verdict": "OUT_OF_SCOPE",
  "verified_at": "2026-07-03T00:00:00-06:00",
  "completion_criteria_checked": [
    "allowed scope respected",
    "forbidden scope avoided"
  ],
  "evidence_reviewed": [
    "git diff",
    "worker-result.md"
  ],
  "missing_evidence": [],
  "out_of_scope_findings": [
    "Worker modified routing logic even though directive only allowed documentation changes."
  ],
  "risks": [
    "Unreviewed behavioral change may affect task routing."
  ],
  "summary": "The worker touched files outside the allowed scope.",
  "next_action": "Stop and review out-of-scope changes before continuing.",
  "state_update_allowed": false
}
```

---

## Verification Quality Rules

A valid verification result must:

* name the task being verified
* include exactly one verdict
* list evidence reviewed
* list missing evidence if any
* list out-of-scope findings if any
* define the next action
* explicitly state whether state update is allowed

When the same agent performed both the worker and verifier roles under the degraded fallback authorized by `DECISION-033`, the verification result must also include an explicit self-verification disclosure in `risks` or `summary` stating that no independent second-party review occurred.

---

## Invalid Verification Result Examples

Invalid:

```text id="8dahsk"
Looks good.
```

Invalid:

```text id="vbfdp7"
Probably done, but I did not check.
```

Invalid:

```text id="tlt49a"
PASS, but tests were not run and evidence is missing.
```

Why invalid:

* vague
* not evidence-based
* contradictory
* cannot safely update state

---

## V1 Discipline

Verification should be strict enough to protect project truth but not so heavy that every task becomes a governance ceremony.

Use the completion contract and verification mode to decide how much evidence is enough.
