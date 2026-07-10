# PCC Engineering Assurance Plan

## Purpose

PCC must produce code that is not merely functional on the expected path. Its
critical behavior must remain truthful and safe under malformed data, stale
state, partial failure, interrupted work, conflicting sources, concurrency,
restart, unavailable dependencies, and verifier failure.

This plan converts known LLM-assisted coding weaknesses into permanent
engineering practices.

It is engineering assurance, not an additional owner-governance system.

The owner is not responsible for remembering technical failure cases,
constructing test matrices, or reminding the worker and verifier how to review
critical code.

## North Star

PCC must:

1. Tell the truth about what it knows, does not know, and could not verify.
2. Protect user and project data before preserving convenience.
3. Have one authoritative owner for every material state domain.
4. Fail visibly rather than silently guess, discard, overwrite, or show stale
   information as current.
5. Produce evidence tied to the exact code being evaluated.
6. Reduce owner babysitting rather than move technical review work onto the
   owner.

## What This Plan Is Not

This plan must not create:

- a new approval bureaucracy
- additional owner checkpoints for ordinary implementation
- a generalized workflow engine
- a large claim-management platform
- scoring, percentages, or compliance theater
- new UI unless a real product truth problem requires it
- duplicate policy documents
- speculative abstractions for problems PCC has not encountered

Automate repeated technical checks. Do not automate paperwork.

## Part 1 — Permanent Engineering Rules

### 1. One authority per domain

Every material state domain must have one identified authority.

Caches, rendered copies, summaries, backups, and localStorage may not silently
become competing authorities.

A change affecting state ownership must identify:

- canonical source
- allowed readers
- allowed writers
- mutation method
- recovery source
- conflict behavior
- project/version identity

Whole-object replacement is prohibited for critical shared state unless it is
provably the intended transaction. Prefer narrow commands and revision checks.

### 2. Claims must match implementation

Comments, test names, task reports, and UI labels may not promise more than the
code proves.

Words such as these require evidence:

- always
- never
- atomic
- durable
- safe
- current
- complete
- verified
- recovered
- backed up
- no data loss
- fail closed

If the implementation provides a weaker guarantee, the wording must state the
weaker guarantee honestly.

### 3. Critical failures may not be swallowed

Empty catches, ignored return values, best-effort behavior, and fallback
defaults are prohibited inside critical guarantees unless the degraded behavior
is explicit, safe, and surfaced.

A failure must become one of:

- a safe retry
- a structured unavailable/stale/conflict result
- a rejected mutation
- a preserved recovery path
- an explicit error

It must not quietly become success.

### 4. Malformed input fails closed

Critical boundaries validate the actual data shape and supported types before
mutation.

Malformed real values may not silently become:

- empty arrays
- default objects
- the current time
- false
- zero
- a generated identifier
- an apparently valid success result

Defaults are acceptable only for genuinely absent optional values whose default
semantics are defined.

### 5. Data mutations must be recoverable

Critical persistent writes require the applicable combination of:

- validation before mutation
- atomic replacement
- retained prior generation
- revision or compare-and-swap protection
- stable project identity
- reread verification
- clear failure results
- tested recovery behavior

A recovery copy must not be overwriteable by a corrupt current generation.

### 6. Displayed truth requires provenance

A material displayed value must eventually be able to identify:

- source
- project
- revision, commit, or equivalent version
- read time
- freshness state
- error or conflict state

A failed refresh may not leave old information painted as current.

### 7. Verification is commit-bound

Every independent verification result must identify:

- exact reviewed commit or diff
- comparison base
- files reviewed
- commands actually executed
- tests actually run
- critical guarantees examined
- uncovered areas
- verifier verdict

Verification from an earlier commit does not transfer automatically to later
code.

Unavailable, interrupted, incomplete, or failed verification is not PASS.

## Part 2 — Development Workflow

Claude Code is the implementation worker.
Codex CLI is the independent verifier.

For every substantive code slice:

1. Claude identifies the affected domain and whether it is integrity-critical.
2. Claude states the small number of important guarantees affected.
3. Claude implements a bounded change.
4. Deterministic tests run.
5. Codex reviews the actual diff and relevant source, not only Claude's summary.
6. Confirmed defects are fixed.
7. The slice is committed and pushed after PASS.
8. Work proceeds to the next bounded slice.

For integrity-critical changes, Codex must explicitly attempt to construct a
counterexample to each important guarantee.

A worker may not substitute self-review for independent verification.

Codex advice about the next task is advisory. It may not silently expand scope
or authorize unrelated work.

