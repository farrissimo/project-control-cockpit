# Audit grid — Multi-project scaffolding & parity   (ADR-0009 category; status: done)

**Scope:** the promise that **what PCC gets, every spawned project gets** (DECISION-113 parity;
DECISION-106 "born bulletproof-by-default") — that a new project is born with the full assurance kit, not a
hand-picked subset that silently drifts. Graded against the integrity contract Part 1 and the ADR-0009
yardstick (esp. #10 parity). Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** read the real scaffolder (`scripts/bootstrap-project.ps1`)
and its contract test (`scaffold-kit.spec.js`), and probed the failure mode this category exists to catch —
**silent drift**, where a new engine file or app-read config is added to PCC but never travels, leaving a
spawned project with a dead button or a detector reading "unknown." **Verdict: tested, holds** — parity is
enforced by *derived* anti-drift guards, not a hand-maintained list, which is the strong form.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Whole-engine copy, not a subset** — `scripts/`, `schemas/`, `.github/`, `.githooks/` are copied wholesale, so future scripts/guardrails travel automatically | machinery-enforced | `bootstrap-project.ps1` §2; **DECISION-106** records the exact past drift this fixed (CI workflow, pre-commit gate, app-invoked scripts had silently not travelled) | No list to maintain → future engine files can't be forgotten | wholesale copy is broad by design; child config is then re-scoped (below) so it doesn't scan PCC's own engine as the product |
| **Anti-drift guard: every app-invoked *script* travels** — derived from `main.js`, not hand-listed | machinery-enforced | `scaffold-kit.spec.js` *"every script the app invokes travels into a new project"* — **re-run green this session** (34/34) | A future missing script fails the build, not ships a dead button | derivation is regex-over-`main.js`; a script invoked via an unusual pattern could evade the regex (low: the common `scripts/x.ps1` shape is matched, sanity-asserted `>5`) |
| **Anti-drift guard: every app-read *state config* travels** (or is explicitly excused as runtime) — derived from `main.js` | machinery-enforced | `scaffold-kit.spec.js` *"every state config the app reads is born..."* — green this session; documents the 3 runtime-OK exceptions | A future declared config can't silently skip the scaffolder the way `models.json`/`backup-policy.json` once did | same regex-derivation caveat; explicit RUNTIME_OK allowlist is small + documented |
| **Config is re-scoped per project, never PCC's leaking in** — fresh `vision-promises.json` (placeholder, needs owner review), product-scoped bloat config, coherent `pcc-baseline` drift baseline, generic starter phase-manifest | machinery-enforced | `scaffold-kit.spec.js`: fresh vision-promises (no PCC ids leak), product-scoped bloat excludes copied engine, generic phase-manifest (`phase.id != trust-signoff`), engine-version stamped current — all green this session | A new project's detectors/overview reflect *its* product, not PCC's — no false drift/bloat on day one | none material — each re-scoping has a dedicated assertion |
| **A fresh scaffold is healthy on day one** — passes its own `doctor.ps1` with zero `[ISSUE]` | machinery-enforced | `scaffold-kit.spec.js` *"a freshly-scaffolded project passes doctor with no ISSUEs"* — green this session | The owner opens a new project to a clean bill of health, not "4 issues, don't trust this" | warnings (e.g. no git upstream) are allowed — correct |
| **Communication-contracts parity** — milestone + verification-request machinery AND the contract docs travel; inherited generator computes a real % against a seeded starter manifest | machinery-enforced | `scaffold-kit.spec.js`: contract docs born + generator computes 0% (not UNKNOWN) against the seeded manifest — green this session | A spawned project inherits the comms standard + working tools, not tools without the standard | channel-6 start-off measurement deferred (disclosed in the comms grid), not a scaffolder gap |
| **`.gitignore` (incl. the new secrets block) travels** — `bootstrap-project.ps1` copies `.gitignore`, so the privacy fix from this session's paired probe is inherited by every child | machinery-enforced (copy) | `bootstrap-project.ps1` §3 `Copy-File '.gitignore'` | Every spawned project is born with real secret-leak protection, not just PCC | **not asserted by a test** — `scaffold-kit.spec.js` checks many born files but not `.gitignore` contents. Low consequence (deterministic copy); noted as a cheap future assertion, not built now |

## Probed, not built (judged, disclosed)
- **Parity is proven at *birth*, not for *upgrades* of already-spawned projects.** `engine-version.json` +
  DECISION-111 upgrade detection flag an out-of-date child, but PCC does not auto-push engine updates into
  existing projects (the owner re-scaffolds/updates deliberately). Correct for reversibility; the ADR-0009
  gate (b) spawned-project qualification is where end-to-end parity is *proven live*, not just at file-copy
  level. Noted, not built.
- **The `.gitignore` content isn't test-pinned in the child.** A one-line addition to `scaffold-kit.spec.js`
  (assert the child's `.gitignore` ignores `.env`) would close the only untested link in this grid. It moves
  a small number and is genuinely cheap — flagged as a recommended follow-up (owner's call whether it clears
  the bar), not built in this probe to respect the "STOP and report" boundary.

## Verdict against the integrity contract
Scaffolding & parity is **strong and tested-holds.** The defining risk — silent drift of the assurance kit —
is defended by **derived** anti-drift guards (scripts + state configs read from `main.js`, not a hand list),
so a forgotten future file fails the build rather than shipping a dead feature. Every born-file, re-scoping,
and health assertion was **re-run green this session (34/34)**. The one untested link (`.gitignore` content
in the child) is disclosed with a cheap recommended fix. **Recorded strong; no consequential control built** —
the expected outcome. The session's actual fix (secrets in `.gitignore`) rides this category's copy path into
every child automatically, which is parity working as designed.
