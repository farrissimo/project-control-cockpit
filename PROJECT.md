# PROJECT.md — current project brief

Read this first. Always-current summary so a new session starts fully oriented,
with no re-briefing from the owner. (Last refreshed 2026-07-16.) This file records
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

## Current phase (2026-07-15): Operational Trust Qualification & Adoption — the FINAL phase (ADR-0009)
This is the project's culminating phase — the "final boss." Goal: prove PCC well enough that the owner
**signs off he has the faith/trust to adopt it** as his standard way of building LLM projects (as a
non-coder). Decision + rules: **`docs/adr/0009-trust-signoff-audit.md`**. The **standardization audit is
ONE workstream** (exhaustive categories, canonical principles yardstick, risk-based depth, per-practice
grid of machinery-enforced / evidence-leaving / prose-only + proof + benefit + gaps); the phase **also**
proves PCC end-to-end on a real, **adversarially-tested spawned-project build** + real adoption
(package → install → use outside the checkout). Two sign-off gates: a proven owner-facing report **and**
that live build; the trust claim stays **bounded** (tested workflows + documented boundaries + accepted
residues), never "any project." Owner signs off only on outcomes he can judge; Claude + Codex own
technical calibration; GPT secondary verification fires on the defined trigger.

**OPERATING RULE (ADR-0009 amendment, PR #22): "probe freely, standardize rarely."** Owner + GPT flagged
the risk of standardization for its own sake. Unbundle **probing** (finding out whether it works — cheap;
"tested, holds" is a first-class outcome, expected to be the most common) from **durable control** (build
ONLY when it clearly improves — moves a number / kills a real risk; else note + move on). The category list
is a **checklist of where to look**, not grids to fill. **Owner directive: if the lighter path zips through
categories finding nothing, STOP and assess.** Full principle: `docs/audit/README.md`.

**Phase progress is tracked as DATA** in `.cockpit/state/phase-manifest.json` (22 audit categories + 2
sign-off gates), so `scripts/new-milestone-update.ps1` computes a real `% complete` and never invents it
(a slice counts `done` only with an `evidence` pointer). Per-category grids live in **`docs/audit/`**
(`README.md` = index + tracker). **Check the live % directly** (run the generator) — don't trust a number
written here.

**Audit categories done (as of 2026-07-16): 12 of 22** (the live meter reads 12/24 = 50% including the 2
sign-off gates). Each produced a real finding OR converted an assumption to proof, not box-ticking:
- **Communication contracts** (PRs #16/#18/#19) — built the milestone-update + verification-request
  generators (structure→machinery); they travel to spawned projects. `docs/specs/communication-contracts.md`.
- **State & data integrity** (PR #21) — strong; closed 2 T0-files-without-tests (backup + schema-check) and
  fixed a docstring that lied about being a gate. `docs/audit/state-data-integrity.md`.
- **Verification & proof-of-done** (PR #23) — built `scripts/check-branch-protection.ps1`, converting the
  owner-asserted branch-protection precondition (O1) into a **live-checked fact** (ran live → PASS).
- **Execution authority & worker safety** (PR #24) — attacked persuadable-bypass; pinned the read-only
  deny-list (the #1-concern mechanism that had **zero** tests) via `app/authority-tool-profile.js` + test.
- **Honesty & anti-fake-green** — verified the 3 metric-honesty soft-spot fixes hold AND are test-pinned;
  attack found the ONE gap: the phase-progress `% complete` meter (`scripts/new-milestone-update.ps1` —
  the number that gates the owner's sign-off) had **zero** tests on its fail-closed logic → built
  `app/tests/scripts/milestone-generator.spec.js` (12 tests, CI-run). `docs/audit/honesty-anti-fake-green.md`.
- **Bypass evidence & tamper-detection** — the deterministic-trail half is strong/tested (ledgers
  git-staged + auditable, CI trailer audit FAILs forged/missing/mismatched). Found the ONE gap on the
  **owner-visible** half: the branch-protection **linchpin** was silently non-functional (`check-branch-protection.ps1`
  used `Get-Command gh`, but `gh` is off PATH → always UNKNOWN) **and** unsurfaced → added a `Resolve-Gh`
  fallback (now reaches the API instead of always-UNKNOWN; PASS on this authenticated machine, UNKNOWN
  when unauthenticated — fail-closed) + wired it into the **release gate** as a required fail-closed check
  (off → gate FAIL, unconfirmable → UNKNOWN). `docs/audit/bypass-evidence-tamper-detection.md`.
- **Backup & recovery** + **Recovery, rollback & damage-repair** + **Multi-project scaffolding & parity**
  (PR #29) — all three **tested-holds** (re-run green this session: backup 7, journal 6, atomic-store 16,
  scaffold-kit 34, schema 4); no control built, the expected probe-freely/standardize-rarely outcome.
- **Privacy, secrets & access control** — **quick probe only** (full category still open): found + fixed the
  ONE real defect — AGENTS.md claimed "Env is git-ignored" but `.env` was NOT ignored (a fake-green that
  travels to every spawned project via bootstrap's `.gitignore` copy) → added a secrets block to `.gitignore`
  (`git check-ignore .env` flips not-ignored→ignored; `.env.example` kept). PCC itself holds no secrets
  (scrubs API keys, DECISION-003). `docs/audit/privacy-secrets-probe.md`.
- **Requirements / intent & acceptance** — accepted-residue by DELIBERATE decision (ADR-0003): the
  intent→spec→acceptance→test chain is prose-not-machinery on purpose; the enforced "done" gate binds to
  execution-proof-of-diff, not to the owner's criteria, so a worker can build the wrong thing and pass every
  automated gate. Named as a residual risk for owner active-acceptance (backstop is human + gate b). No build.
  `docs/audit/requirements-intent-acceptance.md`.
- **External dependency / tool availability** — tested-holds (strong): worker/Codex/gh/CI/git/npm all degrade
  to honest UNKNOWN/error, proven never to fake a green. One disclosed residue: `codex-verify-watcher.ps1`
  (retired advisor track, owner-run) has no timeout on its bare `codex exec` — silent stop, never a false PASS.
  `docs/audit/external-dependency-availability.md`.
- **Incident response & diagnostics** — **found a real break → built the minimum control.** Security-relevant
  app failures were swallowed with zero trace (no-swallowed-failures violation) + no app-error log → built
  `app/error-log.js` (never-throws, 6 tests) + rerouted the 3 worst `main.js` swallows to a durable trace +
  `doctor.ps1` "App errors" WARN surface + git-ignored the log; app boots green (ipc 27).
  `docs/audit/incident-response-diagnostics.md`.

**Next (owner picks):** more audit categories (10 of 22 remain), or **sign-off gate (b)** — the live end-to-end
adversarial spawned-project build + adoption (the gate that actually earns the owner's sign-off). Open
sub-items noted in the grids (e.g. comms channel 6 start-off measurement; the branch-protection check is
now wired into the **release gate** — the **trust-strip** surface remains an open lighter follow-up).

### Predecessor phase (COMPLETE): Governance Standardization
Made PCC's safeguards fire predictably, proportionally, self-enforcing — not prose an LLM can skip.
Full assessment: `docs/proposals/governance-standardization.md`. All slices shipped (below), incl.
Governance Hardening (A/A.1/B, ADR-0006/0007/0008). This is now history; the details remain for reference.

Shipped this phase (all on `main`, CI-green, independently Codex-verified):
- **Metric-honesty audit** (`docs/proposals/metric-honesty-audit.md`) — every visible app
  metric classified backed / declared / fakeable. All 3 false-green soft-spots FIXED: the
  detector "green-over-unchecked" cases (`90cd2e0`) and the lying authority banner
  (`d75eef3`). Most metrics were already honest/fail-closed.
- **Branch protection ON** — `main` now requires the `test` CI check + a pull request (the
  server-side backstop; un-bypassable only while branch protection stays active + required and work
  enters via PR — the system does not self-verify this, so it is an owner-confirmed assumption, per
  Governance Hardening O1). Direct pushes to `main` are rejected (verified live). `gh` CLI is
  authenticated on this machine; the worker opens+merges its own PRs through the CI gate
  (Option B — it cannot merge anything red).
- **ADR-0006 (Accepted)** — the governor design: proportional, path-tagged gate; stakes as
  data; surface-everywhere + gate-the-risky; receipt-as-contract; dual change/runtime modes;
  anti-CCB leanness rule + a measurable kill-switch.
- **Governor slice 1** (`0c38168`) — the stakes manifest (`.cockpit/state/stakes-manifest.json`,
  path globs→tiers T0..T4 + escalation rules) + the deterministic classifier
  (`scripts/classify-stakes.ps1`, 13 tests). It CLASSIFIES a change's tier from WHICH files it
  touches (a git fact, ungameable by self-rating). It does NOT gate yet.
- **Governor slice 2 — Surface** (`027b29f`, PR #6) — the classifier's verdict is now shown
  LIVE in the app: a "Change stakes (governor)" card at the top of the Signals tab shows the
  current change's tier (T0..T4), why, escalations, and touched files. Pure consumer
  (`pcc:stakes` IPC → preload → `app/renderer/stakes-view.js`, a unit-tested view-model);
  fails closed to UNKNOWN, and "no change in flight" is an honest empty state, not a fake T3.
  It NEVER blocks (says so on the card). Does not touch the classifier/manifest, so it stayed
  T1 (off the T0 `governor_self_edit` path). Spec: `docs/specs/governor-surface.md`. Codex
  caught a real serialization bug in review (stakes awaited before detectors) — fixed to
  fetch both concurrently.
- **Governor slice 3 — Gate** (the teeth) — at the commit boundary, block ONLY a tagged-crucial
  (T0/T1) staged change that lacks a valid, diff-bound **verification receipt**; T2/T3/T4 pass
  untouched (proportional). Pieces (all thin consumers, no runtime LLM): the receipt contract
  (`schemas/verification-receipt.schema.json`, written to git-ignored
  `.cockpit/evidence/verification-receipt.json` by `scripts/write-verification-receipt.ps1`),
  bound to exact repo/base/head/**diff_id** (the SHA-256 of the staged index tree) so any later
  change invalidates it; the gate (`scripts/run-governance-gate.ps1`) which reuses the shipped
  classifier for the tier and a shared identity helper (`scripts/lib/change-identity.ps1`) so the
  writer + gate can't drift; a disclosed exact-diff_id bypass ledger
  (`.cockpit/state/governance-gate-exceptions.json`); wired into `.githooks/pre-commit`
  (deterministic, no app launch). Spec: `docs/specs/governor-gate.md`; tests:
  `app/tests/scripts/governance-gate.spec.js` (13, all 8 ACs). Honest residue (surfaced, not
  hidden): the local receipt is worker-attested — it makes the silent-skip default impossible but
  the server-side proof (un-bypassable only under the branch-protection preconditions in Governance
  Hardening O1/O2) stays CI + branch protection. This slice is itself T0 (touches hooks +
  schemas + the governor), so it was dogfooded: built → Codex-verified → a receipt written for its
  own diff → committed through the gate it installs.
- **Governor slice 4 — durable, CI-audited trailer** (ADR-0007) — closes the gap the re-measure
  exposed: the Gate's receipt is git-ignored/transient, so it left NO after-the-fact-checkable
  trail (the baseline metric didn't move even for the Gate's own commit). Fix: a `commit-msg` hook
  (`scripts/emit-verification-trailer.ps1`) records a **`Verified-Receipt: base=… diff_id=…
  verdict=PASS|BYPASS verifier=…`** trailer IN the commit; `scripts/audit-verification-trailers.ps1`
  re-derives each non-merge T0/T1 commit's diff_id (base→commit, ledger-excluded, `--no-renames`)
  and FAILS any missing/mismatched — wired into CI (`ci.yml`, fetch-depth 0, over
  `merge-base(origin/main,HEAD)..HEAD`) so a local `--no-verify` skip is caught server-side. Gate +
  emitter share one validator (`scripts/lib/receipt-check.ps1`). The same audit script IS the
  re-measurement tool. Spec: `docs/specs/verification-trailer.md`; tests:
  `app/tests/scripts/verification-trailer.spec.js` (10). Codex (3 rounds) found + we fixed a
  forgeable-BYPASS and a root-commit re-derivation bug; a **forged-PASS residue is owner-accepted**
  (2026-07-15) as irreducible worker-attestation, not hardened (signing = over-governance). BYPASS
  (durable proof) IS audited against the committed ledger; PASS (transient proof) can't be.

**Baseline (measured 2026-07-14; re-measured 2026-07-15):** at baseline ~100% of recent non-trivial
commits carried NO checkable, diff-bound verification receipt. The Gate alone did NOT move this (the
receipt is git-ignored/transient — even the Gate's own verified commit read as 0 durably). The
**trailer slice makes the proof durable + CI-enforced**, so the metric moves forward from here for
T0/T1 commits made after it lands. Re-measure with `scripts/audit-verification-trailers.ps1`.

**Governor slice 5 — Governance Hardening (SHIPPED 2026-07-15): `docs/proposals/governance-hardening.md`.**
An independent third verification by GPT (remote repo read, adversarial, non-led) against HEAD
`fc5964b` found real defects the local suite AND `codex exec` both missed, plus overclaiming
("fake-green") wording — the disease PCC exists to kill, in PCC's own safety net. Fixed in three
governed PRs (each codex-verified + GPT-reviewed + CI-green + dogfooded):
- **Sub-slice A** (PR #11): honesty fixes H1–H5 (qualify "un-bypassable"/"ungameable"; narrow
  "catches a forged trailer" — it does NOT catch a correctly-bound fabricated PASS; rename the audit
  measure "verified" → **"attestation"** = a valid diff-bound CLAIM of verification, not proof it
  happened; align the manifest `weakened_tests` prose to deletion-only). **T1:** the CI audit's
  `merge-base(origin/main,HEAD)..HEAD` range collapsed to `HEAD..HEAD` = empty vacuous pass on a
  direct push to `main`; fixed to use the push's real `before..sha` and **fail closed** on a
  truly-empty range. **T3:** `.githooks/pre-commit` **fails closed** when `pwsh` is missing (blocks
  any staged deletion/rename or non-noise path).
- **Sub-slice A.1** (PR #12): closed a residual GPT-found fail-open — the no-`pwsh` hook discarded git
  errors, so a failed `git diff` read as "noise only" and allowed the commit; now fails closed if
  either git query errors.
- **Sub-slice B (ADR-0008)** (this slice): **judge-from-trusted-main.** CI now runs the auditor +
  libs + classifier + manifest from a detached `origin/main` worktree, NOT the PR checkout, so a PR
  can't weaken the judge in its own tree and have the weakened judge approve itself. The audit range
  is computed inline in `ci.yml` from GitHub event context with explicit SHAs (a resolver run from the
  worktree hit an empty-range vacuous pass — caught on the first LIVE CI run — so the vestigial
  `resolve-audit-range.ps1` was removed; the range's correctness is proven by the live push +
  pull_request runs). Adversarial test AC-B2 proves a self-weakening PR PASSES under its own copy but
  FAILS under trusted `main`. `.github/CODEOWNERS` marks the governor files for owner review (O2).
Honest boundary (adopted): governance holds for a COOPERATIVE worker; an ADVERSARIAL worker with write
access is NOT fully contained. Accepted residues (do NOT machine-fix): forged PASS; path-granularity
gaming; unauthenticated bypass authz; merge-only changes; and — per ADR-0008 — `ci.yml` self-edit +
admin bypass + a pre-compromised `main` (all owner-side, not code). Spec `docs/specs/governance-hardening.md`.
- **Owner-side (the "last inch"):** **O1 — DONE (confirmed 2026-07-15):** `main` is protected by the
  GitHub ruleset `protect-main` (Active) — requires a PR + the `test` check, blocks force pushes +
  deletions, and its **bypass list is empty** (no admin bypass; in the new Rulesets UI an empty bypass
  list IS the equivalent of the legacy "do not allow bypassing"). So the "un-bypassable" precondition
  is now real. **O2 — DELIBERATELY LEFT OFF (decision 2026-07-15; Claude + `codex exec` both advised
  LEAVE_OFF, owner accepted):** required Code-Owner review would, in a single-account repo, block ALL
  governor PRs (GitHub won't let an author approve their own PR) unless a second reviewer identity is
  added; the only threat it closes (a hostile insider editing `ci.yml` to neuter the audit) is
  effectively the owner/admin in a solo repo, which O2 can't constrain anyway. O1 + judge-from-main
  (ADR-0008) + attributable git history already cover the realistic threats, so O2 is standing
  friction for a theoretical gain (fails the measurably-improve test). `.github/CODEOWNERS` is in place
  for a one-toggle enable. **Flip O2 ON if** another human gets write access, governor changes become
  frequent/high-stakes, or dual-control evidence is ever required. This is an explicit left-disabled
  decision, not an open to-do.
- After hardening: re-measure with `scripts/audit-verification-trailers.ps1` (frame as *attestation*
  coverage, not "verified"). Optional ADR-0006 remainders: continuously-verified branch-protection
  detection, runtime-integrity mode, Known Residual Risks billboard (forged-PASS + the ADR-0008
  owner-side residues belong on it). None started; owner schedules.

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
