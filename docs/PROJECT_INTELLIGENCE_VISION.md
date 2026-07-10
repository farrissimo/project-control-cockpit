# PROJECT_INTELLIGENCE_VISION — PCC as the evidence-backed intelligence layer

Status: **NORTH STAR / durable vision — NOT a build commitment.** This records a
10,000-ft direction so it is not lost (the exact "an idea that didn't get captured"
pain that started the thread). It changes nothing we ship today. PCC stays lean.
See the durable-vision stance in [vision promises: stable vs evolving].

Origin: 2026-07-10, from the chat-history/search work (docs/CHAT_RECALL_SPEC.md) and
the owner's brainstorm developed with GPT — preserved verbatim in
[brainstorms/2026-07-10-project-intelligence.md](brainstorms/2026-07-10-project-intelligence.md).

## The reframe
The global chat search we just shipped is not the feature. It is the **first interface**
to something larger: PCC is quietly creating a **complete historical evidence layer for
AI-built software**. In AI-built projects, most engineering *knowledge* — original ideas,
rejected alternatives, owner intent, corrections, approvals, tradeoffs, governance
evolution — lives in **conversation**, not code. Code alone cannot reconstruct *why*.

Said differently: we are not building projects. We are building a **method for building
with LLMs, validated by living in it.** PCC is the instrument; the spawned projects are
the trials; the accumulating evidence is the method's proof. The eventual product — if
there is one — is **the method, evidenced**: an environment where every guardrail is
backed by a real, recorded failure it is proven to prevent. The market has *speed*; it
does not have *earned trust*. Trust-through-evidence is the unclaimed ground.

## Why PCC (and almost nothing else) can do this
Generic agent-memory tools remember *conversations*; incident tools analyze *incidents*.
PCC governs one project and already owns the **entire verified causal chain**:
intent (chat) → change (commit) → proof (verification) → decision (DECISIONS.md) →
reversal (chat). Two properties make it a trustworthy substrate, not just a pile of logs:
1. **Verified truth, not narrative.** PCC already records executed proof and refuses
   fake-green (see EXECUTION_AUTHORITY_MODEL / VERIFICATION_RESULT_SPEC / the
   verification-origin work). A forensic record is only worth building a product on if it
   stayed honest — honesty-under-pressure is PCC's hardest-won property and the moat.
2. **The epistemic states already exist.** The "authority" ladder below is not new — it
   mirrors PCC's existing TYPE model (mentioned/discussed vs owner-approved vs
   local_execution-verified). This vision *extends* machinery PCC already has.

## The capability arc (three tiers)
1. **Recall — BUILT.** Find what happened. Plain-English search over chats
   (expand→grep→judge), transcripts persisted for all chats. docs/CHAT_RECALL_SPEC.md.
2. **Forensic record / project archaeology — future.** Reconstruct *how and why* by
   linking each chat to the real events PCC already tracks and replaying the chain:
   `idea → discussion → owner correction → approved task → implementation → tests →
   verification → revision`. Richer than git history alone. Bitemporal (event-time vs
   observed-time) so reversals/supersession are first-class without losing history.
3. **Process intelligence / learning — frontier.** The record analyzes *itself*: what
   caused the most rework, which safeguards prevented failures, which task types succeed,
   where babysitting is highest and whether it is falling, which assumptions remain
   untested — then feeds lessons back into PCC's rules/decisions so the project stops
   repeating rakes. This is where PCC becomes an active governor, not an archive.

## Evidence sources (the eventual corpus)
chats · summaries · source code · git history · commits · tasks · owner decisions ·
verification reports · tests · logs · state files · backups · checkpoints · documentation.
Together: the complete project history.

## Durable design invariants (must hold whenever any tier is built)
These are the non-negotiables from the brainstorm — record them now so a future build
can't quietly violate them:
- **Preserve raw evidence.** Never replace a transcript with its summary. Summaries are
  *navigation*; raw chats/commits/records remain the source of truth.
- **Provenance on every answer.** A result must say where it came from — raw chat /
  summary / decision / task / code / verification / test / commit.
- **Epistemic state, not just relevance.** Distinguish *mentioned* vs *discussed* vs
  *owner-approved* vs *implemented* vs *tested* vs *independently verified*. These are
  different truths and must never be flattened (this is the anti-fake-green rule, applied
  to memory).
- **Chat lifecycle is explicit.** active transcript / provisional summary / final summary
  / reopened — a summary is not authoritative just because time passed.

## Reuse, don't reinvent (researched 2026-07-10)
This is a recognized frontier; the engines exist.
- **Graphiti / Zep** — open-source temporal knowledge-graph agent memory; *bitemporal*
  facts handle contradictions/reversals without information loss (directly answers the
  supersession case). The proven substrate for tier 2.
- **Orama** — local hybrid full-text+vector retrieval (the tier-1 retrieval upgrade).
- **Automated post-incident learning** (Rootly / incident.io playbook) — pattern-mining
  across a structured record; the tier-3 reference.
PCC's original contribution is not the engine — it is feeding *verified, evidence-linked
project truth* into it, which none of these have.

## Stance — how we proceed (the discipline that protects the vision)
- **PCC stays lean and stops here** for now. Feature growth past search is diminishing
  returns against rising bloat risk. The discipline that made PCC good includes knowing
  when not to add.
- **The evidence accrues for FREE.** Normal PCC operation already preserves the corpus —
  commits, DECISIONS.md, verification records, memory files, corrections. Stopping costs
  nothing on this vision; the raw material keeps accumulating whether or not we act.
- **Capture now, mine later, decide the product last.** The evidence is not yet rich
  enough to design the product top-down. Force it and we risk the lean machine. Let the
  data reveal the shape.
- **Honesty is the precondition.** The vision *depends on* the rigor that generates the
  evidence. Loosening PCC's honesty to chase the mega-product poisons the well. So the
  big vision and "keep PCC lean and honest" are the same instruction, not opposed ones.

## Open questions (for when this is picked up, not now)
- The cheap first slice of tier 2: a search result that also shows the commit it produced
  and whether it verified — incremental on what exists, delivers the forensic "feel".
- Cross-project vs per-project intelligence ("which project did I solve X").
- When (chat count / project count) the corpus is rich enough to mine for tier 3.
