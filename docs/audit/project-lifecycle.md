# Audit grid — Project lifecycle   (ADR-0009 category; status: done)

**Scope:** the standardized stage map (define→plan→work→verify→phase_close→milestone→handoff→rollover) with a
"you are here" pin, only-legal-next-steps, and phase-close gated on a fresh independent PASS. Graded against the
integrity contract Part 1 and the ADR-0009 yardstick. Columns: `docs/audit/README.md`.

**Method (probe freely, standardize rarely):** mapped the model, the advance gate (`lifecycle-advance.ps1`), the
status reader, the app wiring, and the 18-test spec — probing specifically whether a stale/self-authored PASS can
satisfy the phase-close gate. **Verdict: tested, holds.** The gate machinery is tightly specified and heavily
tested; the one weakness (a forgeable PASS file) is the *same* owner-accepted forged-PASS / origin-seam residue
already established in the governance arc. No control built.

## Grid

| Practice | State | Proof | Benefit | Gaps |
|---|---|---|---|---|
| **Legal-transition enforcement** (target must be in the current stage's `next`) | machinery-enforced | `lifecycle-advance.ps1` (unknown → `unknown_stage`; not-in-next → `illegal_transition`); `lifecycle-advance.spec.js` (illegal `verify→milestone` blocked) | The pin never moves outside the model | — |
| **Phase-close fresh-PASS gate** (structured `VERDICT:`/`TYPE:`, freshness, execution-proof policy) | machinery-enforced | `lifecycle-advance.ps1`: rejects prose "PASS", untyped PASS, FAIL/INSUFFICIENT; **freshness fails CLOSED** on git failure (a git-timestamp failure no longer defeats staleness); executable phase closes only on `local_execution`; `ci_execution`/`live_boundary` **explicitly rejected from the file** (forgery surface). Pinned by `lifecycle-advance.spec.js` (18) | No "done" without a fresh, typed, execution-backed PASS | trusts one hand-editable file — see residue |
| **Honest status reader** | machinery-enforced | `lifecycle-status.ps1` (read-only, always exit 0): bad/absent pin → `unknown` "not in the model", never a fabricated stage | The "you are here" pin never misreports a wrong stage as valid | — |
| **App wiring is fail-closed** | machinery-enforced | `main.js` `pcc:lifecycleAdvance`: stage-id regex-validated, no-shell `execFile`, mutex-serialized, project-switch → `project_changed`; renderer offers **only legal `next` transitions**; any non-`ok`/crash reads as "could not advance" (never moves the pin) | An illegal transition isn't reachable or forceable from the UI; a crash never advances | — |
| **Atomic pin write** (`.prev` retained) + `phase_kind` reset on entering `work` | machinery-enforced | `lifecycle-advance.spec.js` (atomic write + `.prev`; new work phase resets `phase_kind→executable`) | The pin can't tear; a stale review-phase flag can't linger into new work | — |

## Disclosed residues (probed, judged — not built)
- **Forgeable PASS file = the already-accepted forged-PASS / origin-seam residue.** The gate's trust root is
  `app/last-verification.txt`, an **unsigned, hand-editable** text file whose "freshness" is just its filesystem
  mtime. A well-formed `TYPE: local_execution` / `VERDICT: PASS` — forged by hand, or written by the same worker
  it's meant to check — clears the gate; "independent" is asserted, not proven. **This is the same residue the
  governance arc already owner-accepted** (forged PASS is irreducible worker-attestation; the code names the
  "ORIGIN SEAM"). Signing/provenance the file = over-governance for a cooperative-worker model (consistent with
  the ADR-0007/0008 forged-PASS acceptance). The gate correctly minimizes the surface to exactly one file-trusted
  type and rejects the two it can't trust. **No build**; named for owner acceptance. The real server-side proof
  remains CI + branch protection (bypass-evidence grid), not this local file.
- **Minor test-coverage note (not a break):** the freshness comparison is tested for the git-*unknown* fail-closed
  path but not for ordinary staleness (a `local_execution` PASS older than HEAD, git working). The behavior is
  correct (`$fresh = $headKnown -and ($fileEpoch -ge $headEpoch)`) and the gate is otherwise 18-spec-tested; a
  single stale-PASS test would close the last uncovered branch. Recommended as a cheap follow-up, not built (the
  gate's trust-root behavior is already well-proven; this is coverage, not a defect).

## Verdict against the integrity contract
The lifecycle is **strong and tested-holds** — the transition graph and gate are tightly specified and heavily
tested (18 specs, including two subtle regressions now fail-closed: prose-"PASS" and git-failure-false-fresh),
the status reader degrades honestly, and the app layer is genuinely fail-closed (illegal transitions unreachable,
crashes never advance the pin). The one load-bearing weakness (a forgeable local verification file) is the same
forged-PASS residue already owner-accepted, disclosed here for the lifecycle surface. **No control built** — the
expected outcome.
