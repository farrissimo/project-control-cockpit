# Proposal: The Governance Standardization Phase

**Status:** Draft proposal — for owner review. Wired to nothing. No mechanism changed.
**Date:** 2026-07-14
**Author:** Claude (Opus 4.8), at owner request
**Nature:** Strategy / phase plan. Not a single decision — it will spawn one or more
"Proposed" ADRs once the owner approves a direction.

---

## 0. The goal, said out loud

We've been circling this for a whole conversation without naming it. Here it is:

> **One flow, every time.** Make PCC's governance *predictable, proportional, and
> self-enforcing* — so that any work, by any chat, on any day, automatically gets
> exactly the checks its stakes demand (no more, no less); nothing that matters can be
> skipped silently; and the handful of risks that genuinely *can't* be governed are
> held permanently in view instead of quietly forgotten.

The outcome we're buying: **a non-coder can trust the system's behavior without ever
reading the code.** That is the thing that makes PCC the gold-standard reference for
LLM-run projects — not any single feature, but the guarantee that the machinery behaves
the same way tomorrow as it did today, whether the owner is watching or not.

Two words carry the whole proposal:

- **Predictable** — same work → same checks → same behavior. Not "heavy." *Predictably
  light* is the goal for small work.
- **Proportional** — the weight of the checks matches the stakes of the change. This is
  the line between "enough governance" and "CCB's over-governance."

---

## 1. Why this phase exists (the owner's framing, recorded)

New feature work on PCC is **stopped on purpose.** The current mission is not to add
capability — it's to find what's hidden, un-enforced, or inconsistent in what already
exists, and to standardize it, so PCC becomes something that can be *relied on* rather
than *hoped at*.

The history that makes this urgent, in the owner's own words: *"The chaos from the first
projects was ME flailing and the LLMs doing what LLMs do, which forced me to change my
behavior."* PCC exists to stop that failure loop. **CCB was killed by over-governance**
— blanket, binary gates that bred ceremony and task-count theater. PCC's lighter,
graduated approach (BRR) let *real* checks enter the mix without strangling the work.

That was the right call. But it left a specific, glaring gap: **the checks are real, yet
they aren't enforced, aren't standardized, and aren't synchronized.** They fire
sometimes, in some modes, by whichever chat happens to remember them. The owner, being a
non-coder, cannot personally oversee these under-the-hood mechanisms — which is *exactly*
why they have to be standardized and self-running rather than left to per-chat
discretion.

This document is the assessment of that gap and the others like it, plus a proposed way
to close them without betraying the philosophy that saved PCC from CCB's fate.

---

## 2. What we're actually trying to solve, and why each part matters

| # | The problem | Why it matters |
|---|---|---|
| P1 | **Checks fire inconsistently.** The same work gets different governance depending on which chat does it and what "mode" it's in — or none at all. | Unpredictable behavior is untrustworthy behavior. A non-coder can't oversee it, so it has to be consistent *by construction*. |
| P2 | **Most rules are prose, not machinery.** "Verify before done," "make a restore point," "write a spec first" live as instructions an LLM is *trusted* to follow. | An LLM can skip a prose rule silently — and did. This is *self-certification*, the #1 failure mode PCC was built to stop. A rule with no teeth is a hope. |
| P3 | **The checks aren't unified.** doctor, CI, the release gate, detectors, the ADR gate, the Codex watcher, guarded tests — each lives in a different trigger (git hook / CI / scheduled task / app button / manual script). | There's no single governor. Nobody — especially a non-coder — can reason about "what runs, when, and why" because the answer is scattered across five mechanisms. |
| P4 | **There's no stakes classifier.** Nothing decides "this change is risky, that one is trivial." | Without it you get one of two diseases: govern *everything* (CCB's death) or govern *nothing consistently* (today). Proportionality is the cure, and it needs a classifier. |
| P5 | **Some failures can't be fixed** — they're LLMs being LLMs. | If we pretend these are solved, we recreate the fake-green problem at the meta level. They must be surfaced permanently and *managed*, not hidden or waved away. |

