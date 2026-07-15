# Proposal: Governance Hardening (post-GPT-verification)

**Status:** Approved by owner 2026-07-15 — ready to build as the next slice. **Not yet built.**
**Nature:** Bug-fix + honesty hardening of the governor (ADR-0006 gate, ADR-0007 trailer), in
response to an independent third verification. This is the **immediate next work** for the
Governance Standardization phase. Build it in the standard governed loop
(branch → spec → build → local green → `codex exec` verify → dogfood → PR → CI → merge → re-measure).

---

## Why this exists

After the Gate (ADR-0006, PR #8, commit `d263f262`) and the durable Trailer (ADR-0007, PR #9,
commit `6a09fbd`) merged, the owner asked GPT (independent, **remote GitHub repo read access**) to
run an adversarial, non-led verification of the whole phase. GPT verified against HEAD
`fc5964bc81bd2340d3bce5f46313c56f702964bc`. It found **real defects that the local test suite and
the `codex exec` reviews both missed**, plus several overclaiming ("fake-green") wording issues —
which is precisely the disease PCC exists to kill. The owner approved fixing them.

GPT's sharpened one-line verdict (adopt this framing — it is more honest than the worker's original):
> The phase delivers **deterministic, proportional governance + durable diff-bound attestations +
> useful PR-time detection for a *cooperative* worker** — but it does **not** withstand an
> *adversarial* worker with repo write access, and it should not yet be described as guaranteeing a
> non-coder can trust the governance "whether the owner is watching or not."

**The honest boundary, stated plainly:** for a cooperative worker, ordinary skips / tampering /
forged-bypasses are caught. For an adversarial worker with write access, they are **not fully** —
they can fabricate a PASS, weaken the judge in the same PR, exploit a direct-push range bug, or rely
on branch protection that the system does not self-verify.

---

## The approved fix list (build these)

### Non-negotiable — honesty / anti-fake-green (do regardless)
These are the project's cardinal sin at the wording level: strings that promise more than the code
delivers. Fix every one to match reality.

- **H1. "un-bypassable server-side backstop"** (in `scripts/run-governance-gate.ps1`, docs, PR text).
  It leans entirely on GitHub branch protection, which is **not self-verified** by the system (and
  GPT could not confirm it is on). Qualify every such phrase: it is un-bypassable **only if**
  branch protection is active and required, work enters via PR (not direct push), and the PR does
  not weaken the audit machinery.
- **H2. "catches a forged trailer"** (`.github/workflows/ci.yml` comment; specs). It catches
  **malformed / mismatched / invalid-BYPASS** trailers — **NOT** a correctly-bound *fabricated PASS*.
  Add that qualification everywhere it appears.
- **H3. "verified" overstates the measure.** The audit proves a **valid, diff-bound *claim of*
  verification (attestation)**, not that verification *happened*. Rename the measure and the audit
  output from "verified" to **"attestation" / "attested"** (e.g. `audit-verification-trailers.ps1`
  output, spec, PROJECT.md). Distinguish "valid bound claim" from "truthfully independently verified."
- **H4. manifest prose vs behavior.** `.cockpit/state/stakes-manifest.json` `weakened_tests` rule
  prose says it covers a test whose "assertions are materially reduced," but the classifier only
  escalates test **deletion**. Align the words to the actual (deletion-only) behavior, or note the
  assertion-level case as explicitly NOT auto-detected (the classifier's `not_proven` already admits
  this — make the manifest consistent).
- **H5. "one place a chat can't dodge" / "ungameable"** — the local commit gate IS dodged with
  `--no-verify`; path-tagging is explicitly *not* ungameable (§10.1 already corrected this — make all
  wording consistent with the correction).

