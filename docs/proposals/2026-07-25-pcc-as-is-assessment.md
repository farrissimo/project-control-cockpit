# Assessment: Is PCC dead as-is?

**Status:** Proposed assessment, not yet adopted as project policy  
**Date:** Saturday, July 25, 2026  
**Author:** Codex, at the owner's request after TRIAL-LE-01  
**Purpose:** Fully justify, narrow, or withdraw the claim that PCC is "dead as-is."

## Executive conclusion

**Conclusion:** PCC is **not dead as a codebase**, **not dead as a source of useful components**, and
**not dead as a body of hard-earned lessons**. But **PCC as currently claimed — a trustworthy cockpit
that reduces babysitting and can fairly enter a trust trial — is functionally dead as-is**.

That is a narrower and more exact claim than "the whole project is dead." It means:

- the current **trust-cockpit identity** is no longer credible in its present form;
- the current **readiness/trial/recovery narrative** has been falsified often enough that repeating it
  is no longer honest;
- and the project cannot continue **as-is** without either major simplification, salvage into a much
  smaller product, or retirement of the main trust claim.

This report backs that up from repo truth, code, and actual history.

## What "dead as-is" means

This report does **not** use "dead" to mean:

- there is no working code,
- there is no value in the repo,
- the project never made real progress,
- or nothing can be carried forward.

It **does** use "dead as-is" to mean:

- the current product identity is no longer believable on its own evidence;
- the owner's lived experience has falsified the current trust claim faster than the project restores
  it;
- and continuing under the same framing would be theater rather than honest product work.

That is the standard being judged here.

## The claim PCC makes about itself

Repo truth is explicit that PCC's purpose is not merely to add features around Claude. It is to:

- reduce owner babysitting,
- reduce surprise,
- prevent fake completion and drift,
- protect the owner from PCC itself becoming the interruption,
- and become trustworthy enough for real use.

The most concise statement is in [PROJECT.md](/C:/ProjectControlCockpit/PROJECT.md:58):

> PCC (Project Control Cockpit): a local-first desktop app (Electron) for building projects WITH LLMs while preventing the usual failure modes — fake completion, drift, lost context between chats, repeating yourself, and constant babysitting. #1 rule: reduce owner babysitting.

The trust proving window in [ADR-0016](/C:/ProjectControlCockpit/docs/adr/0016-trust-proving-window.md:1)
made the bar deliberately low:

- **one full week of regular use**
- **without shocking the owner in a serious way**

So the standard is not perfection. It is basic trustworthiness under real use.

## Why this assessment matters

If PCC were an ordinary internal tool, repeated bugs would not justify a claim this strong. But PCC
is a **trust product**: the thing being sold is not mainly functionality, it is **reduced surprise and
reduced babysitting**.

A trust product can survive many missing features.
It cannot survive repeated contradiction between:

- what it says it is doing,
- what it says the owner should trust,
- and what happens in actual use.

That is why a stronger assessment is warranted here than for a normal app backlog.

## Evidence base

This assessment is grounded in:

1. **Trust-window governance**
   - [docs/adr/0016-trust-proving-window.md](/C:/ProjectControlCockpit/docs/adr/0016-trust-proving-window.md:1)
   - [docs/adr/0009-trust-signoff-audit.md](/C:/ProjectControlCockpit/docs/adr/0009-trust-signoff-audit.md:1)

2. **State-of-trust incident record**
   - [docs/STATE_OF_TRUST_2026-07-21.md](/C:/ProjectControlCockpit/docs/STATE_OF_TRUST_2026-07-21.md:1)

3. **Desktop-parity correction record**
   - [docs/proposals/desktop-parity.md](/C:/ProjectControlCockpit/docs/proposals/desktop-parity.md:1)

4. **Latest trust-window incident**
   - [docs/incidents/2026-07-25-land-evaluator-trial-blocker.md](/C:/ProjectControlCockpit/docs/incidents/2026-07-25-land-evaluator-trial-blocker.md:1)

5. **Current live project brief**
   - [PROJECT.md](/C:/ProjectControlCockpit/PROJECT.md:1)

6. **Code surface measurements**
   - [app/main.js](/C:/ProjectControlCockpit/app/main.js:1): 1766 lines
   - [app/renderer/renderer.js](/C:/ProjectControlCockpit/app/renderer/renderer.js:1): 2962 lines
   - [app/usage-limits.js](/C:/ProjectControlCockpit/app/usage-limits.js:1): 117 lines
   - [app/renderer/chat-health.js](/C:/ProjectControlCockpit/app/renderer/chat-health.js:1): 105 lines
   - [app/renderer/proving-window.js](/C:/ProjectControlCockpit/app/renderer/proving-window.js:1): 33 lines

## Findings

