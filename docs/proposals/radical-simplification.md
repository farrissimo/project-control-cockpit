# Proposal: Radical simplification after trust-model failure

**Status:** Proposed  
**Date:** 2026-07-25  
**Author:** Codex, at the owner's request after TRIAL-LE-01  
**Purpose:** Define a materially different path from the repeated trust-recovery / proving-window loop. This is not another "narrow slice" framed optimistically. It is a proposal to remove scope, retire claims, and reduce the runtime surface that sits between the owner and real work.

## Thesis

**PCC, as currently shaped and described, is too large a trust surface for its own mission.**

The project's central promise is not merely "provide helpful features." It is to **reduce babysitting,
reduce surprise, and become trustworthy enough for regular use**. Repo truth shows repeated attempts
to reach that state through more governance, more detection, more proof surfaces, and more owner-facing
truth machinery. Those attempts produced real code and real insights, but they did **not** reliably
produce dependable trust in real use.

Therefore, "radical simplification" here means:

1. **Retire the broad trust-cockpit claim.**
2. **Reduce the product to a much smaller set of runtime promises.**
3. **Remove or demote owner-facing machinery that does not directly help the owner complete work
   safely in the moment.**

This differs from prior recovery attempts because it is **not** "more hardening before the next
trial." It is a proposal to **shrink the live product surface** and stop asking the owner to trust
so many interacting mechanisms.

## Why the current shape is not credible

### 1. Repo truth already says the core problem is trust convergence, not missing features

- [docs/adr/0016-trust-proving-window.md](/C:/ProjectControlCockpit/docs/adr/0016-trust-proving-window.md:1)
  explicitly states that PCC's main problem is failure to converge to a trustworthy baseline under
  regular use.
- [PROJECT.md](/C:/ProjectControlCockpit/PROJECT.md:51) sets the governing standard as the trust
  proving window and says changes must be judged first by whether they reduce the chance PCC itself
  interrupts real work.

This means the project already identified the right problem. The issue is not lack of diagnosis.

### 2. The same remedy shape has already been tried repeatedly

Repo history between 2026-07-21 and 2026-07-24 shows repeated trust-focused interventions:

- 2026-07-21: **Option B clean rebuild** (`f75f343...`, `27a354f...`)
- 2026-07-21: **context auto-rollover / truthful chat-health meter** (`0d38e75...`, `d5cf3d7...`)
- 2026-07-22: **native `--max-turns` cap** (`4e639832...`)
- 2026-07-22: **usage-burn diagnostics / incident reconstruction** (`7232510...`)
- 2026-07-24: **persistent worker fixes** (`5733a558...`, `20eeb63...`)
- 2026-07-24: **restart continuity blocker fix** (`1488b099...`)
- 2026-07-24: **automatic 5-hour usage protection** (`43d804899...`, `e390ac82...`)
- 2026-07-24: **failure attribution blocker fix** (`a32e7293...`)

This is not a project that ignored trust. It is a project that kept **adding trust machinery** and
still produced fresh trust incidents.

### 3. The latest incident shows the current runtime surface is too complicated to trust

[docs/incidents/2026-07-25-land-evaluator-trial-blocker.md](/C:/ProjectControlCockpit/docs/incidents/2026-07-25-land-evaluator-trial-blocker.md:1)
documents TRIAL-LE-01:

- visible chat length about 23%
- visible 5-hour usage about 10%
- real hard stop from a separate hidden per-message `--max-turns` guard
- missing Land Evaluator local `.cockpit/state/usage-limits.json`
- owner had to reverse-engineer the actual blocking condition

That is the key failure mode: **too many interacting truth surfaces and guardrails relative to what
the owner can reliably predict from the visible UI.**

### 4. The current runtime is large, mixed-purpose, and highly coupled

Measured on 2026-07-25:

- [app/main.js](/C:/ProjectControlCockpit/app/main.js:1): **1766 lines**
- [app/renderer/renderer.js](/C:/ProjectControlCockpit/app/renderer/renderer.js:1): **2962 lines**

Those files currently host or coordinate:

- chat send/worker lifecycle
- authority model
- trust strip / detector surfaces
- usage limits and rollover behavior
- proving-window UI
- lifecycle and overview surfaces
- multi-project switching
- verification and CI surfaces

That does not prove the code is bad. It does support the narrower claim that the live product has
become **a large trust surface with many owner-visible and owner-adjacent promises**.

## What radical simplification means here

It does **not** mean "rewrite everything."

It means:

- stop trying to be a full trust cockpit right now
- stop exposing many semi-independent truth layers at once
- reduce the runtime to a small, legible set of promises
- move the rest to offline diagnostics, development-only tooling, or retirement

## The simplified product claim

Replace the current broad claim:

> "PCC is a trustworthy cockpit for building projects with LLMs."

with this narrower one:

> "PCC is a local Claude session harness that preserves chat continuity and exposes a few honest,
> directly useful protections: real usage, stop, one visible turn/budget policy, and durable chat/project state."

That is a radically smaller claim.

## Keep / cut / defer

### KEEP in the runtime product

These are the pieces that directly help the owner work **during a live session**:

