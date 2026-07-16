# Audit grid — Testing & assurance   (ADR-0009 category; status: done)

**Scope:** is PCC's own test suite **honest**, or could it be quietly faking green? Everything downstream —
the release gate, "done", the sign-off meter — rests on the tests being real. Graded against the integrity
contract Part 1 and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** searched the entire source test tree (~70 spec/test files,
~597 test blocks) for every faking pattern — `test.skip`/`.only`/`.fixme`/`xit`/`fit`/`.todo`, commented-out
tests, assertion-free tests, always-pass literals, and swallowed assertions — and audited whether CI actually
runs the full suite and whether the guard can launder a hang/abort into green. **Verdict: tested, holds. No
dishonest test found; CI runs the full suite; the guard cannot fake a pass.** No control built.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **No skipped / `.only` / empty / always-pass tests** | machinery-enforced (honest by construction) | independent grep of `app/tests/**`: **0 hits** for `test.only/skip/fixme`, `xit`, `fit`, `.todo`, commented `test(`; every file has real `expect`/`assert` (the `toBeTruthy()` calls assert load-bearing values, never literals) | The suite can't silently disable itself (a `.only` would hide every sibling test) | eslint has no rule *banning* `.only` — currently enforced by absence + review, not a lint gate (low: 0 present, and CI would still run the file) |
| **CI runs the FULL suite** (unit + guarded e2e + scripts + lint + audit) | machinery-enforced | `.github/workflows/ci.yml`: `npm run test:unit` (node:test data-integrity units) **and** `npm test` (guarded Playwright e2e + scripts), plus `npm run lint` + `npm audit --audit-level=high`; `run-unit.js` **fails closed** if it finds zero `*.test.js` ("refusing to report success") | No gap between "npm test" and what CI executes; both test layers run clean-room | `app/tests/external/` real-boundary smoke is intentionally CI-excluded (opt-in `npm run test:external-smoke`) — documented, not deception |
| **The guard can't fake a pass** — hang→exit 3, cap→exit 4, nonzero→exit 1, unreadable exit → `failed` | machinery-enforced | `run-guarded.ps1` ("unreadable exit code is NEVER treated as success"); `guarded-test.js` propagates verbatim; a missing guard runs **loudly unguarded**, never a silent green | A hung/aborted run can never read as green (the "looks alive" incident class) | tested itself (`guarded.spec.js`: nonzero→FAILED, no-progress→HUNG/ABORTED, canonical `npm test` can't bypass the guard) |
| **Assurance proofs classify honestly** — mutation + failure-injection refuse to launder a harness error into success | machinery-enforced (logic) + evidence-leaving (on-demand) | `run-mutation-proof.ps1` (KILLED requires killed==count & survived==0 & invalid==0; a crash/timeout/syntax-break → INVALID, never KILLED); `run-failure-injection.ps1` (allSafe requires 0 EXPOSED & 0 INVALID); both classifiers CI-tested (`mutation-proof.spec.js`, `failure-injection.spec.js`) | The deepest "are the tests real" evidence can't fake a kill/containment | **the proofs run on-demand / at the release gate, NOT per-push CI** — already a disclosed accepted-residue (see below) |
| **Static hallucination check** — eslint `no-undef` | machinery-enforced | `npm run lint` in CI before the suite | Catches calls to functions that don't exist | — |

## Disclosed residue (already recorded — cross-reference, not re-litigated)
The mutation proof and failure-injection proof are **on-demand / release-gate, not per-push CI**. This is the
**same accepted-residue already disclosed** in `docs/audit/state-data-integrity.md` (their underlying guarantees
are separately CI-covered by the unit/contract tests, so it's redundancy-of-proof, not an unproven guarantee).
The standing recommendation (a non-gating nightly CI job) remains the owner's call. Not re-decided here.

## Verdict against the integrity contract
Testing & assurance is **strong and tested-holds.** No dishonest test exists in the source tree; CI genuinely
runs the full unit + guarded-e2e + scripts suite plus lint and audit; the guard provably cannot turn a hang or
abort into a green; and the assurance proofs refuse to count a crash as a kill/containment. The only scope note
(proofs on-demand, external smoke CI-excluded) is disclosed, not deception. **No control built** — the expected,
most-common outcome.
