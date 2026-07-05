# IDEA-014 Detail: Pre-Checkpoint Kernel Quality Audit

Placeholder detail for IDEA-014. Non-canonical. Not an active task until explicitly promoted.

## IDEA Intent

Run a one-time, pre-checkpoint code-quality audit to answer a narrow question:

**"Is PCC's kernel good enough to freeze, preserve, and branch from with confidence?"**

Not:
- "Can this code be optimized forever?"
- "Would a veteran rewrite it differently?"
- "Can we make the code prettier?"

## Why This Could Be Worth Doing

Real benefits only:
- catches trust-threatening defects before the checkpoint freeze
- exposes hidden shared-state or weak modular seams before declaring extractability proven
- identifies a few high-leverage cleanup items that reduce future babysitting
- gives a more defensible answer to "is this preserved PCC baseline actually solid?"

If it does not produce one of those, it is not worth doing.

## Audit Standard

Judge code by PCC values, not generic craftsmanship theater:

1. **Correctness** — Does the script behave reliably on the real workflows it claims to support?
2. **Verification friendliness** — Is behavior observable, testable, and honest, or does it rely on hand-wavy reasoning?
3. **Leanness** — Does it solve the problem with minimal machinery, or has process/complexity crept in?
4. **Modularity / extractability** — Does it respect `DECISION-074`/`DECISION-077` by using documented `.cockpit/` contracts and avoiding hidden shared state?
5. **Maintainability** — Can a future human or verifier understand and safely modify it without lots of babysitting?
6. **Failure clarity** — Do failures surface clearly and locally, or in confusing/procedural ways?

## Recommended Scope

Keep it small. Review only the actual kernel, for example:
- `scripts/*.ps1` that define the core cycle
- generator / handback / verification / close-out / doctor / guardrail scripts
- maybe the directly coupled schemas and truth-surface docs only where needed to judge contract clarity

Do not expand into:
- all archived artifacts
- broad doc rewrites
- style-only cleanup
- speculative architecture redesign

## Required Output Shape

The audit should produce findings in only three categories:

1. **Real risks** — Things that could undermine checkpoint confidence, trust, extractability, or correctness.
2. **Maintainability smells** — Things that are not broken now but are likely future babysitting multipliers.
3. **Optional polish** — Things to ignore unless they surprisingly unlock major value.

That structure is important because it prevents the audit from turning into endless improvement churn.

## Promotion Guardrails

Only promote this idea if all are true:
- the checkpoint is reasonably near
- PCC's kernel is mostly stable
- the review is explicitly bounded
- the owner wants checkpoint confidence, not perfection theater

## Explicit Non-Goals

This idea must not become:
- a rewrite pass
- a veteran-style taste contest
- "convert all PowerShell into cleaner architecture"
- "normalize AI code to look hand-written"
- an excuse to expand scope before the freeze

## What Success Looks Like

A successful audit would end with one of these outcomes:
- "Kernel is solid enough; freeze with no material concerns."
- "Kernel is solid enough if we fix these 2-4 concrete issues first."
- "Kernel is not yet checkpoint-ready because of these specific trust/modularity risks."

That is the intended shape of the idea.

## Relationship to the Maturity Checkpoint

`DECISION-074`'s Maturity Checkpoint requires two things demonstrated, not merely specified: (1) Categories A-C proven across real cycles, and (2) the extractability rule audited and confirmed holding. This idea is a natural companion to condition (2) — it is a code-quality lens on the same kernel the extractability audit examines from a contract-boundary lens. The two could plausibly be scoped as one bounded pre-checkpoint task or run separately; that sequencing decision is left to whoever promotes this idea, not decided here.

## Related

- `docs/CCB_PCC_RELATIONSHIP.md` §8 (the Maturity Checkpoint, pass criteria).
- `docs/PROJECT_CHARTER.md`'s Core Design Rule (Modularity / Extractability, `DECISION-077`).
- `DECISION-074` (the extractability rule and Maturity Checkpoint amendment).