### Real defects — the teeth
- **T1. Direct-push empty audit range (GPT Critical #3).** In `ci.yml`, the audit range
  `base=$(git merge-base origin/main HEAD); "$base..HEAD"` collapses to **`HEAD..HEAD` (empty)** on a
  `push` event to `main` (the pushed commit *is* `origin/main`), so the audit passes without
  inspecting the pushed commit. Masked today only because branch protection blocks direct pushes to
  `main` — but that is unverified and this is a latent hole. **Fix:** on a `push` event use the
  event's real range (`github.event.before..github.sha`); and **fail closed if the computed range is
  empty on a push to the default branch** (never pass an empty range vacuously). Keep the merge-base
  logic for PR events.
- **T2. Self-modifying enforcement (GPT Critical #1 — the deepest finding).** CI checks out the PR
  branch and runs **that branch's** copy of the classifier / auditor / `receipt-check` / manifest /
  `ci.yml`. So a single PR can weaken the judge and have the weakened judge approve itself; tagging
  those files T0 does **not** help because the modified auditor is what runs. **Fix (partial, real):**
  have the CI audit run the governor scripts + libs + manifest fetched from **`origin/main`** (the
  trusted base), not the PR checkout — so a PR is judged by the version it has not touched (an
  *improvement* to the governor only takes effect after it has itself been merged, judged by the
  prior trusted copy). **This is a genuine trust-model decision — it likely warrants its own ADR
  (ADR-0008) or an amendment to ADR-0007.** Honest limit: in a single-owner repo where the owner
  holds admin, this can never be *fully* closed; the goal is to make self-weakening require getting
  past `main`'s copy of the auditor AND (owner-side) a review gate.
- **T3. Hooks fail open when `pwsh` is missing (GPT #6).** `.githooks/pre-commit` and `commit-msg`
  are `command -v pwsh`-guarded; with no PowerShell the gate **silently skips** and the commit
  proceeds — a supposedly always-on gate that vanishes. **Fix:** in `pre-commit`, if `pwsh` is
  missing but crucial (would-be-T0/T1) changes are staged, **fail closed (block)** with a clear
  message, rather than skip. (Windows-first, so pwsh is normally present; this closes the
  cross-platform / stripped-environment fail-open.)

### Owner-side (GitHub settings — only the owner can do these; NOT code)
- **O1. Confirm branch protection on `main` is ON and required** (blocks direct push, requires the
  `test` check + PR, and — ideally — disallows admin bypass). The whole "un-bypassable backstop"
  claim rests on this. Until the system can self-verify it (optional ADR-0006 piece #1), it is an
  owner-confirmed assumption, and must be worded that way.
- **O2. Add required review on the governor files** (CODEOWNERS / ruleset on `scripts/classify-stakes.ps1`,
  `scripts/run-governance-gate.ps1`, `scripts/audit-verification-trailers.ps1`,
  `scripts/emit-verification-trailer.ps1`, `scripts/lib/*`, `.cockpit/state/stakes-manifest.json`,
  `.github/workflows/ci.yml`). This is the other half of the T2 defense: a human must approve any
  change to the judge. Without it, T2's code fix (judge-from-main) is necessary but not sufficient.

---

## What is NOT a defect (accepted residue — do not "fix" with machinery)
GPT confirmed these are disclosed honestly; leave them accepted, just fix the wording that overstates.
- **Fabricated PASS is accepted** (owner-accepted 2026-07-15, ADR-0007). Irreducible
  worker-attestation: the receipt is transient by design, so nothing durable exists for the audit to
  check beyond binding. Signing = over-governance; a committed receipt file = equally forgeable.
  Mitigations that DO hold: a forged PASS still must pass every CI test and leaves a permanent,
  name-attributable false claim in history. Belongs on the future residual-risk billboard.
- **Path-granularity stakes gaming** (risky code in a low-tier file): §6.1 residue — "start at file
  granularity, go finer only if a real miss proves it." Not built on speculation.
- **Bypass authorization is an unauthenticated assertion** (`authorized_by: owner` is worker-written):
  the ledger proves *disclosure*, not authorization — same worker-attestation class as forged PASS.
- **Merge-only changes unaudited** (`--no-merges` skips merge commits): fine for clean PR merges;
  conflict-resolution content introduced *only* in a merge commit is not audited. Low practical risk;
  note it, don't over-build.
- **Fresh-clone hooks + `npm install`:** GPT said it "found no mechanism" to activate the hooks on a
  fresh clone — **factually there is one**: `app/tools/install-git-hooks.js` runs on `npm install`
  (postinstall) and sets `core.hooksPath=.githooks`. GPT could not see it (can't run npm). BUT its
  underlying point stands: that is *install-time*, not *clone-time* — a fresh clone that commits
  before `npm install` has no hooks. Keep the honest caveat; CI + branch protection are the real net.

---

## The metric, re-framed honestly (per GPT)
The audit measures **valid, durable, diff-bound *attestation* coverage** — NOT that independent
verification truthfully occurred. Re-measured 2026-07-15: of the last 25 non-merge commits, 16 are
T0/T1; 1 carries a valid durable trailer (`6a09fbd`, the trailer slice itself), 15 are pre-mechanism
(expected, not a regression). Rolling coverage moved ~0% → ~5% (one self-referential commit — real
but statistically trivial). The genuine change is **structural + forward-looking**: from here, a
T0/T1 commit cannot merge via PR without a valid attestation, *provided* O1/O2 hold and T1/T2 are
fixed. Do not present attestation coverage as proof that verification happened.

---

## Pointers (ground truth for the next chat)
- Decisions: `docs/adr/0006-*.md` (gate), `docs/adr/0007-*.md` (trailer). A new **ADR-0008** (or an
  0007 amendment) is likely needed for T2 (judge-from-main trust model).
- Specs: `docs/specs/governor-gate.md`, `docs/specs/verification-trailer.md` (write
  `docs/specs/governance-hardening.md` for this slice).
- Code: `scripts/{classify-stakes,run-governance-gate,write-verification-receipt,emit-verification-trailer,audit-verification-trailers}.ps1`,
  `scripts/lib/{change-identity,receipt-check}.ps1`, `.githooks/{pre-commit,commit-msg}`,
  `.github/workflows/ci.yml`, `.cockpit/state/{stakes-manifest,governance-gate-exceptions}.json`,
  `schemas/verification-receipt.schema.json`.
- Tests: `app/tests/scripts/{classify-stakes,governance-gate,verification-trailer}.spec.js`.
- Original goals to re-measure against: `docs/proposals/governance-standardization.md` §0, §6, §9.
- Full GPT review text lives in the originating chat transcript (PCC chat mirror,
  `.cockpit/chats/`); its findings are captured in full above so the raw text is not required.

## Known workflow gotchas (save the next chat the pain)
- `codex exec --sandbox read-only` **cannot run the guarded suite** (the guard writes an evidence log
  → Access denied). Scope Codex to **code review**; CI does execution (DECISION-105). Do not ask it
  to "run the tests."
- The **`Monitor` tool is not in the owner's allowlist** (only Bash/PowerShell/Read/Edit/Write/Glob/
  Grep are) → every call prompts the owner. Background commands **self-notify** on completion — just
  launch with `run_in_background` and wait; poll external state (CI) with a backgrounded **Bash**
  loop (Bash IS allowlisted). Do NOT use Monitor to wait on background jobs.
- PowerShell `"$(git show ...)"` **collapses multi-line output to one space-joined line** (this broke
  trailer parsing once) → use `(& git ...) -join "\n"`.
- The full guarded scripts suite takes ~7–9 min; **do not run two at once** (they contend on the
  guard's evidence-log lock). Clear stray `node`/`pwsh` between runs.
- PowerShell variables are **case-insensitive** — don't name an internal var the same as a `[string]`
  param (a `$Deleted`/`$deleted` collision once broke the classifier).
