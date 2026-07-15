---
status: Proposed
date: 2026-07-15
deciders: owner (product lead), Claude (worker), Codex (independent verifier), GPT (secondary verifier — per the trigger below)
---

# ADR-0009: Operational Trust Qualification & Adoption (the trust sign-off phase)

## Context and Problem

The owner will not adopt PCC for real LLM-built, non-coder-owned project work until he can **trust
it** — including every project it spawns. Two concerns block that trust, and they are the same root:

1. **Persuadable bypass.** A worker, told the right way, would likely go do a thing *and* route around
   the checks-and-balances. Controls governed by prose (CLAUDE.md) bend to phrasing.
2. **Un-standardized practice.** Much of what PCC relies on every day works but is "winged" — habit,
   not canon. If it lives in an LLM's compliance or in our memory, it isn't trust; it's luck.

**The root of both:** trust must live in the **system** — enforced machinery and canonical, documented
standards — not in the LLM being incorruptible or in us remembering. This ADR defines the final
assurance phase that moves trust into the system and ends at the owner's sign-off.

## Decision

This is the **Operational Trust Qualification & Adoption** phase — the phase after which the owner may
adopt PCC as his standard way of building products with LLMs. The **standardization audit is ONE
workstream inside it**, not the whole phase: the phase also proves PCC works end-to-end on a real,
adversarially-tested spawned project and can actually be *used*. Locked rules:

1. **Exhaustive top-level categories** (the net that catches the little things). An audit meant to
   expose hidden winging **cannot rely on readers inferring where a whole domain belongs** — every
   domain is named explicitly, even if some later consolidate. Draft set (owner confirms/adjusts;
   exhaustiveness of the *list itself* is audited): state & data integrity · verification &
   proof-of-done · change governance & decisions · **requirements / intent & acceptance correctness** ·
   honesty & anti-fake-green · execution authority & worker safety · **bypass evidence &
   tamper-detection** · **privacy, secrets & access control** · backup & recovery · **recovery,
   rollback & damage-repair behavior** · testing & assurance · detection & signals · **incident
   response, diagnostics & supportability** · project lifecycle · **packaging, install, upgrade &
   runtime-environment compatibility** · **external dependency/tool availability & failure behavior** ·
   multi-project scaffolding & parity · **retirement, migration & data export/decommissioning** ·
   memory & knowledge · **communication contracts** · repo & supply-chain security · worker operation
   & tooling conventions. (GPT secondary verification, 2026-07-15, named the domains that were implicit;
   they are now explicit.)
2. **Cover both** the winging-it *and* the already-standardized — a complete inventory, nothing
   assumed. Most of it is non-owner-facing (he never sees it), which is exactly why it must be proven.
3. **Per-practice grid:** *what it is · current state (machinery-enforced / evidence-leaving +
   owner-visible / prose-only) · proof it's standardized · benefit to PCC · gaps.*
4. **Grade against the canonical principles yardstick** (below). Every practice must serve them; any
   that strains one (especially adds governance without reducing babysitting) is flagged.
5. **Bypass-evidence standard:** every escape hatch must leave a **deterministic, owner-visible** trail
   — PCC itself raises the flag in plain language. An LLM autopsy (Claude/Codex noticing) is a bonus,
   **never** the guarantee, because that re-trusts the very LLM that could be the culprit.
6. **Owner sign-off model:** the owner signs off on **outcomes he can judge** — never on code or
   technical calibration (the LLM + independent verifier own that; he will not be asked to verify what
   he cannot see). But "outcomes he can judge" is more than "documented + plain + less babysitting":
   for a real trust guarantee he must also **explicitly *accept* the residual risks** (active
   acceptance, not mere disclosure), **confirm the intended product behavior and the *unacceptable*
   failure modes**, and **judge whether bypass-visibility and recovery behavior are acceptable to
   him**. Those are owner-judgeable and required — a report he merely reads is not a signature.
   Secondary verification fires by the trigger below, not by reflex.
7. **Output:** an owner-facing **HTML/PDF report** that **discloses each item's true state**
   (machinery-enforced / evidence-leaving / owner-visible-not-enforced / prose-only / accepted-residue /
   untested / failed-or-deferred), its benefit, and the **exact tested boundaries** — it does **not**
   convert "documented" into "proven" or claim everything is "standardized." His sign-off document.