## Part 3 — Required Test Thinking

Tests must be selected according to actual risk, not added mechanically.

Normal feature tests should cover:

- expected operation
- important validation
- meaningful integration behavior
- regression behavior

Integrity-critical tests should additionally consider:

- malformed input
- missing input
- corrupt persisted data
- stale revisions
- conflicting authorities
- duplicate identifiers
- partial writes
- failed writes
- failed rename/copy/flush operations
- restart after interruption
- concurrent or repeated commands
- project switching
- cross-project isolation
- unavailable tools or dependencies
- old data remaining visible after refresh failure
- tests accidentally touching production data

Not every category applies to every change. Claude must choose the applicable
ones and Codex must challenge omissions.

## Part 4 — Regression Rule

Every confirmed defect class must produce a test before or alongside its repair
whenever technically practical.

The test must fail against the defective behavior and pass after repair.

This converts incidents into permanent protection instead of relying on future
models to remember the discussion.

## Part 5 — Test Isolation

Automated tests must use synthetic fixtures, copied evidence, temporary
directories, and isolated userData/project paths.

Tests may not depend on or mutate the owner's production project data.

For particularly sensitive paths, verification must compare relevant hashes,
timestamps, or manifests before and after the test run.

## Part 6 — Backup and Checkpoint Discipline

Git commits and remote pushes are the primary code recovery mechanism.

During critical work:

- completed verified slices are committed and pushed before the next slice
- a long slice receives one WIP checkpoint after several substantial fail/fix
  rounds
- WIP commits are explicitly labeled and do not imply completion
- production data evidence receives a hashed external snapshot before a
  controlled migration or launch
- the backup script and policy must cover the actual critical application files,
  not only older script/document/state categories

Do not create a commit after every edit or test.

## Part 7 — Existing-Code Hardening Sweep

After the chat recovery is complete, PCC receives one risk-based audit of the
existing application.

The audit searches specifically for known failure classes:

- multiple authorities for one domain
- whole-state replacement writes
- swallowed exceptions
- best-effort behavior inside claimed guarantees
- malformed input normalized into valid-looking data
- stale state displayed as current
- verification detached from the current commit
- project identity based on mutable paths
- missing revision/concurrency protection
- corrupt recovery state overwriting good recovery state
- tests covering success but not relevant failure
- tests that do not exercise the production code path
- misleading comments or test names
- false-green defaults
- production-data exposure during tests
- acknowledgments returned before persistence is confirmed

This is not an exhaustive rewrite or style cleanup.

Each finding is classified as:

- critical blocker
- important bounded repair
- ordinary technical debt
- no defect

Only confirmed critical and important defects enter the immediate hardening
queue. Ordinary technical debt does not stop product progress without a specific
reason.

## Part 8 — Shared Engineering Mechanisms

Reusable mechanisms should be created only when PCC has at least one concrete use
and a likely second use.

Likely shared mechanisms include:

- safe atomic storage
- revision-checked mutation helpers
- project identity resolution
- structured current/stale/unavailable/conflict envelopes
- test fault injection for filesystem operations
- isolated temporary project/test profiles
- exact-commit verification evidence
- safe backup and restore manifests

Do not build a general platform merely because one could be useful later.

## Part 9 — Remaining Core Features

The remaining PCC core features are built under this standard from their first
slice.

Before implementation, Claude identifies:

- authoritative data involved
- material guarantees
- realistic failure behavior
- required tests
- whether the feature is integrity-critical

After implementation, Codex attempts to disprove those guarantees.

The owner receives a plain-language result:

- what changed
- what was proven
- what Codex challenged
- what remains uncertain
- whether it is safe to continue

The owner is not expected to review implementation details.

## Part 10 — Final System Hardening

After the remaining core features are complete:

1. Run the complete deterministic test suite.
2. Run critical integration and restart/recovery scenarios.
3. Verify project-switch isolation.
4. Verify canonical state ownership across all material domains.
5. Verify trust indicators against exact current sources.
6. Verify verification evidence against the exact release commit.
7. Exercise backup and restore using copied test data.
8. Run a final adversarial Codex review of the integrated application.
9. Record unresolved risks honestly.
10. Produce one owner-facing readiness report.

No claim of general trustworthiness is made solely from green unit tests or a
single manual launch.

## Anti-Bloat Constraint

No new process artifact is added unless it does at least one of the following:

- automatically prevents a known defect class
- automatically detects a known defect class
- preserves recovery evidence
- removes a repeated owner action
- makes a material product claim more truthful

Anything else requires a concrete justification before it enters PCC.
