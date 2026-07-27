---
status: Proposed
date: 2026-07-27
deciders: owner (product lead), Claude (worker), Codex (independent verifier)
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

*(PROPOSED — the owner has approved the intent: this is now a permanent, tier-1, standard-workflow step
with no shortcuts. This ADR records it; implementation lands in follow-on work, per the task list below.)*

**Every new or changed PCC feature (and every feature in spawned projects) must carry an
Expected-Behavior Map before its idea can be formalized, and is not "done" until every mapped behavior
has a passing test — verified at completion, never deferred.**

- **The map (lean RTM), one small table per feature**, each row: `behavior → trigger/control (which
  button) → expected result → source → status → test ref`.
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

*Plan — executed on acceptance; nothing here is built yet.*

- `check-adr.ps1` gains a rule: a feature-tagged ADR without an Expected-Behavior Map section FAILS
  (red), proven with a red-biting test (mirrors `check-adr.spec.js`).
- The Definition-of-Done / completion path requires each mapped behavior to reference a passing test;
  proven by a fixture where a missing test blocks "done."
- The backfill Stage 1 produces `docs/EXPECTATION_AUDIT.md` with sourced rows and at least the known
  docs-only findings surfaced (e.g. PROJECT.md already records "Steer half — NOT working" → a B/D row).
- Dogfood: the owner's next feature idea runs through the upgraded workflow as the first live example.

## Engagement

*Plan — where this wires in once accepted.*

- **Owner:** maps the intent he cares about at scoping (aided by reference anchors so he needn't
  enumerate everything); uses the register as the final click-through test script; sees gaps early.
- **Claude worker:** fills the map in each feature ADR, writes the behavior tests at "done," maintains
  the living register, runs the backfill.
- **Codex verifier:** checks that the map ↔ tests actually cover the stated behaviors (not just that
  tests pass) and that no row is unsourced/invented.
- **Future chats / spawned projects:** the template, the `check-adr` teeth, the DoD gate, and the
  scaffolder seed make this the default, inherited standard.

## Implementation task list (for the chat that picks this up)

1. Add the **Expected-Behavior Map** section to the ADR template, `docs/DECISION_AND_CHANGE_STANDARD.md`,
   and `docs/specs/README.md` (lean table + the source/status legend above).
2. Add **`check-adr.ps1` teeth**: a feature-tagged ADR must contain the section; red-biting test.
3. Upgrade **Definition of Done** in `AGENTS.md` ("What done means here") to require each mapped
   behavior to have a passing test, checked at completion; wire the check.
4. **Scaffolder**: seed the template + rule so spawned projects inherit it (parity, DECISION-113).
5. **Backfill** `docs/EXPECTATION_AUDIT.md`: Stage 1 (control-surface spine + docs-sourced behavior +
   status, ranked by shock-risk), then Stage 2 (transcript mine — separate opt-in). PCC only.
6. **Dogfood** on the owner's next feature idea.

## Supersedes / Related

Adds the machinery that **ADR-0003** deliberately left as prose (closing the accepted intent-vs-proof
residue). Provides the missing script for **ADR-0009** sign-off gate (b). Builds on the EARS specs
(`docs/specs/`) and the change standard (`docs/DECISION_AND_CHANGE_STANDARD.md`). Parity to spawned
projects per **DECISION-113**. Origin: the 2026-07-27 owner button-press that found ITM trust-window
findings #2/#3 (fixed in PR #83).
