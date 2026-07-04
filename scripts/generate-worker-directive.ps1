param(
  [string]$OutputPath = ".cockpit/handoff/worker-directive.md"
)

$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

function Read-Json {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    Fail "Missing required file: $Path"
  }
  try {
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
  } catch {
    Fail "Invalid JSON in $Path :: $($_.Exception.Message)"
  }
}

function Format-Bullets {
  param([string[]]$Items)
  if (-not $Items -or $Items.Count -eq 0) {
    return "* (none specified)"
  }
  return (($Items | ForEach-Object { "* $_" }) -join "`n")
}

$projectStatePath = ".cockpit/state/project-state.json"
$taskStatePath = ".cockpit/state/task-state.json"

$projectState = Read-Json $projectStatePath
$taskState = Read-Json $taskStatePath

# The directive cannot be drafted without the task fields that give the worker
# a bounded, executable action. Fail loudly rather than emit a vague directive.
foreach ($field in @("task_id", "task_title", "task_status", "task_objective", "task_safety_class")) {
  if ([string]::IsNullOrWhiteSpace($taskState.$field)) {
    Fail "task-state.json field '$field' is empty. Cannot draft a bounded directive without it."
  }
}
if ($taskState.task_safety_class -notin @("A", "B", "C", "D")) {
  Fail "task-state.json field 'task_safety_class' must be one of A, B, C, D per docs/BRR_POLICY.md; found '$($taskState.task_safety_class)'."
}
if (-not $taskState.boundaries.allowed -or $taskState.boundaries.allowed.Count -eq 0) {
  Fail "task-state.json boundaries.allowed is empty. Refusing to draft a directive with no allowed scope."
}
if (-not $taskState.boundaries.forbidden -or $taskState.boundaries.forbidden.Count -eq 0) {
  Fail "task-state.json boundaries.forbidden is empty. Refusing to draft a directive with no forbidden scope."
}
if (-not $taskState.completion_criteria -or $taskState.completion_criteria.Count -eq 0) {
  Fail "task-state.json completion_criteria is empty. Refusing to draft a directive with no completion criteria."
}

if ($projectState.current_task_id -ne $taskState.task_id) {
  Fail "State drift: project-state current_task_id '$($projectState.current_task_id)' does not match task-state task_id '$($taskState.task_id)'. Reconcile state before drafting a directive."
}
if (-not $projectState.worker_context_facts -or $projectState.worker_context_facts.Count -eq 0) {
  Fail "project-state.json worker_context_facts is empty. Current Truth's standing worker facts must come from canonical state (DECISION-017), not a script fallback."
}

$directiveSelfPath = if ($taskState.current_directive_path) { $taskState.current_directive_path } else { ".cockpit/handoff/worker-directive.md" }
$resultPath = if ($taskState.worker_result_path) { $taskState.worker_result_path } else { ".cockpit/result/worker-result.md" }

$requiredEvidenceItems = if ($taskState.required_evidence -and $taskState.required_evidence.Count -gt 0) {
  $taskState.required_evidence
} else {
  @(
    "Files created or changed",
    "Summary of changes",
    "Commands run, if any",
    "Command/test results, if any",
    "Known risks",
    "Unresolved assumptions",
    "Confirmation that forbidden scope was not touched"
  )
}

# Current Truth comes entirely from canonical state: active_constraints plus
# worker_context_facts (DECISION-017). No facts are hardcoded in this script.
$currentTruth = New-Object System.Collections.Generic.List[string]
$currentTruth.Add("$($projectState.project_name) is a local-first AI project control board.")
foreach ($c in $projectState.active_constraints) {
  if (-not $currentTruth.Contains($c)) { $currentTruth.Add($c) }
}
foreach ($f in $projectState.worker_context_facts) {
  if (-not $currentTruth.Contains($f)) { $currentTruth.Add($f) }
}

# Owner-Decision Capture Flow (docs/BRR_PLAN.md Phase 2 item 2): when a
# decision only the owner can make is pending, surface it as its own section
# rather than leaving it buried in current_blocker prose. Rendered only when
# task-state.json's owner_decision_request is populated; absent otherwise.
$ownerDecisionSection = ""
if ($taskState.owner_decision_request) {
  $odr = $taskState.owner_decision_request
  $ownerDecisionSection = @"

## Owner Decision Needed

* Question: $($odr.question)
* Reason: $($odr.reason)
* Options:
$(Format-Bullets $odr.options)
* Blocked until: $($odr.blocked_until)
"@
}

# Safe Next-Task Drafting Rules (docs/BRR_POLICY.md, DECISION-038/pcc-brr2-008):
# when a task was auto-promoted inside an approved lane, the falsifiable
# in-lane justification travels with it and is surfaced for the reviewer.
# Absent (null) when the owner drafted the task directly.
$promotionBasisSection = ""
if ($taskState.promotion_basis) {
  $pb = $taskState.promotion_basis
  $promotionBasisSection = @"

## Auto-Promotion Basis

* Approved lane: $($pb.lane)
* Priority / plan reference: $($pb.priority_ref)
* Justification (continuation, not a fork): $($pb.justification)
"@
}

$directive = @"
# Worker Directive

## Receiving Role

Worker

## Project

* Project ID: $($projectState.project_id)
* Project Name: $($projectState.project_name)
* Repo Path: $($projectState.active_repo_path)
* Active Branch: $($projectState.active_branch)

## Current Task

* Task ID: $($taskState.task_id)
* Task Title: $($taskState.task_title)
* Task Status: $($taskState.task_status)
* Task Safety Class: $($taskState.task_safety_class) (see docs/BRR_POLICY.md "Task Safety Classification")
$ownerDecisionSection$promotionBasisSection
## Objective

Read this directive from ``$directiveSelfPath``, complete the bounded task below, and return your result to ``$resultPath`` using the required evidence format.

## Current Truth

$(Format-Bullets $currentTruth)

## Exact Next Action

$($taskState.task_objective)

## Allowed Scope

The worker may:

$(Format-Bullets $taskState.boundaries.allowed)

## Forbidden Scope

The worker must not:

$(Format-Bullets $taskState.boundaries.forbidden)

## Completion Criteria

The task is complete only if:

$(Format-Bullets $taskState.completion_criteria)

## Required Evidence

Return the following evidence:

$(Format-Bullets $requiredEvidenceItems)

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
"@

Set-Content -LiteralPath $OutputPath -Value ($directive + "`n") -NoNewline
Write-Output "Drafted worker directive for task '$($taskState.task_id)' at $OutputPath"