The through-line: **PCC's entire promise is preventing LLM failure modes for a
non-coder.** If the prevention machinery is itself un-enforced and un-standardized, PCC
documents good intentions instead of delivering the promise. Standardizing it is not
polish — it's the difference between PCC *being* the thing and merely *describing* it.

---

## 3. What we have right now (honest inventory)

Every real check/balance in PCC today, and — the important column — **whether it's
actual machinery or just prose**, and **what makes it fire**.

| Control | What it does | Trigger | Machinery or prose? | Enforced? |
|---|---|---|---|---|
| **CI** (`ci.yml`) | lint, unit suite, full guarded E2E suite, `npm audit`, ADR-format | every push / PR | Machinery | ✅ **Yes** — clean-machine, can't be locally dodged. But only fires *on push*. |
| **ADR-format gate** (`check-adr.ps1`) | blocks a malformed decision record | pre-commit **and** CI | Machinery | ✅ if hooks installed and not `--no-verify`'d |
| **Release gate** (`run-release-gate.ps1`) | git-clean, sync, remote head, exact-SHA CI, unit+full+audit, detectors → PASS/UNKNOWN/FAIL | **manual**, release-time | Machinery | ⚠️ Real, but you have to *choose* to run it |
| **doctor.ps1** | health report | app button, or manual | Advisory | ❌ never gates, not scheduled |
| **Detectors** (bloat, drift, stale-docs, repo-sync, untracked, high-stakes, sycophancy, chat-rollover) | honest "observed / might mean / not proven / do this" signals | app + release gate | Surface | ❌ inform, don't enforce |
| **Independent verification (Codex)** — formal lane | `codex exec` verifies the diff | scheduled task every 3 min, watching `task-state.json` | Machinery | ✅ **but only for work that entered the formal task lane** |
| **Independent verification** — ad-hoc chat | "build → CI → verify → done" | none | **Prose** (ADR-0005 admits it) | ❌ **This is the gap that bit us** |
| **Restore point before risky work** | git-independent backup | "not optional" per CLAUDE.md | **Prose** | ❌ |
| **Spec-first / in-scope / research-first** | discipline before building | AGENTS.md / CLAUDE.md | **Prose** | ❌ |
| **Guarded test runner** (`run-guarded.ps1`) | reaps stale electrons, aborts hangs | wraps every test run | Machinery | ✅ |
| **Mutation proof / failure injection** | prove the tests catch real breaks | manual | Machinery | ⚠️ manual |
| **BRR task lifecycle** (`task-state.json` + handoff/close-out scripts) | the full formal governed cycle | manual entry into the lane | Machinery | ✅ **but only if a chat chooses to enter it** |

Read the "Enforced?" column top to bottom and the shape of the problem is obvious:
**the things that are enforced are enforced; the things that are prose are skippable —
and the most important safety rule in the whole project (independent verification for
ad-hoc work) is in the prose bucket.**

---

## 4. Where the gaps are (ranked)

1. **No stakes classifier (the missing keystone).** Nothing maps *"what did this change
   touch"* → *"what proof does it need."* Every other fix depends on this one existing.
2. **Verification is prose for ad-hoc work.** The live, already-happened gap. A chat can
   declare work done and commit it with zero independent check, silently.
3. **No single governor.** The checks are scattered across five trigger mechanisms with
   no conductor, so "what runs when" is unknowable at a glance.
4. **No door between ad-hoc and formal.** The formal lane's real machinery (including the
   verification watcher) only fires if a chat first chooses to enter it — which ad-hoc
   chats never do. So the good machinery is bypassed *by default*.
5. **Backups, spec-first, in-scope are prose.** Same skippable-by-an-LLM class as #2.
6. **doctor never gates and isn't scheduled.** It's a health report you have to remember
   to look at.
