# Communication Contracts — one fixed template per channel   (status: active — partially machinery-enforced; ADR-0009 category 1)

> **Current state (honest, updated 2026-07-15):** the high-value channels are now **machinery, built and
> parity-proven**, not prose — but NOT every channel is enforced, so the honest status is "active,
> partially machinery-enforced," never "all standardized." What's real:
> - **Channels 1, 3, 4 — built + verified + travel.** `scripts/new-milestone-update.ps1` (channel 1,
>   PR #16) and `scripts/new-verification-request.ps1` (channels 3 & 4, PR #18) are deterministic
>   generators, Codex-verified, and they propagate to spawned projects via the wholesale `scripts/` copy;
>   a **live scaffold** proves the tools + a seeded starter phase-manifest land and the inherited
>   generator computes a real % (scaffold-kit.spec.js). AC-1/AC-3/AC-4 are met by these.
> - **Channel 5 (agent verdict) travels** in AGENTS.md (seeded wholesale) — documented, used by
>   convention, now proven to reach spawned projects. Still **not machine-enforced** (a verifier could
>   deviate) — honest residue.
> - **Channel 7 (app handoff)** spec now travels too (`docs/HANDOFF_PACKET_SPEC.md` seeded). Adherence
>   is still by convention, not enforced.
> - **Channel 2 (owner action → copy block)** is a standing discipline, already met and surfaced by the
>   milestone generator's "Needs you" block; its success metric is a **falling frequency**, not a
>   generator (a generator there would be over-governance — yardstick #2). **Channel 6 (chat start-off)**
>   is improved; the remaining work is to **measure** how reliably it fires (deferred, noted below).
>
> Labelling the whole category "done/all-standardized" would be the exact fake-green this project kills
> (the first draft was caught overclaiming by GPT secondary verification, 2026-07-15). The `SHALL`
> criteria below are met where a channel is built (1/3/4) and remain *targets* where it is not (2/5/6/7).

## Objective
Stop winging communication. Every channel — worker↔Codex, worker↔GPT, worker↔owner, app↔app — gets a
**fixed contract** born from what has actually worked (evidence below), so format never depends on the
worker remembering it. The owner has asked for the same things "hundreds of times" (copy blocks, plain
language, concise, no wall of text); repetition *is* the proof it wasn't standardized.

## The enforcement principle (why a template alone isn't enough)
A rule in CLAUDE.md is **prose** — it drifts, so the worker drifts, so the owner repeats himself. The
fix (principle #3, machinery over prose): **move the structure out of the LLM's judgment and into
machinery.** A generator assembles the fixed format, computes the numbers (phase %, what-changed from
git), and runs the checks; the LLM fills only the plain-English judgment slots. Then "same format every
time" is guaranteed by code, not memory. Channels are marked below by how far they've been converted.

## Channels & contracts

### 1. Owner — significant milestone update  *(state: winging-it → to be templated)*
Fires only on a **significant** milestone (not every turn). Fixed blocks, each 1–2 lines, visually
organized, **never a wall of text**, plain non-technical language, **identical format every time**:
- **Header:** milestone name · phase · **% complete** (a *real computed* number = done slices ÷ total;
  never invented — inventing it would be the fake-green this project kills)
- **What just happened** (plain)
- **Where it fits** — this phase / the whole project
- **Why it's better**
- **Principles check** — confirms adherence to the canonical yardstick (ADR-0009); **flags** any
  principle the change strained
- **Needs you** — anything unusual / requiring approval, surfaced not buried (or "nothing")

### 2. Owner — action item  *(state: prose standing-rule; high-frequency)*
Anything the owner must **verify, decide, or act on** goes in a **copy block, every time, unprompted**
(standing rule since 2026-06-01, reaffirmed 2026-07-11). Self-contained. As the system handles more
autonomously, these should get **rarer** — a falling count is the babysitting metric moving.

### 3. Worker → Codex — verification request  *(state: semi-canonical → to be templated)*
Fixed prompt shape that has worked this phase: *role (read-only, don't run guarded suite) · exact
review target (`git diff --cached main`) · context · specific things to judge · required output
`VERDICT / EVIDENCE / NOT PROVEN`.* Piped `< /dev/null` (Codex blocks on open stdin).

### 4. Worker → GPT — secondary verification  *(state: winging-it → to be templated + triggered)*
Fires **only when the secondary-verification trigger applies** (below) — not by reflex. Fixed copy-block
shape: *repo + PR/commit (pushed first, so GPT can read GitHub) · what changed & why · numbered
`confirm:` questions · required output.* GPT reads the remote repo only; inline anything not yet pushed.

### 5. Agent↔agent — verdict contract  *(state: documented in AGENTS.md; enforcement/parity unverified)*
`VERDICT: PASS|FAIL|INSUFFICIENT|BLOCKED|OUT_OF_SCOPE` + `EVIDENCE` (what was actually checked) +
`NOT PROVEN`. Documented in AGENTS.md and used by convention; keep as the single verdict shape. **Gap:**
it is not *enforced* (a verifier could deviate), and that it travels to spawned projects is unproven —
the audit must confirm both before calling it canonical.

### 6. Chat start-off — "let's get started"  *(state: improved; measure)*
A new chat resumes from repo truth (PROJECT.md → live git/CI checks) with zero re-briefing. Much
improved lately; mine chat start-offs and **measure** how reliably it fires.

### 7. App↔app — handoff packet  *(state: spec exists; enforcement/parity unverified)*
`docs/HANDOFF_PACKET_SPEC.md` defines the cross-session/app handoff format. **Gap:** whether it is
actually followed and whether it propagates to spawned projects via the scaffolder is unproven — the
audit must confirm before calling it canonical.

## The secondary-verification trigger (settled by Claude + Codex; full text in ADR-0009)
Bring in GPT (third, independent, different-model) **only when a mistake would be both hard to notice
and costly** — ANY of: (1) touches **T0 trust-root / verification/governance machinery**; (2) changes
**trust boundaries, evidence standards, release gating, rollback posture, or the security model**; (3)
is **high-consequence + low-observability if wrong**, especially hard to reverse. Skip routine T1–T4 and
reversible design ADRs. Evidence it works: GPT's independent verification this phase caught real defects
(empty audit-range, self-modifying enforcement, fail-open hooks, overclaim wording) that Codex **and**
the local suite both missed — all on T0 code, where same-model-class reviewers share blind spots.

## Acceptance criteria
- AC-1: Every owner milestone update SHALL use the fixed block set above — plain, visually organized,
  never a wall of text, with a **computed** phase %, a principles check, and a surfaced "needs you".
- AC-2: Anything the owner must verify/decide/act on SHALL appear in a copy block, unprompted.
- AC-3: GPT secondary verification SHALL fire only when the trigger applies, and SHALL be delivered as
  the fixed copy-block shape against a **pushed** commit (or with content inlined).
- AC-4: Codex requests and all agent verdicts SHALL use the fixed request/verdict contracts.
- AC-5: These contracts SHALL travel to spawned projects via the scaffolder (parity, ADR-0004).

## Proof & benefit (audit grid — category 1)
| Contract | State | Proof | Benefit | Gap |
|---|---|---|---|---|
| Owner milestone update | **machinery-enforced + parity-proven** | `scripts/new-milestone-update.ps1` (PR #16); 16 tests; computed %, fails closed to UNKNOWN; travels + scaffold-proven | owner stops repeating himself; the % can't be faked | worker still has to *run* it (habit, not yet enforced) |
| Owner action → copy block | prose standing-rule (met) | dated 20+× since 2026-06-01; surfaced by the milestone "Needs you" block | owner stops hunting/relaying | not machine-enforced; success = falling frequency (a generator would be over-governance) |
| Codex request | **machinery-enforced + parity-proven** | `scripts/new-verification-request.ps1 -Channel codex` (PR #18); 9 tests; travels wholesale | consistent reviews | worker still has to run it |
| GPT secondary verification | **machinery-enforced + parity-proven** | `…-Channel gpt` (PR #18): computed remote URL + push guard + required trigger reason; travels | breaks shared blind spot; won't fire against unpushed code | trigger *applicability* stays judgment (surfaced, not adjudicated) |
| Agent verdict contract | documented + parity-proven | AGENTS.md, seeded wholesale → reaches spawned projects | one comparable shape | not machine-enforced (a verifier could deviate) — honest residue |
| App↔app handoff | spec exists + parity-proven | `docs/HANDOFF_PACKET_SPEC.md` now seeded by the scaffolder | lossless handoff | adherence still by convention, not enforced |
| Chat start-off | improved | resumes from PROJECT.md → live git/CI (this session did) | zero re-briefing | reliability not yet **measured** (deferred) |

## Notes
Multi-agent reality: the standard spans Claude Code + Codex + GPT, including GPT's remote-only
constraint (why the copy block exists). "Local-first" applies here too — the mining that produced this
was a deterministic script over 34MB of transcripts; the LLM was spent only on judgment.
