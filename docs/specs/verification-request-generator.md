# Verification-request generator — structure→machinery for channels 3 & 4   (status: active)

> Implements **channel 3 (worker→Codex verification request)** and **channel 4 (worker→GPT secondary
> verification)** of `docs/specs/communication-contracts.md` (ADR-0009 category 1). Both were "winging-it
> / semi-canonical → to be templated"; this makes the fixed copy blocks real, so they stop being
> hand-crafted every time (they were hand-written three times in a single session).

## Objective
Two verification-request copy blocks recur constantly and were assembled from memory each time. Move
their fixed structure + computed facts into a generator (`scripts/new-verification-request.ps1`, no LLM);
the LLM fills only the judgment slots. Same principle as channel 1.

## Behavior
`scripts/new-verification-request.ps1 -Channel <codex|gpt>` (deterministic, read-only, exits 0):

### `-Channel codex` (channel 3)
Emits the independent-verifier request: fixed role (read-only; do **not** modify; do **not** run the
guarded suite — CI owns execution), the **exact review target** `git diff --cached <Base>` (default
`main`), `Context` + `Judge` slots, and the required `VERDICT / EVIDENCE / NOT PROVEN` output shape.
Also prints the canonical run line piped `< /dev/null` (Codex blocks on open stdin).

### `-Channel gpt` (channel 4)
Emits the secondary-verification copy block for the owner to paste into ChatGPT:
- The **remote web URL** computed from `origin` (`.git` stripped; `git@` → `https://`) and the **pushed
  ref** (short HEAD sha + branch). GPT reads GitHub, so:
- **Push guard:** if HEAD is on no remote branch, it warns LOUD ("PUSH FIRST … or GPT reads stale/absent
  code") — never silently emits a block against unpushed code.
- **Trigger discipline:** secondary verification fires **only** when the ADR-0009 trigger applies. If
  `-TriggerReason` is omitted, the block carries a fill-slot **and** a warning that the trigger must be
  stated or the block not sent — surfacing the discipline rather than firing by reflex.
- `Context` + numbered `Judge` (confirm) slots, and the required output shape.

`-Json` emits `{ schema, channel, base, run_line, warnings, not_proven, text }` for tests and callers.

## Acceptance criteria
- **AC-1 (codex shape):** WHEN `-Channel codex` THE SYSTEM SHALL emit the read-only role, the review
  target `git diff --cached <Base>`, and the `VERDICT/EVIDENCE/NOT PROVEN` output shape, with a run line
  piped `< /dev/null`.
- **AC-2 (codex base):** WHEN `-Base <ref>` is given THE SYSTEM SHALL use `git diff --cached <ref>` as the
  review target.
- **AC-3 (gpt shape):** WHEN `-Channel gpt` THE SYSTEM SHALL emit the computed remote repo URL, the HEAD
  ref, and the required output shape.
- **AC-4 (gpt push guard):** WHEN HEAD is on no remote branch THE SYSTEM SHALL warn that it must be pushed
  first (or the diff inlined) — never silently produce a block against unpushed code.
- **AC-5 (gpt trigger discipline):** WHEN `-TriggerReason` is omitted THE SYSTEM SHALL warn that the
  ADR-0009 trigger must be stated; WHEN it is given THE SYSTEM SHALL include it and not warn.
- **AC-6 (judgment slots surfaced):** WHEN `Context`/`Judge` are omitted THE SYSTEM SHALL emit explicit
  `<<fill: …>>` placeholders.

## Non-goals
- Deciding *whether* the GPT trigger applies (judgment) — the generator surfaces + records the reason,
  it does not adjudicate it.
- Enforcing that the worker runs the generator (a later habit/enforcement question).

## Proof
`app/tests/scripts/verification-request.spec.js` runs the generator (`pwsh -File … -Json`) and asserts
AC-1, AC-2, AC-3, AC-5, AC-6, plus the contract shape and ValidateSet rejection. **AC-4 (push guard)** is
proven by a **live pre-push check** recorded in this slice's PR — right after the local commit, HEAD is
genuinely on no remote branch and the generator warns "PUSH FIRST." It is not an isolated unit test on
purpose: forcing an unpushed HEAD inside a test would require mutating the repo's git state, which the
project forbids (tests must never touch real state). This is the honest proof method, not a skipped AC.
