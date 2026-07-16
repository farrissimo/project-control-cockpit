# Audit grid — Requirements / intent & acceptance correctness   (ADR-0009 category; status: done)

**Scope:** how PCC ensures built work matches the owner's *actual intent* — not just "the tests pass." The
chain is intent → spec → acceptance criteria → tests → "done." Graded against the integrity contract Part 1
and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped the full chain — the spec standard (`docs/specs/README.md`,
EARS form), the "every acceptance criterion needs a passing test" rule, the lifecycle stages, and every place
`docs/specs` is referenced in `scripts/`/`.github/`. Then checked whether the enforced machinery is bound to
the owner's acceptance criteria. **Verdict: the prose-only state is a *deliberate, owner-approved decision*
(ADR-0003), so this is an accepted-residue — not a gap to fix.** Building a spec-enforcement gate would
re-litigate a recorded decision AND be the exact over-governance the project rejects.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Lean feature-spec shape** (one-screen Objective / Behavior / EARS acceptance criteria per feature) | **prose-only, by deliberate decision** | `docs/specs/README.md` + **ADR-0003 (Accepted)**; 7 real specs exist and follow the form (`governor-gate.md`, `verification-trailer.md`, etc.) | Intent is stated + checkable before code, without a heavy pipeline | writing a spec is **not enforced** — no `check-spec.ps1`, no hook/CI step (contrast ADRs, which `check-adr.ps1` gates). **This is intentional** (ADR-0003: "kept lean by rule, not enforced by machinery... if it ever ossifies into ceremony, cut it") |
| **"Every acceptance criterion needs a passing test"** — the one load-bearing rule | **prose-only** | `docs/specs/README.md`; each spec's `## Tests` block maps AC→test **by hand** | The right-thing/built-right link is written down per feature | nothing parses a spec or verifies the AC→test mapping is real; a worker could skip it with zero mechanical signal |
| **Lifecycle define→plan→work** (record goal/scope/task before building) | **prose-only** (descriptive exit-criteria, no gate) | `.cockpit/state/lifecycle-model.json` — the **only** `entry_gate` in the whole model is `phase_close: fresh_verification_pass`; `lifecycle-advance.ps1` gates only that transition (verified live) | A legible stage map with a "you are here" | `define→plan→work` advance with **nothing recorded**; a soft non-blocking vision-promises advisory is the only intent touch |
| **Enforced "done" = fresh independent PASS bound to the diff** | machinery-enforced | `lifecycle-advance.ps1` phase-close gate + governance receipt/trailer + CI audit (tested: `lifecycle-advance.spec.js`, `governance-gate.spec.js`, `verification-trailer.spec.js`) | No "done" without fresh execution proof of *this exact diff* | it proves **"is there fresh execution proof of this diff?"** — never **"does this diff satisfy the owner's acceptance criteria?"** (see the residue below) |

## The residual risk — named for the owner's active acceptance (ADR-0009 gate a)
**A worker can build the wrong thing and pass every automated gate as "done."** The enforced machinery
(receipt / trailer / phase-close gate) verifies execution proof bound to a `diff_id`; it never checks the diff
against a recorded requirement. A worker can skip the spec entirely, advance `define→plan→work` with nothing
written, build a feature that misreads intent, produce an honest PASS receipt for that diff, and legally reach
`phase_close` — all green. This is the classic "tests pass ≠ built the right thing."

**Why this is accepted-residue, not a build:**
1. **It's a recorded decision.** ADR-0003 (Accepted, owner-approved 2026-07-14) deliberately took the lean
   essence and rejected a spec→design→tasks pipeline as "exactly the trap that burned CCB." Building an
   AC-coverage gate would re-litigate it and be the over-governance yardstick #2 forbids.
2. **The backstop is human by design, and PCC is built around it.** "Was it the RIGHT thing?" is the one
   question ADR-0003 says only the owner can own. The intended controls are the **independent verifier judging
   intent** (AGENTS.md), the **owner as product lead** judging outcomes, and — decisively — **ADR-0009 gate (b)**,
   the live adversarial build where a real feature is built through the governed loop and *used*. Those are the
   requirement-correctness proof; machinery is not.

Minor honesty note (not a defect): ADR-0003's Consequences says ACs "map 1:1 to tests, so 'the right thing'
and 'built right' both get proof" — the mapping is hand-authored, not machine-verified. ADR-0003 discloses this
itself ("not enforced by machinery"), so it is self-consistent; recorded, not fixed.

## Verdict against the integrity contract
The intent→acceptance chain is **prose by deliberate, recorded decision (ADR-0003)**, with the enforced "done"
gate bound to execution proof rather than to the owner's criteria. That leaves a real residual risk — *a worker
can satisfy every automated gate while building the wrong thing* — which is **owner-side by design** and closed
only by human judgment + ADR-0009 gate (b), not machinery. **No control built** (building one would re-litigate
ADR-0003 and add the over-governance this phase exists to avoid). The residue is surfaced here for the owner's
**active acceptance** at sign-off.
