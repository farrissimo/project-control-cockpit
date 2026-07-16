# Audit grid — Backup & recovery   (ADR-0009 category; status: done)

**Scope:** the machinery that lets the owner (or a worker) get back to a known-good state after a bad
change — git snapshots/push, the git-independent restore point, and the backup-tier honesty that stops
false "not backed up" nags. Graded against the integrity contract (`docs/ENGINEERING_ASSURANCE_PLAN.md`
Part 1) and the ADR-0009 yardstick. Column meanings: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** enumerated every backup/restore path (`scripts/backup-protected-files.ps1`,
the in-app git backup + `detect-repo-sync.ps1`, `backup-policy.json` tiers, `docs/BACKUP_POLICY.md`) and
asked of each: does it protect data, does it fail closed on a bad/partial snapshot, and is its status
honest? **Verdict: tested, holds.** No consequential break found in this category; the one real fix this
session came from the paired privacy probe (see `docs/audit/privacy-secrets-probe.md`).

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Restore point** (timestamped snapshot of an explicit protected set + `manifest.json`) — `scripts/backup-protected-files.ps1` (T0) | machinery-enforced; passive/non-gating by design | `app/tests/scripts/backup.spec.js` (7) — **re-run green this session** (17 total w/ journal+schema). Live dogfood this session: restore point `20260716-042828`, 104 files. | Git-independent local insurance before a risky cycle | passive by design (nothing blocks on it) — correct for insurance |
| **Restore fails closed on a bad snapshot** — abort BEFORE touching any live file if the manifest is missing, the point doesn't exist, or a listed file is absent | machinery-enforced | `backup.spec.js`: *restore ABORTS before any change if a snapshotted file is missing*; *fails closed when manifest missing*; *fails closed for a non-existent point* — all green this session | A corrupt/partial restore point can never half-overwrite good state (Rule 7, protect-data) | none material — restore is all-or-nothing |
| **Mandatory pre-work restore-point discipline** — `docs/BACKUP_POLICY.md` triggers (start of session, before batch edits, before history-rewriting git ops) | **prose-only** (a rule an LLM/owner follows, not enforced) | `CLAUDE.md` + `docs/BACKUP_POLICY.md`; the policy travels to every project (`scaffold-kit.spec.js` asserts `docs/BACKUP_POLICY.md` is born with a new project) | Cheap insurance is taken before damage, not after | **the discipline is not machine-enforced** — see "Probed, not built" below. Low consequence: restore points are cheap and the git commit trail is the primary net |
| **In-app git backup + honest sync status** — the "Back up" button commits/pushes; `detect-repo-sync.ps1` reports ahead/behind/clean vs the real remote head | machinery-enforced (status) + evidence-leaving | `detect-repo-sync` feeds the always-visible "Backed up" trust chip; push-failure path tested (`sync.spec.js`, T3 closed per PROJECT.md — CI-covered, not re-run this session) | Git is the primary + off-machine backup; status is real, never a painted green | the "Back up" button commits WIP with `--no-verify` (intentional snapshots) — disclosed in the bypass-evidence grid; caught server-side by the CI trailer audit if a WIP snapshot carries T0/T1 |
| **Backup tiers** (`local-only` vs `remote-backed`) — a fresh project with no remote is `local-only`, so the app shows "Local checkpointed" instead of a false "Push FAILED" nag | machinery-enforced | `backup-policy.json`; `scaffold-kit.spec.js` — *new project is born on the local-only tier* (green this session) | Kills a babysitting-creating false alarm; backup honesty matches reality (yardstick #1, #4) | none material |

## Probed, not built (judged, disclosed — not painted green)
- **Restore-point discipline is prose, not machinery.** `BACKUP_POLICY.md` says a restore point is
  "not optional" before risky cycles, but nothing *enforces* it — a worker can skip it. **Judged: do not
  build a gate.** (1) The primary recovery net is the git commit trail, which *is* enforced (pre-commit +
  CI + branch protection) and independent of restore points. (2) Restore points are cheap, passive
  insurance whose *absence* costs nothing unless an uncommitted risky edit also corrupts a protected file
  in the same window — a narrow case already covered by `.prev` retention + journal replay (see the
  recovery-rollback grid). A blocking "did you take a restore point?" gate would add friction to every
  session for a tail risk, failing the measurably-improve / anti-over-governance bar (yardstick #2). Noted
  as a live option **if** a real "lost uncommitted work" incident ever occurs. This session dogfooded the
  policy (restore point taken at session start), which is the intended cooperative-worker behaviour.
- **No automatic pruning of old restore points.** By design (`BACKUP_POLICY.md`: "disposable... prune
  manually"). Low consequence — git is canonical history; restore points are small. Not built.

## Verdict against the integrity contract
Backup & recovery is **strong and tested-holds.** The restore path is machinery-enforced and fails closed
before any change on a bad snapshot (Rule 7 protect-data / Rule 4 malformed-fails-closed); the in-app git
backup and tier logic report honest status (Rule 6 displayed-truth); every piece travels to spawned
projects (parity, `scaffold-kit.spec.js`). The one non-enforced practice (restore-point discipline) is
disclosed as prose with a reasoned decision not to gate it. **Recorded strong; no control built in this
category** — the phase's expected, most-common outcome.
