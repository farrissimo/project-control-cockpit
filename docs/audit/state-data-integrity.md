# Audit grid — State & data integrity   (ADR-0009 category; status: done)

**Scope:** the machinery that keeps PCC's durable state and project data truthful and recoverable under
malformed data, interruption, partial failure, corruption, and restart. Graded against the integrity
contract (`docs/ENGINEERING_ASSURANCE_PLAN.md` Part 1) and the ADR-0009 yardstick. See
`docs/audit/README.md` for the column meanings.

**Headline (honest):** this category is **strong** — almost every practice is machinery-enforced and
CI-tested. The audit found and **closed two T0 files that had no test** (backup + schema-check, each now
tested), found and **fixed one claims-vs-implementation defect** (a T0 script's header wrongly said
nothing gates on it, when the worker handback does — Rule 2), and **disclosed one accepted residue with a
recommendation** (the real failure-injection suite runs on demand + at the release gate, not in per-push
CI). The header defect is itself proof the audit works: the exact "claim stronger than reality" this phase
exists to kill, caught in PCC's own trust-root docstring.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Atomic durable write** (validate → temp → prev-first rotate → atomic replace; retain `.prev`) — JS `app/state/atomic-store.js` + PS `scripts/lib/atomic-write.ps1` | machinery-enforced | `app/tests/unit/atomic-store.test.js` (16, incl. every failure path + corrupt-current-never-clobbers-good-.prev) + `app/tests/scripts/atomic-write.spec.js` (5, real pwsh). Both T0. Rule 5. | A crash mid-write never yields a torn/partial canonical file | PS mirror can't fsync (no portable pwsh fsync) — **honestly documented in the file**; per-call atomicity ≠ cross-file consistency (that's the journal, below) |
| **Journaled paired write** (task+project as one transaction: record intent → apply both → delete journal; replay on next start) — `scripts/lib/state-journal.ps1` | machinery-enforced | `app/tests/scripts/state-journal.spec.js` (6 blocks incl. 8 malformed-payload vectors; interrupted-split replay; corrupt-journal fail-closed) + `state-writers.spec.js` (3). T0. | An interrupted two-file update self-heals instead of leaving a split-brain | none material — corrupt/non-object payloads fail closed (throw), not replay garbage |
| **One authority per domain** (single canonical writer; caches/backups/localStorage never compete) | machinery-enforced (at the writer/CAS level) + prose (the invariant) | Rule 1 + `docs/ARCHITECTURE.md` State Layer + `docs/STATE_MODEL.md`; writers route through the tested atomic/journal primitives; chat single-writer + revision-CAS + project-identity tested in `chat-store`/`chat-service` unit tests | No two sources silently diverge as competing truth | the "no competing authority" invariant is enforced per-change by the governance gate + review, **not a single direct assertion test** — inherent (it's an architectural invariant, not one code path) |
| **Chat data integrity** (atomic store + revision CAS + `.prev` + structural validation + fail-closed cross-source migration) — `app/state/chat-{store,service,bootstrap,migrate}.js`, `mutex.js` | machinery-enforced | unit: `chat-store` (31), `chat-migrate` (33), `chat-service` (6), `chat-bootstrap` (11), `mutex` (7); E2E `chat-recovery.spec.js` (2, visible recovery banner + mutations blocked). All T0/T1. | Chat history (a first-class store) can't be silently corrupted or lost | none material |
| **Schema validation of canonical state** — `scripts/check-schemas.ps1` (T0), `scripts/validate-cockpit-state.ps1`, in-code `validateStore` | machinery-enforced (hard-gates the worker handback) + evidence-leaving (reported via `doctor.ps1`) | **NEW:** `app/tests/scripts/check-schemas.spec.js` (4) proves it PASSes valid state and **FAILs (exit 1) on a schema-violating or missing file**. It is a HARD GATE in the handback path: `finalize-worker-handback.ps1:175` and `verify-handback-guardrails.ps1:51` abort on a non-zero exit; `doctor.ps1` treats it as a report. `validateStore` covered in `chat-store.test.js`. | On-disk schema drift is caught and surfaced, and blocks a worker handback | it does not gate the *commit* (only the handback + doctor report) — acceptable per risk-based depth: drift is visible, not silent |
| **Recovery / fail-closed** (journal replay; serve `.prev` on corrupt current with mutations blocked; fail closed when no valid generation) | machinery-enforced | unit + E2E above; `.cockpit` recovery paths in `atomic-store`/`chat-store` tests. Rules 3 & 4. | Corruption degrades to a safe, visible, recoverable state — never a silent wrong answer | see failure-injection residue below |
| **Failure-injection harness** (6 scenarios run real production code under injected failure: journal replay, corrupt journal, chat `.prev` recovery, atomic install-failure, git unavailable, CI evidence) — `scripts/run-failure-injection.ps1` + `docs/FAILURE_INJECTION.md` | evidence-leaving (on-demand + release-gate) | manifest `scripts/failure-injection-manifest.json`, receipt `.cockpit/evidence/failure-injection.json`; classification logic unit-tested `failure-injection.spec.js` (10) | Proves the real boundaries fail safe under real injected faults (integration-level) | **accepted residue:** the 6 real scenarios are **not run in per-push CI** (`.github/workflows/ci.yml` never calls the orchestrator) — the underlying guarantees ARE separately CI-covered by the unit/contract tests above, so this is redundancy-of-proof, not an unproven guarantee. See recommendation. |
| **Backup / restore points** (timestamped snapshot of an explicit protected set + manifest; restore aborts before any change on an incomplete snapshot) — `scripts/backup-protected-files.ps1` (T0) | machinery-enforced (now tested); passive/non-gating by design | **NEW:** `app/tests/scripts/backup.spec.js` (7) incl. the data-safety path — **a restore ABORTS before touching any live file if the snapshot is incomplete** (a corrupt restore point can't half-overwrite good state) — closing the "T0 file, no test" gap | Git-independent insurance that can't itself cause data loss on restore | passive by design (nothing blocks on it) — correct for insurance |
| **Stakes-manifest T0 trust root** (which files are constitutional, as data → required proof by git fact) — `.cockpit/state/stakes-manifest.json` | machinery-enforced | ADR-0006; `classify-stakes.spec.js` + `governance-gate.spec.js`; escalation rules (delete/rename/schema/weakened-tests/governor-self-edit/ci-hooks) | The integrity files above are tagged T0 → changes to them need full proof | file-granularity is gameable (risky code in a low-tier file) — **already disclosed** in the manifest; function-level tiering deferred |

## Gaps found → disposition
1. **`backup-protected-files.ps1` (T0) had no test → FIXED.** `app/tests/scripts/backup.spec.js` (7 tests),
   including the abort-before-any-change data-safety path.
2. **`check-schemas.ps1` (T0) had no test → FIXED.** `app/tests/scripts/check-schemas.spec.js` (4 tests)
   proves it actually detects a schema violation, not just that it passes on good input.
2b. **`check-schemas.ps1`'s header CLAIMED "nothing halts on its exit code" — FALSE → FIXED.** The audit
   (Codex-caught) found the worker-handback path DOES hard-gate on it (`finalize-worker-handback.ps1:175`,
   `verify-handback-guardrails.ps1:51` abort on a non-zero exit). This was a Rule-2 (claims-match-
   implementation) violation in a T0 file's own docstring; the header is corrected to state the truth
   (doctor = report; handback = hard gate). Exactly the kind of drift this audit exists to surface.
3. **The 6 real failure-injection scenarios aren't in per-push CI → ACCEPTED RESIDUE + recommendation.**
   Their guarantees are separately CI-covered by unit/contract tests, so this is redundancy, not an
   unproven guarantee; running the full real suite on every push adds time for little marginal proof.
   **Recommendation (owner decides):** wire `run-failure-injection.ps1` as a **non-gating scheduled/
   nightly CI job** (or keep it at the release gate, where it already belongs), rather than per-push.
   Not changed in this slice to avoid CI-time bloat without the owner's call (yardstick #2).

## Verdict against the integrity contract
All seven Part-1 rules are enforced by tested machinery for the critical state/data paths, with the two
newly-closed test gaps above and the one disclosed, separately-covered failure-injection residue. Claims
match implementation (the one honest limitation — the pwsh mirror can't fsync — is stated in the code).
**This category is done: recorded strong where strong, with the two real holes closed and the residue
disclosed, not painted over.**
