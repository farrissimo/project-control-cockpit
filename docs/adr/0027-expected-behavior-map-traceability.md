---
status: Accepted
date: 2026-07-28
deciders: owner (product lead), Codex (worker), Antigravity/AG (verification-first reviewer)
---

# ADR-0027: Every feature carries an Expected-Behavior Map (traceability), enforced through the workflow

## Context and Problem

On 2026-07-27 the owner pressed real cockpit buttons for the first time and immediately hit two
defects (switch-chats-while-busy silently blocked; search hits never jumped to the match). Both
features **existed, had tests, and were CI-green** — but were built to a *narrower behavior than the
owner expected*, and no test encoded the fuller expectation, so nothing caught it. This is the exact
disease PCC exists to kill (green ≠ correct), one level up: the gates prove **"the code does what its
tests say," not "the app does what the owner expects."**

Root cause is already named in the project: **ADR-0003** accepts as a residue that the
intent→spec→acceptance→test chain is prose-not-machinery — "a worker can build the wrong thing and pass
every automated gate." That residue just bit. And it has a second cost: **sign-off gate (b) (ADR-0009)
— the live end-to-end adversarial test — has no script.** Without a map of every feature, its expected
behavior, and which control triggers it, the final test is "click around from memory and hope."

Prior art is strong and was scanned (2026-07-27): **Requirements Traceability Matrix (RTM)** (map
requirement→test→status; "no requirement is missed"), **BDD Example Mapping / Three-Amigos discovery**
(map concrete example-behaviors *before* build; they become the acceptance criteria), **Definition of
Done** (not done until behaviors have passing tests, checked at completion), and **emergent
requirements + living documentation** (you *cannot* know every behavior upfront — resize-the-chat-box is
the canonical case — so the map is living, not an omniscient one-shot). The concept is not novel; the
PCC-specific part is that our "requirements" are scattered across ~254 AI dev-chat transcripts and were
never consolidated, so we build the matrix **retroactively** from an unstructured history, with
provenance and honest unknowns. We borrow the skeleton, not a SaaS tool, and keep it **lean**
(the project's anti-over-governance rule stands).

## Decision

This is now a permanent, tier-1, standard-workflow step with no shortcuts.

**Every new or changed PCC feature (and every feature in spawned projects) must carry an
Expected-Behavior Map before its idea can be formalized, and is not "done" until every mapped behavior
has a passing test — verified at completion, never deferred.**

- **Addition only:** this does not remove, replace, shorten, or modify the existing governed
  workflow. Full idea scope still comes first: objective, why it matters, in/out boundaries, repo
  truth, risks, trust boundaries, and owner approval. The Expected-Behavior Map is the required
  testing artifact inside that scope.
- **The simple rule:** every row says `what the owner does -> what the app should visibly do -> how
  we prove it`.
- **The map (lean RTM), one small table per feature**, each row: `behavior → control/interaction
  (button, selector, field, app action) → expected visible/observable result → source → status →
  test/evidence ref`.
  - **Source** is typed: **STATED** (explicit in a chat/doc — cite it), **INFERRED** (deduced — say so),
    or **REFERENCE** (imported from a reference anchor, e.g. "mimic the Claude/Codex desktop chat," which
    compactly imports a whole behavior set — resize, auto-grow, stop — without enumerating each).
  - **Status** uses the taxonomy: **A** built+tested+matches · **B** built+tested but *narrower/different*
    than expected (the #2/#3 class) · **C** built but *not* tested · **D** expected, not built, *not*
    rejected/deferred/superseded (dropped) · **E** not built *because* explicitly
    rejected/deferred/superseded (not a gap; flag overdue deferrals) · **F** regressed.
- **Formalization gate (teeth #1):** an ADR that introduces or changes a feature **cannot be Accepted
  without** its Expected-Behavior Map section. `scripts/check-adr.ps1` enforces the section's presence
  (CI + pre-commit already block malformed ADRs).
- **Definition-of-Done gate (teeth #2):** "done" now requires **each mapped behavior to have a passing
  test** — checked at completion (the moment the work is certified), not months later. Wired into the
  completion/release path.
- **Verification gate (teeth #3):** AG's main job is work verification. At the end of a Codex-built
  task, AG verifies the actual evidence against the map row by row so Codex is not grading its own
  work. Advice is secondary; verification is the load-bearing role.
- **Living + emergent (no fake precision):** the map is a **living document**. The teeth are NOT "map
  every behavior perfectly upfront" (impossible — emergent requirements are real). The teeth are: map
  every *known* behavior + name the reference anchors at scoping; add new behaviors when discovered
  (build, use, or audit); and no mapped behavior ships untested.
- **Provenance + no-fake-green:** every row cites its source/evidence; an unknown stays "unknown," never
  invented. Same ethos as the rest of PCC.
- **Travels to spawned projects:** the scaffolder seeds the template + the rule, so parity holds
  (DECISION-113).

**Two distinct efforts (do not conflate):**
1. **Forward process (this ADR):** the map step baked into idea → ADR → build → done-with-tests. Clean,
   enforceable, turn-on-able immediately.
2. **Retroactive backfill (separate work):** build the map for **everything already built** in PCC — a
   one-time archaeology producing a durable register (`docs/EXPECTATION_AUDIT.md`). **Stage 1**
   (bounded, high-value): enumerate the *finite control surface* (every renderer button/handler + IPC
   channel) as the spine, attach docs-sourced expected behavior + built/tested status, rank by
   shock-risk. **Stage 2** (large, token-heavy, parallel-agent candidate — explicit opt-in): mine the
   ~254 dev transcripts + in-app chats for *undocumented / emergent* expectations (the #2/#3 class).
   PCC only for now (not ITM).

## Consequences

- Catches the B/C/D/F classes that CI-green cannot — the intent-vs-reality gap becomes visible and
  testable instead of surfacing as an owner shock.
- The register becomes **three things at once**: a gap list now, the **click-through script for sign-off
  gate (b)**, and a source of regression tests (each real behavior gets pinned so it can't silently
  break again).
- Cost is a per-feature mapping step + tests-at-done. Kept lean to avoid over-governance; the map is a
  table, not a process. The map is never "complete" (emergent) — that is accepted and by design (living).
- Fixed in PCC's workflow + scaffolder, so spawned projects inherit both the rule and the teeth.

## Confirmation

- Owner approved the simple operating rule on 2026-07-28: `what the owner does -> what the app should
  visibly do -> how we prove it`.
- `scripts/check-adr.ps1` enforces that `feature: true` ADRs carry an Expected-Behavior Map, and
  rejects an Accepted feature ADR with status `C` rows or built `A/B` rows lacking test references.
  Red-biting coverage exists in `app/tests/scripts/check-adr.spec.js`.
- `AGENTS.md`, `docs/DECISION_AND_CHANGE_STANDARD.md`, and `docs/specs/README.md` carry the rule
  into the worker workflow.
- Scaffolder parity is pinned by `app/tests/scripts/scaffold-kit.spec.js`, which proves spawned
  projects inherit the Expected-Behavior Map teeth.
- `docs/EXPECTATION_AUDIT.md` exists as the current retroactive control-surface register; fuller
  backfill remains living work, not a reason to delay the forward rule.

## Engagement

- **Owner:** at idea scope, states the interaction and expected visible result he cares about; uses the
  map as the final click-through test script.
- **Codex worker:** fills the map before building, builds to the map, and updates it if scope changes.
- **AG verifier:** checks that the actual proof covers every mapped row, that visible behavior matches
  the expected result, and that no major new app interaction was omitted. AG does not edit or implement.
- **Future chats / spawned projects:** the template, the `check-adr` teeth, the DoD gate, and the
  scaffolder seed make this the default, inherited standard.

## Follow-on work

1. Keep converting current `Proposed` feature ADR maps from status `C` to tested `A` or honest
   `B/D/E/F` before accepting those ADRs.
2. Backfill `docs/EXPECTATION_AUDIT.md` as living work: Stage 1 control-surface spine first, Stage 2
   transcript mining only by explicit opt-in.
3. Dogfood this rule on the next PCC feature idea from scope through AG verification.

## Supersedes / Related

Adds the machinery that **ADR-0003** deliberately left as prose (closing the accepted intent-vs-proof
residue). Provides the missing script for **ADR-0009** sign-off gate (b). Builds on the EARS specs
(`docs/specs/`) and the change standard (`docs/DECISION_AND_CHANGE_STANDARD.md`). Parity to spawned
projects per **DECISION-113**. Origin: the 2026-07-27 owner button-press that found ITM trust-window
findings #2/#3 (fixed in PR #83).
