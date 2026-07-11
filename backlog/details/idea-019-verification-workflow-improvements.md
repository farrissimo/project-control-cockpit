# IDEA-019 Detail: Verification-Workflow Hardening (toward independent, self-observed proof)

Placeholder detail for IDEA-019. Non-canonical. Not an active task until explicitly promoted.

## Intent

Strengthen the canonical build/verify loop (Claude implements → runs the deterministic
tests → Codex adversarially reviews the real `git diff` → PASS-gated commit + push → CI
on push) at its two genuine weak points, **without adding governance or ceremony**. This
is a lens on *how work is proven*, complementary to the standard in
`docs/ENGINEERING_ASSURANCE_PLAN.md` (which says verification is commit-bound and
worker≠verifier), not a new gate.

## The two real gaps (everything below serves these)

1. **The only truly independent execution proof is not observable by the worker.**
   Every local "97/97 passed" is Claude's own self-reported run; Codex reviews *code*,
   not runs (its sandbox can't execute the suite — `EPERM` on `test-results`). The one
   independent signal is the GitHub Actions run on push — and the worker cannot read it
   from its environment (no `gh`/token). So the loop still ends with **"owner, go look at
   the checkmark,"** which is exactly the babysitting the project's #1 rule targets.

2. **The same agent writes the code and its tests.** A test can pass because it is weak
   (asserts the wrong thing, or never exercises the production path), giving a false
   green. Codex reviewing the test diff catches some of this; nothing *proves* the test
   is a real guard.

Everything is ranked by leverage against those two gaps. Items 1–2 are lean and reduce
owner involvement; item 3 is a papercut fix; items 4–5 are real but carry bloat/governance
risk and are explicitly **held until a concrete failure justifies them** (the same
discipline that kept IDEA-001 deferred).

---

## Item 1 — Close the CI observation loop (HIGHEST leverage; do first)

**What it fixes.** Gap #1. Turns "Claude says it passed" into a fact with a link:
"CI run for `<sha>` concluded **success** — <url>." Removes the manual owner step at the
end of every slice.

**How to implement.**
- Give the worker read-only access to the Actions result: a fine-grained `GITHUB_TOKEN`
  with **Actions: read** (and nothing else) in the shell environment, or `gh` CLI
  authenticated the same way. Secret handled per normal token hygiene (never printed,
  never committed).
- Add `scripts/ci-result.ps1 -Sha <sha> [-TimeoutSec N]`: polls the Actions API for the
  workflow run whose head SHA matches, returns a small JSON `{ conclusion, status, url,
  checked_at }` — `success` / `failure` / `in_progress` / `not_found`. Poll-with-timeout
  because CI takes minutes. **Fails honest**, never green: `not_found`/`in_progress`/API
  error is reported as-is, never coerced to "passed."
- Reuse, don't reinvent: `app/ci-status.js` already reads CI state and is commit-bound
  (per PART7 "examined and sound"); check whether it can be the single reader the new
  script wraps, so there is one CI-reading authority, not two.
- Worker discipline: after `git push`, call it and report the real conclusion (or
  "CI still running at <url>" if it hasn't finished) rather than asserting a pass.

**How it improves PCC.** Directly serves the truth-surface mission (a displayed/claimed
result now carries independent provenance) and the anti-babysitting rule. It also makes
the standing honest caveat ("all evidence is Claude-local") *go away* for anything CI
covers.

**Three-filter scoping.** Babysitting: net reduction (removes a manual check). Bloat: low
(one read-only script + a token; no new gate, no new UI required). Modularity: low risk if
it wraps the existing `ci-status` reader instead of adding a second CI authority.

**Honest limits.** Needs a real secret in the environment; CI only proves what CI runs
(today: `npm test` + `npm run test:unit` + `npm audit` on windows-latest — Electron e2e
included, but tail-flaky specs can muddy the signal — see IDEA/soak notes).

---

## Item 2 — Prove each regression test fails on the pre-fix code (cheap; do with Item 1)

**What it fixes.** Gap #2. A new test is only a guard if the *old* code fails it. This
converts "this would have failed before" (reasoning I do in my head) into a demonstrated
red→green.

**How to implement.**
- Per slice, mechanically: stash/checkout the pre-change version of the touched source
  (not the test), run **only** the new test(s), assert they **FAIL**; restore; run again,
  assert **PASS**. A thin `scripts/prove-test-guards.ps1 -Tests <glob> -SourcePathspec
  <paths>` can automate the stash-run-restore.
- Keep it worker-run and advisory — the *evidence* is "old code: N failed / new code: N
  passed," reported alongside the normal numbers. Not a gate.

**How it improves PCC.** Kills the "weak test = false confidence" failure mode that both
Codex and Claude can miss, and makes the test suite's own trustworthiness demonstrable —
squarely the perfection standard and the assurance plan's regression rule.

**Three-filter scoping.** Babysitting: reduction (a bad test is caught before it hides a
real regression). Bloat: near-zero (a stash/run/restore helper). Modularity: none (reads
git + runs existing tests).

**Honest limits.** Only meaningful for tests that pin a *behavior change*; pure-addition
or scaffolding tests have no "old code" to fail. The helper must refuse to run against a
dirty tree it can't cleanly restore.

---

## Item 3 — Deterministic Codex-review wrapper (papercut fix)

**What it fixes.** Two self-inflicted failure modes seen in practice: (a) piping the diff
*and* using a heredoc in the same call lets the heredoc win, so Codex reviews an **empty
diff**; (b) Codex's read-only sandbox *tries to run the tests*, hits `EPERM`, and reports
`VERDICT: FAIL` on the tooling error, not the code. Both are recovered by discipline each
time — a wrapper makes reviews reproducible instead of hand-assembled.

**How to implement.**
- `scripts/codex-review.ps1 -DiffRange <range|--staged> [-ContextFile <f>]`: assembles the
  instructions **and** the diff into a single stdin payload; hardcodes the static-only
  contract ("do NOT execute anything; the human ran the tests; review the diff text");
  sets a sane timeout (~5 min); extracts the single `VERDICT: PASS|FAIL` line; returns a
  structured result. Never lets an empty diff through (asserts the diff is non-empty).
- Reuse check (anti-bloat): `scripts/verify-work.ps1`, `scripts/second-opinion.ps1`, and
  `scripts/codex-verify-watcher.ps1` already shell Codex — the wrapper should extend/share
  those, not duplicate the invocation.

**How it improves PCC.** Removes a recurring worker error surface and makes the Codex step
auditable (same prompt shape every time). Small but real.

**Three-filter scoping.** Babysitting: minor reduction (fewer failed round-trips).
Bloat: low, *if* it consolidates the existing Codex callers rather than adding a fourth.
Modularity: neutral. **Risk to name:** it hardcodes an interaction that can drift if the
Codex CLI changes — keep the wrapper thin.

---

## Item 4 — Adversarial *panel* for CRITICAL-class changes only (HOLD until justified)

**What it fixes.** Codex is one model, one pass, medium reasoning effort — a single point
of judgment. For the highest-stakes slices (data mutation, fail-closed logic), 2–3
independent passes each told to *refute*, with majority required, catches failure modes a
single pass misses.

**How it would work.** Scope strictly to CRITICAL-class findings (never routine ones);
each reviewer gets a distinct lens (correctness / data-loss / does-it-fail-closed); require
majority-refute to block. 

**Why HOLD.** Blanket panels are exactly the ceremony the owner has pushed back on; the
value only appears on a narrow class of changes. Promote **only** if a real CRITICAL defect
slips a single Codex pass. Time/cost is non-trivial.

**Three-filter scoping.** Babysitting: neutral-to-slight-help on rare high-stakes changes.
Bloat: real if applied broadly. Modularity: neutral.

---

## Item 5 — Durable, commit-bound verification provenance (HOLD; governance-adjacent)

**What it fixes.** Today a Codex `PASS` lives only in the chat, attached to a SHA by the
worker's say-so. The known **verification-origin seam** (close-out trusts a PASS *by
content*, not by *who produced it*) means the proof is ephemeral and forgeable.

**What it would do.** Record `{ verifier, reviewed_sha, verdict, timestamp }` into a git
note or commit trailer at commit time, so verification is auditable later instead of
living in a transcript.

**Why HOLD.** This is the most architecturally meaningful but also the most likely to slide
into ceremony. It should follow, not precede, a real incident where an unattributed/ stale
PASS actually causes harm. Ties to the existing "verification-origin seam" note and
`docs/ENGINEERING_ASSURANCE_PLAN.md`.

**Three-filter scoping.** Babysitting: neutral. Bloat: medium (new artifact + readers).
Modularity: medium (anything reading the provenance becomes a coupled reader).

---

## Recommended promotion order

1. **Item 1** (CI observation) + **Item 2** (prove-the-guard) — promote together; they are
   lean, attack both real gaps, and *reduce* owner involvement. This is the whole point.
2. **Item 3** (Codex wrapper) — promote when convenient; small papercut.
3. **Items 4 & 5** — do **not** promote speculatively. Reopen only when a concrete failure
   (a CRITICAL defect passing a single Codex review; or an unattributed/stale PASS causing
   real harm) justifies the added weight.

## Explicit non-goals

- Not a new blocking gate on top of the existing loop.
- Not a scoring/percentage/dashboard layer.
- Not "make Codex review everything harder" (a process instruction with no bounded
  behavior — the shape IDEA-001/013 were declined for).
- Not a replacement for CI or for the human's final judgment — it makes the existing proof
  *independent and self-observed*, nothing more.

## Related

- `docs/ENGINEERING_ASSURANCE_PLAN.md` — the canonical worker/verifier workflow + Part 1
  rules (commit-bound verification, worker≠verifier).
- `docs/PART7_HARDENING_AUDIT.md` — where `app/ci-status.js` is noted reference-quality
  (the natural single CI reader for Item 1); the verification-origin seam context.
- IDEA-018 (Engineering: Assurance Standard) — this idea operationalizes two of its
  principles (independent proof, commit-bound verification).
