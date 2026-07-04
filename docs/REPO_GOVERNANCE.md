# Repo Governance

## Purpose

This document defines how PCC handles canonical docs, live state, ideas, tasks, evidence, archives, and stray documentation.

Its purpose is to keep the repo professional, scalable, and resistant to stale-doc drift.

---

## Core Rule

No document becomes authoritative by accident.

Every repo artifact must belong to one of the following classes:

* canonical documentation
* live state
* decision log
* worker evidence
* idea intake
* archive

If a file does not clearly fit one of those classes, it must be reviewed and either reclassified, archived, or removed.

---

## Repo Classes

## 1. Canonical Documentation

Canonical docs live under `docs/`.

They define durable project rules, workflow, architecture, governance, schemas, or lifecycle behavior.

Canonical docs explain the system, but they do not store live task truth.

Examples:

* `docs/PROJECT_CHARTER.md`
* `docs/V1_Scope.md`
* `docs/STATE_MODEL.md`
* `docs/REPO_GOVERNANCE.md`

## 2. Live State

Live project and task truth lives under `.cockpit/state/`.

State files are the authoritative record of:

* active task
* next expected action
* current blocker
* current verdict
* current phase

Live state is not replaced by prose docs.

## 3. Decision Log

Binding owner/project decisions live in:

* `docs/DECISIONS.md`

If a change affects future behavior, scope, workflow, governance, or truth discipline, it must be recorded there.

## 4. Worker Evidence

Worker outputs and verification artifacts live under `.cockpit/result/`.

These are evidence, not truth, until verification passes.

## 5. Idea Intake

Ideas are not tasks and are not canonical truth.

Ideas live in one controlled intake file:

* `backlog/IDEAS.md`

If an idea needs more detail, it may have one supporting details doc under:

* `backlog/details/`

The idea placeholder in `backlog/IDEAS.md` must point to that details doc.

## 6. Archive

Superseded, historical, or non-canonical material should move to `archive/` rather than remaining mixed with active repo truth.

Archive content may be useful context, but it is not live authority.

---

## New Canonical Doc Process

Before creating a new canonical doc, answer these questions in order:

1. Can the change be handled by an existing canonical doc?
2. Can the change be handled by `docs/DECISIONS.md` instead of a new file?
3. Can the change be handled by live state instead of prose?
4. Does the missing concept represent durable project behavior that needs its own stable reference?

If the answer to 1, 2, or 3 is yes, do not create a new canonical doc.

Create a new canonical doc only when:

* the concept is durable
* the concept does not fit cleanly into an existing doc
* the doc has one narrow purpose
* the doc is linked from the appropriate canonical entry point
* `docs/DECISIONS.md` is updated if project behavior or governance changed

No new broad planning file should become quasi-canonical by default.

---

## Change Propagation Rule

Any meaningful project change must trigger a source-of-truth review.

This is non-negotiable.

When behavior, workflow, scope, state shape, handoff procedure, verification logic, routing policy, or governance changes, the system must check which canonical artifacts also need updating.

Minimum review targets:

* `docs/DECISIONS.md`
* affected canonical docs under `docs/`
* live state under `.cockpit/state/`
* active worker directive under `.cockpit/handoff/` when relevant
* verification artifacts or examples when their structure or meaning changed

The rule is not "update every file every time."

The rule is:

* identify impacted truth surfaces
* update the ones that changed
* avoid silent divergence

If a change is made and related source-of-truth artifacts are not reviewed, the work is incomplete.

PCC should prefer a deterministic local validation step for state consistency rather than relying on memory or chat review alone.

---

## Idea Process

Ideas must be captured without becoming fake active work.

Standard idea workflow:

1. Add a short placeholder entry to `backlog/IDEAS.md`.
2. Give it a stable idea ID.
3. Mark its status.
4. Add a details doc only if the idea needs more than a short placeholder.
5. Link the placeholder to the details doc when one exists.

Recommended idea statuses:

* proposed
* under-review
* promoted-to-task
* rejected
* archived

Ideas remain non-canonical planning material until explicitly promoted.

---

## Task Process

Tasks are separate from ideas.

An idea does not become a task until it is promoted into live state.

Standard task workflow:

1. Confirm the idea or request is worth execution.
2. Define a bounded objective.
3. Define allowed scope and forbidden scope.
4. Define required evidence.
5. Define next action.
6. Write the task into `.cockpit/state/task-state.json`.
7. Generate the worker directive.
8. Run the worker.
9. Verify evidence before truth advances.

If task execution changes the durable workflow, governance, or other canonical project behavior, update the affected docs before treating the task as fully complete.

When state, verdict, or handoff files change, run the local validation step before treating the update as complete.

Active tasks live in `.cockpit/state/task-state.json`, not in idea docs.

### Plain-Language Naming

`task_id` (`pcc-v1-0XX`) and idea IDs (`IDEA-0XX`) remain the permanent, unchanging identifiers - do not rename them once assigned, since archives, git history, and cross-references in `docs/DECISIONS.md` depend on them staying stable.

Starting with tasks drafted after `pcc-v1-012`, `task_title` should lead with a short, non-technical `Category: Plain Name` prefix (e.g. `Safety Net: Clean Stop`, `Honesty Checks: Activity Log`) so the owner can tell what a task is at a glance without decoding jargon or memorizing numbers. Current categories in use: **Foundation** (early setup), **Fresh Start** (restart-safety), **Safety Net** (backup/recovery/session-end tools), **Honesty Checks** (anti-drift/anti-fake-completion tooling). New categories may be added as new themes of work emerge; keep the plain-language name short (2-4 words) and free of technical terms. See `README.md`'s "Plain-Language Task Names" table for the full mapping of completed work.

---

## Stray Or Stale Doc Process

When a stray, stale, duplicate, or unknown doc is found, use this review order:

1. Classify it:
   canonical, live state, evidence, idea intake, archive, or unknown
2. Decide whether it is still active
3. Decide whether another file already owns the truth

Then take one of these actions:

* keep:
  only if the file is active and clearly classified
* move to archive:
  if the file is historical, superseded, or useful for reference but not current
* merge and archive:
  if the file duplicates truth owned elsewhere
* delete:
  only if the file is trivial, generated, duplicated without historical value, or explicitly approved for removal

Unknown docs should not be left sitting in active repo paths indefinitely.

---

## Placement Rules

Use these default locations:

* `docs/` for canonical docs
* `.cockpit/state/` for live truth
* `.cockpit/handoff/` for active directives
* `.cockpit/result/` for worker and verifier artifacts
* `backlog/` for idea intake
* `archive/` for retired or non-canonical historical material

Avoid adding new root-level markdown files unless there is a strong reason and explicit approval.

---

## V1 Discipline

PCC should stay allergic to process theater.

If a new file, step, or workflow does not reduce babysitting, improve verification, preserve truth, or reduce handoff pain, it should be questioned before being added.

Likewise, if a change is not propagated to the relevant truth surfaces, the workflow is incomplete even if the code or artifact itself changed.
