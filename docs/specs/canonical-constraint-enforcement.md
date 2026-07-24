# Spec: Canonical constraint enforcement (ADR-0020)

Status: Proposed · 2026-07-24 · Owner-approved (design ruling + four corrections + eight-point ruling)

## Objective
Make PCC's already-canonical cross-cutting rules **executable**, so a task cannot receive implementation
authority or land without proving compliance. The rules already exist in `CLAUDE.md`; the defect was that
work could proceed and get a PASS without proving it followed them. One policy mechanism, one registry,
invoked at two lifecycle points. No new dependency; extends the existing governor.

## The three canonical constraints (v1, all default-on)
Cited — not restated — from `CLAUDE.md`, with a content hash so a silent reword fails closed:
`RESEARCH_FIRST`, `TOKEN_THRIFT_LOCAL_FIRST`, `REDUCE_OWNER_BABYSITTING`. Registry:
`.cockpit/state/canonical-constraints.json`.

## Behavior
- **Registry + drift.** `check-canonical-constraints.ps1` loads the schema-validated registry and verifies
  each cited statement still exists verbatim in its source doc (whitespace-normalized) and matches its
  stored hash. Any drift → fail closed.
- **Phase Preflight (before implementation).** A `PreToolUse` hook (`.claude/settings.json` →
  `scripts/hooks/canonical-preflight.ps1`) covers every mutation-capable tool (Bash, PowerShell, Edit,
  Write, NotebookEdit, BashOutput, KillBash). With no valid preflight it **denies** mutation, **permits**
  only writing `.cockpit/preflight/<task_id>.json` and running `write-task-preflight.ps1`, and leaves
  read/search/research tools ungated. Once a preflight is validated and locked, mutation proceeds.
- **The lock.** `write-task-preflight.ps1` validates the artifact (schema + required constraints + drift)
  and records a **local** lock (`.cockpit/preflight/.active-lock.json`, git-ignored) binding the task_id to
  the artifact's **full 64-char** digest. Hand-editing the preflight afterwards changes its digest, so the
  lock no longer matches and mutation is blocked until re-locked or a new task is established.
- **Phase Land (at commit).** The governor calls the same checker: a valid, staged (or active) preflight
  must govern a T0–T3 change; for the receipt-gated tiers the receipt must bind the same preflight digest.
- **Durable chain.** The verification receipt carries `preflight_task_id` + full `preflight_digest`; the
  `Verified-Receipt` trailer carries `preflight=<task_id>@<full-digest>`; the CI trailer audit proves, from
  history alone, that the trailer names a task + full digest, the committed preflight exists at that commit,
  its recomputed digest matches, and a preflight is never changed after it has governed a landed commit.
- **Receipt fail-closed.** `write-verification-receipt.ps1` refuses to write when nothing is staged
  (base==head), when the tier is not a schema-valid value, or when its own output fails the schema.
- **Verifier.** The independent-verifier prompts (`verify-work.ps1`, `new-verification-request.ps1`,
  `AGENTS.md`) require checking each applicable constraint against the scope, the **actual diff**, and the
  execution evidence — never the worker's summary. Missing evidence or a material violation is FAIL.
- **Bootstrap.** The mechanism does not govern its own introduction: Phase Land, the receipt binding, and
  the CI audit's preflight requirement are gated on the checker existing in the **baseline/parent**, so this
  introducing change is proven by tests + independent review + CI, and every change after it is governed.

## Acceptance criteria (EARS — each needs a passing test)
1. WHEN a mutation-capable tool is attempted AND no valid preflight is locked THE SYSTEM SHALL deny it,
   except writing the preflight artifact or running the preflight locker.
2. WHEN a valid preflight is locked THE SYSTEM SHALL permit mutation.
3. WHEN the preflight artifact is changed after locking THE SYSTEM SHALL block further mutation
   (digest mismatch) until re-locked.
4. WHEN a cited canonical statement is reworded/removed without updating the registry THE SYSTEM SHALL
   fail closed (drift).
5. WHEN the preflight writer is given a task_id with a path separator/traversal THE SYSTEM SHALL refuse.
6. WHEN a T0–T3 change is committed without a valid preflight (mechanism in baseline) THE SYSTEM SHALL block.
7. WHEN a verification receipt is requested with nothing staged, or an invalid tier, or output that fails
   its schema THE SYSTEM SHALL refuse to write it.
8. WHEN a receipt binds a preflight THE SYSTEM SHALL carry the full digest into the trailer, and the CI
   audit SHALL fail a mismatched/absent/mutated preflight.
9. WHEN the change introducing the mechanism is committed THE SYSTEM SHALL NOT require the mechanism of
   itself (bootstrap).

## Honest limitations
- The hook blocks the **mutation** (PCC's real implementation gate); it cannot stop code written entirely
  outside Claude Code's tool path — Phase Land is the backstop so nothing lands without a valid preflight.
- The gate proves evidence is present, schema-valid, digest-bound and history-verifiable. Whether the
  research or reasoning is **good** remains the independent verifier's judgment.
- The local receipt and lock remain git-ignored; CI proves the trailer↔committed-preflight↔diff chain, not
  that the ignored local receipt existed or that the review was performed honestly (existing ADR-0007
  attestation limit, preserved).