7. **The un-bypassable layer is OFF — confirmed.** Local hooks are escapable
   (`--no-verify`) and missing on a fresh clone until `npm install` runs once. GitHub
   **branch protection** — the one truly un-bypassable gate — is **not configured**
   (owner-verified 2026-07-14: repo Settings → Branches reads *"Classic branch
   protections have not been configured"*). Today nothing requires CI to be green before
   a push to `main` lands.
8. **No live "governance state of current work" surface.** PCC watches the repo but
   doesn't yet show, continuously, *"this in-progress change is stakes=X, proof
   present=Y, so it's VERIFIED / UNVERIFIED."*
9. **The execution-authority surface can display a false state — demonstrated
   2026-07-14.** The "Build session enabled — it can now run commands and write files"
   text is written into the chat transcript as a *saved message*, and build authority
   *expires* (idle 30 min / hard 2 h) without ever retracting it. So on a fresh app open
   with zero clicks, a chat can greet the owner with "it can run commands and write
   files" while the live authority is read-only. **Verified this is display-only, not a
   breach:** the real spawn gate is the live `authority.authorizeSend` (authority-store.js),
   the persisted `authority-store.json` was empty (`{"chats":{}}`), and the running app's
   `authorityState` IPC returned `read_only` for every banner-carrying chat with an empty
   event log. Enforcement is sound; the *surface* lies. On the one control born from the
   off-the-rails incident, a lying surface is a real gap. (Related: two separate
   "is this a build chat?" facts — the persistent `buildChat` UI flag vs. the live
   expiring authority — can drift; today only the live one gates, but it's a latent trap.
   Plus a stale code comment at `renderer.js:1505` that no longer matches the code.)

---

## 5. The proposed shape (the actual proposal)

Reuse proven patterns; build only what's genuinely PCC-specific. This is **BRR applied
to execution** — graduated, proportional autonomy — which is the antidote to CCB, not a
step toward it.

### 5.1 Declare stakes as data (the ungameable classifier)

A short, owner-legible manifest — **CODEOWNERS-shaped** — that tags paths by stakes:

- **Crucial** → source-of-truth docs, canonical docs, integrity-critical code, state
  writers. Touch one → full checks required.
- **Noise / expected** → `backlog/IDEAS.md`, brainstorm dumps, this proposals folder.
  Touch only these → near-zero governance, by design.
- **Default** → everything else gets a sensible middle tier.

Why this matters: **stakes are decided by *what the diff touched*, which a git hook
reads deterministically — the chat's self-rating is removed entirely.** A chat can't
call its work "tiny" to dodge the gate, because it can't lie about which files it
changed. This is PCC's own doctrine — *"declare the boundary as data, then check against
it."*

**Honest correction (second-opinion review, §10):** path-tagging removes *self-rating*,
but it is **not "ungameable"** — path alone does not fully determine risk, and a chat
could edit the manifest or the governor itself. The classifier therefore needs the
deterministic **escalation rules** in §10.1 layered on top of the path tiers. Still lean;
still no AI risk-classifier.

### 5.2 One governor engine (reused, not reinvented)

A single thin script — **Danger/policy-as-code pattern**, run locally — that:

1. reads the changed files in the working tree / the commit,
2. looks up their stakes tier in the manifest,
3. determines the required proof for that tier,
4. checks whether the receipts actually exist (tests green on this diff, an independent
   verification verdict bound to *this exact diff*, doctor OK, etc.),
5. returns a verdict.

Per DECISION-074, it's a script over the `.cockpit/` bridge with declared inputs/outputs
and no hidden shared state — so it stays extractable.

### 5.3 Two touchpoints, one engine

- **Surface (always on, never blocks):** PCC shows the governor's verdict *live while you
  work*. Gaps appear when they're cheap to fix. This is the piece with **no off-the-shelf
  equivalent** — it needs an always-watching app, which PCC uniquely already is. It's
  PCC's edge, not something to buy.
- **Gate (at commit/push, blocks only the risky):** the same verdict, consulted at the
  one place a chat can't dodge. It fails closed **only** when a *tagged-crucial* change
  is missing its required proof. Tiny/noise changes sail through — *predictably light.*

### 5.4 Backstop (the un-bypassable layer)

Confirm and, if needed, turn on **GitHub branch protection**: nothing merges to `main`
unless the checks passed. This is the layer no local `--no-verify` can escape. Standard,
free, and it answers "how does it *stay* enforced" honestly.

### 5.5 Measure first (per the owner's own 2026-07-14 rule)

Before building any of it: **baseline the current skip rate** — across recent real work,
how often did a change ship without the proof its stakes warranted? That number makes the
whole phase a *tested hypothesis* instead of another unproven process layer. If the fix
doesn't move it, the fix gets reverted. We hold ourselves to the standard we're building.

---

## 6. The really hard problems — and the ones that may not be solvable now

This is the section the owner specifically asked for. Honesty over comfort.

### 6.1 Hard, but we have a real handle

- **The "done" signal problem.** An LLM chat has **no mechanical "I'm finished" moment.**
  So *any* "run the checks when work is done" secretly depends on the chat *choosing* to
  run them. **The only hard, un-dodgeable trigger is commit/push.** *Handle:* make the
  commit boundary the honest gate, and surface continuously before it so nothing is a
  surprise. We don't solve the missing signal — we route around it.

- **Stakes gaming.** If a chat rates its own stakes, it can under-rate to skip the gate.
  *Handle:* path-based tagging removes the chat's opinion (§5.1). **Solved at file
  granularity.** *Residual:* "only this one risky *function* inside an otherwise-boring
  file" is harder to detect deterministically. *Recommendation:* start at file/path
  granularity (covers the vast majority, dead simple, ungameable); go finer only if a
  real miss proves it's needed. Don't build the hard version on speculation.

- **The bypass problem.** Every local gate has an escape (`--no-verify`); even server-side
  branch protection can be switched off by the owner. *Handle:* you can't eliminate the
  bypass — but you can make it **logged and loud** instead of silent. A used bypass should
  leave a visible mark. Predictability comes from *visibility of the exception*, not from
  pretending no exception exists.

### 6.2 Probably not fully solvable — the "billboard" category

These are **LLMs doing LLM things.** They can be *reduced*, never *eliminated*. Pretending
otherwise would be the exact fake-green disease, one level up.

- **Confident wrongness / hallucination.** A chat can be fluently, plausibly wrong —
  including about whether it followed the rules.
- **Self-certification instinct.** Left alone, an LLM will tend to bless its own work.
  (ADR-0005 is this caught in the act.)
- **Shared blind spots.** Two AIs can be wrong *the same way* — "worker + verifier agree"
  is still two opinions, not a fact (TRUST_CALIBRATION Level 1).
- **"Was it the RIGHT thing?"** No machinery can prove the work matched the owner's
  *intent* — only the owner can. This is a permanent human-in-the-loop residue.
- **Who checks the checkers?** Mutation testing proves *some* tests catch *some* breaks,
  but "are all our checks themselves correct?" is never fully closed.

### 6.3 How to *live with* the unsolvable — better than "it's broke, deal with it"

The owner asked for a real answer here, not a shrug. Proposed: a permanent, honest
**Known Residual Risks** surface — the "big billboard with flashing lights." For each
unsolvable item, state four things plainly:

1. **What it is** (in non-coder language).
2. **Why it can't be fully fixed** (so it never reads as neglect).
3. **What we already do to shrink it** (adversarial verification, path-gates, honest
   "not proven" lines, live surfacing).
4. **What *you*, the owner, should watch for** — the specific human check that closes the
   gap machinery can't.

This turns "can't fix" into **"consciously managed, in permanent view."** It's the
truth-surface doctrine PCC already paid for, aimed at the governance system's *own limits*
instead of at the code. The residual risk stops being a hidden liability and becomes a
known, owned, visible fact — which is exactly the standard PCC holds everything else to.

---

## 7. Staying inside the core philosophies (the guardrails)

This phase is only worth doing if it *strengthens* the principles, never trades them away.

| Principle | How this proposal honors it |
|---|---|
| **Lean / anti-over-governance** | Proportional by construction. Tiny/noise work stays frictionless; only tagged-crucial paths gate. *Predictable ≠ heavy.* |
| **Reuse, don't reinvent** | CODEOWNERS / Danger / policy-as-code / branch protection are all off-the-shelf. Only the tag list, the PCC-specific checks, and the live surface are custom. |
| **Extractable (DECISION-074)** | The governor is a script over the `.cockpit/` bridge with declared I/O and no hidden state. |
| **Honesty / fail-visible** | Surface everywhere; block only the risky; the billboard for what can't be fixed. Never paint green over unknown. |
| **Measurable (2026-07-14 rule)** | Baseline the skip rate first. If it doesn't move the number, it reverts. |
| **BRR / graduated autonomy** | This *is* BRR, applied to execution. The cure for CCB, not a relapse into it. |

### What we must NOT do (the CCB tripwires)

- Don't gate everything. Don't add ceremony to small, reversible work.
- Don't build a heavy classifier engine when a path manifest does the job.
- Don't require *human* review per path — PCC has no PR-review culture, and the owner
  doesn't read code. The verifier is Codex; the human check is intent, not lines.
- Don't let the governor grow hidden state or reach into other scripts' internals.
- Keep the tag list **short and owner-legible.** If the owner can't read it and understand
  it, it's already too complex.

---

## 8. Proposed sequence (each step is a stop-and-approve gate)

Nothing here is a commitment yet. Recommended order, cheapest-and-most-clarifying first:

1. **The map** — formalize §3 into one canonical operating-contract doc: every check, its
   trigger, its mechanism, and its honest enforced-or-prose status. *(This proposal is
   most of it already.)* Cheap; it's the spec for everything after.
2. **Baseline the skip rate** — measure the current gap before touching anything.
3. **Confirm the un-bypassable backstop** — eyes-on check of GitHub branch protection.
4. **Draft the stakes manifest** — the path→tier tag list, owner-reviewed.
5. **Build the governor engine** — thin, reused pattern, extractable.
6. **Wire the two touchpoints** — live surface first (harmless), then the commit gate.
7. **Stand up the billboard** — the Known Residual Risks surface.
8. **Re-measure** — prove the number moved, or revert.

Each of steps 3–8 becomes its own "Proposed" ADR and its own bounded slice. No big-bang.

---

## 9. Baseline measurement (2026-07-14, read-only)

Per the measure-first rule (§5.5), before building anything we captured the current
skip rate. Method: classify the last 25 commits by what they touched (a first-cut
heuristic — app/scripts/CI/hooks/governance-rules = non-trivial, warranting independent
verification per ADR-0005; docs/backlog-only = noise), then check each non-trivial commit
for a **machine-checkable, diff-bound independent-verification receipt.**

**Result:**
- ~20 of the last 25 commits were **non-trivial** (touched product/integrity/governance
  surface). ~5 were docs/backlog-only noise (PROJECT.md / IDEAS.md updates).
- **0 of those ~20 carry a checkable, diff-bound verification receipt.** Every
  `verification-result.json` in the repo belongs to the older formal BRR task lane
  (`pcc-brr1/brr2…`); none is tied to any of these 25 commits, because this recent work
  never entered that lane.
- 5 of 25 commit subjects reference verification/review as **prose**; ADR-0005 narrates a
  Codex PASS in prose. Prose is not a checkable receipt bound to the exact diff.

**Baseline number:** the skip rate for *checkable* independent verification on recent
non-trivial work is **effectively 100%.** Not because verification never happened — it
sometimes did, in prose — but because outside the formal task lane it is **never captured
as a diff-bound, machine-verifiable receipt.** This is precisely the gap the phase closes.
The phase's success metric is this number moving from ~100% toward ~0% for tagged-crucial
changes (proportionally — noise changes are exempt by design).

**Honest limits of this baseline:** the classifier is a files-touched heuristic (the real
stakes manifest doesn't exist yet); "checkable receipt" was judged by the presence of a
commit-bound `verification-result.json`; live per-commit CI status was not pulled (needs
authenticated access) and is a *different* proof than independent verification, not
conflated here. The headline — zero diff-bound verification receipts outside the formal
lane — is robust regardless.

## 10. Tightenings from the second-opinion review (GPT, 2026-07-14)

A secondary advisor (GPT — remote-repo access, long familiarity with PCC) reviewed this
proposal. It **concurred with the architecture** and added enforcement-rigor tightenings.
Five are genuinely better and are now folded into the acceptance criteria below; one is a
milestone reframe adopted as framing; the "four proofs" it proposed are deferred as
out-of-scope for this frozen phase.

### 10.1 Adopted acceptance-criteria tightenings

1. **Deterministic escalation rules on top of path tiers** (fixes the "ungameable"
   overclaim). Regardless of path tier, a change escalates when it:
   - deletes or renames a protected artifact;
   - touches a dependency / lockfile;
   - touches CI, git hooks, the test runner, authority, persistence, schemas, packaging —
     **or the governor or the stakes manifest itself** (the governed entity must not
     quietly edit its own rules/governor);
   - removes or materially weakens tests;
   - introduces a new, unclassified path → default tier, **never** noise;
   - is unusually large / cross-cutting (needs a **deterministic threshold**, not a vibe).
2. **The verification receipt is a hard schema, bound to the exact change.** It carries:
   repo identity, base commit, tested/verified commit + diff identity, dirty-tree state,
   the required check set, each check's result, verifier identity, timestamp, and
   expiration/invalidation conditions. **Any subsequent relevant change invalidates the
   receipt** — yesterday's green can never be reused on today's diff. (Consistent with the
   release gate's exact-SHA binding + HEAD-stability recheck; now mandatory as a schema.)
3. **The governor consumes; it never re-derives.** It computes policy + evidence status by
   reading the declared outputs of CI, the release gate, doctor, the verifier, and the
   detectors — never a second definition of "CI passed" or "verified." (Already PCC's
   one-authority-per-domain rule; now an explicit criterion.)
4. **Branch protection is continuously verified, not assumed once.** PCC must *detect*
   whether the expected server-side protection is active on this repo, show **UNKNOWN /
   UNPROTECTED** when it can't confirm, never claim the backstop from documentation, offer
   a simple setup path, and visibly record intentional direct-push bypasses. *Open
   dependency:* reading protection status needs authenticated GitHub access (a token /
   `gh`), which the worker does not have today — which is itself why the backstop went
   unverified. To be designed, not assumed free.
5. **No vague "doctor must be green."** Each check carries an explicit role for the current
   change: **required-for-this-tier / advisory / not-applicable / unknown / failed.** An
   unrelated warning must not block a harmless change (that would slide back toward
   CCB-style all-or-nothing gating).
6. **A bypass is a durable, structured exception record.** It need not be impossible — it
   must be **impossible to make invisible.** It records: what was bypassed, why, who
   authorized it, the exact change identity, expiration, the compensating action, and
   whether follow-up is still open. (Extends the existing `release-gate-exceptions.json`
   pattern.)

### 10.2 Milestone reframe (adopted as framing, not new build scope)

Landing this code makes PCC a **gold-standard *candidate*, not the finished gold
standard.** The remaining proof is **successful transfer**: a fresh non-coder taking a new
project through idea → spec → bounded build → independent verification → real execution →
owner acceptance → recovery → release, with PCC applying the right governance
automatically and without the owner reading code or reminding an LLM of the process. That
is the true success milestone — recorded so "the phase shipped" is never mistaken for "the
goal is proven."

### 10.3 Explicitly deferred — NOT this phase (respects the feature freeze)

GPT's "four proofs" (clean-start, transfer-to-multiple-real-projects, owner-comprehension
surfaces, real-product release-confidence ladder) are correct as the *ultimate* bar but
are **out of scope for this frozen phase.** They are largely future/roadmap work already
recorded (packaging; the Maturity Checkpoint and Path A/B in
`docs/CCB_PCC_RELATIONSHIP.md`). Pulling them in now would reopen the feature work the
owner deliberately halted. Captured here so they are not lost; not built now.

### 10.4 What the review did *not* change

The core architecture — proportional, path-seeded, surface-everywhere + gate-the-risky,
thin consuming governor, honest residual-risk billboard — **stands; GPT concurred with
it.** The review also did not have this session's live finding (the demonstrated
authority-surface defect, §4 #9), so on empirical gap-finding this plan is a step ahead of
the review.

## 11. One-line summary

**PCC is close.** A tremendous amount of the machinery already exists and works — the gap
is that it isn't *standardized, enforced, or synchronized*, and a non-coder can't oversee
it by hand. This phase makes the governance behave the same way every time, proportional
to real stakes, self-running without babysitting — and puts the handful of genuinely
unfixable, LLM-native risks on a permanent, honest billboard instead of pretending
they're solved. Do that, and PCC becomes the thing it's trying to be: the gold standard
for how a non-coder safely runs real projects with LLMs.