1. **Durable chat continuity**
   - Canonical chat state / chat persistence
   - Worker session continuity / restart safety
   - Why keep: this is foundational to not losing work.

2. **Real usage meter**
   - The real 5-hour usage surface proven on the owner's screen
   - Why keep: this is the one usage signal the owner actually watches.

3. **Stop control**
   - A reliable stop for a running turn
   - Why keep: direct owner control when things go wrong.

4. **One explicit live protection policy**
   - per-turn budget
   - per-message turn cap
   - whether rollover is advisory or automatic
   - Why keep: these protections are fine **if** the owner can see them as first-class policy.

5. **Minimal project continuity**
   - enough project switching / state to resume work without re-briefing
   - Why keep: useful, but only if it stays boring and legible.

### REMOVE or demote from the runtime surface

These are not useless, but they should stop sitting in the owner's main trust path.

1. **Trust proving-window runtime banner**
   - [app/renderer/proving-window.js](/C:/ProjectControlCockpit/app/renderer/proving-window.js:1)
   - Why remove: the proving-window framing has lost credibility as an owner-facing live status.

2. **Owner/Visionary Overview as a live product surface**
   - described in [PROJECT.md](/C:/ProjectControlCockpit/PROJECT.md:100)
   - Why demote: it is a meaning layer on top of truth, not the truth the owner needs to keep moving.

3. **Lifecycle journey / phase machinery in the runtime**
   - phase pins, phase-close signaling, adoption framing
   - Why demote: valuable for governance, but high indirection for the owner's live work loop.

4. **Most detector surfaces as default-visible runtime trust signals**
   - untracked, drift, stale-docs, bloat, high-stakes, sycophancy nudge, etc.
   - Why demote: these are diagnostic/admin surfaces, not core in-the-moment work controls.

5. **Trust-strip ambition as a comprehensive truth dashboard**
   - "On the rails / Backed up / Verified / Rules loaded" plus associated chips
   - Why simplify: too many cross-domain promises in one narrow strip invites exactly the mismatch
     problem seen in TRIAL-LE-01.

### DEFER or move to development-only tools

1. **Governor / stakes / proportional governance surfaces**
2. **Sign-off / proving-window / adoption framing**
3. **Most audit-category completion machinery**
4. **Advanced parity work beyond the owner's actual core loop**
5. **Meta-observability layers that are useful mainly to the builder, not the operator**

These can remain in the repo. The proposal is to stop treating them as part of the owner's main
interactive runtime contract.

## The target runtime after simplification

The owner-facing live app should answer only these questions:

1. **Am I in the right chat/project, and is my work still there?**
2. **How much 5-hour usage have I burned, and when does it reset?**
3. **Is there a hard per-turn or per-message limit in force right now?**
4. **Can I stop the turn if I need to?**
5. **If the app acts automatically, what exactly did it do and why?**

Everything else is either:

- secondary,
- diagnostic,
- or administrative.

## Why this is different from earlier "narrow slice" recovery

Because the prior pattern was:

- keep the broad cockpit identity
- add another safeguard
- prove another truth surface
- continue toward trust

This proposal is different because it says:

- the broad identity is the problem
- the runtime surface itself must shrink
- some current owner-facing concepts should be retired, not improved
- simplification requires **removing claims and surfaces**, not just fixing them

## Actual code consequences

If adopted, simplification should lead to concrete code changes such as:

1. **Remove the proving-window banner and related copy from the runtime**
   - keep ADR/history in docs, but stop surfacing the countdown in the live app

2. **Collapse protection UI into one explicit "Limits" or "Protection" surface**
   - current budget cap, current turn cap, rollover mode, last real usage reading age
   - no more hidden policy inferred only from code

3. **Move most detectors and phase surfaces behind a secondary diagnostics area**
   - available when needed, not pretending to be the owner's core live truth

4. **Reduce the trust strip to only the few states the owner can act on immediately**
   - or remove it entirely in favor of a smaller session-status block

5. **Treat audit/governance/reporting machinery as development/admin tools**
   - not the center of the day-to-day runtime experience

## Acceptance standard for the simplified product

The simplified product should not be judged by "did it rebuild trust philosophically?"
It should be judged by one brutal standard:

> Can the owner complete a substantial work session without surprise from the runtime surface?

A pass means:

- visible usage matches the real usage source
- visible limits match the limits that can actually stop the turn
- stop works
- continuity works
- any automatic intervention is legible before or when it happens

## Risks

- This may feel like admitting the larger cockpit vision failed in its current form.
  That is because it likely did.
- Some existing code and ideas will become secondary or dormant.
  That is the cost of becoming simpler.
- The project may become less impressive on paper while becoming more usable.
  That is acceptable; repo truth already rejects feature-richness as a proxy for trust.

## Recommendation

**Do not open another trust proving window on the current runtime shape.**

If PCC continues, it should continue as a **much smaller runtime product** with:

- durable chat continuity
- real usage
- explicit live limits
- stop
- minimal project continuity

and with most of the current cockpit/governance/trust-theater moved out of the owner's main loop.

That is my version of radical simplification.
