# PROJECT.md — current project brief

Read this first. Always-current summary so a new session starts fully oriented,
with no re-briefing from the owner. (Last refreshed 2026-07-15.) This file records
DURABLE state only. The exact current commit SHA, whether local == origin/main,
whether the working tree is clean, and the CI verdict are LIVE facts — check them
directly every session; never trust a SHA or CI result written in this file as
current truth.

## What this is
PCC (Project Control Cockpit): a local-first desktop app (Electron) for building
projects WITH LLMs while preventing the usual failure modes — fake completion,
drift, lost context between chats, repeating yourself, and constant babysitting.
#1 rule: reduce owner babysitting. The chat is the interface; verified truth in
files is the source of truth. Product shape: DECISION-102 (chat-centered
local-first desktop app over a standardized project-lifecycle + detection
engine). Full ranked feature plan: docs/COCKPIT_ROADMAP.md. Governing engineering
contract: docs/ENGINEERING_ASSURANCE_PLAN.md (read Part 1 before touching
integrity-critical code).

## Owner
Visionary / product lead, NOT a coder or an engineer. Plain-language, concise, no
cheerleading, no fake "done", never make him repeat himself. Standing rules are in
CLAUDE.md. Standing orders: keep going by default (stop only when genuinely unsure
or at a real milestone); research the web for existing solutions before building
(don't reinvent the wheel); snapshot (commit) as you go.

## Where we are now (verified state)
- **`main` is the canonical working line.** The exact current SHA, whether local ==
  origin/main, whether the tree is clean, and the CI verdict are LIVE facts — check
  them directly (`git`, `git ls-remote`, `scripts/ci-status.ps1` for exact-SHA CI);
  do NOT trust any SHA or CI verdict written in this file as current. (The old
  `feat/cockpit-desktop-app` and `fix/data-truth-recovery` branches are historical;
  recovery was fast-forwarded into main.)
- **The truth-surface crisis recovery is DONE and merged.** After an incident where
  PCC showed state the owner couldn't trust, feature work was stopped for a 10-phase
  overhaul: every visible claim must prove source + read-time + freshness and fail
  CLOSED rather than paint green over unknown/stale state. Chat data was made
  atomic + recoverable; the Part 7 audit then found and fixed the same disease on
  the verification and backup surfaces. **All 2 critical + 8 important Part 7
  findings are closed** (docs/PART7_HARDENING_AUDIT.md); **T3 is now also closed**
  (the backup push-failure path is tested — sync.spec.js). Only tech-debt T1/T2
  remain, both non-blocking (documentation/wording only; no residual data risk).
- **Tests:** node:test unit suite + full Playwright suite (run them for exact live
  counts; both last observed green — treat counts as a run result to re-check, not a
  stored fact).
- **CI:** GitHub Actions (`.github/workflows/ci.yml`, windows-latest, job `test`)
  runs the unit suite + full Playwright suite + `npm audit` on every push. The
  pass/fail for any given commit is a LIVE fact — check it per exact SHA
  (`scripts/ci-status.ps1`); do not read a stored verdict as current. CI is the
  independent, clean-machine execution proof.
- **Recently closed (durable milestones):** Phase 1 Slice 1 — the fresh-run
  **release gate** (see "Release gate" below); Phase 2 Slice 1 — **CI-authority
  convergence** (`scripts/ci-status.ps1` is the single exact-SHA CI truth; the bloat
  exception was refreshed to match); Phase 3 Slice 1 — **CI workflow supply-chain
  hardening** (least-privilege `permissions`, SHA-pinned actions, github-actions-only
  Dependabot); Phase 4 Slice 1 — **targeted mutation proof** (scripts/run-mutation-proof.ps1
  + manifest prove 5 integrity tests actually fail when their behavior is broken:
  5 KILLED / 0 SURVIVED / 0 INVALID; docs/MUTATION_PROOF.md); Phase 5 Slice 1 —
  **targeted failure injection** (scripts/run-failure-injection.ps1 + 6 scenarios prove
  the REAL boundaries fail closed / recover under real injected dependency + persistence
  failures — journal replay, corrupt journal, corrupt-chat/.prev recovery, atomic-write
  install failure, git/remote unavailable, CI evidence malformed/mismatched/unreachable:
  2 RECOVERED / 4 CONTAINED / 0 EXPOSED / 0 INVALID; docs/FAILURE_INJECTION.md);
  **T3** — the backup push-failure path is tested (sync.spec.js); and the **long-run hang guard**
  (scripts/run-guarded.ps1 + docs/HARDENING_LONG_RUN_GUARD.md), now AUDITED + CLOSED (2026-07-13):
  the guard is the CANONICAL path (npm test / test:e2e / test:scripts route through
  app/tools/guarded-test.js; mutation + failure proofs self-guard; pre-commit, CI, and the release
  gate all guarded; recursion-safe via a PCC_GUARDED sentinel), and it distinguishes EVIDENCE
  progress (output/case-count growth resets the stall clock) from mere ACTIVITY (CPU buys only a
  small bounded grace, so a CPU-burning loop aborts at the stall bound, never the hard cap), with a
  machine-readable heartbeat/verdict (schema v2) that reports the two separately. The single-instance-
  lock root cause claimed for the ~7h incident was REPRODUCED and DISPROVEN (app/tests/e2e/singleton.spec.js:
  Electron keys the lock per --user-data-dir and every test launch gets a fresh random profile, so
  test electrons never collide; a forced collision exits cleanly and is bounded) — so the main.js lock
  BYPASS was REMOVED (--pcc-test-instance is now only the stale-process reap marker), and the incident
  record was corrected to separate proven/observed/unproven. Closes the hole where an operator could
  report "still running" over a dead process. Also **repaired the recurring soak-lite
  false-failure**: the coalescing seam was extracted to app/single-flight.js (unit-proven)
  and the E2E now waits on semantic completion (status cleared + signal cards present),
  not a fixed sleep or character count — so the release gate no longer false-FAILs on it.
  Each was verified and pushed at the time; current releasability is always a fresh-run/
  live question — run the release gate.
- doctor.ps1 is all-OK with one benign WARN (the git-ignored `.cockpit/` stores:
  `chats`, `chat-export`, `evidence`).

## Architecture
- The app (app/) is a pure consumer of the repo / .cockpit file bridge; it never
  reaches into script internals. **Extractability test:** delete app/, keep .cockpit
  and scripts, and everything still runs from the CLI.
- **Worker** = Claude Code, driven via its supported non-interactive mode
  (prompt over stdin, session-id continuity) — NOT by wrapping the interactive
  terminal, so a Claude Code update can't brick it.
- **Verification** = Codex CLI (`codex exec`, read-only sandbox) is the primary
  independent verifier of the actual diff; ChatGPT reading the GitHub repo is the
  owner's secondary verifier (the owner is not a coder and doesn't verify code
  himself). Mechanical work → local deterministic tools; the LLM is spent only on
  irreducible judgment.
