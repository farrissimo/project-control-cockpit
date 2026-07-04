$ErrorActionPreference = "Stop"

function Fail {
  param([string]$Message)
  Write-Error $Message
  exit 1
}

# Single shared invariant: any repo-native path that changes live task status
# must leave BOTH live handoff artifacts (worker-directive.md and
# advisor-restart-brief.md) regenerated from the resulting state, not just
# one of them. This exact defect - regenerating only one artifact after a
# status change - has now been found and fixed twice in this same BRR
# sub-thread (pcc-brr2-001 on the worker handback side, then again during
# pcc-brr2-004's own scratch testing on the verifier close-out side). Giving
# every status-mutating path one shared call site, instead of each one
# re-implementing "call both generators" by hand, is what makes a third
# recurrence structurally harder rather than merely "remembered harder."

& pwsh -NoProfile -File "scripts/generate-worker-directive.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "scripts/generate-worker-directive.ps1 failed while refreshing the live directive."
}
& pwsh -NoProfile -File "scripts/generate-advisor-restart-brief.ps1"
if ($LASTEXITCODE -ne 0) {
  Fail "scripts/generate-advisor-restart-brief.ps1 failed while refreshing the live restart brief."
}

Write-Output "Both live handoff artifacts refreshed from the current state."