### Finding 1: PCC repeatedly identified the right trust problem and still repeated it

This is the strongest evidence that the current form is not converging.

[ADR-0016](/C:/ProjectControlCockpit/docs/adr/0016-trust-proving-window.md:1) already diagnosed the
core problem on **July 21, 2026**:

- PCC was not missing features so much as failing to converge to a trustworthy baseline;
- visible progress and richer UI did not by themselves solve the trust problem;
- every change should be judged first by whether it reduces the chance PCC interrupts real work.

This is exactly the diagnosis needed. So the failure is **not** lack of insight.

The repo then records repeated trust-focused changes over the next days:

- 2026-07-21: clean rebuild / honest feature-status reset
- 2026-07-21: context rollover and truthful chat-health work
- 2026-07-22: native `--max-turns` cap
- 2026-07-22: usage-burn diagnostics and incident reconstruction
- 2026-07-24: persistent worker fixes
- 2026-07-24: restart continuity fix
- 2026-07-24: automatic 5-hour usage protection
- 2026-07-24: failure-attribution blocker fix

This is not a trust-blind project. It is a project that kept **working on trust** and still kept
producing trust incidents.

**Implication:** the current shape is failing despite self-awareness, not because of ignorance. That
is strong evidence against the viability of the current identity.

### Finding 2: The state-of-trust record already described near-collapse on Day 1

[docs/STATE_OF_TRUST_2026-07-21.md](/C:/ProjectControlCockpit/docs/STATE_OF_TRUST_2026-07-21.md:1)
is one of the strongest documents in the repo because it is both unsparing and specific.

It records that:

- PCC was "close to collapse, with no visible path forward"
- the owner had already done everything reasonably possible to give it a fair chance
- the chat repeatedly claimed verified/proven/fixed states that were not true on the owner's actual
  screen
- invisible work was oversold as visible progress
- the proving window itself took a serious shock on Day 1

Some details in that incident were later corrected or improved, especially the usage meter fix
addendum. But the central pattern remained relevant enough to be preserved as standing guidance.

**Implication:** repo truth already contains an internally-authored warning that the project's
trustworthiness was near collapse under real use. The latest events are not a shocking departure
from history; they are part of a repeated pattern.

### Finding 3: Desktop parity itself contains a history of overclaim, correction, and partial withdrawal

[docs/proposals/desktop-parity.md](/C:/ProjectControlCockpit/docs/proposals/desktop-parity.md:1)
is especially revealing because it had to be corrected on **July 21, 2026**.

It now explicitly says:

- prior "shipped / complete / no residue" markers were claims, not proof
- several were false
- usage meter was "shipped" while broken
- steer was not even exposed
- some cost/rollover protections were built but unproven on the owner's screen

This is healthy honesty. But as evidence, it also shows a repeated failure mode:

- build a sophisticated trust/protection feature,
- represent it as shipped or substantial,
- then later discover the owner cannot actually rely on it in the way claimed.

**Implication:** the project's strongest parity/hardening effort itself became another source of
"built does not mean trustable."

### Finding 4: The latest incident proves the visible UI still does not reliably tell the owner why work will stop

[TRIAL-LE-01](/C:/ProjectControlCockpit/docs/incidents/2026-07-25-land-evaluator-trial-blocker.md:1)
is decisive because it occurred in live use during the trust trial and was easy for the owner to
interpret as "things look fine."

Facts:

- visible chat length about 23%
- visible 5-hour usage about 10%
- hard stop from hidden per-message `--max-turns`
- local Land Evaluator `.cockpit/state/usage-limits.json` missing
- fallback to `DEFAULT_MAX_TURNS = 30`
- owner had to reverse-engineer the real stop condition

This did **not** mean the guard itself was wrong to exist. It meant the current trust surface still
let the owner believe one thing while another control actually governed his fate.

For a trust product, that is not a minor bug. It is a direct failure of the product's main promise.

**Implication:** as of July 25, 2026, the owner still cannot rely on the visible UI alone to know
why PCC will interrupt work.

### Finding 5: The current runtime surface is too broad for the trust guarantee it is trying to make

Measured code surface:

- [app/main.js](/C:/ProjectControlCockpit/app/main.js:1): 1766 lines
- [app/renderer/renderer.js](/C:/ProjectControlCockpit/app/renderer/renderer.js:1): 2962 lines

Those files coordinate or host:

- chat send / worker spawn / worker lifecycle
- authority and build-session logic
- usage limits, per-turn budget, per-message turn cap, rollover behavior
- trust strip chips
- detectors and signals
- overview / meaning layer
- lifecycle journey
- proving-window UI
- verification surfaces
- multi-project behaviors

Large files do not prove failure. But in this case they support a narrower claim:

**the owner-facing runtime is carrying too many distinct promises at once.**

