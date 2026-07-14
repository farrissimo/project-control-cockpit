---
status: Accepted
date: 2026-07-14
deciders: owner (approved via proven tools), Claude (worker)
---

# ADR-0002: ESLint no-undef as the hallucination tripwire; TypeScript check-JS deferred

## Context and Problem

PCC is 91 files of plain JavaScript with NO linter or type-checking, so a hallucinated
reference (a call to a function/method/variable that doesn't exist) only failed if a test
happened to run that exact line — otherwise it sat silently until runtime. This is the
"silent bug the owner would never see" (External Candidate #4). The fix was to reuse proven
tools, not build a custom AST parser.

## Decision

Adopt **ESLint with `no-undef`** as a deterministic catch for undefined references — the
core hallucination class — via a minimal flat config (`app/eslint.config.js`) scoped to that
rule only (not a style ruleset). Gate it in CI (`npm run lint`) and expose it locally as
`npm run lint`. **Defer TypeScript check-JS mode**: on 91 untyped files it would drown real
"cannot find name / property does not exist" hallucinations in hundreds of implicit-any type
warnings; it needs its own tuning pass and delivers less marginal value than no-undef, which
already covers the undefined-reference class. TypeScript is installed (devDep) so that
follow-on is ready when it earns priority.

## Consequences

- Gain: a clean tripwire — any FUTURE genuinely-undefined reference fails CI, cheaply.
- Give up: check-JS's deeper method/param hallucination catching, deferred (honestly flagged,
  not silently dropped). Three new devDeps (eslint, globals, typescript).
- The baseline was already clean (see Confirmation), so this catches new bugs, not old ones.

## Confirmation

- First run surfaced only **5 issues, all false positives** (cross-file renderer globals
  `PCCOverview`/`PCCVerification`, and an `activeChat()` reference inside a Playwright
  `page.evaluate()` browser context) — **zero real undefined-reference bugs**. Handled by
  declaring the two real globals in the config and one localized, commented eslint-disable;
  `npm run lint` now exits 0.
- **Caught and fixed a real CI bug in ADR-0000's work while wiring this**: the CI job defaults
  to `working-directory: app`, so the repo-root ADR validator step resolved to the wrong
  directory and would have hard-failed CI on the next push. Fixed with an explicit
  `working-directory: ${{ github.workspace }}` on that step; proven by running the script from
  `app/` (pwsh exit 64) vs root (PASS).
- No runtime/app code touched (only an eslint config, a package.json script + devDeps, and a
  comment in one spec), so the test suite is unaffected by construction; CI runs it on push.

## Engagement

- Claude worker / Codex verifier / other tools: `npm run lint` is in the AGENTS.md command table.
- CI: `Lint (no-undef hallucination check)` step is a hard gate; the ADR step's working-directory
  is fixed so that gate is real again.
- Future chats: the check runs automatically in CI; config lives at `app/eslint.config.js`.
- Spawned projects: the scaffolder will seed the eslint config + lint script (with DECISION-116
  Track 3 scaffolder work).

## Supersedes / Related

Related: External Candidate #4 (AST hallucination check), ADR-0000 (whose CI step this fixes),
`docs/PROJECT_DNA.md` Lane 15 (generated-artifact safety), DECISION-117 (rollout discipline).