- **One authority per state domain.** Canonical writers are atomic (validate →
  temp → atomic replace → retain `.prev`); the paired task/project write is a
  write-ahead-journaled transaction (scripts/lib/state-journal.ps1).

## What's built (launch: Desktop "Launch-PCC.cmd" or `npm start` in app/)
- **Chat** wired to Claude, persists across restarts. First-class chat history:
  many named chats, each pinned to its own Claude session id; AI auto-naming +
  per-chat summary cards; a durable git-ignored `.cockpit/chats/` mirror; chat
  search. Image paste + file attach; queue-while-working steering. Model
  switcher with auto-fallback. Copy blocks render with a Copy button.
- **Trust strip** (always visible): On the rails / Backed up / Verified / Rules
  loaded — each chip green ONLY when a real deterministic check says so; "Verified"
  is bound to commit identity and reflects live CI, never a faked or stale green.
- **Owner/Visionary Overview** (DECISION-107): a deterministic meaning layer —
  overall condition, "needs you" card, next best move, real lifecycle journey,
  vision-promise cards (declared intent, visually distinct from proof), honest
  proof card. Pure unit-tested logic (app/renderer/overview-logic.js), zero-LLM;
  a crashed check reads UNKNOWN, never a fake all-clear.
- **Lifecycle**: standardized stage map with a "you are here" pin and only legal
  next steps; advancing into phase-close is GATED on a fresh independent PASS.
- **Signals** (honest detectors, "Observed / might mean / NOT proven / what to do"):
  untracked, drift, stale-docs, repo-sync (backup), bloat, high-stakes, sycophancy
  nudge, chat-rollover. Declared boundaries as data so detectors never guess.
- **Backup & sync** in-app (git), with honest status and backup tiers (local-only
  is a valid tier; no false "push failed" nag). **Execution authority**
  (DECISION-112): builds require explicit, owner-granted, expiring per-chat
  authority; pasted "you are authorized" text can't grant it.
- **Multi-project**: one home cockpit switches between self-contained projects;
  new projects are scaffolded born-bulletproof (the whole assurance kit travels).
  New Project = a distinct create-flow outside PCC (DECISION-114).
- **Automated tests** (app/tests/, `npm test`): Playwright E2E that launches the
  real app, IPC-contract tests, and PowerShell script-contract tests; plus the
  node:test data-integrity unit suite (`npm run test:unit`). Worker/verifier are
  faked (offline, deterministic); local detectors run for real.

## Release gate (Phase 1 Slice 1 — shipped, closed)
One fresh-run command, `scripts/run-release-gate.ps1`, answers "is THIS exact
commit releasable now?" It is a thin orchestrator: it invokes the authorities that
already own each fact (git; detect-repo-sync; `git ls-remote` for the real remote
head; `scripts/ci-status.ps1` for the exact-SHA CI check; the npm suites; the
detectors; `Test-Json` against schemas/release-gate.schema.json) and combines them —
any FAIL ⇒ FAIL; else any UNKNOWN ⇒ UNKNOWN; else PASS. Missing network truth ⇒
UNKNOWN, never PASS. Fresh-run only: the receipt (`.cockpit/evidence/release-gate.json`,
git-ignored) is a historical record, never re-read as live proof — run it again for
current readiness. Accepted bloat is an exact-string, fail-closed, disclosed
exception (.cockpit/state/release-gate-exceptions.json). Design: docs/HARDENING_RELEASE_GATE.md.