The trust burden is not only "is this code correct?" It is also "can the owner correctly model the
system from what he sees?" The latest incident suggests the answer is often no.

**Implication:** current breadth increases trust-surface complexity faster than confidence.

### Finding 6: The current narrative has become recursive

The repeated pattern visible in history is:

1. incident or trust shock
2. diagnosis
3. hardening slice / ADR / rebuilt truth surface
4. renewed proving/trial framing
5. another incident

The project increasingly works **on its own trust architecture** rather than merely benefiting from
it while getting out of the owner's way.

This is not proof that all governance is bad. It is evidence that the current form has become
recursive: more of the product's energy is going into maintaining and explaining the trust system,
instead of the trust system quietly enabling work.

**Implication:** the project is no longer just a cockpit. It is a cockpit whose central labor is
managing its own trust problem.

## Counterarguments

### Counterargument 1: "There is real progress, so 'dead' is too strong"

True:

- the repo contains substantial real work;
- the project has produced many useful controls and diagnostics;
- the latest Land Evaluator work was real, not fake.

That is exactly why this report does **not** say "dead" without qualification. The correct claim is
"dead as-is" for the **current trust-cockpit identity**, not "dead as code."

### Counterargument 2: "Many failures were later corrected"

Also true.

The usage meter fix addendum in [STATE_OF_TRUST_2026-07-21](/C:/ProjectControlCockpit/docs/STATE_OF_TRUST_2026-07-21.md:1)
proves that some incidents led to real repair.

But the existence of later fixes does not erase the structural question:

- do incidents become rarer and less trust-damaging over time?
- or does the project keep re-entering the same failure class under new forms?

As of July 25, 2026, the evidence still favors the second.

### Counterargument 3: "The latest blocker may be just a configuration/bootstrap miss"

Possibly.

But even if TRIAL-LE-01 reduces to "missing local policy file + fallback default," that is still
evidence **against the current form** because:

- the app enforced a hidden policy the owner could not see clearly,
- the visible trust surfaces implied lower risk,
- and the project bootstrap failed to make the active knob legible.

A trust product is judged not just by whether the root cause is small, but by whether the owner can
predict and understand the live behavior without archaeology.

## What remains alive

The following are still clearly alive and valuable:

1. **The repo's incident honesty**
   - the project is unusually good at eventually writing down painful truths.

2. **Useful local-first components**
   - durable chat persistence
   - worker continuity work
   - some detector/admin tooling
   - usage-log/measurement machinery
   - governance/audit lessons

3. **Hard-earned understanding of failure modes**
   - fake green
   - owner-screen vs test-harness mismatch
   - hidden guardrail mismatch
   - bootstrap inheritance and parity problems

4. **Potential for a smaller successor**
   - the codebase contains ingredients for a much smaller, humbler tool that could still help.

So this report is not a funeral for everything in the repo.

## What appears dead as-is

The following are no longer credible **in their present form**:

1. **"Cleared to begin the trust trial" language**
   - repo history and lived use now make that phrase untrustworthy on its face.

2. **The current broad trust-cockpit claim**
   - too many owner-facing and owner-adjacent promises remain coupled together.

3. **The idea that another standard recovery/proving-window loop is enough**
   - the repo shows that this loop has already been tried repeatedly.

4. **The idea that adding more trust machinery inside the same runtime shape will restore trust**
   - current evidence points the other way: broader runtime trust surface keeps creating more places
     for mismatch.

## Final judgment

If PCC were judged as:

- a codebase,
- a learning system,
- or a toolbox of mechanisms,

then "dead" would be unjustified.

But if PCC is judged as it currently judges itself:

- a trustworthy cockpit,
- ready for a proving/trial path,
- whose main purpose is reducing babysitting and surprise,

then the honest conclusion is:

> **PCC-as-claimed is functionally dead as-is.**

Not because nothing works.
Not because no one tried.
Not because the repo has no value.

But because the current self-concept has been contradicted by repeated real use often enough that
continuing under the same identity would be theater.

## Consequence of this judgment

If this assessment is accepted, the project should not continue under the same broad claim.
The available honest options become:

1. **Salvage**
   - preserve the useful components and abandon the large trust-cockpit identity.

2. **Radical simplification**
   - keep only a small owner-facing runtime contract. See
     [docs/proposals/radical-simplification.md](/C:/ProjectControlCockpit/docs/proposals/radical-simplification.md:1).

3. **Retirement**
   - retire the cockpit trust claim entirely and treat PCC as a concluded experiment with artifacts.

## Bottom line

The strongest possible concise statement this report supports is:

> **As of Saturday, July 25, 2026, PCC is not dead as code, but it is dead as-is as a credible
> trust-cockpit vision unless its runtime claim is radically reduced or replaced.**

