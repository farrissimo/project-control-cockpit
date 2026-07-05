param(
  [string]$TaskStatePath = ".cockpit/state/task-state.json"
)

$ErrorActionPreference = "Stop"

# Local-First Routing advisory (archive/PCC Original Project Scope.md §7.12;
# pcc-pathA-001, the first Path-A post-BRR task per DECISION-074).
#
# This is a READ-ONLY, ADVISORY, NON-GATING classifier. It reads the active
# task from task-state.json and prints a routing-suitability hint so PCC's
# local-first principle (DECISION-002) becomes a checkable per-task signal
# instead of an unmeasured convention. It:
#   - never mutates any file or state,
#   - never redirects or executes any work,
#   - never gates or blocks anything,
#   - calls no other script.
# A router that autonomously redirects work would be new authority requiring
# its own owner decision; that is deliberately NOT what this is.
#
# The classification is a MECHANICAL KEYWORD HEURISTIC over signals already in
# task state (task_safety_class + literal keyword matches in the title and
# objective). It is explicitly NOT a claim to know the task's true nature -
# consistent with DECISION-008 (no fake intelligence): it is a hint for the
# owner/worker to consider, not a determination, and it can be wrong.

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

if (-not (Test-Path -LiteralPath $TaskStatePath -PathType Leaf)) {
  Fail "Missing required file: $TaskStatePath"
}
try {
  $task = Get-Content -Raw -LiteralPath $TaskStatePath | ConvertFrom-Json
} catch {
  Fail "Invalid JSON in $TaskStatePath :: $($_.Exception.Message)"
}

# Fixed keyword lists. These are literal membership tests only - no stemming,
# no semantic inference. Kept deliberately small and legible so the signal is
# auditable and honest about being a heuristic.
$localKeywords = @(
  "rename", "move", "copy", "list", "search", "grep", "ripgrep", "diff",
  "count", "validate", "validation", "schema", "json", "path", "whitespace",
  "lint", "format check", "find-and-replace", "find and replace", "enumerate",
  "hash", "checksum", "file listing", "directory"
)
$judgmentKeywords = @(
  "policy", "decide", "decision", "design", "review", "wording", "prose",
  "document", "documentation", "tradeoff", "architecture", "explain",
  "recommend", "recommendation", "synthesize", "judgment", "rationale",
  "narrative", "interpret", "strategy"
)

$title = "$($task.task_title)"
$objective = "$($task.task_objective)"
$haystack = ("$title `n$objective").ToLowerInvariant()

$matchedLocal = New-Object System.Collections.Generic.List[string]
foreach ($k in $localKeywords) {
  if ($haystack.Contains($k.ToLowerInvariant())) { $matchedLocal.Add($k) }
}
$matchedJudgment = New-Object System.Collections.Generic.List[string]
foreach ($k in $judgmentKeywords) {
  if ($haystack.Contains($k.ToLowerInvariant())) { $matchedJudgment.Add($k) }
}

$safetyClass = "$($task.task_safety_class)"
$hasLocal = $matchedLocal.Count -gt 0
$hasJudgment = $matchedJudgment.Count -gt 0

# Classification rule (fixed, mechanical):
#   - both kinds of keyword present            -> mixed
#   - only local keywords present              -> local_deterministic
#   - only judgment keywords present           -> model_judgment
#   - neither present:
#       * Class A (bounded/mechanical by class) -> local_deterministic (leaning local, low confidence)
#       * otherwise                             -> unknown
if ($hasLocal -and $hasJudgment) {
  $class = "mixed"
} elseif ($hasLocal) {
  $class = "local_deterministic"
} elseif ($hasJudgment) {
  $class = "model_judgment"
} else {
  if ($safetyClass -eq "A") { $class = "local_deterministic" } else { $class = "unknown" }
}

$recommendationMap = @{
  "local_deterministic" = "This task looks local-tool-suitable. Prefer local deterministic tools (PowerShell, Git Bash, grep/diff, JSON/schema validators) over model reasoning for its work, per DECISION-002 (local-first by default). Do not burn model context on shell-grade work."
  "model_judgment"      = "This task looks judgment-heavy. Model reasoning is appropriate here; local tools alone will not settle it. Still gather deterministic facts with local tools first where possible (DECISION-002), then apply model judgment only to what genuinely needs it."
  "mixed"               = "This task has both deterministic and judgment-heavy parts. Route the deterministic parts to local tools and reserve model reasoning for the judgment parts, per DECISION-002 - do not do shell-grade work with the model."
  "unknown"             = "No clear routing signal was found from the mechanical keywords or safety class. Fall back to the standing default: prefer local deterministic tools for any shell-grade sub-steps (DECISION-002), and use the model only where judgment is genuinely required."
}

$taskId = if ($task.task_id) { $task.task_id } else { "(no task_id)" }

Write-Output "Local-First Routing Advisory (§7.12; DECISION-002) - advisory only, non-gating, read-only."
Write-Output "Task: '$taskId'"
Write-Output ""
Write-Output "Detected routing class: $class"
Write-Output "Signals used (mechanical keyword heuristic - a hint, NOT a determination; DECISION-008):"
Write-Output ("  task_safety_class : {0}" -f ($(if ($safetyClass) { $safetyClass } else { "(none)" })))
Write-Output ("  local keywords    : {0}" -f ($(if ($hasLocal) { $matchedLocal -join ", " } else { "(none)" })))
Write-Output ("  judgment keywords : {0}" -f ($(if ($hasJudgment) { $matchedJudgment -join ", " } else { "(none)" })))
Write-Output ""
Write-Output "Recommendation:"
Write-Output ("  " + $recommendationMap[$class])
Write-Output ""
Write-Output "This is an advisory hint only. It does not gate, redirect, or execute any work, and it may be wrong - the worker's in-context judgment governs. It surfaces the local-first principle as a checkable signal; it does not enforce it."

exit 0
