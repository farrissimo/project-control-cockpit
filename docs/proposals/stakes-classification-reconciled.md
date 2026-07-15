# Stakes classification — reconciled (Claude × GPT, 2026-07-14)

**Status:** Reconciliation of two independent, blind passes
([Claude's](stakes-classification-claude-pass.md) and GPT's). This is the **near-final
manifest basis** — pending owner review and an ADR before anything is wired. Draft;
nothing committed.

---

## The headline: the two blind passes converged on the top

Independently, with neither seeing the other, both passes ranked **the same code
"integrity floor" at the very top**: the canonical state backbone, the durable-write
primitive (`atomic-store.js`), the CI/Verified exact-SHA truth path (`ci-status`), the
verification interpreter (`verification-parse.js`), the execution-authority logic, the
state-advancement writers, the CI/guarded-test entrypoints, and the release gate. Both
also independently reached the **same self-protection rule**: the governor and its own
manifest must sit at the maximum tier, because the governed entity must never quietly
edit its own rules.

That convergence is the payoff. It also **confirms my most important single finding**:
PCC's *own declared* high-stakes list (`high-stakes-rules.json`) is doc-weighted and omits
that entire code integrity floor — yet two independent evidence-based passes both put it
at the top. The declared config manifest under-covers what the project's real machinery
protects. The reconciled manifest fixes that by merging declared + structural + proof
signals.

Where the passes agree, confidence is high and it goes straight in. Where they diverged,
the divergences were small and are adjudicated below.

---

## Reconciled tier scheme (adopting GPT's finer 5-tier split)

My pass used 4 tiers; GPT used 5. GPT's is **objectively better-resolved** and I'm
adopting it: it separates the *trust root* (the rules themselves) from the *runtime that
operates on them*, and separates *control-surface + binding policy* from *ordinary
support*. Labels are the reconciled mapping of two independent schemes — not hand-picked.

| Tier | Name | My-pass equivalent | Proof floor |
|---|---|---|---|
| **T0** | Constitutional / trust root | Critical | Full: independent verify + focused + full suite + exact-commit CI + failure-injection/live where applicable |
| **T1** | Integrity-critical runtime | Critical/High | Strong: independent verify + focused regression + integration + exact-commit CI |
| **T2** | Control-surface & binding policy | High/Normal | Moderate: focused tests/validation + CI; independent review when trust-presentation or binding policy changes |
| **T3** | Supporting implementation & evidence | Normal | Normal: relevant tests + CI |
| **T4** | Informational / low-consequence | Low | Free-moving; validate only if it makes a binding claim |

A path tier is a **minimum**, never the whole story — the escalation rules below do as
much work as the map.

---

## High-confidence classification (both passes agree → manifest-ready)

**T0 — constitutional / trust root**
- `.cockpit/state/project-state.json`, `task-state.json` (+ `.prev`) — canonical backbone
- `.cockpit/state/project-id.json` — project identity (misroute = wrong-project data). *GPT add, verified real (chat-store.js:154).*
- `app/state/atomic-store.js` — durable-write primitive (M1 + FI-4)
- `scripts/lib/atomic-write.ps1` + `scripts/lib/state-journal.ps1` — PS durability + paired-write journal (FI-1/FI-2)
- `app/ci-status.js` + `scripts/ci-status.ps1` — CI/Verified exact-SHA authority (M2 + FI-6) *(divergence resolved below → both T0)*
- `app/renderer/verification-parse.js` — verification interpreter (M4 + M5)
- `app/authority-logic.js` + `app/authority-store.js` — execution authority (M3)
- `scripts/advance-cockpit-state.ps1`, `scripts/finalize-worker-handback.ps1`, `scripts/lifecycle-advance.ps1` — state-advancement writers
- `scripts/verify-evidence.ps1`, `scripts/run-release-gate.ps1`, `scripts/run-guarded.ps1`, `app/tools/guarded-test.js` — proof/gate entrypoints
- `.github/workflows/**`, `app/package-lock.json` — clean-machine execution proof
- Schemas governing canonical state + proof acceptance: `schemas/project-state`, `task-state`, `verification-result`, `release-gate` *(schema-granularity divergence resolved below)*
- **The future governor, stakes manifest, required-proof table, and exception ledger** — max tier, self-protecting, by both passes

**T1 — integrity-critical runtime**
- `app/main.js` (whole file T1; auto-escalate to T0 when the diff touches persistence / authority / verification / project-routing / worker-spawn / state-mutation / test-isolation / write-capable IPC — *both passes independently reached this exact rule*)
- `app/preload.js` + write/authority/worker/verification IPC handlers
- project registry + switching (`projects.json`, registry code in main.js)
- `scripts/bootstrap-project.ps1` + New-Project scaffolding + `app/package.json` `build.extraResources` (propagation to every new project)
- other `schemas/**` (structural authorities not in T0)
- `app/ci-status.js` consumers, `scripts/validate-cockpit-state.ps1`
- `scripts/backup-protected-files.ps1` + restore machinery, `.githooks/**`
- test-isolation infrastructure (`tests/helpers/launch.js`, shadow-storage routing)

**T2 — control-surface & binding policy**
- renderer trust/status/authority/recovery *logic* (`renderer.js`, `overview-logic.js`) — the false-green surface (this is where today's demonstrated authority-banner defect lives)
- detectors (`detect-*.ps1`) — advisory now; the ones the gate consumes (e.g. `detect-repo-sync`) escalate to T1
- `scripts/doctor.ps1` (never gates), `scripts/check-adr.ps1`
- `scripts/run-mutation-proof.ps1`, `scripts/run-failure-injection.ps1` (harnesses)
- `AGENTS.md`, `CLAUDE.md` (auto-loaded into every agent session)
- binding architecture/policy docs: `STATE_MODEL`, `ARCHITECTURE`, `ENGINEERING_ASSURANCE_PLAN`, `DECISION_AND_CHANGE_STANDARD`, `REPO_GOVERNANCE`, `TRUST_CALIBRATION`, `EXECUTION_AUTHORITY_MODEL`, `HANDOFF_PACKET_SPEC`, `BRR_POLICY`, `docs/adr/**`, `docs/specs/README.md` + active specs

**T3 — supporting implementation & evidence**
- ordinary app modules: `chat-summary.js`, `chat-recall.js`, `backup-policy.js`, `single-flight.js`, `stream-json.js`, `mutex.js`, non-authoritative render helpers
- most tests/fixtures (**escalate on weakening — see rules**)
- generated handoff/result/evidence artifacts, logs, completed specs, immutable archives

**T4 — informational / low-consequence**
- `backlog/**`, `docs/proposals/**`, `docs/brainstorms/**`
- archived/superseded material (destructive edits escalate — see rules)
- cosmetic-only CSS/assets, wording-only README/doc changes

---

## Divergences, adjudicated

| Item | Claude | GPT | Ruling + reason |
|---|---|---|---|
| **`app/state/chat-store.js` (+ service/bootstrap/migrate)** | High | T0 | **→ T0.** GPT's case wins: it's the durable authority for first-class chat history with its own revision-CAS + `.prev` recovery + project-identity binding (FI-3). Data loss / false-empty / wrong-project append are exactly the silent-failure class T0 exists for. |
| **`app/ci-status.js` vs `scripts/ci-status.ps1`** | both Critical | ps1 T0, js T1 (inconsistent) | **→ both T0.** Mutation proof M2 targets `app/ci-status.js:mapCiStatusToChip` specifically — the strongest possible signal it's integrity-floor. Splitting them would let the anti-fake-green core drift. |
| **Schemas** | all Critical | canonical/proof schemas T0, rest T1 | **→ GPT's split.** A `task-state` schema change ≠ a `vision-promises` schema change. Canonical-state + proof-acceptance schemas = T0; others = T1. |
| **Tier count** | 4 | 5 | **→ 5.** Finer resolution is more accurate and still lean. |
| **`PROJECT.md`** | High, flagged churn | (unresolved) | **→ T2 with a churn sub-rule.** Declared high-stakes, but a live brief updated constantly. Its *factual/state claims* matter; routine brief edits are low-risk. Needs a content sub-rule, not a flat gate. Open item. |

Neither pass produced a *contradiction* — every divergence was a granularity or placement nuance, resolved on evidence. That itself is a strong signal the classification is real.

---

## What GPT added that is objectively better (adopted)

Per the owner's standing question — is anything genuinely better than our plan — these are
real additions from GPT's pass, not restatements:

1. **Two governance modes, not one.** A git-diff classifier sees *source* changes — but
   canonical state (`project-state.json`, `project-id.json`, chat stores) is often modified
   *outside a commit* and can be git-ignored. So the governor needs **(a) change
   governance** (classify files in a diff) **and (b) runtime integrity** (validate live
   `.cockpit` state + receipts independently). A path manifest alone cannot protect
   out-of-commit state. This is a real hole my pass didn't surface. **Fold into the main
   proposal's governor design.**
2. **Per-project extension manifest.** Because PCC scaffolds *other* projects (which will
   have their own DB, payment code, deploy keys), the base map can't know their
   authorities. Each spawned project should carry a short owner-legible manifest declaring
   its own T0/T1 paths; unknown files default-middle, never trivial. This directly answers
   the owner's "goal posts move / new projects emerge" concern **and** the DECISION-113
   parity principle. **Adopt.**
3. **Docs-by-role, not by extension.** A brainstorm `.md` is T4; an authority model `.md`
   loaded into every agent session is T2. Classify named governing docs individually.
   Cleaner than my flatter treatment. **Adopt.**
4. **Richer escalation rules.** GPT's set is a superset of the main proposal's §10.1. New
   ones worth adding: a *mixed* diff (low-tier file + high-tier file) adopts the **highest**
   tier; destructive edits to historical evidence escalate; and **touching any line that
   presents PASS/FAIL/UNKNOWN/verified/safe/recovered/authorized to the owner escalates**
   (the trust-display rule — directly relevant to today's authority-banner defect).
5. **Explicit per-tier proof ladder** (its §5) — the concrete required-check set per tier,
   which becomes the governor's "required proof" table. **Adopt as the mapping.**

## Where the passes independently agreed on the *borderlines* (also high-confidence)

- **`main.js` is too big for one tier** — both reached identical T1-with-escalation logic.
- **Tests are an attack surface on assurance** — both: default T3, escalate when a diff
  weakens/removes an assertion covering T0/T1 behavior. (My pass added the concrete gap:
  several high-fan-in orchestrators — `close-out-verified-task`, `finalize-worker-handback`,
  `safe-stop`, `codex-verify-watcher` — are high-tier by responsibility yet have **no
  direct test coverage.** High-tier *and* under-proven: governance should demand more there,
  and it's a standalone testing gap to record.)
- **Detectors are advisory today but become T1 the moment the gate requires them.**

---

## Leanness guardrail (the CCB tripwire)

GPT's pass is thorough — 5 tiers, 14 escalation rules, per-tier proof ladders, dual-mode,
extension manifests. Adopt the **substance**, but the *implementation* must stay lean or we
recreate the disease we're curing. Concretely: the manifest stays **a short,
owner-legible path→tier list plus a handful of deterministic escalation rules** — not a
sprawling policy engine. If the owner can't read the manifest and understand it, it's
already too complex. The tiers are proportional on purpose: T4 stays nearly frictionless;
only T0/T1 carry real weight.

## Open items before this becomes the manifest

1. **Owner review** of the path map — especially the T0/T1 line and the `PROJECT.md`
   churn sub-rule.
2. **Verify a few asserted paths** exist as classified in *this* repo vs. per-project
   runtime (e.g. `project-id.json` is per-project runtime, not a home-repo tracked file —
   which is itself why dual-mode governance is needed).
3. **Decide granularity ceiling:** start at file/path level (both passes agree this is the
   safe first cut); revisit function-level only if a real miss proves it necessary.

---

## Final consequence chain (both passes independently drew the same one)

```
agent instructions / owner intent
  → execution authority
  → project & task state (+ identity)
  → directive & worker execution
  → evidence & verification
  → state advancement
  → CI & release acceptance
  → packaging / propagation to future projects
```

Protect the first six strongly (T0/T1), keep the seventh and eighth (trust display,
binding policy) honest (T2), test the ninth normally (T3), leave the tenth nearly
frictionless (T4). That is the proportional boundary the repo's own architecture and
incident history already imply — now derived twice, independently, and reconciled.
