---
status: Accepted
date: 2026-07-21
deciders: owner (product lead)
---

# ADR-0016: Two-week trust proving window

## Context and Problem

2026-07-20 was a repeat pattern, not an isolated incident: the owner lost real work time to PCC
itself — a runaway usage burn he couldn't see coming and a stuck chat he couldn't stop — on top of
prior shocks earlier in the project's history. The owner's own diagnosis, recorded here verbatim
because it is the standard everything after this ADR is judged against:

> PCC's current problem is not mainly missing features. It is failure to converge to a trustworthy
> baseline under regular use.
>
> Corollary: Visible progress, interesting features, and better surfaces do not by themselves
> solve this. PCC is not considered healthier because it became richer, only if it became less
> interruptive, less surprising, and more reliable in real use.

## Decision

**PCC is not currently trustworthy enough to be treated as a usable product for the owner's
intended workflow.** This is not a claim that PCC has no value — it addresses real problems and
has produced real improvements — but usefulness is not the same as trustworthiness, and right now
**PCC is the main source of the owner having to stop real work.** That is a failure against the
project's #1 stated purpose (reduce babysitting).

**Trust bar (deliberately simple):** PCC must be usable for **one full week of regular use without
shocking the owner in a serious way.** As of 2026-07-21, it does not clear that bar.

**Two-week proving window: 2026-07-21 → 2026-08-04.** Purpose: determine whether PCC can become
trustworthy enough to be the owner's standard way of building with an LLM, or whether it should be
reclassified as something narrower than that original vision.

**Success condition (end of window):** a materially improved trust baseline in real use — fewer
major surprises, fewer cases where PCC itself interrupts or derails real work, better visibility
into what the worker is doing and why, meaningful protection against runaway cost/context
drift/loss of control, and a credible sense of *converging* toward trust, not just accumulating
features.

**Failure condition:** if PCC does not build sufficient trust in this window, it stops being
treated as an emerging general-use cockpit for the owner's envisioned workflow. The follow-up is
**not** denial or more feature expansion — it is to reclassify PCC honestly: what it's usable for
today, what it isn't trustworthy enough for, what kind of work it can safely support (niche
internal tool / experimental framework / diagnostic harness / something narrower), stated plainly.

**Decision rule for the duration of the window** — every proposed feature, ADR, safeguard, or
change must be judged first by: **"Will this reduce the chance that PCC itself interrupts real
work?"** If the answer is no, unclear, or only indirect, it is secondary for the duration of the
window. Explicitly: **better observability is not protection; better UI is not trust.** A new
feature earns its place only by reducing shocks, explaining shocks, or preventing the same shock
from recurring.

## Consequences

- **Gain:** a concrete, dated, honest standard replaces open-ended "keep improving" — either PCC
  earns trust in real use within two weeks, or the project is honestly renamed to fit what it
  actually is. No more drifting on the strength of interesting features.
- **Cost:** work that doesn't demonstrably reduce interruption risk is deprioritized for the
  window's duration, even if otherwise valuable (e.g. R4/R6 of `docs/proposals/desktop-parity.md`
  rank below anything that directly reduces shock risk).
- **Honest residue:** "shocking the owner in a serious way" is a judgment call, not a mechanized
  metric — this ADR does not attempt to auto-detect a "shock"; the owner is the judge, by design
  (mechanizing it would be exactly the fake-intelligence/over-governance this project's other ADRs
  have repeatedly declined to build).

## Confirmation

This is a policy/governance decision, not a code change — there is nothing to test in the usual
sense. Its confirmation is behavioral: does real use over the next two weeks actually get less
surprising. The one piece that IS code — the visible countdown banner on the main chat page
(below) — is tested normally (pure date math, unit-tested).

## Engagement

- **Owner:** author and sole judge of "shocking" vs. not; sets the standard, reviews the outcome
  at the window's end.
- **Claude worker:** for the duration of the window, applies the decision rule above BEFORE
  starting any new work — states explicitly how a proposed change reduces interruption risk, or
  says plainly that it doesn't and asks whether it should proceed anyway.
- **Codex verifier:** unchanged role (diffs, tests, doctor) — this ADR doesn't add a new
  verification surface, it reweights priority.
- **Spawned projects:** not applicable — this is PCC's own project-level standard, not something
  that travels via the scaffolder.

## Supersedes / Related

Sharpens (does not replace) the "Operational Trust Qualification & Adoption" phase in
`PROJECT.md` — that phase's audit-category work continues, but everything is now filtered through
this window's decision rule first. Directly motivated by the 2026-07-20 incident and the
desktop-parity work it produced (`docs/proposals/desktop-parity.md`, ADR-0012–0015) — R1/R2/R3 of
that effort are the clearest examples of work that PASSES this window's test (they directly reduce
interruption risk); R4/R6 are lower priority under this rule until the window closes or is
extended.
