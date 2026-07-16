# Audit grid — Recovery, rollback & damage-repair behavior   (ADR-0009 category; status: done)

**Scope:** what PCC does when state is already damaged, interrupted, or wrong — self-healing an interrupted
write, serving last-good data over corruption, blocking mutations until it's safe, and rolling a bad change
back. Distinct from the backup grid (which is about *taking* snapshots); this is about *behavior under and
after damage*. Graded against the integrity contract Part 1 and the ADR-0009 yardstick. Columns:
`docs/audit/README.md`.

**Method (probe freely, standardize rarely):** enumerated every recovery/rollback path — the write-ahead
journal, atomic `.prev` retention, the chat corrupt-current recovery banner, the fail-closed-when-no-valid-
generation rule, the failure-injection harness, and git-level rollback (restore point / revert) — and asked:
does damage degrade to a **safe, visible, recoverable** state, never a silent wrong answer? **Verdict:
tested, holds.** No consequential break found; this is one of the most heavily-tested areas in the repo.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Interrupted paired write self-heals** (journal: record intent → apply both → delete; replay on next start) — `scripts/lib/state-journal.ps1` | machinery-enforced | `app/tests/scripts/state-journal.spec.js` (6) — **re-run green this session**: completes an interrupted split write; no-op when no journal; **FAILS CLOSED** on corrupt journal + non-string/non-JSON payloads (no garbage commit); doctor surfaces a lingering journal | A crash between two dependent writes self-repairs instead of leaving split-brain (Rule 3 recoverable / Rule 4 fail-closed) | none material — corrupt payloads throw, never replay garbage |
| **Corrupt current → serve last-good `.prev`, block mutations** — `app/state/atomic-store.js` | machinery-enforced | `app/tests/unit/atomic-store.test.js` (16) — **re-run green this session**, incl. *corrupt-current never clobbers a good `.prev`* + every failure path | Corruption degrades to the last good generation, read-only, not a wrong write | PS mirror can't fsync (documented in-code; per-call atomicity ≠ cross-file, which is the journal's job) |
| **Chat corrupt-current recovery is owner-visible** (recovery banner + mutations blocked until resolved) — `app/state/chat-{store,service,bootstrap}.js` | machinery-enforced + owner-visible | unit suites (chat-store 31, chat-migrate 33, mutex 7) cover the recovery paths; E2E `chat-recovery.spec.js` (2, visible banner + mutations blocked) exists + is CI-covered (not re-run this session) | A damaged chat store shows a plain-language banner, never silently loses history (Rule 6) | E2E not re-run this session — relied on CI; unit paths re-run green |
| **Fail closed when no valid generation exists** (no current, no `.prev` → refuse, don't invent) | machinery-enforced | covered in `atomic-store`/`chat-store` recovery tests (Rules 3 & 4) | Never fabricates state to look healthy — the anti-fake-green rule at the data layer | none material |
| **Failure-injection harness** (6 scenarios run REAL production code under injected faults: journal replay, corrupt journal, chat `.prev` recovery, atomic install-failure, git unavailable, CI evidence) — `scripts/run-failure-injection.ps1` | evidence-leaving (on-demand + release gate) | `docs/FAILURE_INJECTION.md`, manifest + receipt; classification logic unit-tested `failure-injection.spec.js` (10). Result: 2 RECOVERED / 4 CONTAINED / 0 EXPOSED (per PROJECT.md; not re-run this session) | Proves the real boundaries fail safe under real injected faults (integration-level) | **accepted residue** (carried from state-data-integrity): the 6 real scenarios are not in per-push CI — the guarantees are separately CI-covered by the unit/contract tests above (redundancy-of-proof, not an unproven guarantee) |
| **Rollback of a bad change** — git restore point (git-independent) + git revert/reset (manual, deliberate); branch protection blocks a bad force-push to `main` | machinery-enforced (git) + prose (the human decision to roll back) | `backup.spec.js` restore path (green this session); branch protection live-checked (`check-branch-protection.ps1`, O1) | A bad commit/merge is reversible; `main` history can't be silently rewritten | rollback is a **deliberate manual action** by design (protect-data: no automated destructive "repair") — correct, not a gap |

## Probed, not built (judged, disclosed)
- **No automated "damage-repair" beyond replay + serve-last-good.** By design. PCC's recovery philosophy is
  *fail closed → surface → let the owner deliberately restore/revert*, never an automated destructive
  self-repair that could compound damage. This is the correct posture for the yardstick (protect-data /
  reversibility buys autonomy); an auto-repair that guesses would be the opposite. Recorded as sound, not a
  gap.
- **The failure-injection suite is on-demand, not per-push.** Same accepted residue as the state-data grid;
  recommendation there (optional nightly/scheduled CI job) still stands, owner's call. Not re-litigated here.

## Verdict against the integrity contract
Recovery/rollback is **strong and tested-holds** — arguably the most thoroughly proven area in the repo.
Interrupted writes self-heal (Rule 3), corruption serves last-good and blocks mutations (Rules 4 & 6), no
valid generation fails closed rather than inventing state (Rule 4), and rollback is reversible-by-design via
git + the restore point + branch protection (Rule 7). Every claim above except the two E2E/on-demand items
was **re-run green this session**; those two are CI-covered and honestly marked not-re-run. **Recorded
strong; no control built** — the expected outcome.
