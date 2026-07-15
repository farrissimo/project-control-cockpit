# Stakes classification — Claude's independent pass (2026-07-14)

**Status:** One of two independent, blind passes. To be reconciled against GPT's
independent pass (neither saw the other). This is **not** the final manifest — it is
evidence for it. Draft; wired to nothing; nothing committed.

**Method (self-defined criteria, not owner-picked):** importance is derived from repo
evidence on five objective signals, weighted toward what the repo *already declares*:
1. **Declared authority** — the repo explicitly names it canonical / protected /
   high-stakes / must-not-change / integrity-critical.
2. **Blast radius** — how many things route through it (dependency fan-in; single points
   everything funnels through).
3. **Irreversibility / data-risk** — it writes durable state, or is a durability primitive
   (damage is hard to recover).
4. **Governance/meta** — changing it changes the *rules* of the system (CI, hooks,
   schemas, the standards, the governor's own config).
5. **Convergence** — multiple independent authorities point at the same file. This is the
   strongest signal and does most of the work below.

Tier labels are mine (Critical / High / Normal / Low); GPT defines its own; the final
scheme is settled by mapping the two, not by hand-picking.

---

## Tier: CRITICAL — the integrity floor

Multiple independent authorities converge here, and damage is hard to reverse or changes
the truth-machinery itself. A change touching these should demand the top proof level
(independent verification + tests + CI green on the exact commit).

| Item | Why (converging evidence) |
|---|---|
| `app/state/atomic-store.js` | Durability primitive — **every** durable JS write routes through it (fan-in 3: main, chat-store, chat-bootstrap). Proof **M1** + **FI-4**. Only file besides ci-status with unit+mutation+failure triple-coverage. |
| `scripts/lib/atomic-write.ps1` | PS durability-primitive mirror — every PS durable write reaches it directly or via state-journal. Protected pattern (`scripts/*.ps1`). |
| `scripts/lib/state-journal.ps1` | The paired task/project-state write-ahead consistency window. Proof **FI-1** + **FI-2**; fan-in 4. |
| `.cockpit/state/project-state.json`, `task-state.json` | Declared canonical **"V1 backbone"** (STATE_MODEL); schema-governed + schema-checked; in the protected-backup set; named `must_not_change` in `app-build-scope.json`. |
| `app/ci-status.js` + `scripts/ci-status.ps1` | The Verified/CI truth path — the anti-fake-green exact-SHA authority. Proof **M2** + **FI-6**. |
| `app/renderer/verification-parse.js` | Defines "what counts as verified." Proof **M4** (trust only local execution) + **M5** (dirty-tree invalidates prior verification). |
| `app/authority-logic.js` + `app/authority-store.js` | Execution authority — the control born from the off-the-rails incident (DECISION-112). Proof **M3**. |
| `schemas/*.schema.json` | Structural authorities — a schema change changes what state is *valid*. `check-schemas.ps1` calls the core three "PCC's canonical runtime JSON files." |
| **Governance/meta:** `.github/workflows/ci.yml`, `.githooks/**`, `scripts/check-adr.ps1`, `scripts/check-schemas.ps1`, `docs/DECISION_AND_CHANGE_STANDARD.md`, `docs/ENGINEERING_ASSURANCE_PLAN.md`, `scripts/backup-protected-files.ps1`, `.cockpit/state/high-stakes-rules.json`, `.cockpit/state/app-build-scope.json` | These *are the rules.* CI is the declared execution proof (DECISION-105); the standards define "done"; the last three are the governor's own config — **the governed entity must never quietly edit its own governor** (GPT tightening §10.1). |

## Tier: HIGH — canonical authority

Canonical writers, high-fan-in hubs, and the repo's own declared high-stakes docs. Strong
proof, but a notch below the integrity floor.

| Item | Why |
|---|---|
| `app/main.js` | JS hub (14 internal requires; sole IPC/state funnel) + canonical writer of several domains: registry `projects.json`, `PROJECT.md`, lifecycle pin, `authority-store.json`, chat mirror. *Caveat: only e2e coverage; 86 KB monolith — see borderline #3.* |
| `app/state/chat-store.js` (+ `chat-bootstrap.js`, `chat-service.js`, `chat-migrate.js`) | Canonical chat writer; revision-CAS + `.prev` recovery. Proof **FI-3**. |
| `scripts/advance-cockpit-state.ps1`, `scripts/finalize-worker-handback.ps1` | Canonical paired task+project-state writers (through state-journal). |
| `scripts/lifecycle-advance.ps1` | Canonical `lifecycle-state.json` writer. |
| `scripts/log-event.ps1` | Append-only event-log writer; fan-in 5. |
| `scripts/doctor.ps1` | Health aggregator; fan-in 5; fans out to validate-state / restart-safety / check-schemas / check-adr. |
| `scripts/run-release-gate.ps1`, `run-guarded.ps1`, `run-mutation-proof.ps1`, `run-failure-injection.ps1` | The proof machinery itself. |
| `docs/DECISIONS.md`, `CLAUDE.md`, `AGENTS.md`, `PROJECT.md` | The repo's **own** declared `high_stakes_globs` (`high-stakes-rules.json`). *PROJECT.md caveat — see borderline #2.* |
| `.cockpit/state/lifecycle-model.json`, `lifecycle-state.json`, `doc-freshness-map.json`, `models.json`, `vision-promises.json` | Canonical live-state authorities (non-backbone). |

## Tier: NORMAL — product default

Everything not otherwise classified. Real product/logic code and most scripts/tests/docs.
Gets normal proof (a real test or visible result), never zero.

- `app/` modules: `chat-summary.js`, `chat-recall.js`, `single-flight.js`, `stream-json.js`, `backup-policy.js`, `renderer/overview-logic.js`, `renderer/renderer.js`, `preload.js`, `state/mutex.js`.
- Detectors (`detect-*`), generators (`generate-*`), and the remaining orchestration scripts.
- Canonical docs under `docs/` not in the high-stakes set.
- The test suites — **with the escalation caveat:** removing or materially weakening a test escalates the change (GPT tightening §10.1), because that edits the proof itself.

## Tier: LOW — expected / noise

Near-zero governance by design.

- `backlog/IDEAS.md`, `backlog/details/`
- `docs/proposals/`, `docs/brainstorms/`
- `archive/`
- Generated/derived, non-authoritative: `dashboard/index.html`, `.cockpit/evidence/*` receipts (git-ignored), `.cockpit/logs/*`, `.cockpit/backups/*` (STATE_MODEL declares these non-canonical).

---

## Divergence & borderline findings (honest flags for reconciliation)

1. **The repo's own declared high-stakes list is doc-weighted and MISSES the code
   integrity floor.** `high-stakes-rules.json` covers docs + core state + hooks — but
   **not** `atomic-store.js`, `ci-status`, `state-journal.ps1`, `verification-parse.js`,
   or the authority logic, which the mutation and failure-injection proofs *already treat
   as integrity-critical.* So PCC's existing declared manifest under-covers what its own
   proofs protect. **This is the single most important finding:** the "importance" signal
   is currently split — declared-in-config (doc-heavy) vs. proven-in-machinery
   (code-heavy) — and nobody has merged them. My pass merges them. This is exactly the
   kind of gap the two-pass method exists to surface; I expect GPT to hit it too.
2. **`PROJECT.md` is declared high-stakes but is a high-churn live brief.** Gating every
   routine status edit at "High" would add friction to something updated constantly. Its
   *factual/state claims* matter; routine brief updates are low-risk. Candidate for a
   sub-rule rather than a flat tier. Flag for reconciliation.
3. **`app/main.js` is too big for one tier.** Its authority/registry/state-writing
   sections are Critical-adjacent; much of the rest is High/Normal. File-level tiering is
   coarse here — this is the concrete case for the function-level residual noted in the
   main proposal (§5.1 / §10.1).
4. **High-fan-in orchestrators with NO direct test coverage:** `close-out-verified-task`,
   `finalize-worker-handback`, `safe-stop`, `check-stop-conditions`,
   `codex-verify-watcher`, `second-opinion`, and the request/process pair scripts. They
   are important *by responsibility and fan-in* yet only exercised indirectly. That's
   important-**and**-under-proven — both a classification input (governance should demand
   more here) and a standalone testing-gap worth recording.

---

## What reconciliation does next

Place this pass beside GPT's independent pass and:
- **Agreement** (both rank an item Critical/High independently) → high-confidence, goes
  straight into the manifest at that tier.
- **Divergence** → the review list; the disagreement is the signal, adjudicated on the
  evidence (or by the owner where it's a genuine judgment call).
- **Bucket labels** settled by mapping the two independent schemes onto each other — not
  hand-picked.

The output is a manifest whose tiers were derived twice, independently, from repo
evidence — reproducible and re-runnable when the project changes, which is the whole point.
