# Advisor Restart Brief

Generated 2026-07-04T01:59:26-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: brr-phase-2

## Active Task

* Task ID: pcc-brr2-011
* Title: BRR Execution: Wire Self-Gate On PCC's Autonomous Path
* Status: complete
* Safety Class: B (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Wire the seam described by pcc-brr2-010 (Acceptance Boundary Rules): build the deterministic gate that PCC's OWN autonomous path - self-promotion of the next task, and unattended self-continuation/self-acceptance - must pass before proceeding. The gate composes the ALREADY-DEFINED stop machinery (scripts/check-stop-conditions.ps1 must report CLEAR) and the already-defined acceptance boundary (self-acceptance requires Class A; Class B must not self-accept). It is narrow by construction: only PCC's autonomous path invokes it, so owner-directed work is never gated by it. It does NOT redesign the stop model, and it does NOT by itself start unattended operation - the first actual gated autonomous run is the SUPERVISED pilot (next task, pcc-brr2-012). Forks route to the owner via owner_decision_request (which trips the stop-check, which blocks the gate), never rationalized into continuation.

## Last Verified

* Verdict: PASS for task 'pcc-brr2-011', verified at 2026-07-04T02:00:00-06:00
* Summary: Verified scripts/check-autonomous-gate.ps1 against the completion criteria. The load-bearing safety property - the gate never gates owner-directed work - is proven structurally: git status shows only the new gate script was added, with zero modifications to any owner-path script (finalize-worker-handback, close-out-verified-task, verify-handback-guardrails, doctor, advance-cockpit-state, enforce-handoff-restart-safety), so owner work cannot reach this gate. Read the script in full: it composes check-stop-conditions.ps1 (must be CLEAR) and the acceptance boundary (self_accept requires Class A), is fail-closed (exit 0 = PROCEED, non-zero = do not proceed), and redesigns nothing. The worker's demonstrations cover PROCEED (clean promote and clean Class A accept), BLOCKED (Class B accept, tripped stop condition), and fail-closed (unhealthy repo). The BRR_POLICY seam text and README correctly state the gate is wired but does not start unattended operation - the supervised pilot does. The worker's decision to leave REPO_GOVERNANCE's owner Task Process unchanged is defensible (the gate is an autonomous-path tool, not an owner-workflow step). All completion criteria met.
* Last verified handoff: .cockpit/handoff/archive/pcc-brr2-011-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-brr2-011': Self-verified under DECISION-033 degraded fallback (Codex unavailable). No independent second-party (Codex) review occurred. GPT secondary review: not performed at verification time (pushed immediately after). Claude drafted, built, and verified this cycle, and it is the highest-stakes piece (the gate that moves autonomy from off toward on). GPT review of the 'never gates owner work' property and the fail-closed design is specifically recommended.
* Risk from last verification of 'pcc-brr2-011': The gate is built but not yet exercised in a live autonomous loop - correct (that is the supervised pilot, pcc-brr2-012), but its real-world loop behavior is unproven until then. The demonstrations prove its verdicts are correct, not that the end-to-end autonomous sequence is safe.
* Risk from last verification of 'pcc-brr2-011': self_promote gating relies entirely on check-stop-conditions.ps1 (the gate adds no promote-specific check); any blind spot there is inherited. The acceptance-boundary check is the gate-specific logic and applies to self_accept.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-brr2-011' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-brr2-011' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