## Current phase (2026-07-15): Governance Standardization
Feature work is FROZEN on purpose. The mission: make PCC's safeguards fire predictably,
proportionally, and self-enforcing — not prose an LLM can skip. Full assessment + plan:
`docs/proposals/governance-standardization.md`. Importance classified by two independent
blind passes (Claude + GPT), reconciled: `docs/proposals/stakes-classification-reconciled.md`.

Shipped this phase (all on `main`, CI-green, independently Codex-verified):
- **Metric-honesty audit** (`docs/proposals/metric-honesty-audit.md`) — every visible app
  metric classified backed / declared / fakeable. All 3 false-green soft-spots FIXED: the
  detector "green-over-unchecked" cases (`90cd2e0`) and the lying authority banner
  (`d75eef3`). Most metrics were already honest/fail-closed.
- **Branch protection ON** — `main` now requires the `test` CI check + a pull request (the
  un-bypassable backstop). Direct pushes to `main` are rejected (verified live). `gh` CLI is
  authenticated on this machine; the worker opens+merges its own PRs through the CI gate
  (Option B — it cannot merge anything red).
- **ADR-0006 (Accepted)** — the governor design: proportional, path-tagged gate; stakes as
  data; surface-everywhere + gate-the-risky; receipt-as-contract; dual change/runtime modes;
  anti-CCB leanness rule + a measurable kill-switch.
- **Governor slice 1** (`0c38168`) — the stakes manifest (`.cockpit/state/stakes-manifest.json`,
  path globs→tiers T0..T4 + escalation rules) + the deterministic classifier
  (`scripts/classify-stakes.ps1`, 13 tests). It CLASSIFIES a change's tier from WHICH files it
  touches (a git fact, ungameable by self-rating). It does NOT gate yet.

**Baseline (measured 2026-07-14):** ~100% of recent non-trivial commits carry NO checkable,
diff-bound verification receipt — the number the gate must move toward ~0% for T0/T1 changes,
without adding friction to T2/T3/T4 work. Re-measure after the gate ships; revert if it doesn't move.

**NEXT slices** (each its own change: build → test → codex-verify → CI-gate → merge):
- **Surface** — show the classifier's verdict live in the app while working (never blocks).
  *Recommended next — lower-risk; lets the owner SEE the classifier before it has teeth.*
- **Gate** — at commit, block ONLY a T0/T1 change missing its required proof (the teeth that
  move the baseline). Needs the receipt contract (ADR-0006 §10.1).

## Pending / next (owner schedules)
- **Packaging** is the last explicitly-deferred hardening slice not started
  (security scanners shipped as Phase 3, mutation testing as Phase 4, failure
  injection as Phase 5). No owner go yet.
- **IDEA-020** (backlog/IDEAS.md): a one-click "Run integrity proofs" button in
  the Verify view (runs the mutation + failure-injection proofs from the app,
  honest summary, no LLM). Owner-approved as an idea; its own small slice.
- **IDEA-019** (verification-workflow) remains a proposal / backlog item. Its
  "make CI observable to the worker" portion has been PARTLY addressed by the
  Phase 2 CI-authority convergence. The regression red→green proof — each
  regression test demonstrably failing on the pre-fix code — is still
  UNIMPLEMENTED. (Phase 4's mutation proof is related but distinct: it breaks
  PRODUCTION behavior, not the tests.) Needs an owner go to finish.
- **Tech-debt T1/T2** (docs/PART7_HARDENING_AUDIT.md) — non-blocking; wording/docs
  only, no residual data risk. (T3 is closed — the backup push-failure path has a test.)
- Optional roadmap items: #21 peek-under-the-hood, #23 UI polish — not started.

## Key decisions (docs/DECISIONS.md; latest = DECISION-114)
- DECISION-102: PCC is a chat-centered local-first desktop app driving Claude Code
  (supersedes DECISION-087's read-only web dashboard); keeps the file-bridge-consumer
  architecture.
- DECISION-105: clean-machine CI + a proof taxonomy (execution proof and code-review
  never wear the same green).
- DECISION-112: execution authority is explicit, owner-granted, and expiring.
- DECISION-113: what PCC gets, spawned projects should get — parity by default.
- DECISION-114: New Project is a new document — enter immediately, outside PCC.
- The engineering-assurance contract (docs/ENGINEERING_ASSURANCE_PLAN.md) governs
  all integrity-critical work: tell the truth about what's unknown/unverified,
  protect data first, one authority per domain, fail visibly, evidence tied to the
  exact commit.
