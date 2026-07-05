# Advisor Restart Brief

Generated 2026-07-04T20:45:16-06:00 from canonical repo truth. This brief is disposable context, not authority — if it ever disagrees with the files it points to, the files win (see Truth Source Priority in docs/STATE_MODEL.md).

## What This Project Is

Project Control Cockpit: Build a lean, local-first AI project control cockpit that reduces owner babysitting.

Current phase: post-brr

## Active Task

* Task ID: pcc-pathC-001
* Title: Metrics & Evidence: Extend doctor.ps1 With Dirty-Tree, Branch-Hygiene, And File-Structure Checks
* Status: complete
* Safety Class: A (see docs/BRR_POLICY.md "Task Safety Classification")
* Objective: Deliver the original project scope's Stronger Repo Health Diagnostics (archive/PCC Original Project Scope.md §12.7) by extending scripts/doctor.ps1 with three additional read-only, advisory checks it does not currently perform: (1) dirty working tree (uncommitted changes present via 'git status --porcelain'), (2) branch hygiene (current branch matches project-state.json's active_branch, and whether the branch is ahead/behind its upstream if one is configured), and (3) file-structure check (the expected .cockpit/ subdirectories and canonical state files from docs/STATE_MODEL.md are present, and no unexpected top-level .cockpit/ entries exist). This is the first Category C (Metrics & Evidence Depth) task per DECISION-074's roadmap. Scoped and justified against the three-filter test recorded in backlog/IDEAS.md IDEA-012 and docs/PROJECT_CHARTER.md's Core Design Rule (Modularity/Extractability, DECISION-077): purely additive to an already-existing advisory-only script, reduces owner babysitting (these are currently only caught by the owner noticing manually), and introduces no new shared state (reads git plumbing and the filesystem directly, prints report lines, exactly the same shape as doctor.ps1's four existing composed checks). Task Safety Class A: bounded, low-risk, mechanically checkable by running doctor.ps1 and inspecting its output; touches no schema, no state file, no verdict, and no Owner Review Matrix truth surface.

## Last Verified

* Verdict: PASS for task 'pcc-pathC-001', verified at 2026-07-04T20:42:30-06:00
* Summary: Independent verification passes. The verifier re-ran scripts/verify-handback-guardrails.ps1 successfully, confirmed doctor.ps1 now contains the required read-only Working tree, Branch hygiene, and File structure checks while preserving exit-0 advisory behavior, and found the current evidence package consistent with the amended completion contract. The prior failure mode is closed: DECISION-078 and task-state.json now accurately disclose the disposable-clone method used for the Working-tree clean/dirty proof, while the branch-hygiene and file-structure induced cases remain tested directly against the real repo and restored afterward.
* Last verified handoff: .cockpit/handoff/archive/pcc-pathC-001-attempt4-worker-directive.md

## Open Issues

* Risk from last verification of 'pcc-pathC-001': The Working-tree clean/dirty proof relies on a one-off owner-approved completion-criterion amendment for this task's structural conflict; that exception should not be generalized to other tasks without separate review.

## Read First

* .cockpit/state/project-state.json
* .cockpit/state/task-state.json
* .cockpit/handoff/worker-directive.md
* .cockpit/result/worker-result.md
* .cockpit/result/verification-result.json
* docs/DECISIONS.md
* docs/REPO_GOVERNANCE.md

## What Happens Next

* Task-level: Task 'pcc-pathC-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
* Project-level: Task 'pcc-pathC-001' is complete and verified PASS. Owner/advisor selects and drafts the next bounded task.