8. **Two sign-off gates.** (a) the proven report; (b) a **live end-to-end build** that shows it all
   working — and for a claim as strong as "trust for *any* project," (b) is **not one happy-path
   demo.** It must include a **clean spawned-project build** (parity proof: the whole assurance kit
   travels) **plus representative adversarial / negative scenarios** — attempted bypass, a failed
   verification, recovery from damage, stale/false evidence, and a parity failure — each shown to fail
   safe and stay owner-visible; **a meaningful real feature built through the governed loop** (not a
   hello-world); and **package → install → launch → use the result OUTSIDE the source checkout** (real
   adoption, not a dev-repo demo). If only the happy path is ever demonstrated, the trust claim is
   **narrowed honestly** to "trust demonstrated for the tested workflows and stated limits," not "any
   project." The owner's true sign-off waits for (b) at that bar. (Strengthened per GPT, 2026-07-15.)

### Canonical principles yardstick (the constitution every practice is graded against)
1. Reduce owner babysitting (#1; everything else justifies against it)
2. Lean — no bloat, *especially* no over-governance
3. Local-first; spend the LLM only on real judgment
4. Honesty / anti-fake-green — never claim proven when it isn't; fail visibly
5. Verify, don't trust — proof matched to stakes; independent verification for "done"
6. Truth lives in files, not the LLM's word
7. Protect data first / reversibility — safety is what buys autonomy
8. Prior-art first — reuse proven solutions, don't reinvent
9. Plain language for the owner — visionary, not coder
10. Parity by default — what PCC gets, spawned projects get

### Secondary (GPT) verification trigger (settled by Claude + Codex)
Bring in the third independent verifier (GPT — different model, remote repo, adversarial) only when a
mistake would be **both hard to notice and costly** — ANY of: (1) the change touches **T0 trust-root /
verification/governance machinery** (the system judging itself); (2) it changes **trust boundaries,
evidence standards, release gating, rollback posture, or the security model**; (3) it is
**high-consequence and low-observability if wrong**, especially hard to reverse. **Skip** for routine
T1–T4 implementation and reversible design ADRs — Codex diff-review + CI already suffice. It reuses the
stakes tiers but is **deliberately more than the tier**: conditions (2) and (3) catch trust-changing
decisions and documents that path tiers alone would miss (confirmed by GPT, 2026-07-15 — do not reduce
it to the classifier). Fewer copy blocks, each meaningful, by design.

## Consequences

- **Gain:** trust becomes a property of the system, not of luck; the standardized template is **intended
  to travel** to every spawned project (parity) — a claim **proven only by gate (b)**, not asserted
  here; the owner gets a legible proof he can sign.
- **Cost:** the audit is real work and must itself stay **lean** — it cannot become the over-governance
  it's cataloguing. Categories that are already fine are recorded as fine, not re-engineered.
- **Honest residue:** some practices stay prose or accepted (e.g., an LLM can't be made incorruptible;
  a fabricated PASS is irreducible). The report **discloses** these plainly rather than pretending
  they're closed — that disclosure is itself the standard.

## Confirmation

The phase's own success = the owner's sign-off after **both** gates: the proven report **and** a live
end-to-end build. Each category is independently verified (Codex; GPT where the trigger fires) and
**documented durably** (truth lives in files). This ADR is the map; each category is populated with
**risk-based depth** — deeply verify / mechanize / test only where a failure would be **silent, costly,
or create babysitting**; low-consequence practices get documentation + review, **not** the full governed
loop (running the heavy verify-and-merge loop for every trivial standardization would itself be the
over-governance this phase forbids). If the audit starts adding friction without reducing babysitting,
it violates its own yardstick and is cut back.

## Engagement

- **Owner:** sets intent, signs off on outcomes he can judge, runs GPT secondary verification where the
  trigger fires (this ADR itself qualifies — it changes evidence/verification standards).
- **Claude worker:** mines the record, drafts standards + templates, converts prose → machinery where
  possible, produces the report.
- **Codex verifier:** owns technical calibration + diff review (per ADR-0005 / DECISION-105).
- **GPT secondary verifier:** independent third check, fired by the trigger, delivered via copy block.
- **Spawned projects:** are **intended to** inherit every standardized practice via the scaffolder
  (DECISION-113 parity, ADR-0004) — the audit's output *becomes* the canonical template; that
  inheritance is **proven by gate (b)'s spawned-project qualification, not assumed.**

## Supersedes / Related

Completes the Governance Standardization arc (ADR-0006/0007/0008 standardized the verification gate;
this generalizes the principle to every practice). Related: `docs/specs/communication-contracts.md`
(the first category), `docs/proposals/governance-standardization.md`, the lessons distillation, and
CLAUDE.md / AGENTS.md / `docs/ENGINEERING_ASSURANCE_PLAN.md` (the canon the yardstick consolidates).
